const express = require('express');
const ctrl = require('../controllers/projectTemplateController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', ctrl.getTemplates);
router.post('/', ctrl.createTemplate);
router.patch('/:id', ctrl.updateTemplate);
router.delete('/:id', ctrl.deleteTemplate);
router.post('/:id/apply', ctrl.applyTemplate);

module.exports = router;
