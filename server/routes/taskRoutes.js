const express = require('express');
const taskController = require('../controllers/taskController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.post('/', taskController.createTask);
router.get('/day/:dayLogId', taskController.getTasksByDay);
router.patch('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

module.exports = router;
