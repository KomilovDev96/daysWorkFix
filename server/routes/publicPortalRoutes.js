const express = require('express');
const ctrl = require('../controllers/portalPublicController');
const rateLimit = require('../middleware/rateLimit');

// Публичный роутер — БЕЗ authMiddleware. Доступ по токену проекта.
const router = express.Router();

// Защита от перебора пароля: не более 10 попыток в минуту на (IP + токен).
const accessLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    keyFn: (req) => `${req.ip}:${req.params.token}`,
    message: 'Слишком много попыток ввода пароля. Подождите минуту.',
});

router.get('/portal/:token',          ctrl.getPortal);
router.post('/portal/:token/access',  accessLimiter, ctrl.verifyAccess);
router.get('/portal/:token/updates',  ctrl.getUpdates);
router.get('/sprint-portal/:token',   ctrl.getSprintPortal);

module.exports = router;
