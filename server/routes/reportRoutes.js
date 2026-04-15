const express = require('express');
const reportController = require('../controllers/reportController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/period', reportController.getPeriodReport);
router.get('/analytics', reportController.getAnalyticsReport);
router.get('/insights', reportController.getAiInsights);
router.post('/insights/generate', reportController.generateAiInsight);
router.get('/analytics/export', reportController.exportAnalyticsExcel);
router.get('/export', reportController.exportExcel);
router.get('/by-project/:projectId', reportController.getProjectReport);
router.get('/by-project/:projectId/export', reportController.exportProjectExcel);
router.get('/by-customer', reportController.getCustomerReport);
router.get('/by-customer/export', reportController.exportCustomerExcel);

module.exports = router;
