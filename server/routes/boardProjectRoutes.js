const express = require('express');
const ctrl    = require('../controllers/boardProjectController');
const protect = require('../middleware/authMiddleware');
const upload  = require('../middleware/uploadMiddleware');

const router = express.Router();
router.use(protect);

router.get('/',      ctrl.getAll);
router.post('/',     ctrl.create);
router.get('/:id',   ctrl.getOne);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

router.get('/:id/export', ctrl.exportExcel);

router.post('/:id/tasks',           ctrl.addTask);
router.patch('/:id/tasks/:taskId',  ctrl.updateTask);
router.delete('/:id/tasks/:taskId', ctrl.deleteTask);

router.post('/:id/tasks/:taskId/files',           upload.single('file'), ctrl.uploadTaskFile);
router.delete('/:id/tasks/:taskId/files/:fileId', ctrl.deleteTaskFile);

module.exports = router;
