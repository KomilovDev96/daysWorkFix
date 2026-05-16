const User = require('../models/User');
const DayLog = require('../models/DayLog');
const Task = require('../models/Task');
const ManagedTask = require('../models/ManagedTask');

const todayRange = () => {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);
    return { start, end };
};

// Собирает компактный текстовый контекст по команде для админ/менеджер запросов.
// Используется как доп.контекст для Ollama. Не должен быть слишком большим.
async function buildTeamContext({ role, userId }) {
    const today = new Date().toISOString().slice(0, 10);
    const { start, end } = todayRange();

    const lines = [`Сегодня: ${today}.`];

    // Пользователи (без пароля и tg-кода)
    const userFilter = role === 'admin' ? {} : { role: { $in: ['worker', 'projectManager'] } };
    const users = await User.find(userFilter).select('name email role _id').lean();
    const usersById = new Map(users.map((u) => [String(u._id), u]));

    // Дневные логи на сегодня
    const todayLogs = await DayLog.find({ date: { $gte: start, $lte: end } }).lean();
    const logsByUser = new Map(todayLogs.map((l) => [String(l.userId), l]));

    // Задачи в этих логах
    const tasks = todayLogs.length
        ? await Task.find({ dayLogId: { $in: todayLogs.map((l) => l._id) } }).lean()
        : [];
    const tasksByLog = new Map();
    tasks.forEach((t) => {
        const arr = tasksByLog.get(String(t.dayLogId)) || [];
        arr.push(t);
        tasksByLog.set(String(t.dayLogId), arr);
    });

    // Сотрудники: что делали сегодня + кто свободен (нет лога или 0 часов)
    const workers = users.filter((u) => u.role === 'worker');
    lines.push('', '--- Сотрудники сегодня ---');
    workers.forEach((w) => {
        const log = logsByUser.get(String(w._id));
        if (!log || (log.totalHours || 0) === 0) {
            lines.push(`• ${w.name} (${w.email}): свободен, задач сегодня нет.`);
        } else {
            const ts = tasksByLog.get(String(log._id)) || [];
            const summary = ts.map((t) => `${t.title} (${t.hours}ч)`).join('; ') || `${log.totalHours}ч без детализации`;
            lines.push(`• ${w.name} (${w.email}): ${log.totalHours}ч — ${summary}`);
        }
    });

    // Менеджеры: их активные ManagedTask
    const managers = users.filter((u) => u.role === 'projectManager');
    if (managers.length) {
        lines.push('', '--- Менеджеры и их задачи ---');
        for (const m of managers) {
            const mTasks = await ManagedTask.find({
                createdBy: m._id,
                status: { $in: ['pending', 'in_progress', 'testing'] },
            })
                .select('title status assignedTo type')
                .populate('assignedTo', 'name')
                .lean();

            if (!mTasks.length) {
                lines.push(`• ${m.name}: активных задач нет.`);
            } else {
                lines.push(`• ${m.name}:`);
                mTasks.slice(0, 15).forEach((t) => {
                    const assignees = (t.assignedTo || []).map((a) => a.name).join(', ') || '—';
                    lines.push(`   - [${t.status}] ${t.title} (исполнители: ${assignees})`);
                });
                if (mTasks.length > 15) lines.push(`   …и ещё ${mTasks.length - 15} задач`);
            }
        }
    }

    // Если это менеджер — добавляем его собственные задачи (даже если они уже выше)
    if (role === 'projectManager' && userId) {
        lines.push('', '--- Твои задачи как менеджера (активные) ---');
        const myTasks = await ManagedTask.find({
            createdBy: userId,
            status: { $in: ['pending', 'in_progress', 'testing'] },
        }).select('title status assignedTo').populate('assignedTo', 'name').lean();
        if (!myTasks.length) lines.push('• активных задач нет');
        myTasks.slice(0, 20).forEach((t) => {
            const assignees = (t.assignedTo || []).map((a) => a.name).join(', ') || '—';
            lines.push(`   - [${t.status}] ${t.title} → ${assignees}`);
        });
    }

    return lines.join('\n');
}

module.exports = { buildTeamContext };
