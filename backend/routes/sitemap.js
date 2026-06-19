// Add this route to server.js BEFORE the SPA fallback routes
// app.get('/sitemap.xml', sitemapRoute);

const express = require('express');
const router = express.Router();
const Photo = require('../models/Photo');
const Category = require('../models/Category');

// Popular keyword pages — matches your /ideas/:keyword pages
const KEYWORD_PAGES = [
  'nature','portrait','street','sunset','macro','travel','architecture',
  'golden-hour','iphone-wallpaper','night-photography','india','goa',
  'mountain','flowers','minimal','hd-wallpaper','landscape'
];

router.get('/', async (req, res) => {
  const BASE = process.env.SITE_URL || 'https://i-clicks.onrender.com';

  try {
    const [photos, categories] = await Promise.all([
      Photo.find({ isPublished: true }).select('_id updatedAt title').lean(),
      Category.find({ isActive: true }).select('slug name updatedAt').lean()
    ]);

    const today = new Date().toISOString().split('T')[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${BASE}/explore</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${BASE}/about.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${BASE}/photographers.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
    <lastmod>${today}</lastmod>
  </url>`;

    // Category pages by name (matches /ideas/category-name)
    categories.forEach(c => {
      const slug = (c.slug || c.name).toLowerCase().replace(/\s+/g, '-');
      xml += `
  <url>
    <loc>${BASE}/ideas/${slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <lastmod>${c.updatedAt ? c.updatedAt.toISOString().split('T')[0] : today}</lastmod>
  </url>`;
    });

    // Keyword/ideas pages — for SEO long-tail searches
    KEYWORD_PAGES.forEach(kw => {
      xml += `
  <url>
    <loc>${BASE}/ideas/${kw}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
    <lastmod>${today}</lastmod>
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