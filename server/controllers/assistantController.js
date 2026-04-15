const DayLog = require('../models/DayLog');
const Project = require('../models/Project');
const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const LEGACY_HF_BASE_URL = 'https://api-inference.huggingface.co/models/';
const HF_ROUTER_BASE_URL = (process.env.HF_ROUTER_BASE_URL || 'https://router.huggingface.co/hf-inference/models').replace(/\/+$/, '');
const HF_MODEL_ID = process.env.HF_MODEL_ID || 'gpt2';
const HF_CHAT_COMPLETIONS_URL = (process.env.HF_CHAT_COMPLETIONS_URL || 'https://router.huggingface.co/v1/chat/completions').replace(/\/+$/, '');
const HF_CHAT_MODEL = process.env.HF_CHAT_MODEL || 'openai/gpt-oss-120b';
const HF_CHAT_FALLBACK_MODELS = (
    process.env.HF_CHAT_FALLBACK_MODELS
    || 'openai/gpt-oss-120b,Qwen/Qwen3.5-9B,Qwen/Qwen3-4B-Thinking-2507'
)
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);

const isValidDate = (value) => !Number.isNaN(new Date(value).getTime());

const toUtcDateOnly = (value) => {
    const date = new Date(value);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const formatDateKey = (date) => date.toISOString().slice(0, 10);

const resolveRequestedUserId = (req, requestedUserId) => {
    if (req.user.role === 'admin') {
        return requestedUserId || null;
    }

    return req.user.id;
};

const addDays = (date, days) => {
    const result = new Date(date.getTime());
    result.setUTCDate(result.getUTCDate() + days);
    return result;
};

const resolveHfModelUrl = () => {
    const configuredUrl = process.env.HF_MODEL_URL?.trim();

    if (!configuredUrl) {
        return `${HF_ROUTER_BASE_URL}/${HF_MODEL_ID}`;
    }

    if (configuredUrl.startsWith('http://') || configuredUrl.startsWith('https://')) {
        if (configuredUrl.startsWith(LEGACY_HF_BASE_URL)) {
            const modelId = configuredUrl.slice(LEGACY_HF_BASE_URL.length);
            return `${HF_ROUTER_BASE_URL}/${modelId}`;
        }

        return configuredUrl;
    }

    return `${HF_ROUTER_BASE_URL}/${configuredUrl}`;
};

const buildAuthErrorIfNeeded = (providerMessage) => {
    const normalizedMessage = String(providerMessage || '').toLowerCase();

    if (
        normalizedMessage.includes('sufficient permissions')
        || normalizedMessage.includes('inference providers')
    ) {
        return new AppError(
            'HuggingFace token has insufficient permissions. Create a new token with "Inference Providers" permission and set it to HF_API_TOKEN.',
            403
        );
    }

    return null;
};

const isModelRoutingError = (providerMessage) => {
    const normalizedMessage = String(providerMessage || '').toLowerCase();
    return (
        normalizedMessage.includes('model_not_supported')
        || normalizedMessage.includes('not supported by any provider')
        || normalizedMessage.includes('not found')
    );
};

const parseJsonSafe = async (response) => {
    try {
        return await response.json();
    } catch {
        return null;
    }
};

const extractChatCompletionText = (payload) => {
    const message = payload?.choices?.[0]?.message;
    if (!message) return null;

    if (typeof message.content === 'string' && message.content.trim()) {
        return message.content;
    }

    if (typeof message.reasoning === 'string' && message.reasoning.trim()) {
        return message.reasoning;
    }

    return null;
};

const extractGeneratedText = (payload) => {
    if (!payload) return null;

    if (Array.isArray(payload)) {
        return payload[0]?.generated_text || payload[0]?.summary_text || null;
    }

    if (typeof payload.generated_text === 'string') {
        return payload.generated_text;
    }

    if (typeof payload.summary_text === 'string') {
        return payload.summary_text;
    }

    return null;
};

const requestViaChatCompletions = async ({ prompt, hfToken, model, historyMessages }) => {
    const response = await fetch(HF_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${hfToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: 'system',
                    content: 'Ты ассистент проекта. Отвечай только на русском и только по данным из переданного контекста проекта.',
                },
                ...historyMessages,
                { role: 'user', content: prompt },
            ],
            temperature: 0.2,
            max_tokens: 900,
        }),
    });

    const payload = await parseJsonSafe(response);
    if (!response.ok) {
        const providerMessage = payload?.error?.message || payload?.error || response.statusText || 'HuggingFace request failed';
        const authError = buildAuthErrorIfNeeded(providerMessage);
        if (authError) throw authError;
        throw new AppError(`AI provider error: ${providerMessage}`, response.status === 404 ? 404 : 502);
    }

    const text = extractChatCompletionText(payload);
    if (!text) {
        throw new AppError('AI provider returned empty response text', 502);
    }

    return {
        text: text.trim(),
        usedModel: model,
    };
};

