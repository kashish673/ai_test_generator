const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/tests', require('./testRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/admin', require('./adminRoutes'));

module.exports = router;
