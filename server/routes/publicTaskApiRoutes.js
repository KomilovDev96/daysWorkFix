const express = require('express');
const rateLimit = require('../middleware/rateLimit');
const upload = require('../middleware/uploadMiddleware');
const ctrl = require('../controllers/publicTaskApiController');

// Публичный роутер — БЕЗ authMiddleware. Доступ по постоянному API-токену проекта,
// который фронтендщик/бэкендщик/пм используют для отправки выполненных задач.
const router = express.Router();

// Мягкая защита от флуда (не авторизация) — 30 запросов в минуту на (IP + токен).
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    keyFn: (req) => `${req.ip}:${req.params.token}`,
    message: 'Слишком много запросов, подождите минуту.',
});

// multipart/form-data (задача + files[]) → парсим через multer; JSON (одна задача или пакет) → пропускаем как есть.
const maybeUpload = (req, res, next) => {
    if (req.is('multipart/form-data')) {
        return upload.array('files', 10)(req, res, next);
    }
    next();
};

router.post('/task-api/:token/tasks', limiter, maybeUpload, ctrl.submitTask);

module.exports = router;
