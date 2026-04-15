const jwt = require('jsonwebtoken');
const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const signToken = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

const createSendToken = (user, statusCode, res) => {
    const token = signToken(user._id);
    user.password = undefined;
    res.status(statusCode).json({ status: 'success', token, data: { user } });
};

// ── Auth ──────────────────────────────────────────────────────────────────────

exports.register = catchAsync(async (req, res, next) => {
    const newUser = await User.create({
        name:     req.body.name,
        email:    req.body.email,
        password: req.body.password,
        role:     req.body.role || 'worker',
    });
    createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password)
        return next(new AppError('Введите email и пароль', 400));

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.correctPassword(password, user.password)))
        return next(new AppError('Неверный email или пароль', 401));

    createSendToken(user, 200, res);
});

// ── Users ─────────────────────────────────────────────────────────────────────

// Admin — все пользователи
exports.getAllUsers = catchAsync(async (req, res, next) => {
    if (req.user.role !== 'admin')
        return next(new AppError('Только администратор может видеть всех пользователей', 403));

    const users = await User.find().sort({ createdAt: -1 });
    res.status(200).json({ status: 'success', results: users.length, data: { users } });
});

// Менеджер/Админ — только воркеры (для назначения задач)
exports.getWorkers = catchAsync(async (req, res, next) => {
    if (!['admin', 'projectManager'].includes(req.user.role))
        return next(new AppError('Доступ запрещён', 403));

    const workers = await User.find({ role: 'worker' }).select('name email role');
    res.status(200).json({ status: 'success', data: { users: workers } });
});

// Admin — только менеджеры
exports.getManagers = catchAsync(async (req, res, next) => {
    if (req.user.role !== 'admin')
        return next(new AppError('Только администратор', 403));

    const managers = await User.find({ role: 'projectManager' }).select('name email role');
    res.status(200).json({ status: 'success', data: { users: managers } });
});

exports.getMe = catchAsync(async (req, res) => {
    const user = await User.findById(req.user._id);
    res.status(200).json({ status: 'success', data: { user } });
});

exports.updateMe = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.user._id);
    if (!user) return next(new AppError('Пользователь не найден', 404));

    if (req.body.name)     user.name     = req.body.name;
    if (req.body.email)    user.email    = req.body.email;
    if (req.body.password) user.password = req.body.password;

    await user.save();
    user.password = undefined;
    res.status(200).json({ status: 'success', data: { user } });
});

// Admin — создать пользователя
exports.createUser = catchAsync(async (req, res, next) => {
    if (req.user.role !== 'admin')
        return next(new AppError('Только администратор может создавать пользователей', 403));

    const user = await User.create({
        name:     req.body.name,
        email:    req.body.email,
        password: req.body.password,
        role:     req.body.role || 'worker',
    });
    user.password = undefined;
    res.status(201).json({ status: 'success', data: { user } });
});

// Admin — обновить любого; остальные — только себя
exports.updateUser = catchAsync(async (req, res, next) => {
    const isAdmin = req.user.role === 'admin';
    const isSelf  = String(req.user._id) === String(req.params.id);

    if (!isAdmin && !isSelf)
        return next(new AppError('Можно редактировать только свои данные', 403));

    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError('Пользователь не найден', 404));

    if (req.body.name)     user.name     = req.body.name;
    if (req.body.email)    user.email    = req.body.email;
    if (req.body.password) user.password = req.body.password;
    if (isAdmin && req.body.role) user.role = req.body.role;

    await user.save();
    user.password = undefined;
    res.status(200).json({ status: 'success', data: { user } });
});

// Admin — удалить
exports.deleteUser = catchAsync(async (req, res, next) => {
    if (req.user.role !== 'admin')
        return next(new AppError('Только администратор может удалять пользователей', 403));

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return next(new AppError('Пользователь не найден', 404));

    res.status(204).json({ status: 'success', data: null });
});
