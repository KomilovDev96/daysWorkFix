const express = require('express');
const fileController = require('../controllers/fileController');
const upload = require('../middleware/uploadMiddleware');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.post('/upload', upload.single('file'), fileController.uploadFile);
router.delete('/:id', fileController.deleteFile);

module.exports = router;
