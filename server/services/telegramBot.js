const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const User = require('../models/User');
const DayLog = require('../models/DayLog');
const Task = require('../models/Task');
const Project = require('../models/Project');
const UserProject = require('../models/UserProject');
const TaskFile = require('../models/TaskFile');
const AssistantKnowledge = require('../models/AssistantKnowledge');
const TelegramDraft = require('../models/TelegramDraft');
const Reminder = require('../models/Reminder');
const ollamaService = require('./ollamaService');
const { buildTeamContext } = require('./teamContextService');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

const SELF_EXECUTOR_RE = /^(я|сам|я\s*сам|myself|me|o['‘]?zim|ozim|men)$/i;

const QUESTION_RE = /\?\s*$/;
const QUESTION_WORDS = /^(кто|что|как|когда|где|почему|зачем|сколько|расскажи|объясни|опиши|можешь|умеешь|поможешь|помоги|умеет|может|whoami)/i;
const isQuestion = (t) => QUESTION_RE.test(t) || QUESTION_WORDS.test(t.trim());

const LIST_PROJECTS_RE = /(мо[ии]\s+проект|какие\s+(?:у\s+меня\s+)?проект|спис(?:ок|ке)\s+проект|покажи\s+проект|все\s+мо[ии]\s+проект)/i;

// Шире чем `оплач` чтобы ловить опечатки: «оплатил», «оплалатил», «уплачено», «заплатили», «paid»
const UNPAID_LIST_RE = /(не\s*опл|неопл|unpaid|долж[ноы]\s*денег)/i;
const MARK_PAID_RE   = /(опла|запла|упла|paid)/i;

// «запланированные», «за планированые», «планы», «что запланировано», «предстоит», «todo», «planned»
const LIST_PENDING_RE = /(заплан|за\s*план|планир|плани?руем|предсто|todo|planned|план[ыа])/i;

// «напомни», «напомина», «эслат» (uz), «remind», «reminder», «remember»
const REMINDER_RE      = /(напомн[ия]|напомина|reminder|remind|эслат|eslat)/i;
const LIST_REMINDERS_RE = /(мо[ии]\s+напомин|какие.*напомин|спис(?:ок|ке)\s+напомин|покажи\s+напомин|все\s+напомин)/i;

const GREETING_RE = /^(привет(ствую)?|здаров[ао]?|здравствуй(те)?|хай|hi|hello|hey|yo|салом|salom|ассал[оa]м[уo][\s,!.]*(алейкум)?|добр[оы][ейм]?\s+(утр[оа]|день|вечер)|доброе\s+утро|good\s*(morning|afternoon|evening|day))[!.,?\s)]*$/i;

const THANKS_RE = /^(спасибо|спс|благодарю|рахмат|raxmat|thank\s*you|thanks|ty)[!.,?\s)]*$/i;

// Слова, по которым ясно что это запись о работе (прошедшее ИЛИ будущее время).
// ВАЖНО: не используем \b — он не работает с кириллицей в JS regex. Принимаем редкие ложные срабатывания.
const TASK_SIGNAL_RE = /(сдел|доде?л|напи[шс]|сверст|свёрст|пофикс|почин|закр[ыо]|разработ|реализ|настро|задепл|деплой|тестир|тестов|подключ|интегр|выполн|поправ|оформ|собр|обнов|загруз|нарисов|спроект|задизайн|отрефактор|перен[её]с|добав|удал|зали[лв]|провер|изуч|занял|занима|работ|qildim|qilaman|bajardim)|(\d+\s*(?:час|мин))|(\d+\s*ч(?![а-яё]))|(полчаса|пол[\s-]?дня)|(задач|проект|таск|надо|нужно|предстоит)/i;

const formatAbout = (kb) => {
    const dev = kb.developer || {};
    const lines = [
        `📦 *${kb.projectName || 'Проект'}*`,
        '',
        kb.about || '',
        '',
        dev.name ? `👨‍💻 Разработчик: *${dev.name}*${dev.role ? ` — ${dev.role}` : ''}` : '',
        dev.site ? `🌐 ${dev.site}` : '',
        kb.createdAt ? `📅 Создан: ${kb.createdAt}` : '',
    ].filter(Boolean);
    return lines.join('\n');
};

const formatFeatures = (kb) => {
    if (!kb.features?.length) return 'Возможности пока не описаны.';
    return `🛠 *Что я умею:*\n\n${kb.features.map((f) => `• ${f}`).join('\n')}`;
};

class PendingDrafts {
    constructor() { this._map = new Map(); }

    get(draftId) { return this._map.get(draftId) || null; }

    set(draftId, draft) {
        this._map.set(draftId, draft);
        TelegramDraft.findOneAndUpdate(
            { draftId },
            { draftId, chatId: draft.chatId, userId: draft.userId, parsed: draft.parsed || {}, photos: draft.photos || [], awaiting: draft.awaiting || null, photoStepDone: !!draft.photoStepDone, projectStepDone: !!draft.projectStepDone, dateStepDone: !!draft.dateStepDone, customerStepDone: !!draft.customerStepDone },
            { upsert: true }
        ).catch(() => {});
    }

    delete(draftId) {
        const draft = this._map.get(draftId);
        this._map.delete(draftId);
        if (draft) userActiveDraft.delete(draft.chatId);
        TelegramDraft.deleteOne({ draftId }).catch(() => {});
    }

    [Symbol.iterator]() { return this._map[Symbol.iterator](); }
}

class UserActiveDraft {
    constructor() { this._map = new Map(); }
    get(chatId) { return this._map.get(chatId); }
    set(chatId, draftId) { this._map.set(chatId, draftId); }
    delete(chatId) { this._map.delete(chatId); }
}

const pendingDrafts   = new PendingDrafts();
const userActiveDraft = new UserActiveDraft();

async function loadDraftsFromDB() {
    try {
        const docs = await TelegramDraft.find({});
        docs.forEach((doc) => {
            const d = doc.toObject();
            pendingDrafts._map.set(d.draftId, d);
            userActiveDraft._map.set(d.chatId, d.draftId);
        });
        if (docs.length) console.log(`[Bot] Restored ${docs.length} draft(s) from DB`);
    } catch (e) {
        console.error('[Bot] Failed to load drafts from DB:', e.message);
    }
}

const findUserByTelegramId = (tgId) => User.findOne({ telegramId: String(tgId) });

const resolveExecutor = (parsed, user) => {
    const raw = parsed.executor;
    if (!raw || SELF_EXECUTOR_RE.test(raw.trim())) return user.name;
    return raw.trim();
};

const fmtAmount = (amount, currency) => {
    if (!amount) return '';
    const s = Number(amount).toLocaleString('ru-RU');
    return `${s} ${currency || 'UZS'}`;
};

const formatPreview = (p, executorName, photoCount = 0) => {
    const kindLabel = p.kind === 'external' ? '🌍 Внешняя' : '💼 Рабочая';
    const paymentLabel = p.kind === 'external'
        ? (p.payment === 'paid' ? '💰 Оплачено' : '⌛ Не оплачено')
        : null;
    const statusLabel = p.status === 'pending' ? '⏳ Запланировано' : '✅ Завершено';

    const lines = [
        `📌 *Задача:* ${p.title || '—'}`,
        `⏱ *Время:* ${p.hours} ч`,
        p.customer ? `👤 *Заказчик:* ${p.customer}` : null,
        p.project ? `📁 *Проект:* ${p.project}` : null,
        executorName ? `🛠 *Исполнитель:* ${executorName}` : null,
        `📅 *Дата:* ${p.date || 'сегодня'}`,
        `🏷 *Тип:* ${kindLabel}`,
        paymentLabel,
        photoCount > 0 ? `📷 *Фото:* ${photoCount}` : null,
        `*Статус:* ${statusLabel}`,
        p.description ? `📝 ${p.description}` : null,
    ].filter(Boolean);
    return lines.join('\n');
};

