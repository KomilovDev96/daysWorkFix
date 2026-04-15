const express = require('express');
const ctrl = require('../controllers/startupController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect);

router.get('/', ctrl.getAll);
router.post('/', ctrl.create);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.post('/:id/members', ctrl.addMember);
router.delete('/:id/members/:userId', ctrl.removeMember);

module.exports = router;
