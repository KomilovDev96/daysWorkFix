const path = require('path');
const BoardProject = require('../models/BoardProject');
const TaskComment = require('../models/TaskComment');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { assertStatusTransition } = require('../utils/taskStatusRules');

// Публичная командная ссылка (/team-portal/:token) — без входа в систему. Токен бывает двух
// видов: на конкретный спринт (sprints.teamToken → sprint не null в контексте ниже) или на
// весь проект сразу, «Все спринты» (BoardProject.teamToken → sprint === null, задачи берутся
// из всех спринтов проекта). Участник сам выбирает свою роль при открытии; PM видит и
// утверждает задачи всех ролей (и может создавать новые с назначением роли-исполнителя),
// остальные видят и двигают только задачи своей роли (frontend/backend/tester).
const ROLES = ['frontend', 'backend', 'pm', 'tester'];
const ROLE_LABELS = { frontend: 'Frontend', backend: 'Backend', pm: 'PM', tester: 'Тестировщик' };

// Возвращает { project, sprint } — sprint === null означает режим «все спринты проекта».
const resolveTeamPortalContext = async (token) => {
    let project = await BoardProject.findOne({ 'sprints.teamToken': token }).populate('tasks.assignedTo', 'name');
    if (project) {
        const sprint = project.sprints.find((s) => s.teamToken === token);
        if (sprint) return { project, sprint };
    }

    project = await BoardProject.findOne({ teamToken: token }).populate('tasks.assignedTo', 'name');
    if (project) return { project, sprint: null };

    return null;
};

// В режиме «все спринты» задача принадлежит области, если у неё вообще есть спринт
// (легаси/бэклоговые задачи без спринта в командный портал не попадают).
const taskInScope = (task, sprint) => (sprint ? String(task.sprint) === String(sprint._id) : !!task.sprint);

