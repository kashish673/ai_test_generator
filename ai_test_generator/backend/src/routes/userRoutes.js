const express = require('express');
const router = express.Router();
const userCtrl = require('../controllers/userController');
const { authMiddleware } = require('../middlewares/authMiddleware');

router.get('/me', authMiddleware, userCtrl.getProfile);
router.put('/me', authMiddleware, userCtrl.updateProfile);

module.exports = router;
