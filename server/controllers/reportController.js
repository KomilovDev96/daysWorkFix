const DayLog = require('../models/DayLog');
const Task = require('../models/Task');
const Project = require('../models/Project');
const AiInsight = require('../models/AiInsight');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const excelService = require('../services/excelService');

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const LEGACY_HF_BASE_URL = 'https://api-inference.huggingface.co/models/';
const HF_ROUTER_BASE_URL = (process.env.HF_ROUTER_BASE_URL || 'https://router.huggingface.co/hf-inference/models').replace(/\/+$/, '');
const HF_MODEL_ID = process.env.HF_MODEL_ID || 'gpt2';
const HF_MODE = (process.env.HF_MODE || 'chat').toLowerCase();
const HF_CHAT_COMPLETIONS_URL = (process.env.HF_CHAT_COMPLETIONS_URL || 'https://router.huggingface.co/v1/chat/completions').replace(/\/+$/, '');
const HF_CHAT_MODEL = process.env.HF_CHAT_MODEL || 'openai/gpt-oss-120b';
const HF_CHAT_FALLBACK_MODELS = (
    process.env.HF_CHAT_FALLBACK_MODELS
    || 'Qwen/Qwen3.5-9B,Qwen/Qwen3-4B-Thinking-2507'
)
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);

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

const toUtcDateOnly = (value) => {
    const date = new Date(value);

    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const isValidDate = (value) => !Number.isNaN(new Date(value).getTime());

const formatDateKey = (date) => date.toISOString().slice(0, 10);

const getIsoWeekInfo = (date) => {
    const tempDate = toUtcDateOnly(date);
    const day = tempDate.getUTCDay() || 7;
    tempDate.setUTCDate(tempDate.getUTCDate() + 4 - day);

    const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((tempDate - yearStart) / DAY_IN_MS) + 1) / 7);

    return {
        week,
        year: tempDate.getUTCFullYear(),
    };
};

const getIsoWeekStart = (date) => {
    const result = toUtcDateOnly(date);
    const day = result.getUTCDay() || 7;
    result.setUTCDate(result.getUTCDate() - day + 1);

    return result;
};

const resolveRequestedUserId = (req, requestedUserId) => {
    if (req.user.role === 'admin') {
        return requestedUserId || null;
    }

    return req.user.id;
};

const buildEmptyBucket = (label, startDate, endDate) => ({
    label,
    startDate: formatDateKey(startDate),
    endDate: formatDateKey(endDate),
    totalHours: 0,
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    failedTasks: 0,
    testingCompleted: 0,
    testingInProgress: 0,
    testingNotReviewed: 0,
    completionRate: 0,
});

const getBucketMeta = (date, granularity) => {
    const normalized = toUtcDateOnly(date);

    if (granularity === 'daily') {
        return {
            key: formatDateKey(normalized),
            ...buildEmptyBucket(formatDateKey(normalized), normalized, normalized),
        };
    }

    if (granularity === 'weekly') {
        const startDate = getIsoWeekStart(normalized);
        const endDate = new Date(startDate.getTime() + (6 * DAY_IN_MS));
        const weekInfo = getIsoWeekInfo(normalized);
        const label = `${weekInfo.year}-W${String(weekInfo.week).padStart(2, '0')}`;

        return {
            key: label,
            ...buildEmptyBucket(label, startDate, endDate),
        };
    }

    if (granularity === 'monthly') {
        const year = normalized.getUTCFullYear();
        const month = normalized.getUTCMonth();
        const startDate = new Date(Date.UTC(year, month, 1));
        const endDate = new Date(Date.UTC(year, month + 1, 0));
        const label = `${year}-${String(month + 1).padStart(2, '0')}`;

        return {
            key: label,
            ...buildEmptyBucket(label, startDate, endDate),
        };
    }

    const year = normalized.getUTCFullYear();
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31));
    const label = String(year);

    return {
        key: label,
        ...buildEmptyBucket(label, startDate, endDate),
    };
};

const applyTaskToBucket = (bucket, task) => {
    const normalizedHours = Number(task.hours) || 0;

    bucket.totalHours += normalizedHours;
    bucket.totalTasks += 1;

    if (task.status === 'completed') bucket.completedTasks += 1;
    else if (task.status === 'failed') bucket.failedTasks += 1;
    else bucket.pendingTasks += 1;

    if (task.testingStatus === 'completed') bucket.testingCompleted += 1;
    else if (task.testingStatus === 'in_progress') bucket.testingInProgress += 1;
    else bucket.testingNotReviewed += 1;
};