const buildDraftKeyboard = (draftId, parsed) => {
    const rows = [
        [
            Markup.button.callback(
                parsed.kind === 'external' ? '✅ 🌍 Внешняя' : '🌍 Внешняя',
                `kind:${draftId}:external`,
            ),
            Markup.button.callback(
                parsed.kind === 'work' ? '✅ 💼 Рабочая' : '💼 Рабочая',
                `kind:${draftId}:work`,
            ),
        ],
    ];
    if (parsed.kind === 'external') {
        rows.push([
            Markup.button.callback(
                parsed.payment === 'paid' ? '✅ 💰 Оплачено' : '💰 Оплачено',
                `pay:${draftId}:paid`,
            ),
            Markup.button.callback(
                parsed.payment === 'unpaid' ? '✅ ⌛ Не оплачено' : '⌛ Не оплачено',
                `pay:${draftId}:unpaid`,
            ),
        ]);
    }
    rows.push([
        Markup.button.callback('✅ Сохранить', `save:${draftId}`),
        Markup.button.callback('❌ Отмена',    `cancel:${draftId}`),
    ]);
    return Markup.inlineKeyboard(rows);
};

const buildPhotoPromptKeyboard = (draftId) =>
    Markup.inlineKeyboard([[Markup.button.callback('⏭ Готово / Пропустить', `photodone:${draftId}`)]]);

const buildCustomerPromptKeyboard = (draftId) =>
    Markup.inlineKeyboard([[Markup.button.callback('⏭ Пропустить (без заказчика)', `skipcust:${draftId}`)]]);

async function buildProjectPromptKeyboard(draftId, userId, draft) {
    const projects = await UserProject.find({ userId })
        .sort({ lastTaskAt: -1, createdAt: -1 })
        .limit(6)
        .lean();
    draft.projectChoices = projects.map((p) => p.name);
    const rows = [];
    for (let i = 0; i < projects.length; i += 2) {
        const slice = projects.slice(i, i + 2);
        rows.push(slice.map((p, j) =>
            Markup.button.callback(`📁 ${p.name}`, `useproj:${draftId}:${i + j}`)
        ));
    }
    rows.push([Markup.button.callback('⏭ Без проекта', `skipproj:${draftId}`)]);
    return { keyboard: Markup.inlineKeyboard(rows), hasExisting: projects.length > 0 };
}

const buildDatePromptKeyboard = (draftId) =>
    Markup.inlineKeyboard([
        [
            Markup.button.callback('📅 Сегодня', `date:${draftId}:today`),
            Markup.button.callback('➡️ Завтра', `date:${draftId}:tomorrow`),
        ],
        [
            Markup.button.callback('⬅️ Вчера', `date:${draftId}:yesterday`),
            Markup.button.callback('⏩ Послезавтра', `date:${draftId}:dayafter`),
        ],
        [Markup.button.callback('✏️ Другая дата', `date:${draftId}:custom`)],
    ]);

function dateOffsetToIso(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
}

