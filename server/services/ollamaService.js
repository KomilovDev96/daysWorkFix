const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

const SYSTEM_PROMPT = `Ты — извлекатель данных из коротких рабочих сообщений на русском/узбекском/английском.
Получив свободный текст о задаче (выполненной ИЛИ запланированной), верни СТРОГО валидный JSON:
{
  "title": string,                  // краткое название задачи (до 80 символов)
  "description": string|null,       // подробности, если есть; иначе null
  "hours": number,                  // время в часах (десятичное); 0 если не указано
  "customer": string|null,          // имя/название заказчика; иначе null
  "executor": string|null,          // имя исполнителя (если "я"/"сам" — null)
  "project": string|null,           // название проекта/системы/продукта
  "kind": "work" | "external",      // "халтура","левый","со стороны","для друга","калым","side-проект" => "external"; обычная => "work"
  "payment": "paid" | "unpaid" | null,
  "amount": number | null,          // "500к"=>500000, "200 000 сум"=>200000, "50$"=>50
  "currency": "UZS" | "USD" | "RUB" | null,
  "date": string|null,              // дата YYYY-MM-DD (вчера/сегодня/завтра/послезавтра — вычисли от "сегодня"); иначе null
  "status": "completed" | "pending" // "completed" если задача УЖЕ сделана (прошедшее время: сделал/починил/написал/выполнил). "pending" если ЗАПЛАНИРОВАНА на будущее (будущее время или дата позже сегодня: "завтра сделаю","на послезавтра задача","нужно починить","надо сделать","предстоит")
}
Правила:
- Время: "30 минут"=>0.5, "час"=>1, "2 ч 30 мин"=>2.5, "полчаса"=>0.5, "полдня"=>4.
- "к" в конце числа = тысячи.
- Дата: "сегодня"=сегодняшняя, "вчера"=минус 1 день, "завтра"=плюс 1, "послезавтра"=плюс 2.
- Не путай проект (продукт/система) и заказчика (компания/человек).
- Не придумывай данных — ставь null. По умолчанию kind="work", status="completed".
- ТОЛЬКО JSON, никаких пояснений и markdown.`;

async function callOllama({ system, user, format, temperature = 0.1 }) {
    const body = {
        model: OLLAMA_MODEL,
        stream: false,
        options: { temperature },
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
        ],
    };
    if (format) body.format = format;

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Ollama HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    return data?.message?.content ?? '';
}

async function parseTaskMessage(text, { now = new Date() } = {}) {
    if (!text || !text.trim()) {
        throw new Error('Пустое сообщение');
    }

    const todayIso = now.toISOString().slice(0, 10);
    const content = await callOllama({
        system: SYSTEM_PROMPT,
        user: `Сегодня ${todayIso}. Текст: "${text.trim()}"`,
        format: 'json',
    });

    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch {
        const match = content.match(/\{[\s\S]*\}/);
        if (!match) throw new Error(`Не удалось распарсить ответ модели: ${content.slice(0, 200)}`);
        parsed = JSON.parse(match[0]);
    }

    const kind = parsed.kind === 'external' ? 'external' : 'work';
    let payment = parsed.payment === 'paid' ? 'paid'
                : parsed.payment === 'unpaid' ? 'unpaid'
                : null;
    // По умолчанию для внешних задач, если оплата не упомянута — считаем "unpaid"
    if (kind === 'external' && payment === null) payment = 'unpaid';

    const status = parsed.status === 'pending' ? 'pending' : 'completed';

    return {
        title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
        description: parsed.description ? String(parsed.description).trim() : null,
        hours: Number(parsed.hours) || 0,
        customer: parsed.customer ? String(parsed.customer).trim() : null,
        executor: parsed.executor ? String(parsed.executor).trim() : null,
        project: parsed.project ? String(parsed.project).trim() : null,
        kind,
        payment,
        amount: Number.isFinite(Number(parsed.amount)) ? Number(parsed.amount) : 0,
        currency: ['UZS', 'USD', 'RUB'].includes(parsed.currency) ? parsed.currency : 'UZS',
        date: parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null,
        status,
    };
}

function buildKnowledgeContext(knowledge) {
    if (!knowledge) return '';
    const lines = [
        `Проект: ${knowledge.projectName || 'DaysWorkFix'}.`,
        knowledge.about ? `О проекте: ${knowledge.about}` : '',
        knowledge.developer?.name
            ? `Разработчик: ${knowledge.developer.name}${knowledge.developer.role ? ` (${knowledge.developer.role})` : ''}${knowledge.developer.site ? `, сайт ${knowledge.developer.site}` : ''}.`
            : '',
        knowledge.createdAt ? `Создан: ${knowledge.createdAt}.` : '',
        knowledge.features?.length
            ? `Возможности:\n- ${knowledge.features.join('\n- ')}`
            : '',
    ].filter(Boolean);
    return lines.join('\n');
}

