const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const BoardProject = require('../models/BoardProject');
const ProjectUpdate = require('../models/ProjectUpdate');
const ProjectEvent = require('../models/ProjectEvent');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { generateUniquePortalToken } = require('../utils/portalToken');
const { logProjectEvent } = require('../utils/projectEvents');
const { computeProgress } = require('../utils/portalSerializer');
const { notifyProjectUpdate } = require('../services/notificationService');

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
const VIDEO_EXT = ['mp4', 'mov', 'webm', 'avi', 'mkv'];

const fileKind = (ext) => {
    if (IMAGE_EXT.includes(ext)) return 'image';
    if (VIDEO_EXT.includes(ext)) return 'video';
    return 'file';
};

// Загрузить проект и проверить право управления порталом.
// admin — любой; projectManager — только свой (createdBy или portal.manager).
const loadManageable = async (id, user, next) => {
    const project = await BoardProject.findById(id);
    if (!project) {
        next(new AppError('Проект не найден', 404));
        return null;
    }
    const isOwner =
        String(project.createdBy) === String(user._id) ||
        String(project.portal?.manager || '') === String(user._id);
    if (user.role !== 'admin' && !isOwner) {
        next(new AppError('Нет прав для управления порталом этого проекта', 403));
        return null;
    }
    return project;
};

const buildLink = (token) =>
    token ? `${(process.env.APP_PUBLIC_URL || '').replace(/\/+$/, '')}/portal/${token}` : null;

const portalPublic = (project) => ({
    enabled: project.portal.enabled,
    token: project.portal.token,
    link: buildLink(project.portal.token),
    hasPassword: !!project.portal.passwordHash,
    manager: project.portal.manager,
    notifyEmail: project.portal.notifyEmail,
    notifyTelegramId: project.portal.notifyTelegramId,
    manualProgress: project.portal.manualProgress,
    revokedAt: project.portal.revokedAt,
});

// GET /api/board-projects/:id/portal
exports.getPortal = catchAsync(async (req, res, next) => {
    const project = await loadManageable(req.params.id, req.user, next);
    if (!project) return;
    res.status(200).json({ status: 'success', data: { portal: portalPublic(project) } });
});

// PATCH /api/board-projects/:id/portal — настройки портала.
exports.updatePortal = catchAsync(async (req, res, next) => {
    const project = await loadManageable(req.params.id, req.user, next);
    if (!project) return;
    const p = project.portal;

    if (typeof req.body.enabled === 'boolean') {
        p.enabled = req.body.enabled;
        if (p.enabled && !p.token) {
            p.token = await generateUniquePortalToken(BoardProject);
            p.createdAt = new Date();
            p.revokedAt = null;
        }
        if (!p.enabled) p.revokedAt = new Date();
    }

    // Пароль: ключ присутствует → пустая строка очищает, иначе хэшируем.
    if (Object.prototype.hasOwnProperty.call(req.body, 'password')) {
        p.passwordHash = req.body.password
            ? await bcrypt.hash(req.body.password, 12)
            : null;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'manager'))
        p.manager = req.body.manager || null;
    if (Object.prototype.hasOwnProperty.call(req.body, 'notifyEmail'))
        p.notifyEmail = req.body.notifyEmail || '';
    if (Object.prototype.hasOwnProperty.call(req.body, 'notifyTelegramId'))
        p.notifyTelegramId = req.body.notifyTelegramId || '';
    if (Object.prototype.hasOwnProperty.call(req.body, 'manualProgress')) {
        const mp = req.body.manualProgress;
        p.manualProgress = mp === null || mp === '' ? null : Math.max(0, Math.min(100, Number(mp)));
    }

    await project.save();
    res.status(200).json({ status: 'success', data: { portal: portalPublic(project) } });
});

// POST /api/board-projects/:id/portal/regenerate — новая ссылка.
exports.regenerateToken = catchAsync(async (req, res, next) => {
    const project = await loadManageable(req.params.id, req.user, next);
    if (!project) return;
    project.portal.token = await generateUniquePortalToken(BoardProject);
    project.portal.enabled = true;
    project.portal.createdAt = new Date();
    project.portal.revokedAt = null;
    await project.save();
    res.status(200).json({ status: 'success', data: { portal: portalPublic(project) } });
});

