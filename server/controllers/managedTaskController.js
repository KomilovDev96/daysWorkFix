const ExcelJS        = require('exceljs');
const ManagedTask    = require('../models/ManagedTask');
const BoardProject   = require('../models/BoardProject');
const User           = require('../models/User');
const catchAsync     = require('../utils/catchAsync');
const AppError       = require('../utils/appError');

const POPULATE_OPTS = [
    { path: 'createdBy',  select: 'name role' },
    { path: 'assignedTo', select: 'name role' },
    { path: 'project',    select: 'name status' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const canModify = (task, user) => {
    // Worker может редактировать только свои задачи (isSelfTask)
    if (user.role === 'worker')
        return task.isSelfTask && String(task.createdBy._id || task.createdBy) === String(user._id);
    // Manager — только свои задачи
    if (user.role === 'projectManager')
        return String(task.createdBy._id || task.createdBy) === String(user._id);
    // Admin — всё
    return user.role === 'admin';
};

// Рекурсивно строим дерево задач
const buildTree = (tasks, parentId = null) => {
    return tasks
        .filter((t) => String(t.parentId || null) === String(parentId))
        .map((t) => ({ ...t.toObject(), children: buildTree(tasks, t._id) }));
};

// ── CRUD ──────────────────────────────────────────────────────────────────────

// Получить задачи (дерево)
exports.getTasks = catchAsync(async (req, res) => {
    const { workerId, managerId, type, isHot, projectId, onlyMine, selfOnly } = req.query;
    const user = req.user;

    const filter = {};

    // selfOnly=true — только личные задачи текущего пользователя (для менеджера и воркера)
    if (selfOnly === 'true') {
        filter.isSelfTask = true;
        filter.createdBy  = user._id;
    } else if (user.role === 'worker') {
        filter.$or = [
            { assignedTo: user._id },
            { createdBy: user._id, isSelfTask: true },
        ];
    } else if (user.role === 'projectManager') {
        // По умолчанию — задачи менеджеров без self-задач воркеров
        // self-задачи менеджеров в основной доске не показываем (они в отдельном блоке)
        filter.isSelfTask = { $ne: true };
        if (onlyMine === 'true') filter.createdBy = user._id;
        if (workerId) filter.assignedTo = workerId;
    }

    if (managerId)  filter.createdBy = managerId;
    if (type)       filter.type = type;
    if (isHot === 'true') filter.isHot = true;
    if (projectId === 'none') filter.project = null;
    else if (projectId)      filter.project  = projectId;

    const tasks = await ManagedTask.find(filter)
        .populate(POPULATE_OPTS)
        .sort({ createdAt: -1 });

    const tree = buildTree(tasks);

    res.status(200).json({ status: 'success', data: { tasks, tree } });
});

// Получить одну задачу
exports.getTask = catchAsync(async (req, res, next) => {
    const task = await ManagedTask.findById(req.params.id).populate(POPULATE_OPTS);
    if (!task) return next(new AppError('Задача не найдена', 404));
    res.status(200).json({ status: 'success', data: { task } });
});

// Создать задачу
exports.createTask = catchAsync(async (req, res, next) => {
    const user = req.user;
    const { title, description, type, parentId, assignedTo, isHot,
            estimatedHours, startDate, dueDate, isSelfTask, project, client, manualAssignee } = req.body;

    // Worker может создавать только свои задачи
    if (user.role === 'worker' && !isSelfTask)
        return next(new AppError('Воркер может создавать только собственные задачи', 403));

    // (менеджеры тоже могут создавать свои личные задачи)

    const task = await ManagedTask.create({
        title,
        description,
        type,
        parentId:       parentId || null,
        project:        project  || null,
        createdBy:      user._id,
        assignedTo:     assignedTo || [],
        isHot:          isHot || false,
        isSelfTask:     isSelfTask || false,
        estimatedHours: estimatedHours || 0,
        startDate:      startDate || null,
        dueDate:        dueDate   || null,
        client:         client    || '',
        manualAssignee: manualAssignee || '',
    });

    await task.populate(POPULATE_OPTS);
    res.status(201).json({ status: 'success', data: { task } });
});

// Обновить задачу
// Статусы которые воркер может выставить сам
const WORKER_ALLOWED_STATUSES = ['pending', 'in_progress', 'testing'];

exports.updateTask = catchAsync(async (req, res, next) => {
    const task = await ManagedTask.findById(req.params.id).populate('createdBy', 'name role');
    if (!task) return next(new AppError('Задача не найдена', 404));

    // Воркер может обновлять назначенную ему задачу (даже не isSelfTask)
    const isWorker = req.user.role === 'worker';
    const isAssigned = (task.assignedTo || []).some(
        (id) => String(id._id || id) === String(req.user._id)
    );

    if (isWorker && !isAssigned && !canModify(task, req.user))
        return next(new AppError('Нет прав для редактирования этой задачи', 403));

    if (!isWorker && !canModify(task, req.user))
        return next(new AppError('Нет прав для редактирования этой задачи', 403));

    // Воркер не может поставить completed/cancelled, КРОМЕ своих личных задач (isSelfTask, созданных им самим)
    const isOwnSelfTask = task.isSelfTask && String(task.createdBy?._id || task.createdBy) === String(req.user._id);
    if (isWorker && !isOwnSelfTask && req.body.status && !WORKER_ALLOWED_STATUSES.includes(req.body.status))
        return next(new AppError('Воркер не может установить этот статус. Ожидайте одобрения менеджера.', 403));

    const allowed = ['title', 'description', 'status', 'isHot',
                     'estimatedHours', 'actualHours', 'startDate', 'dueDate',
                     'assignedTo', 'project', 'client', 'manualAssignee'];
    // Воркер может менять только статус, часы и (для своих) исполнителя и основные поля
    const workerAllowed = isOwnSelfTask
        ? ['title', 'description', 'status', 'estimatedHours', 'actualHours', 'startDate', 'dueDate', 'project', 'manualAssignee']
        : ['status', 'actualHours'];
    const fields = isWorker ? workerAllowed : allowed;

    fields.forEach((f) => { if (req.body[f] !== undefined) task[f] = req.body[f]; });

    await task.save();
    await task.populate(POPULATE_OPTS);
    res.status(200).json({ status: 'success', data: { task } });
});

// Удалить задачу (и все дочерние)
exports.deleteTask = catchAsync(async (req, res, next) => {
    const task = await ManagedTask.findById(req.params.id).populate('createdBy', 'name role');
    if (!task) return next(new AppError('Задача не найдена', 404));

    if (!canModify(task, req.user))
        return next(new AppError('Нет прав для удаления этой задачи', 403));

    // Рекурсивно удаляем дочерние
    const deleteChildren = async (parentId) => {
        const children = await ManagedTask.find({ parentId });
        for (const child of children) {
            await deleteChildren(child._id);
            await child.deleteOne();
        }
    };
    await deleteChildren(task._id);
    await task.deleteOne();

    res.status(204).json({ status: 'success', data: null });
});

// ── Worker availability ───────────────────────────────────────────────────────

// Свободные часы воркера по датам (для менеджера)
exports.getWorkerAvailability = catchAsync(async (req, res, next) => {
    if (!['admin', 'projectManager'].includes(req.user.role))
        return next(new AppError('Доступ запрещён', 403));

    const { workerId, startDate, endDate } = req.query;
    if (!workerId) return next(new AppError('workerId обязателен', 400));

    const worker = await User.findById(workerId).select('name email');
    if (!worker) return next(new AppError('Воркер не найден', 404));

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate)   dateFilter.$lte = new Date(endDate);

    const taskFilter = {
        assignedTo: workerId,
        status: { $nin: ['completed', 'cancelled'] },
    };
    if (startDate || endDate) taskFilter.dueDate = dateFilter;

    const tasks = await ManagedTask.find(taskFilter)
        .select('title estimatedHours actualHours dueDate status isHot type createdBy')
        .populate('createdBy', 'name');

    // Группируем по дате
    const byDate = {};
    tasks.forEach((t) => {
        const key = t.dueDate ? t.dueDate.toISOString().slice(0, 10) : 'no_date';
        if (!byDate[key]) byDate[key] = { date: key, tasks: [], totalEstimated: 0 };
        byDate[key].tasks.push({
            _id:            t._id,
            title:          t.title,
            type:           t.type,
            status:         t.status,
            isHot:          t.isHot,
            estimatedHours: t.estimatedHours || 0,
            actualHours:    t.actualHours    || 0,
            assignedBy:     t.createdBy ? { _id: t.createdBy._id, name: t.createdBy.name } : null,
        });
        byDate[key].totalEstimated += t.estimatedHours || 0;
    });

    const WORK_HOURS_PER_DAY = 8;
    const availability = Object.values(byDate)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((d) => ({
            ...d,
            freeHours:  Math.max(0, WORK_HOURS_PER_DAY - d.totalEstimated),
            isBusy:     d.totalEstimated >= WORK_HOURS_PER_DAY,
        }));

    // Сводка по менеджерам которые дали задачи
    const managerMap = {};
    tasks.forEach((t) => {
        if (!t.createdBy) return;
        const key = String(t.createdBy._id);
        if (!managerMap[key]) managerMap[key] = { _id: key, name: t.createdBy.name, taskCount: 0, totalHours: 0 };
        managerMap[key].taskCount++;
        managerMap[key].totalHours += t.estimatedHours || 0;
    });

    res.status(200).json({
        status: 'success',
        data: { worker, availability, assignedByManagers: Object.values(managerMap) },
    });
});

// ── Admin analytics ───────────────────────────────────────────────────────────

exports.getAdminAnalytics = catchAsync(async (req, res, next) => {
    if (req.user.role !== 'admin')
        return next(new AppError('Только администратор', 403));

    const { month, year } = req.query;
    const now = new Date();
    const y = parseInt(year) || now.getFullYear();
    const m = parseInt(month) || now.getMonth() + 1;

    const startDate = new Date(y, m - 1, 1);
    const endDate   = new Date(y, m, 0, 23, 59, 59);

    const tasks = await ManagedTask.find({
        createdAt: { $gte: startDate, $lte: endDate },
    }).populate('createdBy', 'name role').populate('assignedTo', 'name role');

    // Статистика по менеджерам
    const managerMap = {};
    tasks
        .filter((t) => t.createdBy?.role === 'projectManager')
        .forEach((t) => {
            const key = String(t.createdBy._id);
            if (!managerMap[key]) managerMap[key] = {
                id: key, name: t.createdBy.name,
                total: 0, completed: 0, totalHours: 0,
            };
            managerMap[key].total++;
            managerMap[key].totalHours += t.estimatedHours || 0;
            if (t.status === 'completed') managerMap[key].completed++;
        });

    // Статистика по воркерам
    const workerMap = {};
    tasks.forEach((t) => {
        (t.assignedTo || []).forEach((w) => {
            const key = String(w._id);
            if (!workerMap[key]) workerMap[key] = {
                id: key, name: w.name,
                total: 0, completed: 0, totalHours: 0,
            };
            workerMap[key].total++;
            workerMap[key].totalHours += t.estimatedHours || 0;
            if (t.status === 'completed') workerMap[key].completed++;
        });
    });

    res.status(200).json({
        status: 'success',
        data: {
            period: { year: y, month: m },
            managers: Object.values(managerMap),
            workers:  Object.values(workerMap),
            totals: {
                tasks: tasks.length,
                completed: tasks.filter((t) => t.status === 'completed').length,
                hot: tasks.filter((t) => t.isHot).length,
            },
        },
    });
});

// ── Admin monthly XLS ─────────────────────────────────────────────────────────

exports.exportMonthlyXls = catchAsync(async (req, res, next) => {
    if (req.user.role !== 'admin')
        return next(new AppError('Только администратор', 403));

    const { month, year } = req.query;
    const now = new Date();
    const y = parseInt(year) || now.getFullYear();
    const m = parseInt(month) || now.getMonth() + 1;

    const startDate = new Date(y, m - 1, 1);
    const endDate   = new Date(y, m, 0, 23, 59, 59);

    const tasks = await ManagedTask.find({
        createdAt: { $gte: startDate, $lte: endDate },
    })
        .populate('createdBy',  'name role')
        .populate('assignedTo', 'name role')
        .populate('project',    'name')
        .sort({ createdAt: 1 });

    const workbook  = new ExcelJS.Workbook();
    const ws        = workbook.addWorksheet(`${y}-${String(m).padStart(2, '0')}`);

    ws.columns = [
        { header: '№',           key: 'num',        width: 6  },
        { header: 'Задача',      key: 'title',       width: 40 },
        { header: 'Тип',         key: 'type',        width: 12 },
        { header: 'Статус',      key: 'status',      width: 14 },
        { header: 'Менеджер',    key: 'manager',     width: 22 },
        { header: 'Исполнитель', key: 'workers',     width: 28 },
        { header: 'Часы (план)', key: 'estimated',   width: 13 },
        { header: 'Часы (факт)', key: 'actual',      width: 13 },
        { header: '🔥 Горячая',  key: 'isHot',       width: 12 },
        { header: 'Дедлайн',     key: 'dueDate',     width: 14 },
        { header: 'Проект',      key: 'project',     width: 22 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.font  = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1677FF' } };
    headerRow.height = 22;

    const TYPE_LABELS   = { monthly: 'Месячная', weekly: 'Недельная', daily: 'Дневная', hourly: 'Часовая' };
    const STATUS_LABELS = { pending: 'Ожидает', in_progress: 'В процессе', testing: 'Тестирование', completed: 'Выполнено', cancelled: 'Отменено' };

    tasks.forEach((t, i) => {
        const row = ws.addRow({
            num:       i + 1,
            title:     t.title,
            type:      TYPE_LABELS[t.type] || t.type,
            status:    STATUS_LABELS[t.status] || t.status,
            manager:   t.createdBy?.name  || '—',
            workers:   (t.assignedTo || []).map((w) => w.name).join(', ') || '—',
            estimated: t.estimatedHours || 0,
            actual:    t.actualHours    || 0,
            isHot:     t.isHot ? 'Да' : '',
            dueDate:   t.dueDate ? t.dueDate.toISOString().slice(0, 10) : '',
            project:   t.project?.name || '—',
        });

        if (t.isHot) {
            row.getCell('isHot').font = { color: { argb: 'FFFF4D4F' }, bold: true };
        }
        if (t.status === 'completed') {
            row.getCell('status').font = { color: { argb: 'FF52C41A' } };
        }
    });

    ws.getColumn('title').alignment  = { wrapText: true, vertical: 'middle' };
    ws.getColumn('num').alignment    = { horizontal: 'center', vertical: 'middle' };

    const fileName = `tasks-${y}-${String(m).padStart(2, '0')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    await workbook.xlsx.write(res);
    res.end();
});

// ── Комментарии к задаче ──────────────────────────────────────────────────────

exports.addComment = catchAsync(async (req, res, next) => {
    const { text } = req.body;
    if (!text?.trim()) return next(new AppError('Текст комментария обязателен', 400));

    const task = await ManagedTask.findById(req.params.id);
    if (!task) return next(new AppError('Задача не найдена', 404));

    task.comments.push({ text: text.trim(), author: req.user._id });
    await task.save();

    await task.populate('comments.author', 'name role');
    const comment = task.comments[task.comments.length - 1];

    res.status(201).json({ status: 'success', data: { comment } });
});

exports.getComments = catchAsync(async (req, res, next) => {
    const task = await ManagedTask.findById(req.params.id)
        .select('title status comments')
        .populate('comments.author', 'name role');
    if (!task) return next(new AppError('Задача не найдена', 404));

    res.status(200).json({ status: 'success', data: { task } });
});

exports.deleteComment = catchAsync(async (req, res, next) => {
    const task = await ManagedTask.findById(req.params.id);
    if (!task) return next(new AppError('Задача не найдена', 404));

    const comment = task.comments.id(req.params.commentId);
    if (!comment) return next(new AppError('Комментарий не найден', 404));

    // Удалить может только автор или admin
    if (String(comment.author) !== String(req.user._id) && req.user.role !== 'admin')
        return next(new AppError('Нет прав для удаления этого комментария', 403));

    comment.deleteOne();
    await task.save();

    res.status(204).json({ status: 'success', data: null });
});

// ── Проекты доступные для привязки задач ─────────────────────────────────────

exports.getTaskProjects = catchAsync(async (req, res) => {
    // Менеджер видит свои проекты; воркер — свои; admin — все
    const filter = req.user.role === 'admin' ? {} : { createdBy: req.user._id };
    const projects = await BoardProject.find(filter)
        .select('name status createdBy')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 });
    res.status(200).json({ status: 'success', data: { projects } });
});

// Создать проект прямо из менеджера задач
exports.createTaskProject = catchAsync(async (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ status: 'fail', message: 'Название обязательно' });
    const project = await BoardProject.create({
        name,
        description: description || '',
        createdBy: req.user._id,
        tasks: [],
    });
    res.status(201).json({ status: 'success', data: { project } });
});

// ── Manager stats (свой отчёт менеджера) ──────────────────────────────────────

exports.getManagerStats = catchAsync(async (req, res, next) => {
    if (!['projectManager', 'admin'].includes(req.user.role))
        return next(new AppError('Доступ запрещён', 403));

    const { startDate, endDate } = req.query;

    const filter = { createdBy: req.user._id };
    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate)   filter.createdAt.$lte = new Date(endDate);
    }

    const tasks = await ManagedTask.find(filter)
        .populate('assignedTo', 'name')
        .sort({ createdAt: -1 });

    const byType   = {};
    const byStatus = {};
    tasks.forEach((t) => {
        byType[t.type]     = (byType[t.type]     || 0) + 1;
        byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    });

    // Уникальные воркеры которым назначены задачи
    const workerMap = {};
    tasks.forEach((t) => {
        (t.assignedTo || []).forEach((w) => {
            const key = String(w._id);
            if (!workerMap[key]) workerMap[key] = { _id: key, name: w.name, taskCount: 0, totalHours: 0 };
            workerMap[key].taskCount++;
            workerMap[key].totalHours += t.estimatedHours || 0;
        });
    });

    res.status(200).json({
        status: 'success',
        data: {
            tasks,
            totals: {
                total:      tasks.length,
                completed:  tasks.filter((t) => t.status === 'completed').length,
                inProgress: tasks.filter((t) => t.status === 'in_progress').length,
                pending:    tasks.filter((t) => t.status === 'pending').length,
                hot:        tasks.filter((t) => t.isHot).length,
                totalHours: tasks.reduce((s, t) => s + (t.estimatedHours || 0), 0),
                actualHours:tasks.reduce((s, t) => s + (t.actualHours    || 0), 0),
            },
            byType,
            byStatus,
            workers: Object.values(workerMap),
        },
    });
});

// ── Экспорт выполненных задач (воркер и менеджер) ──────────────────────────────

exports.exportMyTasks = catchAsync(async (req, res) => {
    const { startDate, endDate } = req.query;
    const user = req.user;

    // Фильтр по роли
    const filter = { status: 'completed' };

    if (user.role === 'worker') {
        filter.$or = [
            { assignedTo: user._id },
            { createdBy: user._id, isSelfTask: true },
        ];
    } else if (user.role === 'projectManager') {
        filter.createdBy = user._id;
    }

    // Диапазон по updatedAt (дата завершения)
    if (startDate || endDate) {
        filter.updatedAt = {};
        if (startDate) filter.updatedAt.$gte = new Date(startDate);
        if (endDate) {
            const d = new Date(endDate);
            d.setHours(23, 59, 59, 999);
            filter.updatedAt.$lte = d;
        }
    }

    const tasks = await ManagedTask.find(filter)
        .populate({ path: 'createdBy',        select: 'name' })
        .populate({ path: 'assignedTo',       select: 'name' })
        .populate({ path: 'project',          select: 'name' })
        .populate({ path: 'comments.author',  select: 'name' })
        .sort({ updatedAt: 1 });

    // Группировка по дате завершения
    const byDate = {};
    tasks.forEach((t) => {
        const d = new Date(t.updatedAt).toISOString().split('T')[0];
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(t);
    });

    // Период (строка)
    const fmtDate = (s) => {
        if (!s) return '';
        const date = new Date(s);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString('ru-RU');
    };
    const period = startDate && endDate
        ? `${fmtDate(startDate)} — ${fmtDate(endDate)}`
        : startDate ? `с ${fmtDate(startDate)}`
        : endDate   ? `по ${fmtDate(endDate)}`
        : 'Все время';

    // ── Excel ──────────────────────────────────────────────────────────────────
    const wb    = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Отчёт по задачам');

    sheet.columns = [
        { header: 'Пользователь',          key: 'user',     width: 22 },
        { header: 'Дата',                  key: 'date',     width: 13 },
        { header: 'Кол-во задач',          key: 'count',    width: 14 },
        { header: 'Названия задач',        key: 'titles',   width: 40 },
        { header: 'Детали задач',          key: 'details',  width: 46 },
        { header: 'Причины / Комментарии', key: 'comments', width: 46 },
        { header: 'Часы',                  key: 'hours',    width: 10 },
        { header: 'Период',                key: 'period',   width: 24 },
        { header: 'Заказчик',              key: 'client',   width: 22 },
    ];

    // Заголовок
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
        cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1677FF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border    = {
            top: { style: 'thin' }, bottom: { style: 'thin' },
            left: { style: 'thin' }, right: { style: 'thin' },
        };
    });
    headerRow.height = 28;

    // Строки данных
    let rowIdx = 2;
    Object.entries(byDate).forEach(([date, dateTasks]) => {
        const titles   = dateTasks.map((t) => t.title).join('\n');
        const details  = dateTasks.map((t) => t.description || '—').join('\n');

        const comments = dateTasks
            .flatMap((t) =>
                (t.comments || []).map((c) =>
                    `[${t.title}] ${c.author?.name || 'Аноним'}: ${c.text}`
                )
            )
            .join('\n') || '—';

        const totalEstimatedHours = dateTasks.reduce((s, t) => s + (t.estimatedHours || 0), 0);
        const hours = `${totalEstimatedHours}ч`;

        // Заказчик:
        // - воркер: автоматически имена менеджеров, которые назначили задачи
        // - менеджер: поле client, хранящееся в задаче (заполняется при создании)
        let clientVal;
        if (user.role === 'worker') {
            const mgrs = [...new Set(
                dateTasks.map((t) => t.createdBy?.name).filter(Boolean)
            )];
            clientVal = mgrs.join(', ') || '—';
        } else {
            // Для менеджера берём client из задач (может быть у каждой свой)
            const clients = [...new Set(
                dateTasks.map((t) => t.client).filter(Boolean)
            )];
            clientVal = clients.join(', ') || '—';
        }

        const [y, m, d] = date.split('-');
        const row = sheet.addRow({
            user:     user.name,
            date:     `${d}.${m}.${y}`,
            count:    dateTasks.length,
            titles,
            details,
            comments,
            hours,
            period,
            client:   clientVal,
        });

        row.height = Math.max(30, dateTasks.length * 18);
        row.eachCell((cell) => {
            cell.alignment = { wrapText: true, vertical: 'top' };
            cell.border    = {
                top: { style: 'thin' }, bottom: { style: 'thin' },
                left: { style: 'thin' }, right: { style: 'thin' },
            };
            // Чередование строк
            if (rowIdx % 2 === 0) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F9FF' } };
            }
        });
        rowIdx++;
    });

    // Если нет данных — одна пустая строка
    if (Object.keys(byDate).length === 0) {
        const row = sheet.addRow({
            user: user.name, date: '—', count: 0,
            titles: 'Нет выполненных задач за период', details: '—',
            comments: '—', hours: 0, period, client: '—',
        });
        row.eachCell((cell) => {
            cell.alignment = { wrapText: true, vertical: 'top' };
            cell.font = { color: { argb: 'FF888888' }, italic: true };
        });
    }

    const fileName = `tasks_${user.name.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;
    res.setHeader('Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await wb.xlsx.write(res);
    res.end();
});

