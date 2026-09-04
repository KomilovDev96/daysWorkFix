const ExcelJS = require('exceljs');
const path = require('path');
const fs   = require('fs');
const BoardProject = require('../models/BoardProject');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { logProjectEvent } = require('../utils/projectEvents');
const { generateUniquePortalToken } = require('../utils/portalToken');

const STATUS_LABELS = {
    todo: 'К выполнению',
    in_progress: 'В процессе',
    done: 'Выполнено',
    cancelled: 'Отменено',
};

const PRIORITY_LABELS = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
    critical: 'Критический',
};

// ── Projects ──────────────────────────────────────────────────────────────────

exports.getAll = catchAsync(async (req, res) => {
    // Admin видит все проекты; остальные — свои созданные + те, где назначены на задачу
    const filter = req.user.role === 'admin'
        ? {}
        : { $or: [{ createdBy: req.user._id }, { 'tasks.assignedTo': req.user._id }] };

    const projects = await BoardProject.find(filter)
        .populate('createdBy', 'name email')
        .populate('tasks.assignedTo', 'name email specialization')
        .sort({ createdAt: -1 });

    res.status(200).json({
        status: 'success',
        results: projects.length,
        data: { projects },
    });
});

exports.getOne = catchAsync(async (req, res, next) => {
    const project = await BoardProject.findById(req.params.id)
        .populate('createdBy', 'name email')
        .populate('tasks.assignedTo', 'name email specialization');

    if (!project) return next(new AppError('Проект не найден', 404));

    res.status(200).json({ status: 'success', data: { project } });
});

exports.create = catchAsync(async (req, res) => {
    const project = await BoardProject.create({
        ...req.body,
        createdBy: req.user.id,
        tasks: [],
    });

    const populated = await BoardProject.findById(project._id)
        .populate('createdBy', 'name email');

    await logProjectEvent(project._id, 'project_created', `Проект создан: ${project.name}`, {
        actorId: req.user._id,
    });

    res.status(201).json({ status: 'success', data: { project: populated } });
});

exports.update = catchAsync(async (req, res, next) => {
    const project = await BoardProject.findById(req.params.id);
    if (!project) return next(new AppError('Проект не найден', 404));

    if (req.user.role !== 'admin' && String(project.createdBy) !== String(req.user._id))
        return next(new AppError('Нет прав для редактирования этого проекта', 403));

    const { tasks, ...rest } = req.body;
    const prevDeadline = project.deadline ? new Date(project.deadline).getTime() : null;
    Object.assign(project, rest);
    await project.save();

    // Таймлайн: смена дедлайна.
    const newDeadline = project.deadline ? new Date(project.deadline).getTime() : null;
    if (Object.prototype.hasOwnProperty.call(rest, 'deadline') && prevDeadline !== newDeadline) {
        await logProjectEvent(project._id, 'deadline_changed',
            project.deadline
                ? `Дедлайн изменён на ${new Date(project.deadline).toLocaleDateString('ru-RU')}`
                : 'Дедлайн снят', {
            meta: { oldDeadline: prevDeadline, newDeadline },
            actorId: req.user._id,
        });
    }

    await project.populate('createdBy', 'name email');
    await project.populate('tasks.assignedTo', 'name email specialization');

    res.status(200).json({ status: 'success', data: { project } });
});

exports.remove = catchAsync(async (req, res, next) => {
    const project = await BoardProject.findById(req.params.id);
    if (!project) return next(new AppError('Проект не найден', 404));

    if (req.user.role !== 'admin' && String(project.createdBy) !== String(req.user._id))
        return next(new AppError('Нет прав для удаления этого проекта', 403));

    await project.deleteOne();
    res.status(204).json({ status: 'success', data: null });
});

// ── Tasks ─────────────────────────────────────────────────────────────────────

exports.addTask = catchAsync(async (req, res, next) => {
    const project = await BoardProject.findById(req.params.id);
    if (!project) return next(new AppError('Проект не найден', 404));

    project.tasks.push(req.body);
    await project.save();

    await project.populate('createdBy', 'name email');
    await project.populate('tasks.assignedTo', 'name email specialization');

    res.status(201).json({ status: 'success', data: { project } });
});

