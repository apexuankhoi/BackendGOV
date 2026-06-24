const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newsController');
const authMiddleware = require('../middleware/authMiddleware');

const checkAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'SENIOR_ADMIN') return res.status(403).json({ message: 'Không có quyền' });
  next();
};

router.get('/', newsController.getNews); // Public
router.post('/', authMiddleware, checkAdmin, newsController.createNews);
router.delete('/:id', authMiddleware, checkAdmin, newsController.deleteNews);

module.exports = router;
