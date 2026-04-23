const ExcelJS = require('exceljs');
const path = require('path');
const fs   = require('fs');
const BoardProject = require('../models/BoardProject');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

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
    // Admin видит все проекты; остальные — только свои
    const filter = req.user.role === 'admin' ? {} : { createdBy: req.user._id };

    const projects = await BoardProject.find(filter)
        .populate('createdBy', 'name email')
        .populate('tasks.assignedTo', 'name email')
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
        .populate('tasks.assignedTo', 'name email');

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

    res.status(201).json({ status: 'success', data: { project: populated } });
});

exports.update = catchAsync(async (req, res, next) => {
    const project = await BoardProject.findById(req.params.id);
    if (!project) return next(new AppError('Проект не найден', 404));

    if (req.user.role !== 'admin' && String(project.createdBy) !== String(req.user._id))
        return next(new AppError('Нет прав для редактирования этого проекта', 403));

    const { tasks, ...rest } = req.body;
    Object.assign(project, rest);
    await project.save();

    await project.populate('createdBy', 'name email');
    await project.populate('tasks.assignedTo', 'name email');

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
    await project.populate('tasks.assignedTo', 'name email');

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
    await project.populate('tasks.assignedTo', 'name email');

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
    await project.populate('tasks.assignedTo', 'name email');

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
        .populate('tasks.assignedTo', 'name email');

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
