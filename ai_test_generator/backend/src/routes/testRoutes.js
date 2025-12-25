const express = require('express');
const router = express.Router();
const testCtrl = require('../controllers/testController');
const { authMiddleware } = require('../middlewares/authMiddleware');

// generate test (teacher/admin)
router.post('/generate', testCtrl.generateTest);

// add question (teacher/admin)
router.post('/question', authMiddleware, testCtrl.addQuestion);

// list & get
router.get('/', authMiddleware, testCtrl.listTests);
router.get('/:id', authMiddleware, testCtrl.getTest);

module.exports = router;