const requestViaTextGeneration = async ({ prompt, hfToken, modelUrl }) => {
    const response = await fetch(modelUrl, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${hfToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            inputs: prompt,
            parameters: {
                max_new_tokens: 600,
                return_full_text: false,
                temperature: 0.2,
                top_p: 0.9,
            },
        }),
    });

    const payload = await parseJsonSafe(response);
    if (!response.ok) {
        const providerMessage = payload?.error || response.statusText || 'HuggingFace request failed';
        const authError = buildAuthErrorIfNeeded(providerMessage);
        if (authError) throw authError;
        throw new AppError(`AI provider error: ${providerMessage}`, response.status === 404 ? 404 : 502);
    }

    const text = extractGeneratedText(payload);
    if (!text) {
        throw new AppError('AI provider returned empty response text', 502);
    }

    return {
        text: text.trim(),
        usedModel: modelUrl,
    };
};

const requestAssistantAnswer = async ({ prompt, historyMessages }) => {
    if (typeof fetch !== 'function') {
        throw new AppError('Global fetch is not available on this Node runtime', 500);
    }

    const hfToken = process.env.HF_API_TOKEN
        || process.env.HUGGINGFACE_API_TOKEN
        || process.env.HUGGINGFACEHUB_API_TOKEN;
    if (!hfToken) {
        throw new AppError('HF_API_TOKEN is not configured on backend', 500);
    }

    const candidateModels = [HF_CHAT_MODEL, ...HF_CHAT_FALLBACK_MODELS].filter(
        (model, index, arr) => model && arr.indexOf(model) === index
    );

    let lastError = null;
    for (const model of candidateModels) {
        try {
            return await requestViaChatCompletions({
                prompt,
                hfToken,
                model,
                historyMessages,
            });
        } catch (error) {
            lastError = error;
            if (error.statusCode === 403) throw error;
            if (!isModelRoutingError(error.message)) throw error;
        }
    }

    const modelUrl = resolveHfModelUrl();
    try {
        return await requestViaTextGeneration({ prompt, hfToken, modelUrl });
    } catch (textError) {
        if (lastError) {
            throw lastError;
        }
        throw textError;
    }
};

const getIsoWeekStart = (date) => {
    const result = toUtcDateOnly(date);
    const day = result.getUTCDay() || 7;
    result.setUTCDate(result.getUTCDate() - day + 1);
    return result;
};

const formatWeekLabel = (date) => {
    const weekStart = getIsoWeekStart(date);
    const weekEnd = addDays(weekStart, 6);
    return `${formatDateKey(weekStart)}..${formatDateKey(weekEnd)}`;
};

