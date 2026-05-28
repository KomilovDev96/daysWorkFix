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