function parseCustomDate(text) {
    const m = text.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    // Поддержка форматов: 15.06.2026 или 15/06/2026
    const m2 = text.trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
    if (m2) {
        const yr = m2[3].length === 2 ? `20${m2[3]}` : m2[3];
        return `${yr}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
    }
    return null;
}

const makeDraftId = (ctx) => `${ctx.from.id}:${ctx.message.message_id}`;

function parseHoursReply(text) {
    const cleaned = text.trim().toLowerCase()
        .replace(',', '.')
        .replace(/\s+часа?[a-яa-z]*/g, '')
        .replace(/\s*ч\b/g, '');
    const m = cleaned.match(/(\d+(?:\.\d+)?)/);
    if (!m) return null;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0 || n > 24) return null;
    return n;
}

async function downloadTelegramPhoto(ctx, fileId) {
    const link = await ctx.telegram.getFileLink(fileId);
    const res = await fetch(link.href || link);
    if (!res.ok) throw new Error(`Не удалось скачать фото (HTTP ${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    const urlStr = link.href || String(link);
    const ext = path.extname(new URL(urlStr).pathname) || '.jpg';
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const filename = `tg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buf);
    return { filename, mimeType: 'image/jpeg' };
}

async function ensureUserProject({ userId, name, customer }) {
    if (!name) return null;
    const trimmed = String(name).trim();
    if (!trimmed) return null;
    const safe = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let project = await UserProject.findOne({
        userId,
        name: new RegExp(`^${safe}$`, 'i'),
    });
    if (project) {
        if (customer && !project.customer) {
            project.customer = String(customer).trim();
            await project.save();
        }
        return project;
    }
    return UserProject.create({
        userId,
        name: trimmed,
        customer: customer ? String(customer).trim() : '',
    });
}

const saveTask = async ({ user, parsed, photos = [] }) => {
    const dateStr = parsed.date || new Date().toISOString().slice(0, 10);
    const dateStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dateEnd = new Date(`${dateStr}T23:59:59.999Z`);

    let dayLog = await DayLog.findOne({
        userId: user._id,
        date: { $gte: dateStart, $lte: dateEnd },
    });
    if (!dayLog) {
        dayLog = await DayLog.create({ userId: user._id, date: dateStart });
    }

    let projectId = null;
    if (parsed.project) {
        const name = parsed.project.trim();
        let project = await Project.findOne({
            dayLogId: dayLog._id,
            name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        });
        if (!project) {
            project = await Project.create({ dayLogId: dayLog._id, name });
        }
        projectId = project._id;
    }

    const executor = resolveExecutor(parsed, user);
    const executorField = executor === user.name ? '' : executor;

    const kind = parsed.kind === 'external' ? 'external' : 'work';
    const paymentStatus = parsed.payment === 'paid' ? 'paid' : 'unpaid';

    const taskStatus = parsed.status === 'pending' ? 'pending' : 'completed';

    // 4-значный код только для внешних задач (чтобы можно было сослаться при оплате)
    const shortCode = kind === 'external' ? await generateShortCode(user._id) : null;

    const task = await Task.create({
        dayLogId: dayLog._id,
        projectId,
        title: parsed.title || 'Без названия',
        description: parsed.description || undefined,
        hours: parsed.hours || 0,
        status: taskStatus,
        executor: executorField,
        customer: parsed.customer ? { name: parsed.customer } : undefined,
        kind,
        shortCode,
        payment: {
            status:   paymentStatus,
            amount:   Number(parsed.amount) || 0,
            currency: parsed.currency || 'UZS',
            paidAt:   paymentStatus === 'paid' ? new Date() : null,
        },
    });

    if (photos.length) {
        await TaskFile.insertMany(photos.map((p) => ({
            taskId: task._id,
            title: p.filename,
            fileUrl: `uploads/${p.filename}`,
            fileType: p.mimeType || 'image/jpeg',
        })));
    }

    if (parsed.project) {
        const up = await ensureUserProject({
            userId: user._id,
            name: parsed.project,
            customer: parsed.customer,
        });
        if (up) {
            up.totalHours = (up.totalHours || 0) + (Number(parsed.hours) || 0);
            up.lastTaskAt = new Date();
            await up.save();
        }
    }

    return { dayLog, task };
};

async function listUserProjects(ctx, user) {
    const projects = await UserProject.find({ userId: user._id })
        .sort({ lastTaskAt: -1, createdAt: -1 })
        .lean();

    if (!projects.length) {
        return ctx.reply('📁 У тебя пока нет проектов.\n\nПросто упомяни проект в задаче — например «сделал верстку 2ч проект Dashboard» — и я его запомню.');
    }

    const statusEmoji = { active: '🟢', paused: '⏸', completed: '✅' };
    const lines = projects.map((p, i) => {
        const ext = [];
        if (p.customer) ext.push(`заказчик: ${p.customer}`);
        if (p.totalHours) ext.push(`${p.totalHours} ч`);
        const tail = ext.length ? `  _(${ext.join(', ')})_` : '';
        return `${i + 1}. ${statusEmoji[p.status] || '•'} *${p.name}*${tail}`;
    });

    return ctx.reply(
        `📁 *Твои проекты (${projects.length}):*\n\n${lines.join('\n')}`,
        { parse_mode: 'Markdown' },
    );
}

async function generateShortCode(userId) {
    const dayLogs = await DayLog.find({ userId }).select('_id').lean();
    const ids = dayLogs.map((d) => d._id);
    if (!ids.length) return '0001';
    const tasks = await Task.find({
        dayLogId: { $in: ids },
        shortCode: { $exists: true, $ne: null },
    }).select('shortCode').lean();
    const nums = tasks.map((t) => parseInt(t.shortCode, 10)).filter((n) => Number.isFinite(n));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return String(next).padStart(4, '0');
}

async function backfillCodesIfNeeded(userId, tasks) {
    // Принимает массив lean-task и подставляет коды для тех у кого нет
    const missing = tasks.filter((t) => !t.shortCode);
    if (!missing.length) return tasks;

    const dayLogs = await DayLog.find({ userId }).select('_id').lean();
    const ids = dayLogs.map((d) => d._id);
    const all = await Task.find({
        dayLogId: { $in: ids },
        shortCode: { $exists: true, $ne: null },
    }).select('shortCode').lean();
    let max = all.reduce((m, t) => {
        const n = parseInt(t.shortCode, 10);
        return Number.isFinite(n) && n > m ? n : m;
    }, 0);

    for (const t of missing) {
        max += 1;
        const code = String(max).padStart(4, '0');
        await Task.findByIdAndUpdate(t._id, { shortCode: code });
        t.shortCode = code;
    }
    return tasks;
}

async function listUnpaidTasks(ctx, user) {
    const dayLogs = await DayLog.find({ userId: user._id }).select('_id').lean();
    const ids = dayLogs.map((d) => d._id);
    if (!ids.length) {
        return ctx.reply('💰 Неоплаченных задач нет.');
    }

    let tasks = await Task.find({
        dayLogId: { $in: ids },
        kind: 'external',
        'payment.status': 'unpaid',
    })
        .populate('dayLogId', 'date')
        .populate('projectId', 'name')
        .sort({ createdAt: -1 })
        .lean();

    if (!tasks.length) {
        return ctx.reply('✅ У тебя нет неоплаченных внешних задач. Молодец!');
    }

    tasks = await backfillCodesIfNeeded(user._id, tasks);

    const totalHours = tasks.reduce((s, t) => s + (Number(t.hours) || 0), 0);

    const lines = [`⌛ *Неоплаченные задачи (${tasks.length}):*`, ''];
    tasks.forEach((t) => {
        // DD.MM (по-русски), не MM.DD
        const date = t.dayLogId?.date
            ? (() => { const d = new Date(t.dayLogId.date); return `${String(d.getUTCDate()).padStart(2,'0')}.${String(d.getUTCMonth()+1).padStart(2,'0')}`; })()
            : '—';
        const cust = t.customer?.name ? `👤 ${t.customer.name}` : '';
        const proj = t.projectId?.name ? `📁 ${t.projectId.name}` : '';
        const extras = [cust, proj].filter(Boolean).join(' · ');
        lines.push(`*#${t.shortCode}* · ${date} · ${t.title || '—'}`);
        lines.push(`   ⏱ ${t.hours || 0}ч${extras ? ' · ' + extras : ''}`);
        lines.push('');
    });

    lines.push(`📊 *Итого:* ${totalHours}ч`);
    lines.push('');
    lines.push('_Чтобы пометить как оплаченное:_ «оплачено 0001»');

    return ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
}

async function markTaskPaidByCode(ctx, user, code) {
    const padded = String(code).padStart(4, '0');
    const dayLogs = await DayLog.find({ userId: user._id }).select('_id').lean();
    const ids = dayLogs.map((d) => d._id);
    const task = await Task.findOne({
        dayLogId: { $in: ids },
        shortCode: padded,
    }).populate('dayLogId', 'date');

    if (!task) {
        return ctx.reply(`❌ Задача #${padded} не найдена. Напиши «неоплаченные» — покажу актуальный список.`);
    }
    if (task.kind !== 'external') {
        return ctx.reply(`❌ Задача #${padded} не внешняя — оплата к ней не применяется.`);
    }
    if (task.payment?.status === 'paid') {
        return ctx.reply(`ℹ️ Задача #${padded} «${task.title}» уже была оплачена.`);
    }

    task.payment.status = 'paid';
    task.payment.paidAt = new Date();
    await task.save();

    return ctx.reply(
        `✅ Задача *#${padded}* «${task.title}» помечена как *оплаченная*.`,
        { parse_mode: 'Markdown' },
    );
}

async function listPendingTasks(ctx, user) {
    const dayLogs = await DayLog.find({ userId: user._id }).select('_id date').lean();
    if (!dayLogs.length) {
        return ctx.reply('📭 Запланированных задач нет.');
    }
    const ids = dayLogs.map((d) => d._id);
    const tasks = await Task.find({
        dayLogId: { $in: ids },
        status: 'pending',
    })
        .populate('dayLogId', 'date')
        .populate('projectId', 'name')
        .sort({ createdAt: -1 })
        .lean();

    if (!tasks.length) {
        return ctx.reply('✅ Запланированных задач нет. Всё под контролем!');
    }

    // Сортируем по дате (ближайшие сверху)
    tasks.sort((a, b) => {
        const da = a.dayLogId?.date ? new Date(a.dayLogId.date).getTime() : 0;
        const db = b.dayLogId?.date ? new Date(b.dayLogId.date).getTime() : 0;
        return da - db;
    });

    const todayMs = new Date(new Date().toISOString().slice(0, 10)).getTime();
    const totalHours = tasks.reduce((s, t) => s + (Number(t.hours) || 0), 0);

    const lines = [`⏳ *Запланированные задачи (${tasks.length}):*`, ''];
    tasks.forEach((t) => {
        const d = t.dayLogId?.date ? new Date(t.dayLogId.date) : null;
        const dateStr = d ? d.toISOString().slice(0, 10) : '—';
        let when = '';
        if (d) {
            const diff = Math.round((d.getTime() - todayMs) / (24 * 3600 * 1000));
            if (diff === 0) when = ' (сегодня)';
            else if (diff === 1) when = ' (завтра)';
            else if (diff === -1) when = ' (вчера, просрочена)';
            else if (diff > 1) when = ` (через ${diff} дн.)`;
            else when = ` (просрочена на ${Math.abs(diff)} дн.)`;
        }
        const proj = t.projectId?.name ? ` · 📁 ${t.projectId.name}` : '';
        const cust = t.customer?.name ? ` · 👤 ${t.customer.name}` : '';
        const code = t.shortCode ? ` · #${t.shortCode}` : '';
        lines.push(`📌 *${t.title || '—'}*`);
        lines.push(`   📅 ${dateStr}${when} · ⏱ ${t.hours || 0}ч${proj}${cust}${code}`);
        lines.push('');
    });
    lines.push(`📊 *Итого:* ${totalHours}ч`);

    return ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
}

function formatReminderTime(date) {
    // DD.MM HH:mm в Asia/Tashkent (UTC+5)
    const d = new Date(date.getTime() + 5 * 60 * 60 * 1000);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mi = String(d.getUTCMinutes()).padStart(2, '0');
    return `${dd}.${mm} ${hh}:${mi}`;
}

function buildReminderConfirmKeyboard(draftId) {
    return Markup.inlineKeyboard([
        [Markup.button.callback('✅ Сохранить', `remsave:${draftId}`)],
        [
            Markup.button.callback('⏰ Изменить время', `remedit:${draftId}`),
            Markup.button.callback('❌ Отмена',         `remcancel:${draftId}`),
        ],
    ]);
}

function buildReminderFireKeyboard(reminderId) {
    return Markup.inlineKeyboard([
        [Markup.button.callback('✅ Готово', `rdone:${reminderId}`)],
        [
            Markup.button.callback('⏰ +1ч',    `rsnooze:${reminderId}:1h`),
            Markup.button.callback('⏰ +1д',    `rsnooze:${reminderId}:1d`),
        ],
    ]);
}

const pendingReminders = new Map(); // draftId → { chatId, userId, text, fireAt, sourceMessage, awaiting? }

async function listUserReminders(ctx, user) {
    const items = await Reminder.find({
        userId: user._id,
        status: { $in: ['pending', 'snoozed'] },
    }).sort({ fireAt: 1 }).lean();

    if (!items.length) {
        return ctx.reply('🔔 Активных напоминаний нет.\n\nЧтобы добавить — скажи мне «напомни …». Например: «напомни завтра в 9 позвонить Амиру».');
    }

    const lines = [`🔔 *Твои напоминания (${items.length}):*`, ''];
    items.forEach((r, i) => {
        lines.push(`${i + 1}. ${r.text}`);
        lines.push(`   📅 ${formatReminderTime(new Date(r.fireAt))}${r.status === 'snoozed' ? ' (отложено)' : ''}`);
        lines.push('');
    });
    lines.push('_Чтобы убрать — открой страницу «Напоминания» в веб-приложении._');
    return ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
}

async function getTasksFor(userId, dateIso) {
    const dateStart = new Date(`${dateIso}T00:00:00.000Z`);
    const dateEnd = new Date(`${dateIso}T23:59:59.999Z`);
    const dayLog = await DayLog.findOne({
        userId,
        date: { $gte: dateStart, $lte: dateEnd },
    });
    if (!dayLog) return [];
    return Task.find({ dayLogId: dayLog._id }).sort({ status: 1, createdAt: 1 }).lean();
}

async function sendTodaySummary(telegram, chatId, user, opts = {}) {
    const dateIso = new Date().toISOString().slice(0, 10);
    const tasks = await getTasksFor(user._id, dateIso);

    if (!tasks.length) {
        // Не дёргать пользователя из крона — только при явном запросе (/today)
        if (opts.silentIfEmpty || opts.onlyIfPending) return false;
        await telegram.sendMessage(chatId, `📭 На сегодня (${dateIso}) задач нет.`);
        return false;
    }

    const pending   = tasks.filter((t) => t.status === 'pending');
    const completed = tasks.filter((t) => t.status === 'completed');

    if (opts.onlyIfPending && !pending.length) return false;

    const lines = [`📅 *Сегодня (${dateIso})*`, ''];
    if (pending.length) {
        lines.push(`⏳ *Запланировано (${pending.length}):*`);
        pending.forEach((t, i) => lines.push(`${i + 1}. ${t.title}${t.hours ? ` — ${t.hours}ч` : ''}`));
        lines.push('');
    }
    if (completed.length) {
        lines.push(`✅ *Сделано (${completed.length}):*`);
        const total = completed.reduce((s, t) => s + (t.hours || 0), 0);
        completed.forEach((t, i) => lines.push(`${i + 1}. ${t.title}${t.hours ? ` — ${t.hours}ч` : ''}`));
        lines.push(`\n_Всего: ${total}ч_`);
    }

    await telegram.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' });
    return true;
}

// Раз в день отправляем напоминание про запланированные задачи (между 9:00 и 11:00)
const remindedToday = new Map(); // userId(string) → 'YYYY-MM-DD'

async function fireDueReminders(telegram) {
    const now = new Date();
    const due = await Reminder.find({
        status: { $in: ['pending', 'snoozed'] },
        fireAt: { $lte: now },
    }).populate('userId', 'telegramId name').limit(50);

    for (const r of due) {
        const tgId = r.userId?.telegramId;
        if (!tgId) {
            // Юзер отвязал аккаунт — отметим как sent, чтобы не сыпало
            r.status = 'sent';
            r.sentAt = new Date();
            await r.save();
            continue;
        }
        try {
            await telegram.sendMessage(
                tgId,
                `🔔 *Напоминание!*\n\n${r.text}`,
                { parse_mode: 'Markdown', ...buildReminderFireKeyboard(r._id) },
            );
            r.status = 'sent';
            r.sentAt = new Date();
            await r.save();
        } catch (err) {
            console.error(`fire reminder ${r._id} error:`, err.message);
        }
    }
}

async function runReminderTick(telegram) {
    const now = new Date();
    const hour = now.getHours();
    if (hour < 9 || hour > 11) return;          // утреннее окно
    const dateIso = now.toISOString().slice(0, 10);

    const users = await User.find({ telegramId: { $type: 'string' } }).lean();
    for (const u of users) {
        const key = String(u._id);
        if (remindedToday.get(key) === dateIso) continue;
        try {
            const sent = await sendTodaySummary(telegram, u.telegramId, u, { onlyIfPending: true });
            if (sent) remindedToday.set(key, dateIso);
        } catch (err) {
            console.error(`reminder error for ${u.email}:`, err.message);
        }
    }
}

async function advanceDraft(ctx, draftId) {
    const draft = pendingDrafts.get(draftId);
    if (!draft) return;

    if (!draft.parsed.hours || draft.parsed.hours <= 0) {
        draft.awaiting = 'hours';
        pendingDrafts.set(draftId, draft);
        await ctx.reply('⏱ Сколько часов потрачено? Напиши число (например: 2 или 1.5).');
        return;
    }

    if (!draft.parsed.description || !draft.parsed.description.trim()) {
        draft.awaiting = 'description';
        pendingDrafts.set(draftId, draft);
        await ctx.reply('📝 Опиши подробнее, что именно сделал.');
        return;
    }

    if (!draft.parsed.project && !draft.projectStepDone) {
        draft.awaiting = 'project';
        pendingDrafts.set(draftId, draft);
        const { keyboard, hasExisting } = await buildProjectPromptKeyboard(draftId, draft.userId, draft);
        await ctx.reply(
            hasExisting
                ? '📁 К какому проекту относится? Выбери из списка ниже или напиши название нового.'
                : '📁 К какому проекту относится? Напиши название проекта или нажми «⏭ Без проекта».',
            keyboard,
        );
        return;
    }

    if (!draft.parsed.date && !draft.dateStepDone) {
        draft.awaiting = 'date';
        pendingDrafts.set(draftId, draft);
        await ctx.reply(
            '📅 На какую дату записать? Выбери или нажми «Другая дата» и пришли вручную.',
            buildDatePromptKeyboard(draftId),
        );
        return;
    }

    if (!draft.parsed.customer && !draft.customerStepDone) {
        draft.awaiting = 'customer';
        pendingDrafts.set(draftId, draft);
        await ctx.reply(
            '👤 Кто заказчик? Напиши имя/название (например «Амир», «ООО Ромашка») или нажми «⏭ Пропустить» если это внутренняя работа.',
            buildCustomerPromptKeyboard(draftId),
        );
        return;
    }

    if (!draft.photoStepDone) {
        draft.awaiting = 'photo';
        pendingDrafts.set(draftId, draft);
        await ctx.reply(
            '📷 Прикрепи фото работы (скриншот/фото) или нажми «⏭ Готово / Пропустить».',
            buildPhotoPromptKeyboard(draftId),
        );
        return;
    }

    // All collected — show final preview with save buttons
    draft.awaiting = null;
    pendingDrafts.set(draftId, draft);

    const user = await User.findById(draft.userId);
    const executorName = user ? resolveExecutor(draft.parsed, user) : '';
    await ctx.reply(
        `Готов сохранить?\n\n${formatPreview(draft.parsed, executorName, draft.photos.length)}`,
        { parse_mode: 'Markdown', ...buildDraftKeyboard(draftId, draft.parsed) },
    );
}

function createBot(token) {
    const bot = new Telegraf(token);

    bot.start(async (ctx) => {
        const kb = await AssistantKnowledge.getOrCreate();
        const user = await findUserByTelegramId(ctx.from.id);
        const greet = kb.greeting || '👋 Привет! Я ассистент проекта.';
        let tail;
        if (!user) {
            tail = '\n\nЧтобы привязать аккаунт, отправь *6-значный код*, который выдал администратор.\n\n/about — о проекте\n/help — что я умею';
        } else {
            const roleLabels = { admin: '👑 Супер-админ', projectManager: '🧑‍💼 Менеджер', worker: '🛠 Сотрудник', guest: '👤 Гость' };
            const roleLabel = roleLabels[user.role] || user.role;
            const extras = [];
            if (user.role === 'admin') {
                extras.push('• «Кто сегодня свободен?»', '• «Какие задачи у менеджера Алишера?»', '• «Сколько часов отработал X сегодня?»');
            } else if (user.role === 'projectManager') {
                extras.push('• «Какие у меня активные задачи?»', '• «Кто из моих свободен?»');
            }
            tail = `\n\n${user.name} — ${roleLabel}.\n\nПиши, что сделал — я запишу. Спроси что-то — отвечу.\n«Мои проекты» — увидишь список своих проектов.${extras.length ? '\n\nПримеры вопросов:\n' + extras.join('\n') : ''}\n\n/projects — мои проекты\n/about — о проекте\n/help — что я умею`;
        }
        return ctx.reply(greet + tail, { parse_mode: 'Markdown' });
    });

    bot.command('about', async (ctx) => {
        const kb = await AssistantKnowledge.getOrCreate();
        return ctx.reply(formatAbout(kb), { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } });
    });

    bot.command('help', async (ctx) => {
        const kb = await AssistantKnowledge.getOrCreate();
        const extra = '\n\n*Команды:*\n/projects — мои проекты\n/today — задачи на сегодня\n/planned — запланированные\n/unpaid — неоплаченные\n/reminders — мои напоминания\n/about — о проекте\n/whoami — кто я\n/logout — отвязать аккаунт\n\n*Подсказки:*\n• Имя задачи можно явно указать в кавычках: `сделал "Верстка главной" 2ч проект Dashboard, использовал tailwind, lazy-load карточек`\n• Длинные подробности (>30 символов) сохраняются как ты написал, бот их не сокращает.\n\n*Примеры:*\n• «сделал верстку Dashboard 2ч»\n• «напомни завтра в 9 позвонить Амиру»\n• «неоплаченные» / «оплачено 0001»';
        return ctx.reply(formatFeatures(kb) + extra, { parse_mode: 'Markdown' });
    });

    bot.command('logout', async (ctx) => {
        const user = await findUserByTelegramId(ctx.from.id);
        if (!user) return ctx.reply('Аккаунт не привязан.');
        user.telegramId = null;
        await user.save({ validateBeforeSave: false });
        userActiveDraft.delete(ctx.chat.id);
        return ctx.reply('🔓 Аккаунт отвязан. Чтобы привязать снова — отправь 6-значный код.');
    });

    bot.command('whoami', async (ctx) => {
        const user = await findUserByTelegramId(ctx.from.id);
        if (!user) return ctx.reply('Не привязан. Отправь 6-значный код от админа.');
        return ctx.reply(`👤 ${user.name} | ${user.email} | роль: ${user.role}`);
    });

    bot.command('projects', async (ctx) => {
        const user = await findUserByTelegramId(ctx.from.id);
        if (!user) return ctx.reply('Сначала привяжи аккаунт: отправь 6-значный код.');
        return listUserProjects(ctx, user);
    });

    bot.command('today', async (ctx) => {
        const user = await findUserByTelegramId(ctx.from.id);
        if (!user) return ctx.reply('Сначала привяжи аккаунт: отправь 6-значный код.');
        return sendTodaySummary(ctx.telegram, ctx.chat.id, user);
    });

    bot.command('unpaid', async (ctx) => {
        const user = await findUserByTelegramId(ctx.from.id);
        if (!user) return ctx.reply('Сначала привяжи аккаунт.');
        return listUnpaidTasks(ctx, user);
    });

    bot.command('planned', async (ctx) => {
        const user = await findUserByTelegramId(ctx.from.id);
        if (!user) return ctx.reply('Сначала привяжи аккаунт.');
        return listPendingTasks(ctx, user);
    });

    bot.command('reminders', async (ctx) => {
        const user = await findUserByTelegramId(ctx.from.id);
        if (!user) return ctx.reply('Сначала привяжи аккаунт.');
        return listUserReminders(ctx, user);
    });

    // Подтверждение и сохранение напоминания
    bot.action(/^remsave:(.+)$/, async (ctx) => {
        const draftId = ctx.match[1];
        const draft = pendingReminders.get(draftId);
        await ctx.answerCbQuery();
        if (!draft) return ctx.editMessageText('⏱ Черновик потерян, повтори: «напомни …».');
        try {
            const r = await Reminder.create({
                userId:        draft.userId,
                text:          draft.text,
                fireAt:        draft.fireAt,
                sourceMessage: draft.sourceMessage,
            });
            pendingReminders.delete(draftId);
            await ctx.editMessageText(
                `✅ Напоминание сохранено!\n\n🔔 ${r.text}\n📅 ${formatReminderTime(new Date(r.fireAt))}`,
                { parse_mode: 'Markdown' },
            );
        } catch (err) {
            console.error('reminder save error:', err.message);
            await ctx.editMessageText(`❌ Не получилось сохранить: ${err.message}`);
        }
    });

    bot.action(/^remcancel:(.+)$/, async (ctx) => {
        const draftId = ctx.match[1];
        pendingReminders.delete(draftId);
        await ctx.answerCbQuery('Отменено');
        await ctx.editMessageText('❌ Напоминание отменено.');
    });

    bot.action(/^remedit:(.+)$/, async (ctx) => {
        const draftId = ctx.match[1];
        const draft = pendingReminders.get(draftId);
        await ctx.answerCbQuery();
        if (!draft) return;
        draft.awaiting = 'time';
        pendingReminders.set(draftId, draft);
        try { await ctx.editMessageReplyMarkup(undefined); } catch {}
        await ctx.reply('✏️ Напиши новое время. Примеры:\n• `завтра в 10:30`\n• `через 2 часа`\n• `15.06.2026 09:00`\n• `сегодня в 18`', { parse_mode: 'Markdown' });
    });

    // Действия по сработавшему напоминанию
    bot.action(/^rdone:(.+)$/, async (ctx) => {
        const id = ctx.match[1];
        await ctx.answerCbQuery('Готово');
        try {
            await Reminder.findByIdAndUpdate(id, { status: 'sent' });
            try { await ctx.editMessageReplyMarkup(undefined); } catch {}
            await ctx.reply('✅ Напоминание закрыто.');
        } catch (err) { console.error('rdone error:', err.message); }
    });

    bot.action(/^rsnooze:(.+):(1h|1d)$/, async (ctx) => {
        const id = ctx.match[1];
        const dur = ctx.match[2];
        await ctx.answerCbQuery();
        try {
            const r = await Reminder.findById(id);
            if (!r) return;
            const addMs = dur === '1h' ? 3600_000 : 24 * 3600_000;
            r.fireAt = new Date(Date.now() + addMs);
            r.status = 'snoozed';
            r.snoozeCount = (r.snoozeCount || 0) + 1;
            await r.save();
            try { await ctx.editMessageReplyMarkup(undefined); } catch {}
            await ctx.reply(`⏰ Перенесено на ${formatReminderTime(r.fireAt)}.`);
        } catch (err) { console.error('rsnooze error:', err.message); }
    });

    bot.command('cancel', async (ctx) => {
        const draftId = userActiveDraft.get(ctx.chat.id);
        if (draftId) {
            pendingDrafts.delete(draftId);
            userActiveDraft.delete(ctx.chat.id);
            return ctx.reply('❌ Текущий черновик отменён.');
        }
        return ctx.reply('Нет активного черновика.');
    });

    bot.on('text', async (ctx) => {
        if (ctx.message.text.startsWith('/')) return;
        const text = ctx.message.text.trim();

        const user = await findUserByTelegramId(ctx.from.id);

        if (!user) {
            const code = text.replace(/\D/g, '');
            if (!/^\d{6}$/.test(code)) {
                return ctx.reply('🔢 Отправь 6-значный код, выданный администратором.');
            }
            const candidate = await User.findOne({ telegramLinkCode: code });
            if (!candidate) {
                return ctx.reply('❌ Код не найден или уже использован. Проверь с админом.');
            }
            candidate.telegramId = String(ctx.from.id);
            candidate.telegramLinkCode = null;
            await candidate.save({ validateBeforeSave: false });
            return ctx.reply(
                `✅ Аккаунт привязан: ${candidate.name} (${candidate.email}).\n\nТеперь просто пиши, что сделал — я разберу и сохраню.`
            );
        }

        // === Reminder draft awaiting new time ===
        for (const [draftId, draft] of pendingReminders) {
            if (draft.chatId !== ctx.chat.id || draft.awaiting !== 'time') continue;
            try {
                const parsed = await ollamaService.parseReminderMessage(`напомни ${draft.text} ${text}`);
                draft.fireAt = parsed.fireAt;
                draft.awaiting = null;
                pendingReminders.set(draftId, draft);
                await ctx.reply(
                    `🔔 *Напомнить:* ${draft.text}\n📅 *Когда:* ${formatReminderTime(parsed.fireAt)}\n\nПодтверди?`,
                    { parse_mode: 'Markdown', ...buildReminderConfirmKeyboard(draftId) },
                );
            } catch (err) {
                await ctx.reply(`Не понял время: ${err.message}. Попробуй ещё раз или нажми «❌ Отмена» в предыдущем сообщении.`);
            }
            return;
        }

        // === Active draft in follow-up state ===
        const activeDraftId = userActiveDraft.get(ctx.chat.id);
        if (activeDraftId) {
            const draft = pendingDrafts.get(activeDraftId);
            if (draft) {
                if (draft.awaiting === 'hours') {
                    const h = parseHoursReply(text);
                    if (h === null) {
                        return ctx.reply('Не понял, сколько часов. Напиши числом: «2», «1.5», «0.5».');
                    }
                    draft.parsed.hours = h;
                    pendingDrafts.set(activeDraftId, draft);
                    return advanceDraft(ctx, activeDraftId);
                }
                if (draft.awaiting === 'description') {
                    draft.parsed.description = text;
                    pendingDrafts.set(activeDraftId, draft);
                    return advanceDraft(ctx, activeDraftId);
                }
                if (draft.awaiting === 'project') {
                    if (/^(нет|no|—|-|skip|пропуст[ьи]|без\s*проект)/i.test(text)) {
                        draft.projectStepDone = true;
                    } else {
                        draft.parsed.project = text.trim();
                        draft.projectStepDone = true;
                        try {
                            await ensureUserProject({
                                userId: draft.userId,
                                name: draft.parsed.project,
                                customer: draft.parsed.customer,
                            });
                        } catch (e) { console.error('ensureUserProject error:', e.message); }
                    }
                    pendingDrafts.set(activeDraftId, draft);
                    return advanceDraft(ctx, activeDraftId);
                }
                if (draft.awaiting === 'date') {
                    const iso = parseCustomDate(text);
                    if (!iso) {
                        return ctx.reply('Не понял дату. Напиши в формате 2026-06-15 или 15.06.2026.');
                    }
                    draft.parsed.date = iso;
                    // Авто-статус: если дата позже сегодня → pending, иначе оставляем как есть
                    const today = new Date().toISOString().slice(0, 10);
                    if (iso > today) draft.parsed.status = 'pending';
                    draft.dateStepDone = true;
                    pendingDrafts.set(activeDraftId, draft);
                    return advanceDraft(ctx, activeDraftId);
                }
                if (draft.awaiting === 'customer') {
                    // Принимаем имя; «нет/-/пусто» = пропустить
                    if (/^(нет|no|—|-|skip|пропуст[ьи])$/i.test(text)) {
                        draft.customerStepDone = true;
                    } else {
                        draft.parsed.customer = text.trim();
                        draft.customerStepDone = true;
                    }
                    pendingDrafts.set(activeDraftId, draft);
                    return advanceDraft(ctx, activeDraftId);
                }
                if (draft.awaiting === 'photo') {
                    return ctx.reply('📷 Жду фото или нажми «⏭ Готово / Пропустить».');
                }
            }
        }

        // === Unpaid list ===
        if (UNPAID_LIST_RE.test(text)) {
            return listUnpaidTasks(ctx, user);
        }

        // === Mark task paid by code (NOT preceded by "не") ===
        if (MARK_PAID_RE.test(text) && !UNPAID_LIST_RE.test(text)) {
            const numMatch = text.match(/\b(\d{1,5})\b/);
            if (numMatch) {
                return markTaskPaidByCode(ctx, user, numMatch[1]);
            }
            return ctx.reply('💡 Чтобы пометить оплату — напиши код задачи. Например: «оплачено 0001».\nПосмотреть коды: «неоплаченные».');
        }

        // === Greeting ===
        if (GREETING_RE.test(text)) {
            return ctx.reply(
                `Привет, ${user.name}! 👋\n\nЯ помогаю записывать задачи и веду список твоих проектов.\n\nПросто напиши что сделал — например:\n• «сделал верстку Dashboard 2ч»\n• «починил баг логина 30 мин»\n\nИли:\n• «мои проекты» — список твоих проектов\n• любой вопрос со знаком «?» — отвечу по проекту/команде\n\n/help — что я умею`,
            );
        }

        // === Thanks ===
        if (THANKS_RE.test(text)) {
            return ctx.reply('Всегда пожалуйста 🙌');
        }

        // === List reminders ===
        if (LIST_REMINDERS_RE.test(text)) {
            return listUserReminders(ctx, user);
        }

        // === Create reminder ===
        if (REMINDER_RE.test(text)) {
            const waiting = await ctx.reply('🔔 Разбираю напоминание…');
            try {
                const parsed = await ollamaService.parseReminderMessage(text);
                const draftId = `rem:${ctx.from.id}:${ctx.message.message_id}`;
                pendingReminders.set(draftId, {
                    chatId: ctx.chat.id,
                    userId: user._id,
                    text: parsed.text,
                    fireAt: parsed.fireAt,
                    sourceMessage: text,
                });
                await ctx.telegram.editMessageText(
                    ctx.chat.id, waiting.message_id, undefined,
                    `🔔 *Напомнить:* ${parsed.text}\n📅 *Когда:* ${formatReminderTime(parsed.fireAt)}\n\nПодтверди?`,
                    { parse_mode: 'Markdown', ...buildReminderConfirmKeyboard(draftId) },
                );
            } catch (err) {
                console.error('TG reminder parse error:', err.message);
                await ctx.telegram.editMessageText(
                    ctx.chat.id, waiting.message_id, undefined,
                    `⚠️ Не разобрал напоминание: ${err.message}\n\nПопробуй так: «напомни завтра в 9 утра позвонить Амиру».`,
                );
            }
            return;
        }

        // === List pending/planned tasks ===
        if (LIST_PENDING_RE.test(text)) {
            return listPendingTasks(ctx, user);
        }

        // === List my projects ===
        if (LIST_PROJECTS_RE.test(text)) {
            return listUserProjects(ctx, user);
        }

        // === Question (Q&A) ===
        if (isQuestion(text)) {
            const waiting = await ctx.reply('🤔 Думаю…');
            try {
                const kb = await AssistantKnowledge.getOrCreate();
                let teamContext = '';
                if (['admin', 'projectManager'].includes(user.role)) {
                    teamContext = await buildTeamContext({ role: user.role, userId: user._id });
                }
                const answer = await ollamaService.answerQuestion(text, {
                    knowledge: kb.toObject(),
                    teamContext,
                    role: user.role,
                    userName: user.name,
                });
                await ctx.telegram.editMessageText(ctx.chat.id, waiting.message_id, undefined, answer || 'Не нашёл ответа.');
            } catch (err) {
                console.error('TG QA error:', err.message);
                await ctx.telegram.editMessageText(ctx.chat.id, waiting.message_id, undefined, `⚠️ Ошибка: ${err.message}`);
            }
            return;
        }

        // === No task signals — ask for clarification, don't force Ollama parse ===
        if (!TASK_SIGNAL_RE.test(text)) {
            return ctx.reply(
                '🤔 Не совсем понял.\n\nЭто про задачу или проект? Опиши что сделал и сколько часов — например «сделал верстку Dashboard 2ч».\n\nЕсли это вопрос — поставь «?» в конце.\nХочешь список проектов — напиши «мои проекты».',
            );
        }

        // === New task: parse with Ollama, then collect missing fields ===
        const waiting = await ctx.reply('🤖 Разбираю сообщение…');
        try {
            const originalText = ctx.message.text;
            const parsed = await ollamaService.parseTaskMessage(originalText);

            // ── Явный title из кавычек («…» или "…") — приоритет над LLM
            const quoteMatch = originalText.match(/[«"]([^"»]{2,120})[»"]/);
            let restAfterQuote = null;
            if (quoteMatch) {
                parsed.title = quoteMatch[1].trim();
                restAfterQuote = originalText.replace(quoteMatch[0], '').trim();
            }

            // ── Сохраняем детали как юзер написал (НЕ упрощаем длинные тексты)
            //    Длинные сообщения (>30 символов) кладём целиком в description
            if (quoteMatch) {
                // Если есть кавычки — description = всё что вокруг них (verbatim)
                parsed.description = (restAfterQuote && restAfterQuote.length > 5) ? restAfterQuote : null;
            } else if (originalText.length > 30) {
                // Длинное сообщение — сохраняем как написал, не позволяем LLM сокращать
                parsed.description = originalText;
            }
            // Короткие сообщения без кавычек — оставляем parsed.description от LLM (может быть null,
            // тогда бот спросит «опиши подробнее»)

            if (!parsed.title) {
                await ctx.telegram.editMessageText(
                    ctx.chat.id, waiting.message_id, undefined,
                    '⚠️ Не смог разобрать. Опиши: что сделал.\n\nИли задай вопрос (напр. «Кто разработчик?»).'
                );
                return;
            }

            // Pre-create UserProject if mentioned (so it appears in list even before save)
            if (parsed.project) {
                await ensureUserProject({
                    userId: user._id,
                    name: parsed.project,
                    customer: parsed.customer,
                });
            }

            const draftId = makeDraftId(ctx);
            const draft = {
                userId: user._id,
                chatId: ctx.chat.id,
                parsed,
                awaiting: null,
                photos: [],
                photoStepDone: false,
                createdAt: Date.now(),
            };
            pendingDrafts.set(draftId, draft);
            userActiveDraft.set(ctx.chat.id, draftId);

            await ctx.telegram.editMessageText(
                ctx.chat.id, waiting.message_id, undefined,
                '✅ Распознал. Сейчас уточню недостающее…'
            );
            await advanceDraft(ctx, draftId);
        } catch (err) {
            console.error('TG parse error:', err.message);
            await ctx.telegram.editMessageText(
                ctx.chat.id, waiting.message_id, undefined,
                `⚠️ Ошибка обработки: ${err.message}`
            );
        }
    });

    bot.on('photo', async (ctx) => {
        const draftId = userActiveDraft.get(ctx.chat.id);
        if (!draftId) {
            return ctx.reply('Сначала напиши, что ты сделал — потом я попрошу фото.');
        }
        const draft = pendingDrafts.get(draftId);
        if (!draft) return;
        if (draft.awaiting !== 'photo') {
            return ctx.reply('Сейчас фото не нужно — отвечай на текущий вопрос или жди следующего шага.');
        }
        const sizes = ctx.message.photo;
        const best = sizes[sizes.length - 1];
        try {
            const saved = await downloadTelegramPhoto(ctx, best.file_id);
            draft.photos.push(saved);
            pendingDrafts.set(draftId, draft);
            await ctx.reply(
                `📎 Фото сохранено (всего: ${draft.photos.length}). Можешь прислать ещё или нажать «⏭ Готово / Пропустить».`,
                buildPhotoPromptKeyboard(draftId),
            );
        } catch (err) {
            console.error('photo download error:', err.message);
            await ctx.reply(`⚠️ Не смог сохранить фото: ${err.message}`);
        }
    });

    bot.action(/^useproj:(.+):(\d+)$/, async (ctx) => {
        const draftId = ctx.match[1];
        const idx = Number(ctx.match[2]);
        const draft = pendingDrafts.get(draftId);
        await ctx.answerCbQuery();
        if (!draft) return;
        const name = draft.projectChoices?.[idx];
        if (!name) return;
        draft.parsed.project = name;
        draft.projectStepDone = true;
        draft.awaiting = null;
        pendingDrafts.set(draftId, draft);
        try { await ctx.editMessageReplyMarkup(undefined); } catch {}
        await advanceDraft(ctx, draftId);
    });

    bot.action(/^skipproj:(.+)$/, async (ctx) => {
        const draftId = ctx.match[1];
        const draft = pendingDrafts.get(draftId);
        await ctx.answerCbQuery();
        if (!draft) return;
        draft.projectStepDone = true;
        draft.awaiting = null;
        pendingDrafts.set(draftId, draft);
        try { await ctx.editMessageReplyMarkup(undefined); } catch {}
        await advanceDraft(ctx, draftId);
    });

    bot.action(/^date:(.+):(today|tomorrow|yesterday|dayafter|custom)$/, async (ctx) => {
        const draftId = ctx.match[1];
        const choice = ctx.match[2];
        const draft = pendingDrafts.get(draftId);
        await ctx.answerCbQuery();
        if (!draft) return;

        if (choice === 'custom') {
            // Оставляем awaiting='date' — пользователь напишет вручную
            draft.awaiting = 'date';
            pendingDrafts.set(draftId, draft);
            try { await ctx.editMessageReplyMarkup(undefined); } catch {}
            await ctx.reply('✏️ Напиши дату в формате 2026-06-15 или 15.06.2026.');
            return;
        }

        const offsets = { today: 0, tomorrow: 1, yesterday: -1, dayafter: 2 };
        const iso = dateOffsetToIso(offsets[choice]);
        draft.parsed.date = iso;
        const today = dateOffsetToIso(0);
        if (iso > today) draft.parsed.status = 'pending';
        if (iso < today) draft.parsed.status = 'completed';
        draft.dateStepDone = true;
        draft.awaiting = null;
        pendingDrafts.set(draftId, draft);
        try { await ctx.editMessageReplyMarkup(undefined); } catch {}
        await advanceDraft(ctx, draftId);
    });

    bot.action(/^skipcust:(.+)$/, async (ctx) => {
        const draftId = ctx.match[1];
        const draft = pendingDrafts.get(draftId);
        await ctx.answerCbQuery();
        if (!draft) return;
        draft.customerStepDone = true;
        draft.awaiting = null;
        pendingDrafts.set(draftId, draft);
        try { await ctx.editMessageReplyMarkup(undefined); } catch {}
        await advanceDraft(ctx, draftId);
    });

    bot.action(/^photodone:(.+)$/, async (ctx) => {
        const draftId = ctx.match[1];
        const draft = pendingDrafts.get(draftId);
        await ctx.answerCbQuery();
        if (!draft) return;
        draft.photoStepDone = true;
        draft.awaiting = null;
        pendingDrafts.set(draftId, draft);
        try {
            await ctx.editMessageReplyMarkup(undefined);
        } catch {}
        await advanceDraft(ctx, draftId);
    });

    bot.action(/^kind:(.+):(work|external)$/, async (ctx) => {
        const draftId = ctx.match[1];
        const newKind = ctx.match[2];
        const draft = pendingDrafts.get(draftId);
        await ctx.answerCbQuery();
        if (!draft) return;

        draft.parsed.kind = newKind;
        if (newKind === 'external' && draft.parsed.payment !== 'paid') {
            draft.parsed.payment = 'unpaid';
        }
        if (newKind === 'work') {
            draft.parsed.payment = null;
        }
        pendingDrafts.set(draftId, draft);

        const user = await User.findById(draft.userId);
        const executorName = user ? resolveExecutor(draft.parsed, user) : '';
        await ctx.editMessageText(
            `Готов сохранить?\n\n${formatPreview(draft.parsed, executorName, draft.photos.length)}`,
            { parse_mode: 'Markdown', ...buildDraftKeyboard(draftId, draft.parsed) },
        );
    });

    bot.action(/^pay:(.+):(paid|unpaid)$/, async (ctx) => {
        const draftId = ctx.match[1];
        const newPay = ctx.match[2];
        const draft = pendingDrafts.get(draftId);
        await ctx.answerCbQuery();
        if (!draft) return;

        draft.parsed.payment = newPay;
        pendingDrafts.set(draftId, draft);

        const user = await User.findById(draft.userId);
        const executorName = user ? resolveExecutor(draft.parsed, user) : '';
        await ctx.editMessageText(
            `Готов сохранить?\n\n${formatPreview(draft.parsed, executorName, draft.photos.length)}`,
            { parse_mode: 'Markdown', ...buildDraftKeyboard(draftId, draft.parsed) },
        );
    });

    bot.action(/^save:(.+)$/, async (ctx) => {
        const draftId = ctx.match[1];
        const draft = pendingDrafts.get(draftId);
        await ctx.answerCbQuery();
        if (!draft) return ctx.editMessageText('⏱ Время вышло, отправь сообщение заново.');

        const user = await User.findById(draft.userId);
        if (!user) return ctx.editMessageText('❌ Пользователь не найден.');

        try {
            const { task } = await saveTask({ user, parsed: draft.parsed, photos: draft.photos });
            pendingDrafts.delete(draftId);
            if (userActiveDraft.get(draft.chatId) === draftId) userActiveDraft.delete(draft.chatId);
            const executorName = resolveExecutor(draft.parsed, user);
            const codeLine = task.shortCode ? `\n\n💳 *Код задачи:* #${task.shortCode} _(используй для оплаты — «оплачено ${task.shortCode}»)_` : '';
            await ctx.editMessageText(
                `✅ Сохранено!\n\n${formatPreview(draft.parsed, executorName, draft.photos.length)}${codeLine}`,
                { parse_mode: 'Markdown' }
            );
        } catch (err) {
            console.error('TG save error:', err.message);
            await ctx.editMessageText(`❌ Не удалось сохранить: ${err.message}`);
        }
    });

    bot.action(/^cancel:(.+)$/, async (ctx) => {
        const draftId = ctx.match[1];
        const draft = pendingDrafts.get(draftId);
        pendingDrafts.delete(draftId);
        if (draft && userActiveDraft.get(draft.chatId) === draftId) userActiveDraft.delete(draft.chatId);
        await ctx.answerCbQuery('Отменено');
        await ctx.editMessageText('❌ Отменено.');
    });

    bot.catch((err) => console.error('Telegraf error:', err));

    setInterval(() => {
        const cutoff = Date.now() - 10 * 60 * 1000;
        for (const [id, d] of pendingDrafts) {
            if (d.createdAt < cutoff) {
                pendingDrafts.delete(id);
                if (userActiveDraft.get(d.chatId) === id) userActiveDraft.delete(d.chatId);
            }
        }
    }, 60_000).unref();

    // Напоминалка: проверяем раз в 30 минут
    setInterval(() => {
        runReminderTick(bot.telegram).catch((err) => console.error('reminder tick error:', err.message));
    }, 30 * 60 * 1000).unref();

    // Шедулер напоминаний пользователей: раз в минуту
    setInterval(() => {
        fireDueReminders(bot.telegram).catch((err) => console.error('reminder fire error:', err.message));
    }, 60 * 1000).unref();

    return bot;
}

function startTelegramBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.log('TELEGRAM_BOT_TOKEN not set — bot disabled');
        return null;
    }
    const bot = createBot(token);
    console.log('🤖 Telegram bot launching…');
    loadDraftsFromDB().catch(() => {});
    bot.launch({ dropPendingUpdates: true })
        .catch((err) => console.error('Telegram bot launch failed:', err.message));

    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    return bot;
}

module.exports = { startTelegramBot };
