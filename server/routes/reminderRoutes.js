const express = require('express');
const reminderController = require('../controllers/reminderController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect);

router.get('/my',      reminderController.listMyReminders);
router.post('/',       reminderController.createReminder);
router.patch('/:id',   reminderController.updateReminder);
router.delete('/:id',  reminderController.deleteReminder);

module.exports = router;
