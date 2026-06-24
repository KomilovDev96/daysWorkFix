const User = require('../models/User');
const { notifyTelegram } = require('./telegramBot');

const buildLink = (token) =>
    token ? `${(process.env.APP_PUBLIC_URL || '').replace(/\/+$/, '')}/portal/${token}` : '';

// Экранирование для Telegram Markdown (legacy) — чтобы спецсимволы в названии
// проекта/обновления не ломали парсинг сообщения.
const esc = (s = '') => String(s).replace(/([_*`\[\]])/g, '\\$1');

// Собрать уникальные telegram chatId получателей:
// 1) ручное поле портала; 2) привязанные guest-клиенты из clients[].
async function collectTelegramRecipients(project) {
    const ids = new Set();
    if (project.portal?.notifyTelegramId) ids.add(String(project.portal.notifyTelegramId));

    const clientIds = (project.clients || []).map((c) => c._id || c);
    if (clientIds.length) {
        const clients = await User.find({
            _id: { $in: clientIds },
            telegramId: { $type: 'string' },
        }).select('telegramId');
        clients.forEach((c) => c.telegramId && ids.add(String(c.telegramId)));
    }
    return [...ids];
}

// Уведомить о новом обновлении проекта. percent — актуальный % прогресса.
async function notifyProjectUpdate(project, update, percent) {
    const link = buildLink(project.portal?.token);
    const text =
        `Проект: *${esc(project.name)}*\n\n` +
        `Новое обновление:\n"${esc(update.title)}"\n\n` +
        `Текущий прогресс: *${percent}%*` +
        (link ? `\n\n[Открыть портал проекта](${link})` : '');

    // — Telegram —
    const recipients = await collectTelegramRecipients(project);
    await Promise.all(recipients.map((id) => notifyTelegram(id, text)));

    // — Email — фаза 2 (инфраструктуры нет; pluggable-заглушка) —
    if (project.portal?.notifyEmail) {
        sendEmail(project.portal.notifyEmail, `Обновление проекта: ${project.name}`, text);
    }

    return recipients.length;
}

// Заглушка email-канала. Реализуется в фазе 2 (nodemailer + SMTP).
function sendEmail(to, subject /*, text */) {
    console.log(`[notify:email] disabled (phase 2) → ${to}: ${subject}`);
    return false;
}

module.exports = { notifyProjectUpdate, collectTelegramRecipients };
