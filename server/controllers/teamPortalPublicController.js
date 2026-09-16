const path = require('path');
const BoardProject = require('../models/BoardProject');
const TaskComment = require('../models/TaskComment');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { assertStatusTransition } = require('../utils/taskStatusRules');

// Публичная командная ссылка (/team-portal/:token) — одна на спринт, без входа в систему.
// Участник сам выбирает свою роль при открытии; PM видит и утверждает задачи всех ролей,
// остальные видят и двигают только задачи своей роли (frontend/backend/tester).
const ROLES = ['frontend', 'backend', 'pm', 'tester'];
const ROLE_LABELS = { frontend: 'Frontend', backend: 'Backend', pm: 'PM', tester: 'Тестировщик' };

const findProjectBySprintTeamToken = (token) =>
    BoardProject.findOne({ 'sprints.teamToken': token }).populate('tasks.assignedTo', 'name');

const loadSprintAndValidateRole = async (token, role, next) => {
    if (!ROLES.includes(role)) {
        next(new AppError('Неизвестная роль', 400));
        return null;
    }
    const project = await findProjectBySprintTeamToken(token);
    if (!project) {
        next(new AppError('Ссылка не найдена', 404));
        return null;
    }
    const sprint = project.sprints.find((s) => s.teamToken === token);
    if (!sprint) {
        next(new AppError('Ссылка не найдена', 404));
        return null;
    }
    return { project, sprint };
};

const publicTeamTask = (t) => ({
    _id: t._id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    execRole: t.execRole,
    assignedTo: t.assignedTo?.name ? { name: t.assignedTo.name } : null,
    hours: t.hours || 0,
    dueDate: t.dueDate || null,
    files: (t.files || []).map((f) => ({
        _id: f._id,
        originalName: f.originalName,
        fileUrl: f.fileUrl,
        fileType: f.fileType,
        uploadedAt: f.uploadedAt,
    })),
});

// GET /api/public/team-portal/:token — инфо о спринте + список ролей (экран выбора роли).
exports.getTeamPortal = catchAsync(async (req, res, next) => {
    const project = await findProjectBySprintTeamToken(req.params.token);
    if (!project) return next(new AppError('Ссылка не найдена', 404));
    const sprint = project.sprints.find((s) => s.teamToken === req.params.token);
    if (!sprint) return next(new AppError('Ссылка не найдена', 404));

    res.status(200).json({
        status: 'success',
        data: {
            project: { name: project.name },
            sprint: { _id: sprint._id, name: sprint.name, status: sprint.status },
            roles: ROLES.map((key) => ({ key, label: ROLE_LABELS[key] })),
        },
    });
});

// GET /api/public/team-portal/:token/:role/tasks
exports.getTeamPortalTasks = catchAsync(async (req, res, next) => {
    const ctx = await loadSprintAndValidateRole(req.params.token, req.params.role, next);
    if (!ctx) return;
    const { project, sprint } = ctx;

    const sprintTasks = (project.tasks || []).filter((t) => String(t.sprint) === String(sprint._id));
    const tasks = req.params.role === 'pm' ? sprintTasks : sprintTasks.filter((t) => t.execRole === req.params.role);

    res.status(200).json({
        status: 'success',
        data: {
            sprint: { _id: sprint._id, name: sprint.name, status: sprint.status },
            project: { name: project.name },
            tasks: tasks.map(publicTeamTask),
        },
    });
});

// PATCH /api/public/team-portal/:token/:role/tasks/:taskId — сменить статус задачи.
exports.updateTeamPortalTaskStatus = catchAsync(async (req, res, next) => {
    const ctx = await loadSprintAndValidateRole(req.params.token, req.params.role, next);
    if (!ctx) return;
    const { project, sprint } = ctx;
    const { role, taskId } = req.params;

    const task = project.tasks.id(taskId);
    if (!task || String(task.sprint) !== String(sprint._id)) return next(new AppError('Задача не найдена', 404));
    if (role !== 'pm' && task.execRole !== role) return next(new AppError('Нет доступа к этой задаче', 403));

    try {
        assertStatusTransition(task.status, req.body.status, role === 'pm');
    } catch (e) {
        return next(e);
    }

    task.status = req.body.status;
    await project.save();
    await project.populate('tasks.assignedTo', 'name');

    res.status(200).json({ status: 'success', data: { task: publicTeamTask(project.tasks.id(taskId)) } });
});

// GET /api/public/team-portal/:token/tasks/:taskId/comments
exports.getTeamPortalComments = catchAsync(async (req, res, next) => {
    const project = await findProjectBySprintTeamToken(req.params.token);
    if (!project) return next(new AppError('Ссылка не найдена', 404));
    const task = project.tasks.id(req.params.taskId);
    if (!task) return next(new AppError('Задача не найдена', 404));

    const comments = await TaskComment.find({ project: project._id, taskId: task._id }).sort({ createdAt: 1 });
    res.status(200).json({ status: 'success', data: { comments } });
});

// POST /api/public/team-portal/:token/:role/tasks/:taskId/comments — имя вводится вручную,
// т.к. у публичного участника нет аккаунта.
exports.addTeamPortalComment = catchAsync(async (req, res, next) => {
    const ctx = await loadSprintAndValidateRole(req.params.token, req.params.role, next);
    if (!ctx) return;
    const { project, sprint } = ctx;

    const task = project.tasks.id(req.params.taskId);
    if (!task || String(task.sprint) !== String(sprint._id)) return next(new AppError('Задача не найдена', 404));

    const authorName = req.body.authorName?.trim();
    const text = req.body.text?.trim();
    if (!authorName) return next(new AppError('Укажите имя', 400));
    if (!text) return next(new AppError('Текст комментария обязателен', 400));

    const comment = await TaskComment.create({
        project: project._id,
        taskId: task._id,
        authorName,
        role: req.params.role,
        text,
    });

    res.status(201).json({ status: 'success', data: { comment } });
});

// POST /api/public/team-portal/:token/:role/tasks/:taskId/files
exports.uploadTeamPortalFile = catchAsync(async (req, res, next) => {
    const ctx = await loadSprintAndValidateRole(req.params.token, req.params.role, next);
    if (!ctx) return;
    const { project, sprint } = ctx;
    const { role, taskId } = req.params;

    const task = project.tasks.id(taskId);
    if (!task || String(task.sprint) !== String(sprint._id)) return next(new AppError('Задача не найдена', 404));
    if (role !== 'pm' && task.execRole !== role) return next(new AppError('Нет доступа к этой задаче', 403));
    if (!req.file) return next(new AppError('Файл не загружен', 400));

    const ext = path.extname(req.file.originalname).toLowerCase();
    task.files.push({
        originalName: req.file.originalname,
        fileUrl: `uploads/${req.file.filename}`,
        fileType: ext.replace('.', '') || 'file',
    });
    await project.save();

    res.status(201).json({ status: 'success', data: { task: publicTeamTask(project.tasks.id(taskId)) } });
});
