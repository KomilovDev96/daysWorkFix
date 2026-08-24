const BoardProject = require('../models/BoardProject');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { generateUniquePortalToken } = require('../utils/portalToken');

// Загрузить проект и проверить право управления API задач.
// admin — любой; остальные — только свой (createdBy).
const loadManageable = async (id, user, next) => {
    const project = await BoardProject.findById(id);
    if (!project) {
        next(new AppError('Проект не найден', 404));
        return null;
    }
    const isOwner = String(project.createdBy) === String(user._id);
    if (user.role !== 'admin' && !isOwner) {
        next(new AppError('Нет прав для управления API этого проекта', 403));
        return null;
    }
    return project;
};

const taskApiPublic = (project) => ({
    enabled: project.taskApi.enabled,
    token: project.taskApi.token,
    createdAt: project.taskApi.createdAt,
    revokedAt: project.taskApi.revokedAt,
});

// GET /api/board-projects/:id/task-api
exports.getTaskApi = catchAsync(async (req, res, next) => {
    const project = await loadManageable(req.params.id, req.user, next);
    if (!project) return;
    res.status(200).json({ status: 'success', data: { taskApi: taskApiPublic(project) } });
});

// PATCH /api/board-projects/:id/task-api — включить/выключить (токен создаётся при первом включении).
exports.updateTaskApi = catchAsync(async (req, res, next) => {
    const project = await loadManageable(req.params.id, req.user, next);
    if (!project) return;
    const a = project.taskApi;

    if (typeof req.body.enabled === 'boolean') {
        a.enabled = req.body.enabled;
        if (a.enabled && !a.token) {
            a.token = await generateUniquePortalToken(BoardProject, 'taskApi.token');
            a.createdAt = new Date();
            a.revokedAt = null;
        }
        if (!a.enabled) a.revokedAt = new Date();
    }

    await project.save();
    res.status(200).json({ status: 'success', data: { taskApi: taskApiPublic(project) } });
});

// POST /api/board-projects/:id/task-api/regenerate — новый ключ (старый перестаёт работать).
exports.regenerateToken = catchAsync(async (req, res, next) => {
    const project = await loadManageable(req.params.id, req.user, next);
    if (!project) return;
    project.taskApi.token = await generateUniquePortalToken(BoardProject, 'taskApi.token');
    project.taskApi.enabled = true;
    project.taskApi.createdAt = new Date();
    project.taskApi.revokedAt = null;
    await project.save();
    res.status(200).json({ status: 'success', data: { taskApi: taskApiPublic(project) } });
});
