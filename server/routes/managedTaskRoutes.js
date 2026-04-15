const express = require('express');
const ctrl    = require('../controllers/managedTaskController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/',                   ctrl.getTasks);
router.post('/',                  ctrl.createTask);
router.get('/analytics',          ctrl.getAdminAnalytics);
router.get('/analytics/export',   ctrl.exportMonthlyXls);
router.get('/export-my',          ctrl.exportMyTasks);
router.get('/availability',       ctrl.getWorkerAvailability);
router.get('/manager-stats',      ctrl.getManagerStats);
router.get('/projects',           ctrl.getTaskProjects);
router.post('/projects',          ctrl.createTaskProject);
router.get('/:id',                       ctrl.getTask);
router.patch('/:id',                     ctrl.updateTask);
router.delete('/:id',                    ctrl.deleteTask);
router.get('/:id/comments',              ctrl.getComments);
router.post('/:id/comments',             ctrl.addComment);
router.delete('/:id/comments/:commentId', ctrl.deleteComment);

module.exports = router;