const finalizeBuckets = (bucketMap) => {
    const sorted = Array.from(bucketMap.values()).sort(
        (a, b) => new Date(a.startDate) - new Date(b.startDate)
    );

    return sorted.map((bucket) => ({
        ...bucket,
        totalHours: Number(bucket.totalHours.toFixed(2)),
        completionRate: bucket.totalTasks
            ? Number(((bucket.completedTasks / bucket.totalTasks) * 100).toFixed(2))
            : 0,
    }));
};

const buildGroupedStats = (entries, granularity) => {
    const bucketMap = new Map();

    entries.forEach(({ logDate, task }) => {
        const meta = getBucketMeta(logDate, granularity);

        if (!bucketMap.has(meta.key)) {
            bucketMap.set(meta.key, meta);
        }

        applyTaskToBucket(bucketMap.get(meta.key), task);
    });

    return finalizeBuckets(bucketMap);
};

const getWeekInsights = (weeklyBuckets) => {
    const weeksWithTasks = weeklyBuckets.filter((bucket) => bucket.totalTasks > 0);

    if (!weeksWithTasks.length) {
        return {
            bestWeek: null,
            worstWeek: null,
            totalResolvedTasks: 0,
            latestVsPrevious: null,
        };
    }

    const bestWeek = weeksWithTasks.reduce((best, current) => {
        if (current.completedTasks > best.completedTasks) return current;
        if (current.completedTasks === best.completedTasks && current.totalHours > best.totalHours) return current;
        return best;
    }, weeksWithTasks[0]);

    const worstWeek = weeksWithTasks.reduce((worst, current) => {
        if (current.completedTasks < worst.completedTasks) return current;
        if (current.completedTasks === worst.completedTasks && current.totalHours < worst.totalHours) return current;
        return worst;
    }, weeksWithTasks[0]);

    const totalResolvedTasks = weeksWithTasks.reduce(
        (sum, week) => sum + week.completedTasks,
        0
    );

    const latestWeek = weeksWithTasks[weeksWithTasks.length - 1];
    const previousWeek = weeksWithTasks.length > 1 ? weeksWithTasks[weeksWithTasks.length - 2] : null;

    return {
        bestWeek,
        worstWeek,
        totalResolvedTasks,
        latestVsPrevious: previousWeek
            ? {
                latestWeek,
                previousWeek,
                deltaResolvedTasks: latestWeek.completedTasks - previousWeek.completedTasks,
                deltaHours: Number((latestWeek.totalHours - previousWeek.totalHours).toFixed(2)),
            }
            : null,
    };
};

const buildAnalyticsData = async ({ normalizedStart, normalizedEnd, effectiveUserId }) => {
    const query = {
        date: {
            $gte: normalizedStart,
            $lt: new Date(normalizedEnd.getTime() + DAY_IN_MS),
        },
    };

    if (effectiveUserId) {
        query.userId = effectiveUserId;
    }

    const logs = await DayLog.find(query)
        .sort({ date: 1 })
        .populate({
            path: 'tasks',
            populate: { path: 'projectId', select: 'name' }
        })
        .populate('userId', 'name email');

    const entries = logs.flatMap((log) => {
        const logDate = toUtcDateOnly(log.date);

        return (log.tasks || []).map((task) => ({
            logDate,
            task,
        }));
    });

    const daily = buildGroupedStats(entries, 'daily');
    const weekly = buildGroupedStats(entries, 'weekly');
    const monthly = buildGroupedStats(entries, 'monthly');
    const yearly = buildGroupedStats(entries, 'yearly');

    const totalHours = Number(entries.reduce((sum, entry) => sum + (Number(entry.task.hours) || 0), 0).toFixed(2));
    const totalTasks = entries.length;
    const completedTasks = entries.filter((entry) => entry.task.status === 'completed').length;
    const failedTasks = entries.filter((entry) => entry.task.status === 'failed').length;
    const pendingTasks = totalTasks - completedTasks - failedTasks;

    const testingCompleted = entries.filter((entry) => entry.task.testingStatus === 'completed').length;
    const testingInProgress = entries.filter((entry) => entry.task.testingStatus === 'in_progress').length;
    const testingNotReviewed = totalTasks - testingCompleted - testingInProgress;

    // Build per-project stats
    const projectMap = new Map();
    entries.forEach(({ task }) => {
        const proj = task.projectId;
        const key = proj?._id?.toString() || '__no_project__';
        const name = proj?.name || 'Без проекта';

        if (!projectMap.has(key)) {
            projectMap.set(key, {
                projectId: key === '__no_project__' ? null : key,
                projectName: name,
                totalTasks: 0,
                completedTasks: 0,
                pendingTasks: 0,
                failedTasks: 0,
                totalHours: 0,
            });
        }

        const stats = projectMap.get(key);
        stats.totalTasks++;
        stats.totalHours += Number(task.hours) || 0;
        if (task.status === 'completed') stats.completedTasks++;
        else if (task.status === 'failed') stats.failedTasks++;
        else stats.pendingTasks++;
    });

    const projectStats = Array.from(projectMap.values())
        .map((s) => ({
            ...s,
            totalHours: Number(s.totalHours.toFixed(2)),
            completionRate: s.totalTasks
                ? Number(((s.completedTasks / s.totalTasks) * 100).toFixed(2))
                : 0,
        }))
        .sort((a, b) => b.totalTasks - a.totalTasks);

    return {
        period: {
            startDate: formatDateKey(normalizedStart),
            endDate: formatDateKey(normalizedEnd),
        },
        overview: {
            totalHours,
            totalTasks,
            completedTasks,
            failedTasks,
            pendingTasks,
            testingCompleted,
            testingInProgress,
            testingNotReviewed,
            completionRate: totalTasks
                ? Number(((completedTasks / totalTasks) * 100).toFixed(2))
                : 0,
        },
        projectStats,
        daily,
        weekly,
        monthly,
        yearly,
        weeklyInsights: getWeekInsights(weekly),
    };
};

