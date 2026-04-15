const express = require('express');
const authController = require('../controllers/authController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', authController.login);

// Профиль — любой авторизованный
router.get('/me',         protect, authController.getMe);
router.patch('/me',       protect, authController.updateMe);

// Admin — управление пользователями
router.post('/users',     protect, authController.createUser);
router.get('/users',      protect, authController.getAllUsers);
router.patch('/users/:id', protect, authController.updateUser);
router.delete('/users/:id', protect, authController.deleteUser);

// Список воркеров (для менеджера/admin)
router.get('/workers',    protect, authController.getWorkers);

// Список менеджеров (для admin)
router.get('/managers',   protect, authController.getManagers);

module.exports = router;
