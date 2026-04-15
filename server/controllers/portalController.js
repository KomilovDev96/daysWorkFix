const BoardProject  = require('../models/BoardProject');
const ProjectComment = require('../models/ProjectComment');
const catchAsync    = require('../utils/catchAsync');
const AppError      = require('../utils/appError');

// Гость видит только свои проекты (где он в clients[])
exports.getMyProjects = catchAsync(async (req, res) => {
    const projects = await BoardProject.find({ clients: req.user._id })
        .populate('createdBy', 'name')
        .select('-tasks.isPaid')          // оплата гостю не видна
        .sort({ createdAt: -1 });

    res.status(200).json({
        status: 'success',
        data: { projects },
    });
});

exports.getProject = catchAsync(async (req, res, next) => {
    const project = await BoardProject.findOne({
        _id: req.params.id,
        clients: req.user._id,
    })
        .populate('createdBy', 'name')
        .select('-tasks.isPaid');

    if (!project) return next(new AppError('Проект не найден или доступ запрещён', 404));

    const comments = await ProjectComment.find({ projectId: project._id })
        .populate('userId', 'name role')
        .sort({ createdAt: 1 });

    res.status(200).json({
        status: 'success',
        data: { project, comments },
    });
});

exports.addComment = catchAsync(async (req, res, next) => {
    const { text } = req.body;
    if (!text?.trim()) return next(new AppError('Текст комментария обязателен', 400));

    // Проверяем доступ — guest должен быть в clients, admin/worker может видеть любой проект
    const project = await BoardProject.findById(req.params.id);
    if (!project) return next(new AppError('Проект не найден', 404));

    if (req.user.role === 'guest' && !project.clients.map(String).includes(String(req.user._id))) {
        return next(new AppError('Доступ запрещён', 403));
    }

    const comment = await ProjectComment.create({
        projectId: req.params.id,
        userId: req.user._id,
        text: text.trim(),
    });

    await comment.populate('userId', 'name role');

    res.status(201).json({ status: 'success', data: { comment } });
});

exports.deleteComment = catchAsync(async (req, res, next) => {
    const comment = await ProjectComment.findById(req.params.commentId);
    if (!comment) return next(new AppError('Комментарий не найден', 404));

    // Удалить может сам автор или admin
    if (String(comment.userId) !== String(req.user._id) && req.user.role !== 'admin') {
        return next(new AppError('Нет прав для удаления', 403));
    }

    await comment.deleteOne();
    res.status(204).json({ status: 'success', data: null });
});

// ── Admin: управление клиентами проекта ──────────────────────────────────────

exports.addClient = catchAsync(async (req, res, next) => {
    const { userId } = req.body;
    const project = await BoardProject.findByIdAndUpdate(
        req.params.id,
        { $addToSet: { clients: userId } },
        { new: true }
    ).populate('clients', 'name email role');

    if (!project) return next(new AppError('Проект не найден', 404));
    res.status(200).json({ status: 'success', data: { clients: project.clients } });
});

exports.removeClient = catchAsync(async (req, res, next) => {
    const project = await BoardProject.findByIdAndUpdate(
        req.params.id,
        { $pull: { clients: req.params.userId } },
        { new: true }
    ).populate('clients', 'name email role');

    if (!project) return next(new AppError('Проект не найден', 404));
    res.status(200).json({ status: 'success', data: { clients: project.clients } });
});

// Получить все комментарии проекта (для admin/worker)
exports.getProjectComments = catchAsync(async (req, res) => {
    const comments = await ProjectComment.find({ projectId: req.params.id })
        .populate('userId', 'name role')
        .sort({ createdAt: 1 });

    res.status(200).json({ status: 'success', data: { comments } });
});
