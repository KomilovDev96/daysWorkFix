const TaskFile = require('../models/TaskFile');
const Task = require('../models/Task');
const ManagedTask = require('../models/ManagedTask');
const DayLog = require('../models/DayLog');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const PRIVILEGED_ROLES = ['admin', 'projectManager'];

async function assertTaskAccess(taskId, user) {
    if (!taskId) throw new AppError('taskId обязателен', 400);

    const userId = String(user._id);
    const isPrivileged = PRIVILEGED_ROLES.includes(user.role);

    const managed = await ManagedTask.findById(taskId).select('createdBy assignedTo').lean();
    if (managed) {
        if (isPrivileged) return;
        const isCreator = String(managed.createdBy) === userId;
        const isAssignee = (managed.assignedTo || []).some((id) => String(id) === userId);
        if (!isCreator && !isAssignee) throw new AppError('Нет доступа к этой задаче', 403);
        return;
    }

    const task = await Task.findById(taskId).select('dayLogId').lean();
    if (task) {
        if (isPrivileged) return;
        const day = await DayLog.findById(task.dayLogId).select('userId').lean();
        if (!day || String(day.userId) !== userId) {
            throw new AppError('Нет доступа к этой задаче', 403);
        }
        return;
    }

    throw new AppError('Задача не найдена', 404);
}

exports.uploadFile = catchAsync(async (req, res, next) => {
    if (!req.file) {
        return next(new AppError('Please upload a file!', 400));
    }

    const { taskId, title } = req.body;

    if (!taskId) {
        return next(new AppError('A file must belong to a task!', 400));
    }

    await assertTaskAccess(taskId, req.user);

    const fileExt = req.file.originalname.split('.').pop();

    const newFile = await TaskFile.create({
        taskId,
        title: title || req.file.originalname,
        fileUrl: `uploads/${req.file.filename}`,
        fileType: fileExt
    });

    res.status(201).json({
        status: 'success',
        data: {
            file: newFile
        }
    });
});

exports.getFilesByTask = catchAsync(async (req, res, next) => {
    const { taskId } = req.query;
    await assertTaskAccess(taskId, req.user);
    const files = await TaskFile.find({ taskId }).sort({ createdAt: -1 });
    res.status(200).json({ status: 'success', data: { files } });
});

exports.deleteFile = catchAsync(async (req, res, next) => {
    const file = await TaskFile.findById(req.params.id);

    if (!file) {
        return next(new AppError('No file found with that ID', 404));
    }

    await assertTaskAccess(file.taskId, req.user);

    await file.deleteOne();

    res.status(204).json({
        status: 'success',
        data: null
    });
});
