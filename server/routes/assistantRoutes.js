const express = require('express');
const protect = require('../middleware/authMiddleware');
const assistantController = require('../controllers/assistantController');

const router = express.Router();

router.use(protect);

router.post('/chat', assistantController.chatWithAssistant);

module.exports = router;
