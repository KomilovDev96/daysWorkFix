const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

const SYSTEM_PROMPT = `Ты — извлекатель данных из коротких рабочих сообщений на русском/узбекском/английском.
Получив свободный текст о выполненной задаче, верни СТРОГО валидный JSON со следующими полями:
{
  "title": string,                 // краткое название задачи (до 80 символов)
  "description": string|null,      // подробности, если есть; иначе null
  "hours": number,                 // потраченное время в часах (десятичное, напр. 1.5)
  "customer": string|null,         // имя/название заказчика, если упомянут; иначе null
  "executor": string|null,         // имя исполнителя, если упомянут (если "я"/"сам" — оставь null)
  "date": string|null              // дата в формате YYYY-MM-DD, если указана (вчера/сегодня — вычисли); иначе null
}
Правила:
- Время: "30 минут" => 0.5, "час" => 1, "2 ч 30 мин" => 2.5, "полчаса" => 0.5.
- Не придумывай данных, которых нет в тексте — ставь null.
- Никаких пояснений, никаких markdown, ТОЛЬКО JSON-объект.`;

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

    return {
        title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
        description: parsed.description ? String(parsed.description).trim() : null,
        hours: Number(parsed.hours) || 0,
        customer: parsed.customer ? String(parsed.customer).trim() : null,
        executor: parsed.executor ? String(parsed.executor).trim() : null,
        date: parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null,
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

module.exports = { parseTaskMessage, answerQuestion, healthCheck, OLLAMA_URL, OLLAMA_MODEL };
