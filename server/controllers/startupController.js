const StartupProject = require('../models/StartupProject');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.getAll = catchAsync(async (req, res) => {
    const projects = await StartupProject.find()
        .populate('createdBy', 'name email')
        .populate('members', 'name email')
        .sort({ createdAt: -1 });

    res.status(200).json({
        status: 'success',
        results: projects.length,
        data: { projects },
    });
});

exports.create = catchAsync(async (req, res) => {
    const project = await StartupProject.create({
        ...req.body,
        createdBy: req.user.id,
        members: req.body.members || [],
    });

    const populated = await StartupProject.findById(project._id)
        .populate('createdBy', 'name email')
        .populate('members', 'name email');

    res.status(201).json({
        status: 'success',
        data: { project: populated },
    });
});

exports.update = catchAsync(async (req, res, next) => {
    const project = await StartupProject.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    })
        .populate('createdBy', 'name email')
        .populate('members', 'name email');

    if (!project) return next(new AppError('Проект не найден', 404));

    res.status(200).json({
        status: 'success',
        data: { project },
    });
});

exports.remove = catchAsync(async (req, res, next) => {
    const project = await StartupProject.findByIdAndDelete(req.params.id);
    if (!project) return next(new AppError('Проект не найден', 404));

    res.status(204).json({ status: 'success', data: null });
});

exports.addMember = catchAsync(async (req, res, next) => {
    const { userId } = req.body;

    const project = await StartupProject.findByIdAndUpdate(
        req.params.id,
        { $addToSet: { members: userId } },
        { new: true }
    )
        .populate('createdBy', 'name email')
        .populate('members', 'name email');

    if (!project) return next(new AppError('Проект не найден', 404));

    res.status(200).json({ status: 'success', data: { project } });
});

exports.removeMember = catchAsync(async (req, res, next) => {
    const project = await StartupProject.findByIdAndUpdate(
        req.params.id,
        { $pull: { members: req.params.userId } },
        { new: true }
    )
        .populate('createdBy', 'name email')
        .populate('members', 'name email');

    if (!project) return next(new AppError('Проект не найден', 404));

    res.status(200).json({ status: 'success', data: { project } });
});
