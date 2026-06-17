const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const Photo = require('../models/Photo');
const { protect } = require('../middleware/authMiddleware');

// Multer setup
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|heic/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype) || file.mimetype === 'image/heic';
    if (ext || mime) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

const uploadDir = path.join(__dirname, '../uploads');
const thumbDir = path.join(__dirname, '../uploads/thumbnails');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

// ─── PUBLIC ROUTES ────────────────────────────────────────────

// GET /api/photos  - list all published photos
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const category = req.query.category;
    const tag = req.query.tag;
    const search = req.query.search;
    const featured = req.query.featured;

    let query = { isPublished: true };
    if (category) query.category = category;
    if (tag) query.tags = tag;
    if (featured === 'true') query.isFeatured = true;
    if (search) query.$text = { $search: search };

    const [photos, total] = await Promise.all([
      Photo.find(query)
        .populate('category', 'name slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v'),
      Photo.countDocuments(query)
    ]);

    res.json({
      success: true,
      photos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: skip + photos.length < total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/photos/:id  - single photo
router.get('/:id', async (req, res) => {
  try {
    const photo = await Photo.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    ).populate('category', 'name slug');

    if (!photo || !photo.isPublished) {
      return res.status(404).json({ success: false, message: 'Photo not found' });
    }

    // Related photos
    const related = await Photo.find({
      _id: { $ne: photo._id },
      isPublished: true,
      $or: [{ category: photo.category }, { tags: { $in: photo.tags } }]
    }).limit(8).select('title url thumbnailUrl width height');

    res.json({ success: true, photo, related });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── ADMIN ROUTES ─────────────────────────────────────────────

// POST /api/photos  - upload new photo
router.post('/', protect, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const timestamp = Date.now();
    const ext = '.jpg';
    const filename = `photo_${timestamp}${ext}`;
    const thumbFilename = `thumb_${timestamp}${ext}`;

    const imgMeta = await sharp(req.file.buffer).metadata();

    // Save full size (max 2400px wide)
    await sharp(req.file.buffer)
      .resize({ width: 2400, withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toFile(path.join(uploadDir, filename));

    // Save thumbnail (600px wide)
    await sharp(req.file.buffer)
      .resize({ width: 600, withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toFile(path.join(thumbDir, thumbFilename));

    const tags = req.body.tags ? req.body.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    const photo = await Photo.create({
      title: req.body.title || 'Untitled',
      description: req.body.description,
      filename,
      thumbnailFilename: thumbFilename,
      url: `/uploads/${filename}`,
      thumbnailUrl: `/uploads/thumbnails/${thumbFilename}`,
      category: req.body.category || undefined,
      tags,
      width: imgMeta.width,
      height: imgMeta.height,
      fileSize: req.file.size,
      isFeatured: req.body.isFeatured === 'true',
      isPublished: req.body.isPublished !== 'false',
      device: req.body.device || 'iPhone',
      location: req.body.location,
      shootDate: req.body.shootDate || undefined
    });

    res.status(201).json({ success: true, photo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/photos/:id  - update photo
router.put('/:id', protect, async (req, res) => {
  try {
    const { title, description, category, tags, isFeatured, isPublished, location } = req.body;
    const updates = {
      title, description, category, isFeatured, isPublished, location,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined
    };
    Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);

    const photo = await Photo.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!photo) return res.status(404).json({ success: false, message: 'Photo not found' });

    res.json({ success: true, photo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/photos/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id);
    if (!photo) return res.status(404).json({ success: false, message: 'Photo not found' });

    // Delete files
    const fullPath = path.join(uploadDir, photo.filename);
    const thumbPath = path.join(thumbDir, photo.thumbnailFilename);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);

    await photo.deleteOne();
    res.json({ success: true, message: 'Photo deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/photos/admin/all  - admin: all photos including unpublished
router.get('/admin/all', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [photos, total] = await Promise.all([
      Photo.find({}).populate('category', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Photo.countDocuments({})
    ]);

    res.json({ success: true, photos, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.put('/:id/replace-image', protect, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const photo = await Photo.findById(req.params.id);
    if (!photo) return res.status(404).json({ success: false, message: 'Photo not found' });
    const oldFull  = path.join(uploadDir, photo.filename);
    const oldThumb = path.join(thumbDir, photo.thumbnailFilename || '');
    if (fs.existsSync(oldFull))  fs.unlinkSync(oldFull);
    if (fs.existsSync(oldThumb)) fs.unlinkSync(oldThumb);
    const timestamp  = Date.now();
    const filename   = `photo_${timestamp}.jpg`;
    const thumbFname = `thumb_${timestamp}.jpg`;
    const imgMeta    = await sharp(req.file.buffer).metadata();
    await sharp(req.file.buffer).resize({ width: 2400, withoutEnlargement: true }).jpeg({ quality: 88 }).toFile(path.join(uploadDir, filename));
    await sharp(req.file.buffer).resize({ width: 600, withoutEnlargement: true }).jpeg({ quality: 75 }).toFile(path.join(thumbDir, thumbFname));
    photo.filename = filename;
    photo.thumbnailFilename = thumbFname;
    photo.url = `/uploads/${filename}`;
    photo.thumbnailUrl = `/uploads/thumbnails/${thumbFname}`;
    photo.width = imgMeta.width;
    photo.height = imgMeta.height;
    photo.fileSize = req.file.size;
    await photo.save();
    res.json({ success: true, photo });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});
module.exports = router;