exports.updateTask = catchAsync(async (req, res, next) => {
    const project = await BoardProject.findById(req.params.id);
    if (!project) return next(new AppError('Проект не найден', 404));

    const task = project.tasks.id(req.params.taskId);
    if (!task) return next(new AppError('Задача не найдена', 404));

    Object.assign(task, req.body);
    await project.save();

    await project.populate('createdBy', 'name email');
    await project.populate('tasks.assignedTo', 'name email specialization');

    res.status(200).json({ status: 'success', data: { project } });
});

exports.deleteTask = catchAsync(async (req, res, next) => {
    const project = await BoardProject.findById(req.params.id);
    if (!project) return next(new AppError('Проект не найден', 404));

    const task = project.tasks.id(req.params.taskId);
    if (!task) return next(new AppError('Задача не найдена', 404));

    task.deleteOne();
    await project.save();

    res.status(204).json({ status: 'success', data: null });
});

// ── Sprints ───────────────────────────────────────────────────────────────────
// Спринт — именованный блок задач (напр. «Спринт 1»). Только один спринт активен
// одновременно: при активации нового все остальные автоматически завершаются,
// чтобы клиентский портал всегда показывал ровно один текущий снимок.

const assertProjectOwner = (project, user, next) => {
    if (user.role !== 'admin' && String(project.createdBy) !== String(user._id)) {
        next(new AppError('Нет прав для управления этим проектом', 403));
        return false;
    }
    return true;
};

exports.getSprints = catchAsync(async (req, res, next) => {
    const project = await BoardProject.findById(req.params.id);
    if (!project) return next(new AppError('Проект не найден', 404));
    res.status(200).json({ status: 'success', data: { sprints: project.sprints } });
});

exports.createSprint = catchAsync(async (req, res, next) => {
    const project = await BoardProject.findById(req.params.id);
    if (!project) return next(new AppError('Проект не найден', 404));
    if (!assertProjectOwner(project, req.user, next)) return;

    const { name, description } = req.body;
    if (!name?.trim()) return next(new AppError('Название спринта обязательно', 400));

    // status: 'planning' — будущий/запланированный спринт, не влияет на остальные и не
    // показывается клиенту, пока не станет активным. По умолчанию — 'active' (как раньше).
    const status = ['planning', 'active'].includes(req.body.status) ? req.body.status : 'active';

    // Завершаем предыдущий активный спринт — активен всегда только один. Планируемый
    // спринт создаётся «в стороне» и текущий активный не трогает.
    if (status === 'active') {
        project.sprints.forEach((s) => {
            if (s.status === 'active') {
                s.status = 'completed';
                s.completedAt = new Date();
            }
        });
    }

    project.sprints.push({
        name: name.trim(),
        description: description?.trim() || '',
        status,
        createdBy: req.user._id,
    });
    await project.save();

    const sprint = project.sprints[project.sprints.length - 1];
    if (status === 'active') {
        await logProjectEvent(project._id, 'sprint_started', `Начат спринт: ${sprint.name}`, {
            meta: { sprintId: sprint._id },
            actorId: req.user._id,
        });
    }

    res.status(201).json({ status: 'success', data: { sprints: project.sprints } });
});

exports.updateSprint = catchAsync(async (req, res, next) => {
    const project = await BoardProject.findById(req.params.id);
    if (!project) return next(new AppError('Проект не найден', 404));
    if (!assertProjectOwner(project, req.user, next)) return;

    const sprint = project.sprints.id(req.params.sprintId);
    if (!sprint) return next(new AppError('Спринт не найден', 404));

    const { name, description, status, visibleToClient } = req.body;
    if (name !== undefined) sprint.name = name.trim();
    if (description !== undefined) sprint.description = description?.trim() || '';
    if (visibleToClient !== undefined) sprint.visibleToClient = !!visibleToClient;

    if (status !== undefined && status !== sprint.status) {
        if (status === 'active') {
            // Активируя этот спринт, завершаем остальные активные.
            project.sprints.forEach((s) => {
                if (String(s._id) !== String(sprint._id) && s.status === 'active') {
                    s.status = 'completed';
                    s.completedAt = new Date();
                }
            });
            sprint.status = 'active';
            sprint.completedAt = null;
            await project.save();
            await logProjectEvent(project._id, 'sprint_started', `Возобновлён спринт: ${sprint.name}`, {
                meta: { sprintId: sprint._id }, actorId: req.user._id,
            });
        } else if (status === 'completed') {
            sprint.status = 'completed';
            sprint.completedAt = new Date();
            await project.save();
            await logProjectEvent(project._id, 'sprint_completed', `Завершён спринт: ${sprint.name}`, {
                meta: { sprintId: sprint._id }, actorId: req.user._id,
            });
        } else if (status === 'planning') {
            // Возврат в план не трогает остальные спринты — просто снимает флаг активности/завершения.
            sprint.status = 'planning';
            sprint.completedAt = null;
            await project.save();
        }
    } else {
        await project.save();
    }

    res.status(200).json({ status: 'success', data: { sprints: project.sprints } });
});

