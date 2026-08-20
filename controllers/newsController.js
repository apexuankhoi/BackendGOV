const News = require('../models/News');
const axios = require('axios');
const cheerio = require('cheerio');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch & parse Open Graph / meta tags from any URL.
 * Works best with public pages (Facebook public posts, web articles, etc.)
 */
const scrapeOpenGraph = async (url) => {
  // Use a browser-like User-Agent to avoid bot blocks
  const { data: html } = await axios.get(url, {
    timeout: 12000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
    },
    maxRedirects: 5,
  });

  const $ = cheerio.load(html);

  const og = (prop) =>
    $(`meta[property="og:${prop}"]`).attr('content') ||
    $(`meta[name="og:${prop}"]`).attr('content') ||
    '';

  const twitter = (name) =>
    $(`meta[name="twitter:${name}"]`).attr('content') ||
    $(`meta[property="twitter:${name}"]`).attr('content') ||
    '';

  const title =
    og('title') ||
    twitter('title') ||
    $('title').text().trim() ||
    '';

  const description =
    og('description') ||
    twitter('description') ||
    $('meta[name="description"]').attr('content') ||
    '';

  const image =
    og('image') ||
    twitter('image') ||
    $('meta[itemprop="image"]').attr('content') ||
    '';

  const siteName = og('site_name') || '';
  const canonicalUrl = og('url') || $('link[rel="canonical"]').attr('href') || url;

  // Try to extract body text as fallback content
  // Remove scripts, styles, nav, footer for cleaner text
  $('script, style, nav, footer, header, aside').remove();
  const bodyText = $('article, main, [role="main"]').text().trim().replace(/\s+/g, ' ') ||
    $('body').text().trim().replace(/\s+/g, ' ').slice(0, 2000);

  return {
    title: title.slice(0, 300),
    description: description.slice(0, 500),
    image,
    siteName,
    canonicalUrl,
    bodyText: bodyText.slice(0, 3000),
  };
};

// ─── Controllers ──────────────────────────────────────────────────────────────

exports.getNews = async (req, res) => {
  try {
    const news = await News.find()
      .populate('author', 'username')
      .sort({ createdAt: -1 });
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
    console.error(err);
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

/**
 * POST /api/news/scrape
 * Body: { url: "https://facebook.com/..." }
 * Returns scraped Open Graph data as a preview — does NOT save to DB.
 */
exports.scrapeUrl = async (req, res) => {
  const { url } = req.body;

  if (!url || !url.startsWith('http')) {
    return res.status(400).json({ message: 'URL không hợp lệ. Vui lòng cung cấp link đầy đủ.' });
  }

  try {
    const data = await scrapeOpenGraph(url);

    // Determine source type
    let sourceType = 'web';
    if (url.includes('facebook.com') || url.includes('fb.com') || url.includes('fb.watch')) {
      sourceType = 'facebook';
    }

    // Build a suggested content from description + bodyText
    const suggestedContent = data.description
      ? `${data.description}\n\n${data.bodyText || ''}`.trim()
      : data.bodyText || '';

    res.json({
      title: data.title,
      summary: data.description,
      content: suggestedContent.slice(0, 3000),
      imageUrl: data.image,
      sourceUrl: data.canonicalUrl || url,
      sourceType,
      siteName: data.siteName,
    });
  } catch (err) {
    console.error('[scrapeUrl] Error:', err.message);

    // Facebook blocks most bot scraping — give helpful message
    if (
      err.response?.status === 403 ||
      err.response?.status === 429 ||
      err.message?.includes('403') ||
      err.message?.includes('blocked')
    ) {
      return res.status(422).json({
        message:
          'Facebook chặn tự động tải nội dung. Hãy sao chép nội dung bài viết thủ công rồi điền vào form bên dưới.',
        fallback: true,
        sourceUrl: url,
        sourceType: 'facebook',
      });
    }

    res.status(500).json({
      message: `Không thể đọc nội dung từ link này: ${err.message}`,
      fallback: true,
      sourceUrl: url,
    });
  }
};

/**
 * PUT /api/news/:id — Update an existing article
 */
exports.updateNews = async (req, res) => {
  try {
    const news = await News.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!news) return res.status(404).json({ message: 'Không tìm thấy bài viết' });
    res.json({ message: 'Đã cập nhật', news });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server' });
  }
};
