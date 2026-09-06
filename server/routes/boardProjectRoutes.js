const express = require('express');
const ctrl       = require('../controllers/boardProjectController');
const portalCtrl = require('../controllers/projectPortalController');
const taskApiCtrl = require('../controllers/projectTaskApiController');
const protect    = require('../middleware/authMiddleware');
const restrictTo = require('../middleware/roleMiddleware');
const upload     = require('../middleware/uploadMiddleware');

const router = express.Router();
router.use(protect);

router.get('/',      ctrl.getAll);
router.post('/',     ctrl.create);
router.get('/:id',   ctrl.getOne);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

router.get('/:id/export', ctrl.exportExcel);

// ── Клиентский портал: настройки, токен, обновления, таймлайн ──────────────────
// Доступ admin / projectManager / worker; реальное право (владение проектом)
// проверяется в контроллере (loadManageable): admin — любой проект, остальные — свой.
const manage = restrictTo('admin', 'projectManager', 'worker');
router.get('/:id/portal',               manage, portalCtrl.getPortal);
router.patch('/:id/portal',             manage, portalCtrl.updatePortal);
router.post('/:id/portal/regenerate',   manage, portalCtrl.regenerateToken);
router.get('/:id/updates',              manage, portalCtrl.getUpdates);
router.post('/:id/updates',             manage, upload.array('files', 10), portalCtrl.publishUpdate);
router.delete('/:id/updates/:updateId', manage, portalCtrl.deleteUpdate);
router.get('/:id/timeline',             manage, portalCtrl.getTimeline);

// ── Публичный API для задач: постоянный токен, по которому фронтендщик/бэкендщик/пм
// отправляют выполненные задачи без входа в систему (см. routes/publicTaskApiRoutes.js).
router.get('/:id/task-api',             manage, taskApiCtrl.getTaskApi);
router.patch('/:id/task-api',           manage, taskApiCtrl.updateTaskApi);
router.post('/:id/task-api/regenerate', manage, taskApiCtrl.regenerateToken);

// ── Спринты: именованные блоки задач, из которых один активный показывается в портале ──
router.get('/:id/sprints',                manage, ctrl.getSprints);
router.post('/:id/sprints',               manage, ctrl.createSprint);
router.patch('/:id/sprints/:sprintId',    manage, ctrl.updateSprint);
router.delete('/:id/sprints/:sprintId',   manage, ctrl.deleteSprint);
router.post('/:id/sprints/:sprintId/link', manage, ctrl.regenerateSprintLink);
router.post('/:id/sprints/:sprintId/task-api-link', manage, ctrl.regenerateSprintTaskApiLink);

router.post('/:id/tasks',           ctrl.addTask);
router.patch('/:id/tasks/:taskId',  ctrl.updateTask);
router.delete('/:id/tasks/:taskId', ctrl.deleteTask);

router.post('/:id/tasks/:taskId/files',           upload.single('file'), ctrl.uploadTaskFile);
router.delete('/:id/tasks/:taskId/files/:fileId', ctrl.deleteTaskFile);

module.exports = router;