const compactBuckets = (buckets, takeLast = 6) => (
    (buckets || []).slice(-takeLast).map((bucket) => ({
        label: bucket.label,
        totalTasks: bucket.totalTasks,
        completedTasks: bucket.completedTasks,
        totalHours: bucket.totalHours,
        completionRate: bucket.completionRate,
    }))
);

const formatBucketsForPrompt = (buckets) => {
    if (!buckets.length) return '- no data';
    return buckets
        .map((bucket) => (
            `${bucket.label}: tasks=${bucket.totalTasks}, completed=${bucket.completedTasks}, hours=${bucket.totalHours}, completionRate=${bucket.completionRate}%`
        ))
        .join('\n');
};

const buildAiPrompt = (analyticsData) => {
    const overview = analyticsData.overview || {};
    const weeklyInsights = analyticsData.weeklyInsights || {};

    const dailySlice = compactBuckets(analyticsData.daily, 7);
    const weeklySlice = compactBuckets(analyticsData.weekly, 8);
    const monthlySlice = compactBuckets(analyticsData.monthly, 6);

    return `You are an experienced project delivery analyst.
Analyze this project's execution health and respond ONLY in Russian.

Period: ${analyticsData.period.startDate} to ${analyticsData.period.endDate}
Overview:
- totalHours: ${overview.totalHours || 0}
- totalTasks: ${overview.totalTasks || 0}
- completedTasks: ${overview.completedTasks || 0}
- pendingTasks: ${overview.pendingTasks || 0}
- failedTasks: ${overview.failedTasks || 0}
- testingCompleted: ${overview.testingCompleted || 0}
- testingInProgress: ${overview.testingInProgress || 0}
- testingNotReviewed: ${overview.testingNotReviewed || 0}
- completionRate: ${overview.completionRate || 0}%

Weekly comparison:
- bestWeek: ${weeklyInsights.bestWeek ? `${weeklyInsights.bestWeek.label} (completed=${weeklyInsights.bestWeek.completedTasks}, hours=${weeklyInsights.bestWeek.totalHours})` : 'no data'}
- worstWeek: ${weeklyInsights.worstWeek ? `${weeklyInsights.worstWeek.label} (completed=${weeklyInsights.worstWeek.completedTasks}, hours=${weeklyInsights.worstWeek.totalHours})` : 'no data'}
- totalResolvedTasks: ${weeklyInsights.totalResolvedTasks || 0}
- latestVsPrevious: ${weeklyInsights.latestVsPrevious ? `deltaResolvedTasks=${weeklyInsights.latestVsPrevious.deltaResolvedTasks}, deltaHours=${weeklyInsights.latestVsPrevious.deltaHours}` : 'no data'}

Daily samples:
${formatBucketsForPrompt(dailySlice)}

Weekly samples:
${formatBucketsForPrompt(weeklySlice)}

Monthly samples:
${formatBucketsForPrompt(monthlySlice)}

Return strict markdown with sections:
## Состояние проекта
## Растет ли успеваемость
## Разница между неделями
## Риски
## Советы по улучшению

In "Советы по улучшению", provide exactly 5 bullet points with concrete actions.`;
};

const hasCyrillic = (text) => /[А-Яа-яЁё]/.test(text || '');

const looksLikeThinkingTrace = (text) => {
    const normalized = String(text || '').toLowerCase();
    return (
        normalized.includes('thinking process')
        || normalized.includes('analyze the request')
        || normalized.includes('constraint')
        || normalized.includes('weekly samples')
        || normalized.includes('daily samples')
        || normalized.includes('output format')
    );
};

const normalizeMarkdownHeadings = (text) => (
    String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/^\s*[\-\*\d\.\)]*\s*##\s*/gm, '## ')
        .replace(/^\s*[\-\*\d\.\)]*\s*###\s*/gm, '### ')
        .trim()
);