exports.deleteSprint = catchAsync(async (req, res, next) => {
    const project = await BoardProject.findById(req.params.id);
    if (!project) return next(new AppError('Проект не найден', 404));
    if (!assertProjectOwner(project, req.user, next)) return;

    const sprint = project.sprints.id(req.params.sprintId);
    if (!sprint) return next(new AppError('Спринт не найден', 404));

    // Задачи спринта не удаляются — просто теряют привязку (возвращаются в бэклог).
    project.tasks.forEach((t) => {
        if (String(t.sprint) === String(sprint._id)) t.sprint = null;
    });
    sprint.deleteOne();
    await project.save();

    res.status(204).json({ status: 'success', data: null });
});

// POST /:id/sprints/:sprintId/link — выдать (или перевыпустить) отдельную публичную
// ссылку на конкретный спринт. Старая ссылка при этом перестаёт работать.
exports.regenerateSprintLink = catchAsync(async (req, res, next) => {
    const project = await BoardProject.findById(req.params.id);
    if (!project) return next(new AppError('Проект не найден', 404));
    if (!assertProjectOwner(project, req.user, next)) return;

    const sprint = project.sprints.id(req.params.sprintId);
    if (!sprint) return next(new AppError('Спринт не найден', 404));

    sprint.token = await generateUniquePortalToken(BoardProject, 'sprints.token');
    await project.save();

    const link = `${(process.env.APP_PUBLIC_URL || '').replace(/\/+$/, '')}/sprint-portal/${sprint.token}`;
    res.status(200).json({ status: 'success', data: { token: sprint.token, link } });
});

// ── Task files ────────────────────────────────────────────────────────────────

exports.uploadTaskFile = catchAsync(async (req, res, next) => {
    if (!req.file) return next(new AppError('Файл не загружен', 400));

    const project = await BoardProject.findById(req.params.id);
    if (!project) return next(new AppError('Проект не найден', 404));

    const task = project.tasks.id(req.params.taskId);
    if (!task) return next(new AppError('Задача не найдена', 404));

    const ext = path.extname(req.file.originalname).toLowerCase();
    task.files.push({
        originalName: req.file.originalname,
        fileUrl:      `uploads/${req.file.filename}`,
        fileType:     ext.replace('.', '') || 'file',
    });

    await project.save();
    await project.populate('createdBy', 'name email');
    await project.populate('tasks.assignedTo', 'name email specialization');

    res.status(201).json({ status: 'success', data: { project } });
});

exports.deleteTaskFile = catchAsync(async (req, res, next) => {
    const project = await BoardProject.findById(req.params.id);
    if (!project) return next(new AppError('Проект не найден', 404));

    const task = project.tasks.id(req.params.taskId);
    if (!task) return next(new AppError('Задача не найдена', 404));

    const fileEntry = task.files.id(req.params.fileId);
    if (!fileEntry) return next(new AppError('Файл не найден', 404));

    // Удаляем физический файл
    const filePath = path.join(__dirname, '..', fileEntry.fileUrl);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    fileEntry.deleteOne();
    await project.save();

    res.status(204).json({ status: 'success', data: null });
});

// ── Excel export ──────────────────────────────────────────────────────────────

