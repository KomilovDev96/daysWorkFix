const { Telegraf, Markup } = require('telegraf');
const User = require('../models/User');
const DayLog = require('../models/DayLog');
const Task = require('../models/Task');
const AssistantKnowledge = require('../models/AssistantKnowledge');
const ollamaService = require('./ollamaService');
const { buildTeamContext } = require('./teamContextService');

const QUESTION_RE = /\?\s*$/;
const QUESTION_WORDS = /^(кто|что|как|когда|где|почему|зачем|сколько|расскажи|объясни|опиши|можешь|умеешь|поможешь|помоги|умеет|может|whoami)/i;
const isQuestion = (t) => QUESTION_RE.test(t) || QUESTION_WORDS.test(t.trim());

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

const pendingDrafts = new Map();

const findUserByTelegramId = (tgId) => User.findOne({ telegramId: String(tgId) });

const formatPreview = (p) => {
    const lines = [
        `📌 *Задача:* ${p.title || '—'}`,
        `⏱ *Время:* ${p.hours} ч`,
        p.customer ? `👤 *Заказчик:* ${p.customer}` : null,
        p.executor ? `🛠 *Исполнитель:* ${p.executor}` : null,
        `📅 *Дата:* ${p.date || 'сегодня'}`,
        p.description ? `📝 ${p.description}` : null,
    ].filter(Boolean);
    return lines.join('\n');
};

const saveTask = async ({ user, parsed }) => {
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

    const task = await Task.create({
        dayLogId: dayLog._id,
        title: parsed.title || 'Без названия',
        description: parsed.description || undefined,
        hours: parsed.hours || 0,
        customer: parsed.customer ? { name: parsed.customer } : undefined,
    });

    return { dayLog, task };
};

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
            tail = `\n\n${user.name} — ${roleLabel}.\n\nПиши, что сделал — я запишу. Спроси что-то — отвечу.${extras.length ? '\n\nПримеры вопросов:\n' + extras.join('\n') : ''}\n\n/about — о проекте\n/help — что я умею`;
        }
        return ctx.reply(greet + tail, { parse_mode: 'Markdown' });
    });

    bot.command('about', async (ctx) => {
        const kb = await AssistantKnowledge.getOrCreate();
        return ctx.reply(formatAbout(kb), { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } });
    });

    bot.command('help', async (ctx) => {
        const kb = await AssistantKnowledge.getOrCreate();
        const extra = '\n\n*Команды:*\n/about — о проекте\n/whoami — кто я\n/logout — отвязать аккаунт\n\nПросто пиши свободным текстом — я разберу: задача это или вопрос.';
        return ctx.reply(formatFeatures(kb) + extra, { parse_mode: 'Markdown' });
    });

    bot.command('logout', async (ctx) => {
        const user = await findUserByTelegramId(ctx.from.id);
        if (!user) return ctx.reply('Аккаунт не привязан.');
        user.telegramId = null;
        await user.save({ validateBeforeSave: false });
        return ctx.reply('🔓 Аккаунт отвязан. Чтобы привязать снова — отправь 6-значный код.');
    });

    bot.command('whoami', async (ctx) => {
        const user = await findUserByTelegramId(ctx.from.id);
        if (!user) return ctx.reply('Не привязан. Отправь 6-значный код от админа.');
        return ctx.reply(`👤 ${user.name} | ${user.email} | роль: ${user.role}`);
    });

    bot.on('text', async (ctx) => {
        if (ctx.message.text.startsWith('/')) return;
        const text = ctx.message.text.trim();

        const user = await findUserByTelegramId(ctx.from.id);

        // Если не привязан — ждём 6-значный код
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

        // Если это вопрос — отвечаем из базы знаний (+ командный контекст для admin/manager)
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

        const waiting = await ctx.reply('🤖 Разбираю сообщение…');
        try {
            const parsed = await ollamaService.parseTaskMessage(ctx.message.text);
            if (!parsed.title || !parsed.hours) {
                await ctx.telegram.editMessageText(
                    ctx.chat.id, waiting.message_id, undefined,
                    '⚠️ Не смог разобрать. Опиши: что сделал и сколько времени ушло.\n\nИли задай вопрос (напр. «Кто разработчик?»).'
                );
                return;
            }

            const draftId = `${ctx.from.id}:${ctx.message.message_id}`;
            pendingDrafts.set(draftId, { userId: user._id, parsed, createdAt: Date.now() });

            await ctx.telegram.editMessageText(
                ctx.chat.id, waiting.message_id, undefined,
                `Готов сохранить?\n\n${formatPreview(parsed)}`,
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        Markup.button.callback('✅ Сохранить', `save:${draftId}`),
                        Markup.button.callback('❌ Отмена', `cancel:${draftId}`),
                    ]),
                }
            );
        } catch (err) {
            console.error('TG parse error:', err.message);
            await ctx.telegram.editMessageText(
                ctx.chat.id, waiting.message_id, undefined,
                `⚠️ Ошибка обработки: ${err.message}`
            );
        }
    });

    bot.action(/^save:(.+)$/, async (ctx) => {
        const draftId = ctx.match[1];
        const draft = pendingDrafts.get(draftId);
        await ctx.answerCbQuery();
        if (!draft) return ctx.editMessageText('⏱ Время вышло, отправь сообщение заново.');

        const user = await User.findById(draft.userId);
        if (!user) return ctx.editMessageText('❌ Пользователь не найден.');

        try {
            const { task } = await saveTask({ user, parsed: draft.parsed });
            pendingDrafts.delete(draftId);
            await ctx.editMessageText(
                `✅ Сохранено!\n\n${formatPreview(draft.parsed)}\n\nID задачи: \`${task._id}\``,
                { parse_mode: 'Markdown' }
            );
        } catch (err) {
            console.error('TG save error:', err.message);
            await ctx.editMessageText(`❌ Не удалось сохранить: ${err.message}`);
        }
    });

    bot.action(/^cancel:(.+)$/, async (ctx) => {
        pendingDrafts.delete(ctx.match[1]);
        await ctx.answerCbQuery('Отменено');
        await ctx.editMessageText('❌ Отменено.');
    });

    bot.catch((err) => console.error('Telegraf error:', err));

    setInterval(() => {
        const cutoff = Date.now() - 10 * 60 * 1000;
        for (const [id, d] of pendingDrafts) if (d.createdAt < cutoff) pendingDrafts.delete(id);
    }, 60_000).unref();

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
    bot.launch({ dropPendingUpdates: true })
        .catch((err) => console.error('Telegram bot launch failed:', err.message));

    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    return bot;
}

module.exports = { startTelegramBot };
