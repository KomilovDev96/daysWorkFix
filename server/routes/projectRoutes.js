const express = require('express');
const projectController = require('../controllers/projectController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', projectController.getAllProjects);
router.post('/', projectController.createProject);
router.patch('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

module.exports = router;