const buildFallbackInsight = (analyticsData) => {
    const overview = analyticsData.overview || {};
    const weeklyInsights = analyticsData.weeklyInsights || {};
    const weekly = analyticsData.weekly || [];
    const totalTasks = overview.totalTasks || 0;
    const testingBacklog = (overview.testingInProgress || 0) + (overview.testingNotReviewed || 0);

    const latestWeek = weekly.length ? weekly[weekly.length - 1] : null;
    const previousWeek = weekly.length > 1 ? weekly[weekly.length - 2] : null;
    const latestDelta = previousWeek && latestWeek
        ? latestWeek.completedTasks - previousWeek.completedTasks
        : null;

    const trendText = latestDelta === null
        ? 'Недостаточно данных для полного анализа тренда.'
        : latestDelta > 0
            ? `Есть рост: за последнюю неделю решено на ${latestDelta} задач больше, чем неделей ранее.`
            : latestDelta < 0
                ? `Есть просадка: за последнюю неделю решено на ${Math.abs(latestDelta)} задач меньше, чем неделей ранее.`
                : 'Темп стабильный: количество решенных задач не изменилось по сравнению с прошлой неделей.';

    const bestWeekText = weeklyInsights.bestWeek
        ? `${weeklyInsights.bestWeek.label}: ${weeklyInsights.bestWeek.completedTasks} решённых задач, ${weeklyInsights.bestWeek.totalHours} ч.`
        : 'Недостаточно данных.';
    const worstWeekText = weeklyInsights.worstWeek
        ? `${weeklyInsights.worstWeek.label}: ${weeklyInsights.worstWeek.completedTasks} решённых задач, ${weeklyInsights.worstWeek.totalHours} ч.`
        : 'Недостаточно данных.';

    const riskLines = [];
    if ((overview.completionRate || 0) < 60) riskLines.push('- Низкая конверсия закрытия задач (меньше 60%).');
    if (testingBacklog > Math.ceil(Math.max(totalTasks, 1) * 0.4)) riskLines.push('- Большой бэклог по тестированию.');
    if ((overview.failedTasks || 0) > 0) riskLines.push(`- Есть проваленные задачи: ${overview.failedTasks}.`);
    if (!riskLines.length) riskLines.push('- Критических рисков по метрикам не выявлено.');

    return `## Состояние проекта
- Период: ${analyticsData.period.startDate} — ${analyticsData.period.endDate}
- Всего задач: ${totalTasks}
- Решено: ${overview.completedTasks || 0}
- В процессе: ${overview.pendingTasks || 0}
- Провалено: ${overview.failedTasks || 0}
- Отработано часов: ${overview.totalHours || 0}
- Конверсия выполнения: ${overview.completionRate || 0}%
- Тестирование завершено: ${overview.testingCompleted || 0}
- Тестирование в процессе: ${overview.testingInProgress || 0}
- Тестирование не рассмотрено: ${overview.testingNotReviewed || 0}

## Растет ли успеваемость
${trendText}

## Разница между неделями
- Лучшая неделя: ${bestWeekText}
- Слабая неделя: ${worstWeekText}
- Решено задач за все недели: ${weeklyInsights.totalResolvedTasks || 0}

## Риски
${riskLines.join('\n')}

## Советы по улучшению
- Зафиксируйте еженедельный целевой KPI по завершенным задачам и сверяйте факт каждую пятницу.
- Разбейте большие задачи на более короткие этапы, чтобы повышать стабильность закрытия.
- Выделяйте ежедневное окно под тестирование, чтобы уменьшать бэклог “не рассмотрено”.
- Для недель с просадкой заранее планируйте приоритеты и лимит незавершенных задач.
- Раз в неделю проводите короткий ретро-разбор причин задержек и корректируйте план.`;
};

const finalizeAiSummary = (analyticsData, aiText) => {
    const normalized = normalizeMarkdownHeadings(aiText);
    const sections = ['## Состояние проекта', '## Растет ли успеваемость', '## Разница между неделями', '## Риски', '## Советы по улучшению'];
    const hasAllSections = sections.every((section) => normalized.includes(section));

    if (!normalized || !hasCyrillic(normalized) || looksLikeThinkingTrace(normalized) || !hasAllSections) {
        return buildFallbackInsight(analyticsData);
    }

    return normalized;
};

