const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const Submission = require('../models/Submission');
const Photo = require('../models/Photo');
const { protect } = require('../middleware/authMiddleware');

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only image files allowed'));
  }
});

// Helper — upload buffer to Cloudinary
async function uploadToCloudinary(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (err, result) => { if (err) reject(err); else resolve(result); }
    );
    stream.end(buffer);
  });
}

// ── PUBLIC: Submit a photo ──────────────────────────────
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const { name, email, title, description, tags, location, device } = req.body;
    if (!name || !email || !title) return res.status(400).json({ success: false, message: 'Name, email and title are required' });

    const meta = await sharp(req.file.buffer).metadata();

    const fullBuffer = await sharp(req.file.buffer).resize({ width: 2000, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    const thumbBuffer = await sharp(req.file.buffer).resize({ width: 600, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();

    const [fullResult, thumbResult] = await Promise.all([
      uploadToCloudinary(fullBuffer, 'iclicks/submissions'),
      uploadToCloudinary(thumbBuffer, 'iclicks/submissions/thumbnails')
    ]);

    const submission = await Submission.create({
      name, email, title, description,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      location,
      device: device || 'iPhone',
      filename: fullResult.public_id,
      url: fullResult.secure_url,
      thumbnailUrl: thumbResult.secure_url,
      thumbnailFilename: thumbResult.public_id,
      width: meta.width,
      height: meta.height,
      fileSize: req.file.size
    });

    res.status(201).json({ success: true, message: 'Photo submitted successfully! We will review it shortly.', id: submission._id });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── ADMIN: Get all submissions ──────────────────────────
router.get('/admin', protect, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = status ? { status } : {};
    const skip = (page - 1) * limit;
    const [submissions, total] = await Promise.all([
      Submission.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Submission.countDocuments(query)
    ]);
    const counts = await Promise.all([
      Submission.countDocuments({ status: 'pending' }),
      Submission.countDocuments({ status: 'approved' }),
      Submission.countDocuments({ status: 'rejected' })
    ]);
    res.json({ success: true, submissions, total, counts: { pending: counts[0], approved: counts[1], rejected: counts[2] } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── ADMIN: Approve → move to Photo collection ──
router.post('/:id/approve', protect, async (req, res) => {
  try {
    const sub = await Submission.findById(req.params.id);
    if (!sub) return res.status(404).json({ success: false, message: 'Submission not found' });

    const photo = await Photo.create({
      title: sub.title,
      description: sub.description,
      filename: sub.filename,
      thumbnailFilename: sub.thumbnailFilename,
      url: sub.url,
      thumbnailUrl: sub.thumbnailUrl,
      tags: sub.tags,
      location: sub.location,
      device: sub.device,
      width: sub.width,
      height: sub.height,
      fileSize: sub.fileSize,
      isPublished: true,
      category: req.body.categoryId || undefined
    });

    sub.status = 'approved';
    sub.reviewedAt = new Date();
    await sub.save();

    res.json({ success: true, message: 'Approved and published!', photo });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── ADMIN: Reject ──
router.post('/:id/reject', protect, async (req, res) => {
  try {
    const sub = await Submission.findById(req.params.id);
    if (!sub) return res.status(404).json({ success: false, message: 'Not found' });

    // Delete from Cloudinary
    if (sub.filename) await cloudinary.uploader.destroy(sub.filename).catch(() => {});
    if (sub.thumbnailFilename) await cloudinary.uploader.destroy(sub.thumbnailFilename).catch(() => {});

    sub.status = 'rejected';
    sub.adminNote = req.body.note || '';
    sub.reviewedAt = new Date();
    await sub.save();

    res.json({ success: true, message: 'Submission rejected' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── ADMIN: Delete permanently ──
router.delete('/:id', protect, async (req, res) => {
  try {
    const sub = await Submission.findByIdAndDelete(req.params.id);
    if (!sub) return res.status(404).json({ success: false, message: 'Not found' });
    if (sub.filename) await cloudinary.uploader.destroy(sub.filename).catch(() => {});
    if (sub.thumbnailFilename) await cloudinary.uploader.destroy(sub.thumbnailFilename).catch(() => {});
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;