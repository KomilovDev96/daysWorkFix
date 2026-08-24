const express = require('express');
const rateLimit = require('../middleware/rateLimit');
const ctrl = require('../controllers/fabrioPublicController');

// ВРЕМЕННЫЙ публичный роутер — БЕЗ авторизации, только для заполнения задач
// в проект Fabrio сторонним агентом. Активен только при NODE_ENV=development
// (см. guard в контроллере). Удалить вместе с fabrioPublicController.js после
// того как данные будут заполнены.
const router = express.Router();

// Мягкая защита от случайного флуда (не авторизация) — 60 запросов в минуту с IP.
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    keyFn: (req) => req.ip,
    message: 'Слишком много запросов, подождите минуту.',
});

router.post('/fabrio/tasks', limiter, ctrl.addTask);

module.exports = router;
