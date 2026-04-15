const Project = require('../models/Project');
const Task = require('../models/Task');
const TaskFile = require('../models/TaskFile');
const DayLog = require('../models/DayLog');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// List all projects accessible to the current user
exports.getAllProjects = catchAsync(async (req, res) => {
    let query = {};

    if (req.user.role !== 'admin') {
        const logs = await DayLog.find({ userId: req.user.id }, '_id');
        query.dayLogId = { $in: logs.map((l) => l._id) };
    }

    const projects = await Project.find(query)
        .populate({
            path: 'dayLogId',
            select: 'date userId',
            populate: { path: 'userId', select: 'name email' },
        })
        .populate({
            path: 'tasks',
        })
        .sort({ createdAt: -1 });

    res.status(200).json({
        status: 'success',
        results: projects.length,
        data: { projects },
    });
});

exports.createProject = catchAsync(async (req, res, next) => {
    const project = await Project.create(req.body);

    res.status(201).json({
        status: 'success',
        data: { project }
    });
});

exports.updateProject = catchAsync(async (req, res, next) => {
    const project = await Project.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    if (!project) {
        return next(new AppError('No project found with that ID', 404));
    }

    res.status(200).json({
        status: 'success',
        data: { project }
    });
});

exports.deleteProject = catchAsync(async (req, res, next) => {
    const project = await Project.findByIdAndDelete(req.params.id);

    if (!project) {
        return next(new AppError('No project found with that ID', 404));
    }

    // Delete all tasks and their files belonging to this project
    const tasks = await Task.find({ projectId: req.params.id });
    const taskIds = tasks.map(t => t._id);

    if (taskIds.length > 0) {
        await TaskFile.deleteMany({ taskId: { $in: taskIds } });
        await Task.deleteMany({ projectId: req.params.id });
    }

    res.status(204).json({
        status: 'success',
        data: null
    });
});