const QA_SYSTEM_PROMPT_BASE = `Ты — дружелюбный ассистент проекта. Отвечай КОРОТКО и по делу (1-5 предложений), на русском, опираясь ТОЛЬКО на предоставленный контекст.
Если в контексте нет ответа — честно скажи "В моей базе пока нет этой информации".
Не выдумывай данных. Не используй markdown — обычный текст.`;

const ROLE_HINTS = {
    admin:          'Ты разговариваешь с СУПЕР-АДМИНОМ — у него есть доступ ко всей команде и задачам. Можешь свободно обсуждать сотрудников, менеджеров, их загрузку.',
    projectManager: 'Ты разговариваешь с МЕНЕДЖЕРОМ ПРОЕКТОВ — он видит свою команду и задачи. Можешь рассказывать о его задачах и исполнителях.',
    worker:         'Ты разговариваешь с СОТРУДНИКОМ — отвечай только про проект в целом, не раскрывай данные других сотрудников.',
    guest:          'Ты разговариваешь с ГОСТЕМ — отвечай только общую публичную информацию о проекте.',
};

async function answerQuestion(text, { knowledge, teamContext, role = 'worker', userName } = {}) {
    if (!text || !text.trim()) throw new Error('Пустой вопрос');

    const roleHint = ROLE_HINTS[role] || ROLE_HINTS.worker;
    const system = `${QA_SYSTEM_PROMPT_BASE}\n\n${roleHint}`;

    const contextParts = [
        knowledge ? `=== О проекте ===\n${buildKnowledgeContext(knowledge)}` : '',
        teamContext ? `=== Команда и задачи ===\n${teamContext}` : '',
    ].filter(Boolean);

    const userMsg = [
        contextParts.join('\n\n'),
        userName ? `\nПользователь: ${userName} (${role}).` : '',
        `\nВопрос: ${text.trim()}`,
    ].filter(Boolean).join('\n');

    const answer = await callOllama({
        system,
        user: userMsg,
        temperature: 0.3,
    });
    return (answer || '').trim();
}

const REMINDER_SYSTEM_PROMPT = `Ты — извлекатель напоминаний из коротких сообщений на русском/узбекском/английском.
Получив текст «напомни мне …», верни СТРОГО валидный JSON:
{
  "text":   string,    // ЧТО напомнить (без слов «напомни мне»/«напомни про»). Кратко, до 100 символов.
  "fireAt": string     // КОГДА — точная дата+время в ISO 8601 (YYYY-MM-DDTHH:mm:00, локальная зона Asia/Tashkent UTC+5).
                       // Если время не указано — поставь 09:00.
                       // Относительные: «через час» => +1ч, «через 30 минут» => +30мин, «через 2 дня» => +2д.
                       // Дни недели: «в понедельник», «в субботу» — ближайший следующий.
                       // «завтра» => +1 день, «послезавтра» => +2 дня, «сегодня вечером» => сегодня 20:00.
                       // «утром» => 09:00, «днём» => 13:00, «вечером» => 20:00, «ночью» => 23:00.
}
Никаких пояснений, никаких markdown — только JSON.`;

async function parseReminderMessage(text, { now = new Date() } = {}) {
    if (!text || !text.trim()) throw new Error('Пустое сообщение');

    // Подставляем "сейчас" в локальной зоне UTC+5 для модели
    const tzOffsetMs = 5 * 60 * 60 * 1000;
    const local = new Date(now.getTime() + tzOffsetMs);
    const nowIso = local.toISOString().slice(0, 19);

    const content = await callOllama({
        system: REMINDER_SYSTEM_PROMPT,
        user: `Сейчас (Asia/Tashkent): ${nowIso}. Текст: "${text.trim()}"`,
        format: 'json',
    });

    let parsed;
    try { parsed = JSON.parse(content); }
    catch {
        const m = content.match(/\{[\s\S]*\}/);
        if (!m) throw new Error('Не удалось разобрать ответ модели');
        parsed = JSON.parse(m[0]);
    }

    const reminderText = String(parsed.text || '').trim();
    if (!reminderText) throw new Error('Модель не извлекла текст напоминания');

    // fireAt: модель отдаёт локальное время UTC+5; превращаем в UTC Date
    let fireAt = null;
    if (parsed.fireAt && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(parsed.fireAt)) {
        const localDate = new Date(parsed.fireAt.slice(0, 19) + '+05:00');
        if (!Number.isNaN(localDate.getTime())) fireAt = localDate;
    }
    if (!fireAt) throw new Error('Не удалось разобрать время напоминания');

    return { text: reminderText, fireAt };
}

async function healthCheck() {
    try {
        const res = await fetch(`${OLLAMA_URL}/api/tags`);
        if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
        const data = await res.json();
        const models = (data?.models || []).map((m) => m.name);
        return { ok: true, url: OLLAMA_URL, model: OLLAMA_MODEL, available: models, hasModel: models.includes(OLLAMA_MODEL) };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

module.exports = { parseTaskMessage, parseReminderMessage, answerQuestion, healthCheck, OLLAMA_URL, OLLAMA_MODEL };
