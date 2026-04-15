const express = require('express');
const logController = require('../controllers/logController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.post('/', logController.createDayLog);
router.get('/my', logController.getMyLogs);
router.get('/:id', logController.getDayLog);
router.patch('/:id', logController.updateDayLog);
router.delete('/:id', logController.deleteDayLog);

module.exports = router;
