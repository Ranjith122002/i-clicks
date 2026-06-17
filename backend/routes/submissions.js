const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const Submission = require('../models/Submission');
const Photo = require('../models/Photo');
const { protect } = require('../middleware/authMiddleware');

// Multer setup
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

const uploadDir = path.join(__dirname, '../uploads');
const thumbDir = path.join(__dirname, '../uploads/thumbnails');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

// ── PUBLIC: Submit a photo ──────────────────────────────
// POST /api/submissions
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const { name, email, title, description, tags, location, device } = req.body;
    if (!name || !email || !title) {
      return res.status(400).json({ success: false, message: 'Name, email and title are required' });
    }

    const timestamp = Date.now();
    const filename = `sub_${timestamp}.jpg`;
    const thumbFilename = `sub_thumb_${timestamp}.jpg`;

    const meta = await sharp(req.file.buffer).metadata();

    await sharp(req.file.buffer)
      .resize({ width: 2000, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(path.join(uploadDir, filename));

    await sharp(req.file.buffer)
      .resize({ width: 600, withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toFile(path.join(thumbDir, thumbFilename));

    const submission = await Submission.create({
      name,
      email,
      title,
      description,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      location,
      device: device || 'iPhone',
      filename,
      url: `/uploads/${filename}`,
      thumbnailUrl: `/uploads/thumbnails/${thumbFilename}`,
      width: meta.width,
      height: meta.height,
      fileSize: req.file.size
    });

    res.status(201).json({
      success: true,
      message: 'Photo submitted successfully! We will review it shortly.',
      id: submission._id
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── ADMIN: Get all submissions ──────────────────────────
// GET /api/submissions/admin?status=pending
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

    res.json({
      success: true,
      submissions,
      total,
      counts: { pending: counts[0], approved: counts[1], rejected: counts[2] }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── ADMIN: Approve submission → moves to Photo collection ──
// POST /api/submissions/:id/approve
router.post('/:id/approve', protect, async (req, res) => {
  try {
    const sub = await Submission.findById(req.params.id);
    if (!sub) return res.status(404).json({ success: false, message: 'Submission not found' });

    // Create a real Photo from submission
    const photo = await Photo.create({
      title: sub.title,
      description: sub.description,
      filename: sub.filename,
      thumbnailFilename: sub.thumbnailUrl?.split('/').pop(),
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

// ── ADMIN: Reject submission ──
// POST /api/submissions/:id/reject
router.post('/:id/reject', protect, async (req, res) => {
  try {
    const sub = await Submission.findById(req.params.id);
    if (!sub) return res.status(404).json({ success: false, message: 'Not found' });

    sub.status = 'rejected';
    sub.adminNote = req.body.note || '';
    sub.reviewedAt = new Date();
    await sub.save();

    // Delete files to save space
    const uploadDir = path.join(__dirname, '../uploads');
    const thumbDir = path.join(__dirname, '../uploads/thumbnails');
    const fp = path.join(uploadDir, sub.filename);
    const tp = path.join(thumbDir, sub.thumbnailUrl?.split('/').pop() || '');
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    if (fs.existsSync(tp)) fs.unlinkSync(tp);

    res.json({ success: true, message: 'Submission rejected' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── ADMIN: Delete submission permanently ──
router.delete('/:id', protect, async (req, res) => {
  try {
    const sub = await Submission.findByIdAndDelete(req.params.id);
    if (!sub) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