const buildProjectContext = async ({ req, userId, startDate, endDate }) => {
    const effectiveUserId = resolveRequestedUserId(req, userId);
    const normalizedStart = toUtcDateOnly(startDate);
    const normalizedEnd = toUtcDateOnly(endDate);

    if (normalizedStart > normalizedEnd) {
        throw new AppError('startDate cannot be greater than endDate', 400);
    }

    const query = {
        date: {
            $gte: normalizedStart,
            $lt: addDays(normalizedEnd, 1),
        },
    };

    if (effectiveUserId) {
        query.userId = effectiveUserId;
    }

    const logs = await DayLog.find(query)
        .sort({ date: 1 })
        .populate({
            path: 'tasks',
            populate: { path: 'projectId', select: 'name' },
        })
        .populate('userId', 'name email');

    const entries = logs.flatMap((log) => {
        const logDate = toUtcDateOnly(log.date);

        return (log.tasks || []).map((task) => ({
            date: logDate,
            dateKey: formatDateKey(logDate),
            weekKey: formatWeekLabel(logDate),
            title: task.title,
            status: task.status || 'pending',
            testingStatus: task.testingStatus || 'not_reviewed',
            hours: Number(task.hours) || 0,
            customerName: task.customer?.name || null,
            customerExternalId: task.customer?.externalId || null,
            customerEmail: task.customer?.email || null,
            projectName: task.projectId?.name || null,
        }));
    });

    const totalHours = Number(entries.reduce((sum, item) => sum + item.hours, 0).toFixed(2));
    const totalTasks = entries.length;
    const completedTasks = entries.filter((item) => item.status === 'completed').length;
    const failedTasks = entries.filter((item) => item.status === 'failed').length;
    const pendingTasks = totalTasks - completedTasks - failedTasks;

    const testingCompleted = entries.filter((item) => item.testingStatus === 'completed').length;
    const testingInProgress = entries.filter((item) => item.testingStatus === 'in_progress').length;
    const testingNotReviewed = totalTasks - testingCompleted - testingInProgress;

    const dailyMap = new Map();
    entries.forEach((item) => {
        if (!dailyMap.has(item.dateKey)) {
            dailyMap.set(item.dateKey, {
                period: item.dateKey,
                totalTasks: 0,
                completedTasks: 0,
                totalHours: 0,
            });
        }
        const bucket = dailyMap.get(item.dateKey);
        bucket.totalTasks += 1;
        if (item.status === 'completed') bucket.completedTasks += 1;
        bucket.totalHours = Number((bucket.totalHours + item.hours).toFixed(2));
    });

    const weeklyMap = new Map();
    entries.forEach((item) => {
        if (!weeklyMap.has(item.weekKey)) {
            weeklyMap.set(item.weekKey, {
                period: item.weekKey,
                totalTasks: 0,
                completedTasks: 0,
                totalHours: 0,
            });
        }
        const bucket = weeklyMap.get(item.weekKey);
        bucket.totalTasks += 1;
        if (item.status === 'completed') bucket.completedTasks += 1;
        bucket.totalHours = Number((bucket.totalHours + item.hours).toFixed(2));
    });

    const customerMap = new Map();
    entries.forEach((item) => {
        const key = item.customerName || item.customerExternalId || item.customerEmail;
        if (!key) return;
        customerMap.set(key, (customerMap.get(key) || 0) + 1);
    });

    const topCustomers = Array.from(customerMap.entries())
        .map(([customer, tasks]) => ({ customer, tasks }))
        .sort((a, b) => b.tasks - a.tasks)
        .slice(0, 8);

    // Per-project summary
    const projectMap2 = new Map();
    entries.forEach((item) => {
        const key = item.projectName || '__no_project__';
        const name = item.projectName || 'Без проекта';
        if (!projectMap2.has(key)) {
            projectMap2.set(key, { projectName: name, totalTasks: 0, completedTasks: 0, totalHours: 0 });
        }
        const p = projectMap2.get(key);
        p.totalTasks++;
        p.totalHours = Number((p.totalHours + item.hours).toFixed(2));
        if (item.status === 'completed') p.completedTasks++;
    });
    const projectSummary = Array.from(projectMap2.values())
        .map((p) => ({
            ...p,
            completionRate: p.totalTasks ? Number(((p.completedTasks / p.totalTasks) * 100).toFixed(2)) : 0,
        }))
        .sort((a, b) => b.totalTasks - a.totalTasks);

    // Full customer details (name + email + externalId)
    const customerDetails = new Map();
    entries.forEach((item) => {
        if (!item.customerName && !item.customerEmail && !item.customerExternalId) return;
        const key = item.customerName || item.customerEmail || item.customerExternalId;
        if (!customerDetails.has(key)) {
            customerDetails.set(key, {
                name: item.customerName,
                email: item.customerEmail,
                externalId: item.customerExternalId,
                tasks: 0,
                hours: 0,
            });
        }
        const c = customerDetails.get(key);
        c.tasks++;
        c.hours = Number((c.hours + item.hours).toFixed(2));
    });
    const customerList = Array.from(customerDetails.values()).sort((a, b) => b.tasks - a.tasks).slice(0, 15);

    const dailySeries = Array.from(dailyMap.values()).slice(-14);
    const weeklySeries = Array.from(weeklyMap.values()).slice(-10);

    const reportEndDate = formatDateKey(addDays(normalizedEnd, 1));
    const exportParams = new URLSearchParams({
        startDate: formatDateKey(normalizedStart),
        endDate: reportEndDate,
    });
    if (effectiveUserId) exportParams.set('userId', effectiveUserId);

    const analyticsExportParams = new URLSearchParams({
        startDate: formatDateKey(normalizedStart),
        endDate: formatDateKey(normalizedEnd),
    });
    if (effectiveUserId) analyticsExportParams.set('userId', effectiveUserId);

    let targetUser = null;
    if (effectiveUserId) {
        const target = await User.findById(effectiveUserId).select('_id name email');
        if (target) {
            targetUser = {
                id: String(target._id),
                name: target.name,
                email: target.email,
            };
        }
    }

    return {
        period: {
            startDate: formatDateKey(normalizedStart),
            endDate: formatDateKey(normalizedEnd),
        },
        userScope: effectiveUserId
            ? 'single_user'
            : 'all_users',
        targetUser,
        overview: {
            totalHours,
            totalTasks,
            completedTasks,
            pendingTasks,
            failedTasks,
            testingCompleted,
            testingInProgress,
            testingNotReviewed,
            completionRate: totalTasks
                ? Number(((completedTasks / totalTasks) * 100).toFixed(2))
                : 0,
        },
        dailySeries,
        weeklySeries,
        topCustomers,
        projectSummary,
        customerList,
        exportActions: [
            {
                type: 'report_excel',
                label: 'Скачать отчет Excel',
                endpoint: `/reports/export?${exportParams.toString()}`,
                filename: `work-log-report-${formatDateKey(normalizedStart)}-${formatDateKey(normalizedEnd)}.xlsx`,
            },
            {
                type: 'analytics_excel',
                label: 'Скачать аналитику Excel',
                endpoint: `/reports/analytics/export?${analyticsExportParams.toString()}`,
                filename: `analytics-report-${formatDateKey(normalizedStart)}-${formatDateKey(normalizedEnd)}.xlsx`,
            },
        ],
    };
};

