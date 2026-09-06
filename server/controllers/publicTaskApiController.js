const path = require('path');
const BoardProject = require('../models/BoardProject');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { logProjectEvent } = require('../utils/projectEvents');

const EXEC_ROLES = ['frontend', 'backend', 'pm', 'tester'];
const TASK_STATUSES = ['todo', 'in_progress', 'done', 'cancelled'];
const MAX_BATCH = 100;

const ROLE_LABELS = { frontend: 'Frontend', backend: 'Backend', pm: 'PM', tester: 'Тестировщик' };

const buildFileEntries = (files = []) =>
    files.map((f) => {
        const ext = path.extname(f.originalname).toLowerCase();
        return {
            originalName: f.originalname,
            fileUrl: `uploads/${f.filename}`,
            fileType: ext.replace('.', '') || 'file',
        };
    });

const toTaskDoc = (item, index, files = [], sprintId = null) => {
    const { title, description, execRole, amount, hours, isPaid, customer, system, dueDate, notes, status } = item || {};

    if (!title?.trim()) throw new AppError(`Задача #${index + 1}: поле title обязательно`, 400);
    if (!EXEC_ROLES.includes(execRole))
        throw new AppError(`Задача #${index + 1}: поле execRole обязательно (frontend, backend, pm или tester)`, 400);

    return {
        title: title.trim(),
        description: description || '',
        execRole,
        status: TASK_STATUSES.includes(status) ? status : 'done',
        amount: Number(amount) || 0,
        hours: Number(hours) || 0,
        // multipart-поля приходят строками ("true"/"false"), JSON — уже boolean.
        isPaid: isPaid === true || isPaid === 'true',
        customer: customer || '',
        system: system || '',
        dueDate: dueDate || null,
        notes: notes || '',
        sprint: sprintId,
        files,
    };
};

// Общая логика приёма задачи/пакета задач — используется и проектным, и спринтовым API.
// sprintId, если передан, проставляется на все созданные задачи.
const acceptSubmittedTasks = async (req, project, sprintId = null) => {
    const isMultipart = req.is('multipart/form-data');
    const isBatch = !isMultipart && (Array.isArray(req.body) || Array.isArray(req.body?.tasks));
    const items = isBatch
        ? (Array.isArray(req.body) ? req.body : req.body.tasks)
        : [req.body];

    if (!items.length) throw new AppError('Нет задач для добавления', 400);
    if (items.length > MAX_BATCH) throw new AppError(`Максимум ${MAX_BATCH} задач за один запрос`, 400);

    const attachedFiles = isMultipart ? buildFileEntries(req.files) : [];
    const prepared = items.map((item, i) => toTaskDoc(item, i, i === 0 ? attachedFiles : [], sprintId));

    project.tasks.push(...prepared);
    await project.save();

    const newTasks = project.tasks.slice(-prepared.length);

    await Promise.all(
        newTasks.map((t) =>
            logProjectEvent(
                project._id,
                'task_submitted_api',
                `Задача добавлена через API (${ROLE_LABELS[t.execRole]}): ${t.title}`,
                { meta: { taskId: t._id, execRole: t.execRole, sprintId: sprintId || undefined } }
            )
        )
    );

    return { newTasks, isBatch };
};

// POST /api/public/task-api/:token/tasks
// Публичный приём выполненной задачи (или нескольких сразу) от исполнителя (фронтенд/бэкенд/пм/тестировщик)
// без входа в систему, по постоянному токену проекта. Задачи сразу попадают в нужный модуль (execRole).
//
// Тело запроса:
//   - JSON, одна задача:  { title, execRole, ... }
//   - JSON, пакет:        { tasks: [ {...}, {...} ] }  или просто массив [...]  — до 100 задач за раз
//   - multipart/form-data: те же текстовые поля + files (до 10 файлов) — только для одной задачи за раз,
//     файлы к пакетной отправке не прикрепляются.
exports.submitTask = catchAsync(async (req, res, next) => {
    const project = await BoardProject.findOne({
        'taskApi.token': req.params.token,
        'taskApi.enabled': true,
    });
    if (!project) return next(new AppError('Неверный или отключённый API-ключ', 404));

    let result;
    try {
        result = await acceptSubmittedTasks(req, project);
    } catch (e) {
        return next(e);
    }

    res.status(201).json({
        status: 'success',
        results: result.newTasks.length,
        data: result.isBatch ? { tasks: result.newTasks } : { task: result.newTasks[0] },
    });
});

// POST /api/public/sprint-task-api/:token/tasks
// То же самое, но по токену конкретного спринта — задачи автоматически попадают именно в него
// (в дополнение к execRole), без необходимости передавать sprintId в теле запроса.
exports.submitSprintTask = catchAsync(async (req, res, next) => {
    const project = await BoardProject.findOne({ 'sprints.taskApiToken': req.params.token });
    if (!project) return next(new AppError('Неверный API-ключ спринта', 404));

    const sprint = project.sprints.find((s) => s.taskApiToken === req.params.token);
    if (!sprint) return next(new AppError('Неверный API-ключ спринта', 404));

    let result;
    try {
        result = await acceptSubmittedTasks(req, project, sprint._id);
    } catch (e) {
        return next(e);
    }

    res.status(201).json({
        status: 'success',
        results: result.newTasks.length,
        data: result.isBatch ? { tasks: result.newTasks } : { task: result.newTasks[0] },
    });
});