const loadTeamPortalContext = async (token, role, next) => {
    if (!ROLES.includes(role)) {
        next(new AppError('Неизвестная роль', 400));
        return null;
    }
    const ctx = await resolveTeamPortalContext(token);
    if (!ctx) {
        next(new AppError('Ссылка не найдена', 404));
        return null;
    }
    return ctx;
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

// GET /api/public/team-portal/:token — инфо о спринте (или проекте целиком) + список ролей
// (экран выбора роли). Для режима «все спринты» дополнительно отдаём список спринтов проекта —
// он нужен PM на фронте, чтобы выбрать спринт при создании новой задачи.
exports.getTeamPortal = catchAsync(async (req, res, next) => {
    const ctx = await resolveTeamPortalContext(req.params.token);
    if (!ctx) return next(new AppError('Ссылка не найдена', 404));
    const { project, sprint } = ctx;

    res.status(200).json({
        status: 'success',
        data: {
            project: { name: project.name },
            sprint: sprint ? { _id: sprint._id, name: sprint.name, status: sprint.status } : null,
            sprints: sprint ? undefined : project.sprints.map((s) => ({ _id: s._id, name: s.name, status: s.status })),
            roles: ROLES.map((key) => ({ key, label: ROLE_LABELS[key] })),
        },
    });
});

// GET /api/public/team-portal/:token/:role/tasks
exports.getTeamPortalTasks = catchAsync(async (req, res, next) => {
    const ctx = await loadTeamPortalContext(req.params.token, req.params.role, next);
    if (!ctx) return;
    const { project, sprint } = ctx;

    const scopeTasks = (project.tasks || []).filter((t) => taskInScope(t, sprint));
    const tasks = req.params.role === 'pm' ? scopeTasks : scopeTasks.filter((t) => t.execRole === req.params.role);

    // В режиме «все спринты» подмешиваем имя спринта в каждую задачу — фронт использует его
    // для тега на карточке, т.к. единого текущего спринта тут нет.
    const sprintNameById = sprint ? null : new Map(project.sprints.map((s) => [String(s._id), s.name]));

    res.status(200).json({
        status: 'success',
        data: {
            sprint: sprint ? { _id: sprint._id, name: sprint.name, status: sprint.status } : null,
            sprints: sprint ? undefined : project.sprints.map((s) => ({ _id: s._id, name: s.name, status: s.status })),
            project: { name: project.name },
            tasks: tasks.map((t) => ({
                ...publicTeamTask(t),
                ...(sprintNameById ? { sprintName: sprintNameById.get(String(t.sprint)) || null } : {}),
            })),
        },
    });
});

// POST /api/public/team-portal/:token/:role/tasks — PM заводит новую задачу и назначает
// роль-исполнителя (frontend/backend/pm/tester); доступно только роли pm. В режиме одного
// спринта задача автоматически попадает в него, в режиме «все спринты» — sprintId обязателен
// в теле запроса и должен быть одним из спринтов проекта.
exports.createTeamPortalTask = catchAsync(async (req, res, next) => {
    const ctx = await loadTeamPortalContext(req.params.token, req.params.role, next);
    if (!ctx) return;
    const { project, sprint } = ctx;
    if (req.params.role !== 'pm') return next(new AppError('Создавать задачи может только PM', 403));

    const { title, description, execRole, hours, dueDate, notes, sprintId } = req.body;
    if (!title?.trim()) return next(new AppError('Название задачи обязательно', 400));
    if (!ROLES.includes(execRole)) return next(new AppError('Укажите роль исполнителя', 400));

    let targetSprintId = sprint ? sprint._id : sprintId;
    if (!sprint) {
        const targetSprint = project.sprints.id(sprintId);
        if (!targetSprint) return next(new AppError('Укажите спринт для новой задачи', 400));
        targetSprintId = targetSprint._id;
    }

    project.tasks.push({
        title: title.trim(),
        description: description || '',
        execRole,
        status: 'todo',
        hours: Number(hours) || 0,
        dueDate: dueDate || null,
        notes: notes || '',
        sprint: targetSprintId,
    });
    await project.save();
    await project.populate('tasks.assignedTo', 'name');

    const newTask = project.tasks[project.tasks.length - 1];
    const sprintName = sprint ? null : project.sprints.id(targetSprintId)?.name || null;

    res.status(201).json({
        status: 'success',
        data: { task: { ...publicTeamTask(newTask), ...(sprint ? {} : { sprintName }) } },
    });
});

// PATCH /api/public/team-portal/:token/:role/tasks/:taskId — сменить статус задачи.
exports.updateTeamPortalTaskStatus = catchAsync(async (req, res, next) => {
    const ctx = await loadTeamPortalContext(req.params.token, req.params.role, next);
    if (!ctx) return;
    const { project, sprint } = ctx;
    const { role, taskId } = req.params;

    const task = project.tasks.id(taskId);
    if (!task || !taskInScope(task, sprint)) return next(new AppError('Задача не найдена', 404));
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
    const ctx = await resolveTeamPortalContext(req.params.token);
    if (!ctx) return next(new AppError('Ссылка не найдена', 404));
    const task = ctx.project.tasks.id(req.params.taskId);
    if (!task) return next(new AppError('Задача не найдена', 404));

    const comments = await TaskComment.find({ project: ctx.project._id, taskId: task._id }).sort({ createdAt: 1 });
    res.status(200).json({ status: 'success', data: { comments } });
});

// POST /api/public/team-portal/:token/:role/tasks/:taskId/comments — имя вводится вручную,
// т.к. у публичного участника нет аккаунта.
exports.addTeamPortalComment = catchAsync(async (req, res, next) => {
    const ctx = await loadTeamPortalContext(req.params.token, req.params.role, next);
    if (!ctx) return;
    const { project, sprint } = ctx;

    const task = project.tasks.id(req.params.taskId);
    if (!task || !taskInScope(task, sprint)) return next(new AppError('Задача не найдена', 404));

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
    const ctx = await loadTeamPortalContext(req.params.token, req.params.role, next);
    if (!ctx) return;
    const { project, sprint } = ctx;
    const { role, taskId } = req.params;

    const task = project.tasks.id(taskId);
    if (!task || !taskInScope(task, sprint)) return next(new AppError('Задача не найдена', 404));
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