const buildAssistantPrompt = (projectContext, userMessage) => {
    const contextJson = JSON.stringify(projectContext, null, 2);

    return `Ты внутренний ассистент проекта по задачам.
Правила:
1) Отвечай ТОЛЬКО на основе JSON-контекста проекта ниже.
2) Не используй внешние знания.
3) Если данных не хватает, напиши: "В данных проекта нет информации для точного ответа."
4) Ответ только на русском, кратко и по делу.
5) Когда уместно, опирайся на числа из контекста.

Контекст проекта (JSON):
${contextJson}

Вопрос пользователя:
${userMessage}

Формат ответа:
## Ответ
## Ключевые метрики
## Что делать дальше`;
};

const normalizeAssistantAnswer = (rawText, projectContext) => {
    const text = String(rawText || '').replace(/\r\n/g, '\n').trim();
    const normalized = text
        .replace(/^\s*[\-\*\d\.\)]*\s*##\s*/gm, '## ')
        .trim();

    const hasSections = normalized.includes('## Ответ')
        && normalized.includes('## Ключевые метрики')
        && normalized.includes('## Что делать дальше');
    const hasCyrillic = /[А-Яа-яЁё]/.test(normalized);
    const looksLikeThinking = /thinking process|analyze the request|constraint|output format/i.test(normalized);

    if (hasSections && hasCyrillic && !looksLikeThinking) {
        return normalized;
    }

    const overview = projectContext.overview;
    return `## Ответ
По данным проекта: выполнено ${overview.completedTasks} из ${overview.totalTasks} задач за период ${projectContext.period.startDate} — ${projectContext.period.endDate}. Конверсия выполнения: ${overview.completionRate}%.

## Ключевые метрики
- Часы: ${overview.totalHours}
- Выполнено: ${overview.completedTasks}
- В процессе: ${overview.pendingTasks}
- Провалено: ${overview.failedTasks}
- Тестирование завершено: ${overview.testingCompleted}
- Тестирование не рассмотрено: ${overview.testingNotReviewed}

## Что делать дальше
- Закрыть бэклог тестирования.
- Держать недельный KPI по выполненным задачам.
- При необходимости выгрузить Excel через кнопки ниже.`;
};

