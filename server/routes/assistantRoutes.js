const express = require('express');
const protect = require('../middleware/authMiddleware');
const assistantController = require('../controllers/assistantController');

const router = express.Router();

router.use(protect);

router.post('/chat', assistantController.chatWithAssistant);
router.post('/parse-task', assistantController.parseTaskMessage);
router.get('/ollama/health', assistantController.ollamaHealth);

router.get('/knowledge', assistantController.getKnowledge);
router.patch('/knowledge', assistantController.updateKnowledge);
router.post('/ask', assistantController.askAssistant);

module.exports = router;
