const express = require('express');
const router = express.Router();

const adminCtrl = require('../controllers/adminController');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');

// All routes protected and admin-only
router.use(authMiddleware);
router.use(requireRole(['admin']));

router.get('/users', adminCtrl.getAllUsers);
router.delete('/users/:id', adminCtrl.deleteUser);

router.get('/logs', adminCtrl.viewActivityLogs);

router.delete('/tests/:id', adminCtrl.deleteTest);

module.exports = router;
