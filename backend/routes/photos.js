const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const Photo = require('../models/Photo');
const { protect } = require('../middleware/authMiddleware');

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer — memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|heic/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype) || file.mimetype === 'image/heic';
    if (ext || mime) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

// Helper — upload buffer to Cloudinary
async function uploadToCloudinary(buffer, folder, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, ...options },
      (err, result) => { if (err) reject(err); else resolve(result); }
    );
    stream.end(buffer);
  });
}

// ─── PUBLIC ROUTES ─────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { category, tag, search, featured } = req.query;

    let query = { isPublished: true };
    if (category) query.category = category;
    if (tag) query.tags = tag;
    if (featured === 'true') query.isFeatured = true;
    if (search) query.$text = { $search: search };

    const [photos, total] = await Promise.all([
      Photo.find(query).populate('category', 'name slug').sort({ createdAt: -1 }).skip(skip).limit(limit).select('-__v'),
      Photo.countDocuments(query)
    ]);

    res.json({ success: true, photos, pagination: { page, limit, total, pages: Math.ceil(total / limit), hasMore: skip + photos.length < total } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const photo = await Photo.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true }).populate('category', 'name slug');
    if (!photo || !photo.isPublished) return res.status(404).json({ success: false, message: 'Photo not found' });
    const related = await Photo.find({ _id: { $ne: photo._id }, isPublished: true, $or: [{ category: photo.category }, { tags: { $in: photo.tags } }] }).limit(8).select('title url thumbnailUrl width height');
    res.json({ success: true, photo, related });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── ADMIN ROUTES ──────────────────────────────────────────────

// POST /api/photos — upload new photo to Cloudinary
router.post('/', protect, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const imgMeta = await sharp(req.file.buffer).metadata();

    // Resize full image
    const fullBuffer = await sharp(req.file.buffer)
      .resize({ width: 2400, withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();

    // Resize thumbnail
    const thumbBuffer = await sharp(req.file.buffer)
      .resize({ width: 600, withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();

    // Upload both to Cloudinary
    const [fullResult, thumbResult] = await Promise.all([
      uploadToCloudinary(fullBuffer, 'iclicks/photos'),
      uploadToCloudinary(thumbBuffer, 'iclicks/thumbnails')
    ]);

    const tags = req.body.tags ? req.body.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    const photo = await Photo.create({
      title: req.body.title || 'Untitled',
      description: req.body.description,
      filename: fullResult.public_id,
      thumbnailFilename: thumbResult.public_id,
      url: fullResult.secure_url,
      thumbnailUrl: thumbResult.secure_url,
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

// PUT /api/photos/:id — update metadata
router.put('/:id', protect, async (req, res) => {
  try {
    const { title, description, category, tags, isFeatured, isPublished, location } = req.body;
    const updates = { title, description, category, isFeatured, isPublished, location, tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined };
    Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);
    const photo = await Photo.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!photo) return res.status(404).json({ success: false, message: 'Photo not found' });
    res.json({ success: true, photo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/photos/:id — delete from Cloudinary + DB
router.delete('/:id', protect, async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id);
    if (!photo) return res.status(404).json({ success: false, message: 'Photo not found' });

    // Delete from Cloudinary
    if (photo.filename) await cloudinary.uploader.destroy(photo.filename).catch(() => {});
    if (photo.thumbnailFilename) await cloudinary.uploader.destroy(photo.thumbnailFilename).catch(() => {});

    await photo.deleteOne();
    res.json({ success: true, message: 'Photo deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/photos/admin/all
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

// PUT /api/photos/:id/replace-image — replace image on Cloudinary
router.put('/:id/replace-image', protect, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const photo = await Photo.findById(req.params.id);
    if (!photo) return res.status(404).json({ success: false, message: 'Photo not found' });

    // Delete old from Cloudinary
    if (photo.filename) await cloudinary.uploader.destroy(photo.filename).catch(() => {});
    if (photo.thumbnailFilename) await cloudinary.uploader.destroy(photo.thumbnailFilename).catch(() => {});

    const imgMeta = await sharp(req.file.buffer).metadata();

    const fullBuffer = await sharp(req.file.buffer).resize({ width: 2400, withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
    const thumbBuffer = await sharp(req.file.buffer).resize({ width: 600, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();

    const [fullResult, thumbResult] = await Promise.all([
      uploadToCloudinary(fullBuffer, 'iclicks/photos'),
      uploadToCloudinary(thumbBuffer, 'iclicks/thumbnails')
    ]);

    photo.filename = fullResult.public_id;
    photo.thumbnailFilename = thumbResult.public_id;
    photo.url = fullResult.secure_url;
    photo.thumbnailUrl = thumbResult.secure_url;
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