const normalizeInsightForResponse = (insightDoc) => {
    const insight = insightDoc?.toObject ? insightDoc.toObject() : insightDoc;
    if (!insight) return insight;

    if (!insight.aiSummary) return insight;

    const normalized = normalizeMarkdownHeadings(insight.aiSummary);
    const sections = ['## Состояние проекта', '## Растет ли успеваемость', '## Разница между неделями', '## Риски', '## Советы по улучшению'];
    const hasAllSections = sections.every((section) => normalized.includes(section));
    const needsFix = !hasCyrillic(normalized) || looksLikeThinkingTrace(normalized) || !hasAllSections;

    if (!needsFix) {
        return insight;
    }

    if (insight.analyticsSnapshot?.period && insight.analyticsSnapshot?.overview) {
        insight.aiSummary = buildFallbackInsight(insight.analyticsSnapshot);
        return insight;
    }

    insight.aiSummary = normalized;
    return insight;
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

const buildAuthErrorIfNeeded = (providerMessage) => {
    const normalizedMessage = String(providerMessage).toLowerCase();

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

const requestViaTextGenerationEndpoint = async ({ prompt, hfToken, hfModelUrl }) => {
    const response = await fetch(hfModelUrl, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${hfToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            inputs: prompt,
            parameters: {
                max_new_tokens: 380,
                return_full_text: false,
                temperature: 0.3,
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

    const aiText = extractGeneratedText(payload);
    if (!aiText) {
        throw new AppError('AI provider returned empty response text', 502);
    }

    return {
        aiText: aiText.trim(),
        rawPayload: payload,
        usedModelUrl: hfModelUrl,
    };
};

const requestViaChatCompletionsEndpoint = async ({ prompt, hfToken, model }) => {
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
                    content: 'You are a project delivery analyst. Answer in Russian.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.3,
            max_tokens: 700,
        }),
    });

    const payload = await parseJsonSafe(response);

    if (!response.ok) {
        const providerMessage = payload?.error?.message || payload?.error || response.statusText || 'HuggingFace request failed';
        const authError = buildAuthErrorIfNeeded(providerMessage);
        if (authError) throw authError;
        throw new AppError(`AI provider error: ${providerMessage}`, response.status === 404 ? 404 : 502);
    }

    const aiText = extractChatCompletionText(payload);
    if (!aiText) {
        throw new AppError('AI provider returned empty response text', 502);
    }

    return {
        aiText: aiText.trim(),
        rawPayload: payload,
        usedModelUrl: `${HF_CHAT_COMPLETIONS_URL} | model=${model}`,
    };
};

const requestHuggingFaceInsight = async (prompt) => {
    if (typeof fetch !== 'function') {
        throw new AppError('Global fetch is not available on this Node runtime', 500);
    }

    const hfToken = process.env.HF_API_TOKEN
        || process.env.HUGGINGFACE_API_TOKEN
        || process.env.HUGGINGFACEHUB_API_TOKEN;
    if (!hfToken) {
        throw new AppError('HF_API_TOKEN is not configured on backend (checked: HF_API_TOKEN, HUGGINGFACE_API_TOKEN, HUGGINGFACEHUB_API_TOKEN)', 500);
    }

    const hfModelUrl = resolveHfModelUrl();

    if (HF_MODE === 'text') {
        return requestViaTextGenerationEndpoint({ prompt, hfToken, hfModelUrl });
    }

    if (HF_MODE === 'chat') {
        const candidateModels = [HF_CHAT_MODEL, ...HF_CHAT_FALLBACK_MODELS].filter(
            (model, index, arr) => model && arr.indexOf(model) === index
        );

        let lastError = null;
        for (const candidateModel of candidateModels) {
            try {
                return await requestViaChatCompletionsEndpoint({
                    prompt,
                    hfToken,
                    model: candidateModel,
                });
            } catch (error) {
                lastError = error;
                if (error.statusCode === 403) throw error;
                if (!isModelRoutingError(error.message)) throw error;
            }
        }

        if (lastError && lastError.statusCode === 404) {
            return requestViaTextGenerationEndpoint({ prompt, hfToken, hfModelUrl });
        }

        if (lastError) throw lastError;
    }

    try {
        return await requestViaChatCompletionsEndpoint({ prompt, hfToken });
    } catch (chatError) {
        if (chatError.statusCode !== 404) throw chatError;
    }

    return requestViaTextGenerationEndpoint({ prompt, hfToken, hfModelUrl });
};

exports.getPeriodReport = catchAsync(async (req, res, next) => {
    const { startDate, endDate, userId } = req.query;

    if (!startDate || !endDate) {
        return next(new AppError('Please provide startDate and endDate', 400));
    }

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
        return next(new AppError('Invalid date format for startDate or endDate', 400));
    }

    const effectiveUserId = resolveRequestedUserId(req, userId);

    const query = {
        date: { $gte: new Date(startDate), $lte: new Date(endDate) }
    };

    if (effectiveUserId) {
        query.userId = effectiveUserId;
    }

    const logs = await DayLog.find(query).populate('userId', 'name email');

    const totalHours = logs.reduce((acc, log) => acc + log.totalHours, 0);
    const daysWorked = logs.length;
    const logIds = logs.map((l) => l._id);
    const totalTasks = await Task.countDocuments({ dayLogId: { $in: logIds } });

    res.status(200).json({
        status: 'success',
        data: {
            totalTasks,
            totalHours,
            daysWorked,
            logs
        }
    });
});

