const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const Photo = require('../models/Photo');
const { protect } = require('../middleware/authMiddleware');

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });

    // Add photo count to each category
    const withCounts = await Promise.all(categories.map(async (cat) => {
      const count = await Photo.countDocuments({ category: cat._id, isPublished: true });
      return { ...cat.toObject(), photoCount: count };
    }));

    res.json({ success: true, categories: withCounts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/categories  (admin)
router.post('/', protect, async (req, res) => {
  try {
    const { name, description, sortOrder } = req.body;
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const category = await Category.create({ name, slug, description, sortOrder });
    res.status(201).json({ success: true, category });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT /api/categories/:id  (admin)
router.put('/:id', protect, async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, category });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/categories/:id  (admin)
router.delete('/:id', protect, async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
