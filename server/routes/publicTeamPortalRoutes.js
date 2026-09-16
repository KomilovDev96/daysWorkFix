const express = require('express');
const ctrl = require('../controllers/teamPortalPublicController');
const upload = require('../middleware/uploadMiddleware');
const rateLimit = require('../middleware/rateLimit');

// Публичный роутер — БЕЗ authMiddleware. Доступ по общему токену спринта, роль
// участник выбирает сам при открытии ссылки (см. teamPortalPublicController).
const router = express.Router();

// Мутации (смена статуса, комментарии, файлы) ограничены по IP+токену, чтобы
// анонимную ссылку без пароля нельзя было завалить запросами.
const mutateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    keyFn: (req) => `${req.ip}:${req.params.token}`,
    message: 'Слишком много запросов, подождите минуту.',
});

router.get('/team-portal/:token',                        ctrl.getTeamPortal);
router.get('/team-portal/:token/:role/tasks',             ctrl.getTeamPortalTasks);
router.patch('/team-portal/:token/:role/tasks/:taskId',   mutateLimiter, ctrl.updateTeamPortalTaskStatus);
router.get('/team-portal/:token/tasks/:taskId/comments',  ctrl.getTeamPortalComments);
router.post('/team-portal/:token/:role/tasks/:taskId/comments', mutateLimiter, ctrl.addTeamPortalComment);
router.post('/team-portal/:token/:role/tasks/:taskId/files',    mutateLimiter, upload.single('file'), ctrl.uploadTeamPortalFile);

module.exports = router;
