const ProjectTemplate = require('../models/ProjectTemplate');
const Project = require('../models/Project');
const Task = require('../models/Task');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.getTemplates = catchAsync(async (req, res) => {
    const query = req.user.role === 'admin'
        ? {}
        : { createdBy: req.user.id };

    const templates = await ProjectTemplate.find(query)
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 });

    res.status(200).json({
        status: 'success',
        results: templates.length,
        data: { templates }
    });
});

exports.createTemplate = catchAsync(async (req, res) => {
    const template = await ProjectTemplate.create({
        ...req.body,
        createdBy: req.user.id,
    });

    res.status(201).json({
        status: 'success',
        data: { template }
    });
});

exports.updateTemplate = catchAsync(async (req, res, next) => {
    const template = await ProjectTemplate.findOneAndUpdate(
        { _id: req.params.id, createdBy: req.user.id },
        req.body,
        { new: true, runValidators: true }
    );

    if (!template) {
        return next(new AppError('No template found with that ID', 404));
    }

    res.status(200).json({
        status: 'success',
        data: { template }
    });
});

exports.deleteTemplate = catchAsync(async (req, res, next) => {
    const template = await ProjectTemplate.findOneAndDelete({
        _id: req.params.id,
        createdBy: req.user.id,
    });

    if (!template) {
        return next(new AppError('No template found with that ID', 404));
    }

    res.status(204).json({ status: 'success', data: null });
});

// Apply template to a DayLog: creates a Project + Tasks
exports.applyTemplate = catchAsync(async (req, res, next) => {
    const { dayLogId } = req.body;

    if (!dayLogId) {
        return next(new AppError('dayLogId is required', 400));
    }

    const template = await ProjectTemplate.findById(req.params.id);

    if (!template) {
        return next(new AppError('No template found with that ID', 404));
    }

    // Create the project from template
    const project = await Project.create({
        dayLogId,
        name: template.name,
        description: template.description,
        templateId: template._id,
    });

    // Create tasks from template tasks
    const taskDocs = await Promise.all(
        template.tasks.map((tmplTask) =>
            Task.create({
                dayLogId,
                projectId: project._id,
                title: tmplTask.title,
                description: tmplTask.description,
                hours: tmplTask.estimatedHours || 0,
                status: 'pending',
                testingStatus: 'not_reviewed',
            })
        )
    );

    res.status(201).json({
        status: 'success',
        data: {
            project: { ...project.toObject(), tasks: taskDocs }
        }
    });
});
