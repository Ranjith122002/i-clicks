const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { protect } = require('../middleware/authMiddleware');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await Admin.findOne({ email, isActive: true });

    if (!admin || !(await admin.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    admin.lastLogin = new Date();
    await admin.save();

    res.json({
      success: true,
      token: generateToken(admin._id),
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, (req, res) => {
  res.json({ success: true, admin: req.admin });
});

// POST /api/auth/setup  (only works if no admin exists)
router.post('/setup', async (req, res) => {
  try {
    const count = await Admin.countDocuments();
    if (count > 0) {
      return res.status(403).json({ success: false, message: 'Admin already exists' });
    }

    const admin = await Admin.create({
      name: 'Super Admin',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: 'superadmin'
    });

    res.status(201).json({ success: true, message: 'Admin account created', email: admin.email });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