exports.exportExcel = catchAsync(async (req, res, next) => {
    const project = await BoardProject.findById(req.params.id)
        .populate('createdBy', 'name email')
        .populate('tasks.assignedTo', 'name email specialization');

    if (!project) return next(new AppError('Проект не найден', 404));

    // ?unpaidOnly=true — только неоплаченные задачи
    const unpaidOnly = req.query.unpaidOnly === 'true';
    const allTasks   = (project.tasks || []).map(t => t.toObject ? t.toObject() : t);
    const tasks      = unpaidOnly ? allTasks.filter(t => !t.isPaid) : allTasks;

    const sheetLabel = unpaidOnly
        ? `${project.name.slice(0, 25)} (неопл.)`
        : project.name.slice(0, 31);

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet(sheetLabel);

    const border = (cell) => {
        cell.border = {
            top:    { style: 'thin', color: { argb: 'FF999999' } },
            left:   { style: 'thin', color: { argb: 'FF999999' } },
            bottom: { style: 'thin', color: { argb: 'FF999999' } },
            right:  { style: 'thin', color: { argb: 'FF999999' } },
        };
    };

    ws.columns = [
        { header: '№',               key: 'num',      width: 6  },
        { header: 'Задача',          key: 'title',    width: 52 },
        { header: 'Часы',            key: 'hours',    width: 10 },
        { header: 'Заказчик',        key: 'customer', width: 24 },
        { header: 'Система/Проект',  key: 'system',   width: 20 },
        { header: 'Дата',            key: 'date',     width: 13 },
        { header: 'Оплата',          key: 'paid',     width: 14 },
    ];

    // Заголовок
    const headerRow = ws.getRow(1);
    headerRow.height = 24;
    headerRow.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
    headerRow.eachCell((cell) => {
        border(cell);
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    tasks.forEach((task, index) => {
        const dateStr = task.dueDate
            ? new Date(task.dueDate).toLocaleDateString('ru-RU')
            : '—';
        const isPaid = task.isPaid === true;

        const row = ws.addRow({
            num:      index + 1,
            title:    task.title,
            hours:    task.hours || 0,
            customer: task.customer || '—',
            system:   task.system  || '—',
            date:     dateStr,
            paid:     isPaid ? '✅ Оплачено' : '❌ Не оплачено',
        });

        row.height = 20;

        // Чередование строк
        const baseBg = index % 2 === 0 ? 'FFD9EAD3' : 'FFF0FAF4';
        row.eachCell({ includeEmpty: true }, (cell) => {
            border(cell);
            cell.alignment = { vertical: 'middle', wrapText: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
        });

        // Колонка "Оплата" — цветная
        const paidCell = row.getCell('paid');
        paidCell.font = { bold: true, color: { argb: isPaid ? 'FF166534' : 'FFB91C1C' } };
        paidCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isPaid ? 'FFD1FAE5' : 'FFFEE2E2' } };
        paidCell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // ── Итоговая строка ────────────────────────────────────────────────────────
    const totalHours    = tasks.reduce((s, t) => s + (Number(t.hours) || 0), 0);
    const paidHours     = tasks.filter((t) => t.isPaid).reduce((s, t) => s + (Number(t.hours) || 0), 0);
    const unpaidHours   = totalHours - paidHours;
    const paidCount     = tasks.filter((t) => t.isPaid).length;
    const unpaidCount   = tasks.length - paidCount;

    ws.addRow({}); // пустая строка-разделитель

    const totalRow = ws.addRow({
        num:      '',
        title:    `Итого задач: ${tasks.length}  |  Оплачено: ${paidCount}  |  Не оплачено: ${unpaidCount}`,
        hours:    totalHours,
        customer: '',
        system:   '',
        date:     '',
        paid:     `✅ ${paidHours}ч  /  ❌ ${unpaidHours}ч`,
    });
    totalRow.height = 24;
    totalRow.font   = { bold: true, size: 11, color: { argb: 'FF052E16' } };
    totalRow.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF86EFAC' } };
    totalRow.eachCell({ includeEmpty: true }, (cell) => {
        border(cell);
        cell.alignment = { vertical: 'middle', wrapText: true };
    });
    totalRow.getCell('paid').alignment = { horizontal: 'center', vertical: 'middle' };

    // Выравнивание колонок
    ws.getColumn('title').alignment    = { wrapText: true, vertical: 'middle' };
    ws.getColumn('hours').alignment    = { horizontal: 'center', vertical: 'middle' };
    ws.getColumn('num').alignment      = { horizontal: 'center', vertical: 'middle' };
    ws.getColumn('date').alignment     = { horizontal: 'center', vertical: 'middle' };

    const safeFileName = project.name.replace(/[^a-zA-Zа-яА-Я0-9_\- ]/g, '').trim() || 'project';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFileName)}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
});
