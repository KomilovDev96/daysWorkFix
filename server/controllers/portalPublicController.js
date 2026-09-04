const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const BoardProject = require('../models/BoardProject');
const ProjectUpdate = require('../models/ProjectUpdate');
const ProjectEvent = require('../models/ProjectEvent');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { publicProjectView, publicSprintView, publicUpdate } = require('../utils/portalSerializer');

const ACCESS_TTL = '12h';

// Найти включённый проект по публичному токену.
const findByToken = (token) =>
    BoardProject.findOne({ 'portal.token': token, 'portal.enabled': true })
        .populate('portal.manager', 'name')
        .populate('createdBy', 'name')
        .populate('tasks.assignedTo', 'name');

// Проверить пароль-доступ к защищённому порталу.
// Токен доступа приходит как Bearer-заголовок или ?access=<jwt>.
const hasValidAccess = (req, token) => {
    const raw = (req.headers.authorization?.startsWith('Bearer')
        ? req.headers.authorization.split(' ')[1]
        : req.query.access) || null;
    if (!raw) return false;
    try {
        const decoded = jwt.verify(raw, process.env.JWT_SECRET);
        return decoded.scope === 'portal' && decoded.token === token;
    } catch {
        return false;
    }
};

// GET /api/public/portal/:token — обзор проекта для клиента.
exports.getPortal = catchAsync(async (req, res, next) => {
    const { token } = req.params;
    const project = await findByToken(token);
    if (!project) return next(new AppError('Портал не найден или отключён', 404));

    // Защита паролем (опциональная).
    if (project.portal.passwordHash && !hasValidAccess(req, token)) {
        return res.status(401).json({ status: 'fail', passwordRequired: true });
    }

    const [updates, events] = await Promise.all([
        ProjectUpdate.find({ projectId: project._id, isPublished: true })
            .sort({ createdAt: -1 })
            .limit(50),
        ProjectEvent.find({ projectId: project._id }).sort({ createdAt: -1 }).limit(100),
    ]);

    res.status(200).json({
        status: 'success',
        data: { project: publicProjectView(project, { updates, events }) },
    });
});

// POST /api/public/portal/:token/access — обмен пароля на токен доступа.
exports.verifyAccess = catchAsync(async (req, res, next) => {
    const { token } = req.params;
    const { password } = req.body;
    const project = await findByToken(token);
    if (!project) return next(new AppError('Портал не найден или отключён', 404));

    if (!project.portal.passwordHash) {
        // Пароль не требуется — выдаём доступ сразу.
        const accessToken = jwt.sign({ scope: 'portal', token }, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL });
        return res.status(200).json({ status: 'success', data: { accessToken } });
    }

    if (!password || !(await bcrypt.compare(password, project.portal.passwordHash))) {
        return next(new AppError('Неверный пароль', 401));
    }

    const accessToken = jwt.sign({ scope: 'portal', token }, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL });
    res.status(200).json({ status: 'success', data: { accessToken } });
});

// GET /api/public/portal/:token/updates — пагинация обновлений.
exports.getUpdates = catchAsync(async (req, res, next) => {
    const { token } = req.params;
    const project = await findByToken(token);
    if (!project) return next(new AppError('Портал не найден или отключён', 404));
    if (project.portal.passwordHash && !hasValidAccess(req, token)) {
        return res.status(401).json({ status: 'fail', passwordRequired: true });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const updates = await ProjectUpdate.find({ projectId: project._id, isPublished: true })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

    res.status(200).json({
        status: 'success',
        data: { updates: updates.map(publicUpdate), page },
    });
});

// GET /api/public/sprint-portal/:token — отдельная ссылка на один спринт.
// Не требует portal.enabled/пароль проекта — своя, самостоятельная ссылка;
// но подчиняется visibleToClient конкретного спринта (можно отозвать вручную).
exports.getSprintPortal = catchAsync(async (req, res, next) => {
    const { token } = req.params;
    const project = await BoardProject.findOne({ 'sprints.token': token })
        .populate('portal.manager', 'name')
        .populate('createdBy', 'name')
        .populate('tasks.assignedTo', 'name');
    if (!project) return next(new AppError('Ссылка не найдена', 404));

    const sprint = project.sprints.find((s) => s.token === token);
    if (!sprint || !sprint.visibleToClient) return next(new AppError('Ссылка не найдена', 404));

    res.status(200).json({
        status: 'success',
        data: { project: publicSprintView(project, sprint) },
    });
});