const extractHistory = (history) => {
    if (!Array.isArray(history)) return [];

    return history
        .slice(-8)
        .map((item) => ({
            role: item?.role === 'assistant' ? 'assistant' : 'user',
            content: String(item?.content || '').slice(0, 3000),
        }))
        .filter((item) => item.content.trim().length > 0);
};

const looksLikeHoursQuestion = (message) => {
    const normalized = String(message || '').toLowerCase();
    return (
        normalized.includes('сколько часов')
        || normalized.includes('сколка часов')
        || normalized.includes('часы')
        || normalized.includes('hours')
    );
};

const looksLikeExcelRequest = (message) => {
    const normalized = String(message || '').toLowerCase();
    return (
        normalized.includes('excel')
        || normalized.includes('exel')
        || normalized.includes('xlsx')
        || normalized.includes('скачай')
        || normalized.includes('выгруз')
        || normalized.includes('export')
        || normalized.includes('скачать')
        || normalized.includes('файл')
    );
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const RU_MONTHS = {
    января: 1,
    февраль: 2,
    февраля: 2,
    март: 3,
    марта: 3,
    апрель: 4,
    апреля: 4,
    май: 5,
    мая: 5,
    июнь: 6,
    июня: 6,
    июль: 7,
    июля: 7,
    август: 8,
    августа: 8,
    сентябрь: 9,
    сентября: 9,
    октябрь: 10,
    октября: 10,
    ноябрь: 11,
    ноября: 11,
    декабрь: 12,
    декабря: 12,
};

const parseYear = (value, fallbackYear) => {
    if (!value) return fallbackYear;
    const numeric = Number(value);
    if (!numeric) return fallbackYear;
    if (numeric < 100) return 2000 + numeric;
    return numeric;
};

const formatYmd = (year, month, day) => (
    `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
);

const extractDateRangeFromMessage = (message) => {
    const text = String(message || '').toLowerCase().replace(/,/g, ' ');
    const nowYear = new Date().getUTCFullYear();

    const dottedMatch = text.match(
        /(?:с|за)\s*(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?\s*(?:до|по)\s*(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?/i
    );
    if (dottedMatch) {
        const [, d1, m1, y1Raw, d2, m2, y2Raw] = dottedMatch;
        const baseYear = parseYear(y1Raw, parseYear(y2Raw, nowYear));
        const y1 = parseYear(y1Raw, baseYear);
        const y2 = parseYear(y2Raw, y1);

        return {
            startDate: formatYmd(y1, Number(m1), Number(d1)),
            endDate: formatYmd(y2, Number(m2), Number(d2)),
        };
    }

    const wordsMatch = text.match(
        /(?:с|за)\s*(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?\s*(?:года|год|г)?\s*(?:до|по)\s*(\d{1,2})(?:\s+([а-яё]+))?(?:\s+(\d{4}))?/i
    );
    if (wordsMatch) {
        const [, d1Raw, m1Raw, y1Raw, d2Raw, m2RawMaybe, y2Raw] = wordsMatch;
        const month1 = RU_MONTHS[m1Raw];
        const month2 = RU_MONTHS[m2RawMaybe || m1Raw];
        if (!month1 || !month2) return null;

        const baseYear = parseYear(y1Raw, parseYear(y2Raw, nowYear));
        const y1 = parseYear(y1Raw, baseYear);
        const y2 = parseYear(y2Raw, y1);

        return {
            startDate: formatYmd(y1, month1, Number(d1Raw)),
            endDate: formatYmd(y2, month2, Number(d2Raw)),
        };
    }

    return null;
};

const extractProjectHint = (message) => {
    const text = String(message || '');
    const match = text.match(
        /(?:проект|project|по\s+проекту|для\s+проекта|расскажи\s+(?:о|про)\s+проект[еа]?)\s+[«"']?([А-Яа-яA-Za-z0-9\s_\-]+?)[»"']?(?:\s|$|[,.])/i
    );
    return match?.[1]?.trim() || null;
};

const extractCustomerHint = (message) => {
    const text = String(message || '');
    const match = text.match(
        /(?:заказчик|клиент|customer|по\s+заказчику|для\s+заказчика)\s+[«"']?([А-Яа-яA-Za-z0-9\s_\-@.]+?)[»"']?(?:\s|$|[,.])/i
    );
    return match?.[1]?.trim() || null;
};

const extractNameHint = (message) => {
    const text = String(message || '');
    const direct = text.match(/(?:по|для)\s+([A-Za-zА-Яа-яЁё'\-]+\s+[A-Za-zА-Яа-яЁё'\-]+)/i);
    if (direct?.[1]) return direct[1].trim();
    return null;
};

const findUserByNameHint = async (nameHint) => {
    if (!nameHint) return null;

    const tokens = nameHint
        .split(/\s+/)
        .map((item) => item.trim())
        .filter((item) => item.length >= 2)
        .slice(0, 3);

    if (!tokens.length) return null;

    const andConditions = tokens.map((token) => ({
        name: { $regex: escapeRegex(token), $options: 'i' },
    }));

    return User.findOne({ $and: andConditions }).select('_id name email');
};

exports.chatWithAssistant = catchAsync(async (req, res, next) => {
    const { message, userId, history } = req.body || {};
    let resolvedUserId = userId || null;
    let startDate = req.body?.startDate || formatDateKey(addDays(new Date(), -90));
    let endDate = req.body?.endDate || formatDateKey(new Date());

    if (!message || !String(message).trim()) {
        return next(new AppError('Please provide message', 400));
    }

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
        return next(new AppError('Invalid date format for startDate or endDate', 400));
    }

    const parsedDateRange = extractDateRangeFromMessage(message);
    if (parsedDateRange && isValidDate(parsedDateRange.startDate) && isValidDate(parsedDateRange.endDate)) {
        startDate = parsedDateRange.startDate;
        endDate = parsedDateRange.endDate;
    }

    if (req.user.role === 'admin' && !resolvedUserId) {
        const nameHint = extractNameHint(message);
        const matchedUser = await findUserByNameHint(nameHint);
        if (matchedUser) {
            resolvedUserId = matchedUser._id;
        }
    }

    const projectContext = await buildProjectContext({
        req,
        userId: resolvedUserId,
        startDate,
        endDate,
    });

    if (looksLikeExcelRequest(message)) {
        return res.status(200).json({
            status: 'success',
            data: {
                answer: `## Ответ
Конечно, подготовил ссылки на Excel выгрузки за период ${projectContext.period.startDate} — ${projectContext.period.endDate}.

## Ключевые метрики
- Всего задач: ${projectContext.overview.totalTasks}
- Выполнено: ${projectContext.overview.completedTasks}
- Часы: ${projectContext.overview.totalHours}

## Что делать дальше
- Нажмите нужную кнопку скачивания ниже.`,
                downloads: projectContext.exportActions,
                context: {
                    period: projectContext.period,
                    overview: projectContext.overview,
                },
                usedModel: null,
            },
        });
    }

    if (looksLikeHoursQuestion(message)) {
        const targetName = projectContext.targetUser?.name
            || (projectContext.userScope === 'all_users' ? 'все сотрудники' : 'сотрудник');

        return res.status(200).json({
            status: 'success',
            data: {
                answer: `## Ответ
За период ${projectContext.period.startDate} — ${projectContext.period.endDate} ${targetName} отработал ${projectContext.overview.totalHours} часов.

## Ключевые метрики
- Всего задач: ${projectContext.overview.totalTasks}
- Выполнено: ${projectContext.overview.completedTasks}
- В процессе: ${projectContext.overview.pendingTasks}
- Конверсия: ${projectContext.overview.completionRate}%

## Что делать дальше
- Если нужна выгрузка, нажмите Excel-кнопки ниже.`,
                downloads: projectContext.exportActions,
                context: {
                    period: projectContext.period,
                    overview: projectContext.overview,
                },
                usedModel: null,
            },
        });
    }

    const projectHint = extractProjectHint(message);
    if (projectHint) {
        const matched = projectContext.projectSummary.find((p) =>
            p.projectName.toLowerCase().includes(projectHint.toLowerCase())
        );

        if (matched) {
            return res.status(200).json({
                status: 'success',
                data: {
                    answer: `## Ответ
Проект **${matched.projectName}** за период ${projectContext.period.startDate} — ${projectContext.period.endDate}:

## Ключевые метрики
- Всего задач: ${matched.totalTasks}
- Выполнено: ${matched.completedTasks}
- Выполнение: ${matched.completionRate}%
- Затрачено часов: ${matched.totalHours}

## Что делать дальше
- Следите за прогрессом в разделе Аналитика.
- Для детального отчёта используйте страницу Отчёт по проекту.`,
                    downloads: projectContext.exportActions,
                    context: {
                        period: projectContext.period,
                        overview: projectContext.overview,
                        projectDetail: matched,
                    },
                    usedModel: null,
                },
            });
        }
    }

    const customerHint = extractCustomerHint(message);
    if (customerHint) {
        const matched = projectContext.customerList.find((c) =>
            (c.name || '').toLowerCase().includes(customerHint.toLowerCase())
            || (c.email || '').toLowerCase().includes(customerHint.toLowerCase())
            || (c.externalId || '').toLowerCase().includes(customerHint.toLowerCase())
        );

        if (matched) {
            return res.status(200).json({
                status: 'success',
                data: {
                    answer: `## Ответ
Заказчик **${matched.name || matched.email || matched.externalId}** за период ${projectContext.period.startDate} — ${projectContext.period.endDate}:

## Ключевые метрики
- Задач выполнено: ${matched.tasks}
- Затрачено часов: ${matched.hours}
${matched.email ? `- Email: ${matched.email}` : ''}
${matched.externalId ? `- ID: ${matched.externalId}` : ''}

## Что делать дальше
- Детальный отчёт доступен в разделе Отчёт по заказчику.`,
                    downloads: projectContext.exportActions,
                    context: {
                        period: projectContext.period,
                        overview: projectContext.overview,
                        customerDetail: matched,
                    },
                    usedModel: null,
                },
            });
        }
    }

    const prompt = buildAssistantPrompt(projectContext, String(message).trim());
    const historyMessages = extractHistory(history);
    const aiResult = await requestAssistantAnswer({ prompt, historyMessages });
    const answer = normalizeAssistantAnswer(aiResult.text, projectContext);

    res.status(200).json({
        status: 'success',
        data: {
            answer,
            downloads: projectContext.exportActions,
            context: {
                period: projectContext.period,
                overview: projectContext.overview,
            },
            usedModel: aiResult.usedModel,
        },
    });
});
