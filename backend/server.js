require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve admin static files
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/photos', require('./routes/photos'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/submissions', require('./routes/submissions'));

app.get('/admin/submissions.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/submissions.html'));
});

// Sitemap
app.use('/sitemap.xml', require('./routes/sitemap'));

// Stats endpoint (public)
app.get('/api/stats', async (req, res) => {
  try {
    const Photo = require('./models/Photo');
    const Category = require('./models/Category');
    const [totalPhotos, totalCategories, totalViews] = await Promise.all([
      Photo.countDocuments({ isPublished: true }),
      Category.countDocuments({ isActive: true }),
      Photo.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }])
    ]);
    res.json({
      success: true,
      stats: {
        totalPhotos,
        totalCategories,
        totalViews: totalViews[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin stats (protected)
app.get('/api/admin/stats', require('./middleware/authMiddleware').protect, async (req, res) => {
  try {
    const Photo = require('./models/Photo');
    const Category = require('./models/Category');
    const [total, published, unpublished, featured, categories, recentPhotos] = await Promise.all([
      Photo.countDocuments(),
      Photo.countDocuments({ isPublished: true }),
      Photo.countDocuments({ isPublished: false }),
      Photo.countDocuments({ isFeatured: true }),
      Category.countDocuments({ isActive: true }),
      Photo.find({}).sort({ createdAt: -1 }).limit(5).select('title thumbnailUrl createdAt isPublished views')
    ]);
    res.json({ success: true, stats: { total, published, unpublished, featured, categories }, recentPhotos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/login.html'));
});
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/dashboard.html'));
});

// Article pages
app.get('/about.html', (req, res) => res.sendFile(require('path').join(__dirname,'../frontend/about.html')));
app.get('/photographers.html', (req, res) => res.sendFile(require('path').join(__dirname,'../frontend/photographers.html')));
app.get('/visual-search.html', (req, res) => res.sendFile(require('path').join(__dirname,'../frontend/visual-search.html')));
app.get('/news.html', (req, res) => res.sendFile(require('path').join(__dirname,'../frontend/about.html')));

// Explore page
app.get('/explore', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/explore.html'));
});

// Ideas/keyword pages — /ideas/sunset  /ideas/nature  /ideas/any-keyword
app.get('/ideas/:keyword', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/ideas.html'));
});

// Homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 I-Clicks server running on http://localhost:${PORT}`);
  console.log(`📸 Gallery: http://localhost:${PORT}`);
  console.log(`🔑 Admin:   http://localhost:${PORT}/admin`);
  console.log(`\n⚡ First time? Run: POST http://localhost:${PORT}/api/auth/setup`);
});
