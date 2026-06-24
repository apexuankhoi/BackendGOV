const News = require('../models/News');

exports.getNews = async (req, res) => {
  try {
    const news = await News.find().populate('author', 'username').sort({ createdAt: -1 });
    res.json(news);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server' });
  }
};

exports.createNews = async (req, res) => {
  try {
    const news = new News({ ...req.body, author: req.user.userId });
    await news.save();
    res.status(201).json({ message: 'Đăng tin thành công', news });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server' });
  }
};

exports.deleteNews = async (req, res) => {
  try {
    await News.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa tin tức' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server' });
  }
};