// GET /api/board-projects/:id/updates — обновления (внутр. вид).
exports.getUpdates = catchAsync(async (req, res, next) => {
    const project = await loadManageable(req.params.id, req.user, next);
    if (!project) return;
    const updates = await ProjectUpdate.find({ projectId: project._id })
        .populate('authorId', 'name')
        .sort({ createdAt: -1 });
    res.status(200).json({ status: 'success', data: { updates } });
});

// POST /api/board-projects/:id/updates — публикация обновления (multipart files[]).
exports.publishUpdate = catchAsync(async (req, res, next) => {
    const project = await loadManageable(req.params.id, req.user, next);
    if (!project) return;

    const { title, body } = req.body;
    if (!title?.trim()) return next(new AppError('Заголовок обязателен', 400));

    let links = [];
    if (req.body.links) {
        try {
            links = typeof req.body.links === 'string' ? JSON.parse(req.body.links) : req.body.links;
        } catch {
            links = [];
        }
    }
    links = (Array.isArray(links) ? links : [])
        .filter((l) => l && l.url)
        .map((l) => ({ label: l.label || '', url: l.url }));

    const files = (req.files || []).map((f) => {
        const ext = path.extname(f.originalname).toLowerCase().replace('.', '') || 'file';
        return {
            originalName: f.originalname,
            fileUrl: `uploads/${f.filename}`,
            fileType: ext,
            kind: fileKind(ext),
        };
    });

    const progress = (req.body.progress === '' || req.body.progress == null)
        ? null
        : Math.max(0, Math.min(100, Number(req.body.progress)));

    const update = await ProjectUpdate.create({
        projectId: project._id,
        authorId: req.user._id,
        title: title.trim(),
        body: body?.trim() || '',
        progress,
        links,
        files,
    });

    // Если указан ручной прогресс — синхронизируем на проекте, чтобы портал показал его же.
    if (progress != null) {
        project.portal.manualProgress = progress;
        await project.save();
    }

    // Таймлайн.
    await logProjectEvent(project._id, 'update_published', `Опубликовано обновление: ${update.title}`, {
        meta: { updateId: update._id, progress },
        actorId: req.user._id,
    });
    if (files.length) {
        await logProjectEvent(project._id, 'file_added', `Добавлены файлы (${files.length}) к обновлению`, {
            meta: { updateId: update._id, count: files.length },
            actorId: req.user._id,
        });
    }
    if (progress != null) {
        await logProjectEvent(project._id, 'progress_changed', `Прогресс проекта: ${progress}%`, {
            meta: { updateId: update._id, percent: progress },
            actorId: req.user._id,
        });
    }

    // Уведомления (Telegram). Не блокируем ответ ошибкой канала.
    const percent = computeProgress(project).percent;
    notifyProjectUpdate(project, update, percent).catch((e) =>
        console.error('[portal] notify failed:', e.message)
    );

    await update.populate('authorId', 'name');
    res.status(201).json({ status: 'success', data: { update } });
});

// DELETE /api/board-projects/:id/updates/:updateId
exports.deleteUpdate = catchAsync(async (req, res, next) => {
    const project = await loadManageable(req.params.id, req.user, next);
    if (!project) return;

    const update = await ProjectUpdate.findOne({ _id: req.params.updateId, projectId: project._id });
    if (!update) return next(new AppError('Обновление не найдено', 404));

    // Удаляем физические файлы обновления.
    (update.files || []).forEach((f) => {
        const fp = path.join(__dirname, '..', f.fileUrl);
        if (fs.existsSync(fp)) {
            try { fs.unlinkSync(fp); } catch (e) { console.error('[portal] unlink:', e.message); }
        }
    });

    await update.deleteOne();
    res.status(204).json({ status: 'success', data: null });
});

// GET /api/board-projects/:id/timeline
exports.getTimeline = catchAsync(async (req, res, next) => {
    const project = await loadManageable(req.params.id, req.user, next);
    if (!project) return;
    const events = await ProjectEvent.find({ projectId: project._id }).sort({ createdAt: -1 }).limit(200);
    res.status(200).json({ status: 'success', data: { events } });
});
