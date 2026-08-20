const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newsController');
const authMiddleware = require('../middleware/authMiddleware');

const checkAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'SENIOR_ADMIN')
    return res.status(403).json({ message: 'Không có quyền' });
  next();
};

// Public routes
router.get('/', newsController.getNews);

// Admin-only routes
router.post('/', authMiddleware, checkAdmin, newsController.createNews);
router.put('/:id', authMiddleware, checkAdmin, newsController.updateNews);
router.delete('/:id', authMiddleware, checkAdmin, newsController.deleteNews);

// Scrape URL (Facebook / web link) — returns preview data, does NOT save
router.post('/scrape', authMiddleware, checkAdmin, newsController.scrapeUrl);

module.exports = router;