exports.getAnalyticsReport = catchAsync(async (req, res, next) => {
    const { userId } = req.query;

    const startDate = req.query.startDate || new Date(Date.now() - (365 * DAY_IN_MS)).toISOString().slice(0, 10);
    const endDate = req.query.endDate || new Date().toISOString().slice(0, 10);

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
        return next(new AppError('Invalid date format for startDate or endDate', 400));
    }

    const normalizedStart = toUtcDateOnly(startDate);
    const normalizedEnd = toUtcDateOnly(endDate);

    if (normalizedStart > normalizedEnd) {
        return next(new AppError('startDate cannot be greater than endDate', 400));
    }

    const effectiveUserId = resolveRequestedUserId(req, userId);

    const analyticsData = await buildAnalyticsData({
        normalizedStart,
        normalizedEnd,
        effectiveUserId,
    });

    res.status(200).json({
        status: 'success',
        data: analyticsData
    });
});

exports.getAiInsights = catchAsync(async (req, res, next) => {
    const { userId, startDate, endDate } = req.query;
    const effectiveUserId = resolveRequestedUserId(req, userId);

    if ((startDate && !endDate) || (!startDate && endDate)) {
        return next(new AppError('Please provide both startDate and endDate', 400));
    }

    if (startDate && endDate && (!isValidDate(startDate) || !isValidDate(endDate))) {
        return next(new AppError('Invalid date format for startDate or endDate', 400));
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 30);
    const query = {
        userId: effectiveUserId || null,
    };

    if (startDate && endDate) {
        query.startDate = toUtcDateOnly(startDate);
        query.endDate = toUtcDateOnly(endDate);
    }

    const rawInsights = await AiInsight.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('userId', 'name email')
        .populate('requestedBy', 'name email');

    const insights = rawInsights.map(normalizeInsightForResponse);

    res.status(200).json({
        status: 'success',
        results: insights.length,
        data: {
            insights,
        },
    });
});

exports.generateAiInsight = catchAsync(async (req, res, next) => {
    const { userId } = req.body;
    const startDate = req.body.startDate || new Date(Date.now() - (90 * DAY_IN_MS)).toISOString().slice(0, 10);
    const endDate = req.body.endDate || new Date().toISOString().slice(0, 10);
    const forceRefresh = req.body.forceRefresh === true;

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
        return next(new AppError('Invalid date format for startDate or endDate', 400));
    }

    const normalizedStart = toUtcDateOnly(startDate);
    const normalizedEnd = toUtcDateOnly(endDate);

    if (normalizedStart > normalizedEnd) {
        return next(new AppError('startDate cannot be greater than endDate', 400));
    }

    const effectiveUserId = resolveRequestedUserId(req, userId);
    const insightUserId = effectiveUserId || null;

    if (!forceRefresh) {
        const cachedInsight = await AiInsight.findOne({
            userId: insightUserId,
            startDate: normalizedStart,
            endDate: normalizedEnd,
        })
            .sort({ createdAt: -1 })
            .populate('userId', 'name email')
            .populate('requestedBy', 'name email');

        if (cachedInsight) {
            const normalizedCachedInsight = normalizeInsightForResponse(cachedInsight);
            return res.status(200).json({
                status: 'success',
                data: {
                    insight: normalizedCachedInsight,
                    reused: true,
                },
            });
        }
    }

    const analyticsData = await buildAnalyticsData({
        normalizedStart,
        normalizedEnd,
        effectiveUserId,
    });

    const prompt = buildAiPrompt(analyticsData);
    const { aiText, rawPayload, usedModelUrl } = await requestHuggingFaceInsight(prompt);
    const finalAiSummary = finalizeAiSummary(analyticsData, aiText);

    const insight = await AiInsight.create({
        userId: insightUserId,
        requestedBy: req.user.id,
        startDate: normalizedStart,
        endDate: normalizedEnd,
        provider: 'huggingface',
        model: usedModelUrl,
        prompt,
        aiSummary: finalAiSummary,
        aiRawResponse: rawPayload,
        analyticsSnapshot: {
            period: analyticsData.period,
            overview: analyticsData.overview,
            daily: compactBuckets(analyticsData.daily, 14),
            weekly: compactBuckets(analyticsData.weekly, 12),
            monthly: compactBuckets(analyticsData.monthly, 12),
            yearly: compactBuckets(analyticsData.yearly, 6),
            weeklyInsights: analyticsData.weeklyInsights,
        },
    });

    const populatedInsight = await AiInsight.findById(insight._id)
        .populate('userId', 'name email')
        .populate('requestedBy', 'name email');

    res.status(201).json({
        status: 'success',
        data: {
            insight: normalizeInsightForResponse(populatedInsight),
            reused: false,
        },
    });
});

