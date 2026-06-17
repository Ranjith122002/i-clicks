// Add this route to server.js BEFORE the SPA fallback routes
// app.get('/sitemap.xml', sitemapRoute);

const express = require('express');
const router = express.Router();
const Photo = require('../models/Photo');
const Category = require('../models/Category');

router.get('/', async (req, res) => {
  const BASE = process.env.SITE_URL || 'https://i-clicks.com';

  try {
    const [photos, categories] = await Promise.all([
      Photo.find({ isPublished: true }).select('_id updatedAt').lean(),
      Category.find({ isActive: true }).select('slug updatedAt').lean()
    ]);

    const today = new Date().toISOString().split('T')[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <lastmod>${today}</lastmod>
  </url>`;

    categories.forEach(c => {
      xml += `
  <url>
    <loc>${BASE}/?category=${c._id}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <lastmod>${c.updatedAt ? c.updatedAt.toISOString().split('T')[0] : today}</lastmod>
  </url>`;
    });

    photos.forEach(p => {
      xml += `
  <url>
    <loc>${BASE}/photo.html?id=${p._id}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
    <lastmod>${p.updatedAt ? p.updatedAt.toISOString().split('T')[0] : today}</lastmod>
  </url>`;
    });

    xml += '\n</urlset>';

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (e) {
    res.status(500).send('Error generating sitemap');
  }
});

module.exports = router;
