const BoardProject = require('../models/BoardProject');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// ВРЕМЕННЫЙ публичный эндпоинт без авторизации — для массового заполнения задач
// в проект Fabrio сторонним агентом. Работает только при NODE_ENV=development,
// чтобы случайно не оказаться доступным после деплоя на прод.
// Удалить controller+route+модель-поля после того как данные заполнены.
exports.addTask = catchAsync(async (req, res, next) => {
    if (process.env.NODE_ENV !== 'development') {
        return next(new AppError('Not found', 404));
    }

    const project = await BoardProject.findOne({ name: /^fabrio$/i });
    if (!project) return next(new AppError('Проект Fabrio не найден', 404));

    const { title, description, execRole, amount, hours, isPaid, customer, system, dueDate, notes } = req.body;
    if (!title) return next(new AppError('Поле title обязательно', 400));

    project.tasks.push({
        title,
        description: description || '',
        execRole: ['frontend', 'backend', 'pm'].includes(execRole) ? execRole : null,
        amount: Number(amount) || 0,
        hours: Number(hours) || 0,
        isPaid: !!isPaid,
        customer: customer || '',
        system: system || '',
        dueDate: dueDate || null,
        notes: notes || '',
    });
    await project.save();

    const newTask = project.tasks[project.tasks.length - 1];
    res.status(201).json({ status: 'success', data: { task: newTask } });
});