exports.exportAnalyticsExcel = catchAsync(async (req, res, next) => {
    const { userId } = req.query;

    const startDate = req.query.startDate || new Date(Date.now() - (365 * DAY_IN_MS)).toISOString().slice(0, 10);
    const endDate = req.query.endDate || new Date().toISOString().slice(0, 10);

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
        return next(new AppError('Invalid date format for startDate or endDate', 400));
    }

    const normalizedStart = toUtcDateOnly(startDate);
    const normalizedEnd = toUtcDateOnly(endDate);

    if (normalizedStart > normalizedEnd) {
        return next(new AppError('startDate cannot be greater than endDate', 400));
    }

    const effectiveUserId = resolveRequestedUserId(req, userId);

    const analyticsData = await buildAnalyticsData({
        normalizedStart,
        normalizedEnd,
        effectiveUserId,
    });

    const workbook = await excelService.generateAnalyticsReport(analyticsData);

    res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
        'Content-Disposition',
        `attachment; filename=analytics-report-${analyticsData.period.startDate}-${analyticsData.period.endDate}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
});

exports.exportExcel = catchAsync(async (req, res, next) => {
    const { startDate, endDate, userId } = req.query;

    if ((startDate && !endDate) || (!startDate && endDate)) {
        return next(new AppError('Please provide both startDate and endDate for date filtering', 400));
    }

    if (startDate && endDate && (!isValidDate(startDate) || !isValidDate(endDate))) {
        return next(new AppError('Invalid date format for startDate or endDate', 400));
    }

    const effectiveUserId = resolveRequestedUserId(req, userId);

    const query = {};
    if (startDate && endDate) {
        query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    if (effectiveUserId) {
        query.userId = effectiveUserId;
    }

    const logs = await DayLog.find(query)
        .populate('userId', 'name')
        .populate({
            path: 'projects',
            populate: { path: 'tasks' }
        });

    const reportData = [];
    const periodLabel = `${startDate || 'All'} - ${endDate || 'All'}`;

    logs.forEach((log) => {
        if (!log.projects || log.projects.length === 0) {
            reportData.push({
                user: log.userId,
                date: log.date,
                projectName: '—',
                tasks: [],
                totalHours: log.totalHours,
                period: periodLabel,
            });
            return;
        }

        log.projects.forEach((project) => {
            const projectTasks = project.tasks || [];
            const projectHours = projectTasks.reduce((sum, t) => sum + (Number(t.hours) || 0), 0);
            reportData.push({
                user: log.userId,
                date: log.date,
                projectName: project.name,
                tasks: projectTasks,
                totalHours: Number(projectHours.toFixed(2)),
                period: periodLabel,
            });
        });
    });

    const workbook = await excelService.generateReport(reportData);

    res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
        'Content-Disposition',
        'attachment; filename=work-log-report.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
});

// ─── Project report ───────────────────────────────────────────────────────────

exports.getProjectReport = catchAsync(async (req, res, next) => {
    const { projectId } = req.params;

    const project = await Project.findById(projectId)
        .populate({
            path: 'dayLogId',
            select: 'date userId',
            populate: { path: 'userId', select: 'name email' },
        })
        .populate({ path: 'tasks', populate: { path: 'files' } });

    if (!project) return next(new AppError('Проект не найден', 404));

    const tasks = project.tasks || [];
    const totalHours = Number(tasks.reduce((s, t) => s + (Number(t.hours) || 0), 0).toFixed(2));
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const failedTasks = tasks.filter((t) => t.status === 'failed').length;
    const pendingTasks = tasks.length - completedTasks - failedTasks;
    const testingCompleted = tasks.filter((t) => t.testingStatus === 'completed').length;
    const testingInProgress = tasks.filter((t) => t.testingStatus === 'in_progress').length;
    const testingNotReviewed = tasks.length - testingCompleted - testingInProgress;

    res.status(200).json({
        status: 'success',
        data: {
            project,
            stats: {
                totalTasks: tasks.length,
                completedTasks,
                pendingTasks,
                failedTasks,
                totalHours,
                testingCompleted,
                testingInProgress,
                testingNotReviewed,
                completionRate: tasks.length ? Number(((completedTasks / tasks.length) * 100).toFixed(2)) : 0,
            },
        },
    });
});

exports.exportProjectExcel = catchAsync(async (req, res, next) => {
    const { projectId } = req.params;

    const project = await Project.findById(projectId)
        .populate({ path: 'dayLogId', select: 'date userId', populate: { path: 'userId', select: 'name' } })
        .populate('tasks');

    if (!project) return next(new AppError('Проект не найден', 404));

    const log = project.dayLogId;
    const reportData = [{
        user: log?.userId || { name: '—' },
        date: log?.date || new Date(),
        projectName: project.name,
        tasks: project.tasks || [],
        totalHours: Number((project.tasks || []).reduce((s, t) => s + (Number(t.hours) || 0), 0).toFixed(2)),
        period: `Проект: ${project.name}`,
    }];

    const workbook = await excelService.generateReport(reportData);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=project-report-${project.name}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
});

// ─── Customer report ──────────────────────────────────────────────────────────

exports.getCustomerReport = catchAsync(async (req, res, next) => {
    const { search, startDate, endDate, userId } = req.query;

    const effectiveUserId = resolveRequestedUserId(req, userId);

    const logQuery = {};
    if (startDate && endDate) {
        logQuery.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (effectiveUserId) logQuery.userId = effectiveUserId;

    const logs = await DayLog.find(logQuery, '_id');
    const logIds = logs.map((l) => l._id);

    const taskQuery = { dayLogId: { $in: logIds } };
    if (search && search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        taskQuery.$or = [
            { 'customer.name': regex },
            { 'customer.email': regex },
            { 'customer.externalId': regex },
        ];
    } else {
        taskQuery.$or = [
            { 'customer.name': { $exists: true, $ne: '' } },
            { 'customer.email': { $exists: true, $ne: '' } },
            { 'customer.externalId': { $exists: true, $ne: '' } },
        ];
    }

    const tasks = await Task.find(taskQuery)
        .populate({ path: 'dayLogId', select: 'date userId', populate: { path: 'userId', select: 'name' } })
        .populate({ path: 'projectId', select: 'name' })
        .sort({ createdAt: -1 });

    const customerMap = new Map();
    tasks.forEach((task) => {
        const key = task.customer?.name || task.customer?.email || task.customer?.externalId || '—';
        if (!customerMap.has(key)) {
            customerMap.set(key, {
                customerName: task.customer?.name || '—',
                customerEmail: task.customer?.email || '—',
                customerExternalId: task.customer?.externalId || '—',
                totalTasks: 0,
                completedTasks: 0,
                totalHours: 0,
                tasks: [],
            });
        }
        const c = customerMap.get(key);
        c.totalTasks++;
        c.totalHours = Number((c.totalHours + (Number(task.hours) || 0)).toFixed(2));
        if (task.status === 'completed') c.completedTasks++;
        c.tasks.push(task);
    });

    const customers = Array.from(customerMap.values()).map((c) => ({
        ...c,
        completionRate: c.totalTasks ? Number(((c.completedTasks / c.totalTasks) * 100).toFixed(2)) : 0,
    }));

    res.status(200).json({
        status: 'success',
        data: { customers, totalTasksFound: tasks.length },
    });
});

exports.exportCustomerExcel = catchAsync(async (req, res, next) => {
    const { search, startDate, endDate, userId } = req.query;

    const effectiveUserId = resolveRequestedUserId(req, userId);

    const logQuery = {};
    if (startDate && endDate) {
        logQuery.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (effectiveUserId) logQuery.userId = effectiveUserId;

    const logs = await DayLog.find(logQuery, '_id date userId').populate('userId', 'name');
    const logMap = new Map(logs.map((l) => [String(l._id), l]));
    const logIds = logs.map((l) => l._id);

    const taskQuery = { dayLogId: { $in: logIds } };
    if (search && search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        taskQuery.$or = [
            { 'customer.name': regex },
            { 'customer.email': regex },
            { 'customer.externalId': regex },
        ];
    } else {
        taskQuery.$or = [
            { 'customer.name': { $exists: true, $ne: '' } },
            { 'customer.email': { $exists: true, $ne: '' } },
            { 'customer.externalId': { $exists: true, $ne: '' } },
        ];
    }

    const tasks = await Task.find(taskQuery).populate({ path: 'projectId', select: 'name' });

    const reportData = logs
        .filter((log) => tasks.some((t) => String(t.dayLogId) === String(log._id)))
        .map((log) => ({
            user: log.userId || { name: '—' },
            date: log.date,
            projectName: search || 'Все заказчики',
            tasks: tasks.filter((t) => String(t.dayLogId) === String(log._id)),
            totalHours: Number(
                tasks
                    .filter((t) => String(t.dayLogId) === String(log._id))
                    .reduce((s, t) => s + (Number(t.hours) || 0), 0)
                    .toFixed(2)
            ),
        }));

    const workbook = await excelService.generateReport(reportData);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=customer-report-${search || 'all'}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
});
