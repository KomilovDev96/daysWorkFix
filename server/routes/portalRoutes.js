const express = require('express');
const ctrl    = require('../controllers/portalController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect);

// Гость — свои проекты
router.get('/projects',          ctrl.getMyProjects);
router.get('/projects/:id',      ctrl.getProject);
router.post('/projects/:id/comments', ctrl.addComment);
router.delete('/projects/:id/comments/:commentId', ctrl.deleteComment);

// Admin — управление клиентами и просмотр комментариев
router.post('/projects/:id/clients',          ctrl.addClient);
router.delete('/projects/:id/clients/:userId', ctrl.removeClient);
router.get('/projects/:id/comments',          ctrl.getProjectComments);

module.exports = router;
