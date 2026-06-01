const Task = require('../models/Task');
const DayLog = require('../models/DayLog');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const PRIVILEGED_ROLES = ['admin', 'projectManager'];

async function assertDayLogOwnership(dayLogId, user) {
    if (!dayLogId) throw new AppError('dayLogId обязателен', 400);
    const day = await DayLog.findById(dayLogId).select('userId').lean();
    if (!day) throw new AppError('DayLog не найден', 404);
    if (PRIVILEGED_ROLES.includes(user.role)) return day;
    if (String(day.userId) !== String(user._id)) {
        throw new AppError('Нет доступа к этому дню', 403);
    }
    return day;
}

exports.createTask = catchAsync(async (req, res, next) => {
    await assertDayLogOwnership(req.body.dayLogId, req.user);

    const newTask = await Task.create(req.body);

    res.status(201).json({
        status: 'success',
        data: {
            task: newTask
        }
    });
});

// Быстрое создание задачи: автоматически находит/создаёт DayLog за указанную дату,
// опционально создаёт Project в этом дне по имени, генерит shortCode для внешних.
exports.quickCreateTask = catchAsync(async (req, res, next) => {
    const {
        date,
        title,
        description,
        hours,
        status,
        kind,
        customer,
        projectName,
        payment,
    } = req.body;

    if (!title || !title.trim()) {
        return next(new AppError('title обязателен', 400));
    }
    const dateIso = (date || new Date().toISOString().slice(0, 10)).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
        return next(new AppError('Некорректная дата', 400));
    }

    const Project = require('../models/Project');
    const UserProject = require('../models/UserProject');

    const dateStart = new Date(`${dateIso}T00:00:00.000Z`);
    const dateEnd   = new Date(`${dateIso}T23:59:59.999Z`);

    // 1. DayLog (find or create)
    let dayLog = await DayLog.findOne({
        userId: req.user._id,
        date: { $gte: dateStart, $lte: dateEnd },
    });
    if (!dayLog) {
        dayLog = await DayLog.create({ userId: req.user._id, date: dateStart });
    }

    // 2. Project в этом дне (если указано имя)
    let projectId = null;
    if (projectName && projectName.trim()) {
        const name = projectName.trim();
        const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let proj = await Project.findOne({
            dayLogId: dayLog._id,
            name: new RegExp(`^${safe}$`, 'i'),
        });
        if (!proj) {
            proj = await Project.create({ dayLogId: dayLog._id, name });
        }
        projectId = proj._id;

        // 3. UserProject (реестр проектов юзера)
        const existingUp = await UserProject.findOne({
            userId: req.user._id,
            name: new RegExp(`^${safe}$`, 'i'),
        });
        if (!existingUp) {
            await UserProject.create({
                userId: req.user._id,
                name,
                customer: customer || '',
            });
        }
    }

    // 4. shortCode для внешних
    const taskKind = kind === 'external' ? 'external' : 'work';
    let shortCode = null;
    if (taskKind === 'external') {
        const userDayLogs = await DayLog.find({ userId: req.user._id }).select('_id').lean();
        const ids = userDayLogs.map((d) => d._id);
        const tasksWithCodes = await Task.find({
            dayLogId: { $in: ids },
            shortCode: { $exists: true, $ne: null },
        }).select('shortCode').lean();
        const nums = tasksWithCodes.map((t) => parseInt(t.shortCode, 10)).filter((n) => Number.isFinite(n));
        const next = nums.length ? Math.max(...nums) + 1 : 1;
        shortCode = String(next).padStart(4, '0');
    }

    const paymentStatus = payment === 'paid' ? 'paid' : 'unpaid';

    const task = await Task.create({
        dayLogId: dayLog._id,
        projectId,
        title: title.trim(),
        description: description || undefined,
        hours: Number(hours) || 0,
        status: status === 'pending' ? 'pending' : 'completed',
        kind: taskKind,
        customer: customer ? { name: customer.trim() } : undefined,
        shortCode,
        payment: {
            status:   paymentStatus,
            amount:   0,
            currency: 'UZS',
            paidAt:   paymentStatus === 'paid' ? new Date() : null,
        },
    });

    res.status(201).json({
        status: 'success',
        data: { task, dayLogId: dayLog._id },
    });
});

exports.getTasksByDay = catchAsync(async (req, res, next) => {
    await assertDayLogOwnership(req.params.dayLogId, req.user);

    const tasks = await Task.find({ dayLogId: req.params.dayLogId }).populate('files');

    res.status(200).json({
        status: 'success',
        results: tasks.length,
        data: {
            tasks
        }
    });
});

exports.deleteTask = catchAsync(async (req, res, next) => {
    const task = await Task.findById(req.params.id);

    if (!task) {
        return next(new AppError('No task found with that ID', 404));
    }

    await assertDayLogOwnership(task.dayLogId, req.user);

    await task.deleteOne();

    res.status(204).json({
        status: 'success',
        data: null
    });
});

exports.updateTask = catchAsync(async (req, res, next) => {
    const existing = await Task.findById(req.params.id).select('dayLogId').lean();
    if (!existing) {
        return next(new AppError('No task found with that ID', 404));
    }

    await assertDayLogOwnership(existing.dayLogId, req.user);

    const { dayLogId: _ignore, ...patch } = req.body;

    const task = await Task.findByIdAndUpdate(req.params.id, patch, {
        new: true,
        runValidators: true
    });

    res.status(200).json({
        status: 'success',
        data: {
            task
        }
    });
});
