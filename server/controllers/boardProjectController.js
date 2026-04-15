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

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet(project.name.slice(0, 31));

    ws.columns = [
        { header: 'нумерация', key: 'num',      width: 12 },
        { header: 'Задачи',    key: 'title',     width: 55 },
        { header: 'время  часы', key: 'hours',   width: 14 },
        { header: 'заказчик',  key: 'customer',  width: 25 },
        { header: 'проект(система)', key: 'system', width: 22 },
        { header: 'дата',      key: 'date',      width: 14 },
    ];

    // Header — красный фон, синий жирный текст
    const headerRow = ws.getRow(1);
    headerRow.height = 22;
    headerRow.font  = { bold: true, color: { argb: 'FF0000CC' } };
    headerRow.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFB3B3' } };
    headerRow.eachCell((cell) => {
        cell.border = {
            top:    { style: 'thin', color: { argb: 'FF999999' } },
            left:   { style: 'thin', color: { argb: 'FF999999' } },
            bottom: { style: 'thin', color: { argb: 'FF999999' } },
            right:  { style: 'thin', color: { argb: 'FF999999' } },
        };
    });

    const addStyledRow = (values) => {
        const row = ws.addRow(values);
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.border = {
                top:    { style: 'thin', color: { argb: 'FF999999' } },
                left:   { style: 'thin', color: { argb: 'FF999999' } },
                bottom: { style: 'thin', color: { argb: 'FF999999' } },
                right:  { style: 'thin', color: { argb: 'FF999999' } },
            };
        });
        return row;
    };

    project.tasks.forEach((task, index) => {
        const dateStr = task.dueDate
            ? new Date(task.dueDate).toISOString().slice(0, 10)
            : '';
        addStyledRow({
            num:      index + 1,
            title:    task.title,
            hours:    task.hours || 0,
            customer: task.customer || '',
            system:   task.system  || '',
            date:     dateStr,
        });
    });

    // Пустые зелёные строки до конца (как на скриншоте)
    const fillerCount = Math.max(0, 20 - project.tasks.length);
    for (let i = 0; i < fillerCount; i++) {
        addStyledRow({ num: '', title: '', hours: '', customer: '', system: '', date: '' });
    }

    // Выравнивание
    ws.getColumn('title').alignment    = { wrapText: true, vertical: 'middle' };
    ws.getColumn('hours').alignment    = { horizontal: 'center', vertical: 'middle' };
    ws.getColumn('num').alignment      = { horizontal: 'center', vertical: 'middle' };
    ws.getColumn('date').alignment     = { horizontal: 'center', vertical: 'middle' };
    ws.getColumn('customer').alignment = { vertical: 'middle' };
    ws.getColumn('system').alignment   = { vertical: 'middle' };

    const safeFileName = project.name.replace(/[^a-zA-Zа-яА-Я0-9_\- ]/g, '').trim() || 'project';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFileName)}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
});
