const express = require('express');
const ctrl = require('../controllers/settingsController');
const protect = require('../middleware/authMiddleware');
const restrictTo = require('../middleware/roleMiddleware');

const router = express.Router();
router.use(protect);

router.get('/', ctrl.getSettings);
router.patch('/', restrictTo('admin'), ctrl.updateSettings);

module.exports = router;
