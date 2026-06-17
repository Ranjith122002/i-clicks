// seed.js — Run this from the i-clicks folder:
// node seed.js

const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';

const photos = [
  {
    file: 'nature_placeholder.jpg',
    title: 'Morning Dew in the Forest',
    description: 'A peaceful morning walk through the forest, captured on iPhone.',
    categoryName: 'Nature',
    tags: 'nature,green,forest,morning',
    location: 'Western Ghats, India',
    device: 'iPhone 15 Pro',
    isFeatured: true,
  },
  {
    file: 'portrait_placeholder.jpg',
    title: 'Natural Light Portrait',
    description: 'Soft natural light portrait shot near a window.',
    categoryName: 'Portrait',
    tags: 'portrait,people,natural light,face',
    location: 'Mumbai, India',
    device: 'iPhone 15 Pro',
    isFeatured: false,
  },
  {
    file: 'street_placeholder.jpg',
    title: 'City Lights at Night',
    description: 'Late night street photography in the heart of the city.',
    categoryName: 'Street',
    tags: 'street,urban,city,night,lights',
    location: 'Bengaluru, India',
    device: 'iPhone 14 Pro',
    isFeatured: true,
  },
  {
    file: 'architecture_placeholder.jpg',
    title: 'Geometric Lines',
    description: 'Minimalist architecture captured from below.',
    categoryName: 'Architecture',
    tags: 'architecture,building,minimal,geometry',
    location: 'Delhi, India',
    device: 'iPhone 15',
    isFeatured: false,
  },
  {
    file: 'macro_placeholder.jpg',
    title: 'Close Up Details',
    description: 'Extreme closeup revealing hidden details invisible to the naked eye.',
    categoryName: 'Macro',
    tags: 'macro,closeup,detail,texture',
    location: 'Pune, India',
    device: 'iPhone 15 Pro Max',
    isFeatured: false,
  },
  {
    file: 'sunset_placeholder.jpg',
    title: 'Golden Hour Magic',
    description: 'The sky painted in warm gold just before the sun dips below the horizon.',
    categoryName: 'Sunset',
    tags: 'sunset,golden hour,sky,warm,orange',
    location: 'Goa, India',
    device: 'iPhone 15 Pro',
    isFeatured: true,
  },
  {
    file: 'travel_placeholder.jpg',
    title: 'Roads Less Traveled',
    description: 'An open road leading to somewhere beautiful.',
    categoryName: 'Travel',
    tags: 'travel,road,explore,adventure',
    location: 'Ladakh, India',
    device: 'iPhone 14 Pro Max',
    isFeatured: false,
  },
];

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  return res.json();
}

async function getToken() {
  console.log('🔑 Logging in as admin...');
  const data = await fetchJson(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@iclicks.com',
      password: 'admin123'
    })
  });
  if (!data.success) {
    console.error('❌ Login failed:', data.message);
    console.log('   → Check ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env');
    process.exit(1);
  }
  console.log('✅ Logged in successfully\n');
  return data.token;
}

async function getOrCreateCategory(name, token) {
  // Try to get existing categories
  const data = await fetchJson(`${BASE_URL}/api/categories`);
  const existing = (data.categories || []).find(c => c.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing._id;

  // Create it
  const created = await fetchJson(`${BASE_URL}/api/categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name, description: `${name} photography`, sortOrder: 0 })
  });
  if (created.success) {
    console.log(`   📁 Created category: ${name}`);
    return created.category._id;
  }
  return null;
}

async function uploadPhoto(photo, token) {
  const filePath = path.join(__dirname, 'placeholders', photo.file);
  if (!fs.existsSync(filePath)) {
    console.log(`   ⚠️  File not found: ${photo.file} — skipping`);
    return;
  }

  const categoryId = await getOrCreateCategory(photo.categoryName, token);

  const formData = new FormData();
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
  formData.append('photo', blob, photo.file);
  formData.append('title', photo.title);
  formData.append('description', photo.description);
  formData.append('tags', photo.tags);
  formData.append('location', photo.location);
  formData.append('device', photo.device);
  formData.append('isFeatured', photo.isFeatured ? 'true' : 'false');
  formData.append('isPublished', 'true');
  if (categoryId) formData.append('category', categoryId);

  const res = await fetch(`${BASE_URL}/api/photos`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });

  const data = await res.json();
  if (data.success) {
    console.log(`   ✅ Uploaded: ${photo.title}`);
  } else {
    console.log(`   ❌ Failed: ${photo.title} — ${data.message}`);
  }
}

async function run() {
  console.log('═══════════════════════════════════');
  console.log('   I-Clicks — Seeding Photos');
  console.log('═══════════════════════════════════\n');

  // Check server is running
  try {
    await fetch(`${BASE_URL}/api/stats`);
  } catch (e) {
    console.error('❌ Server not reachable at', BASE_URL);
    console.log('   → Make sure "npm run dev" is running first');
    process.exit(1);
  }

  const token = await getToken();

  console.log(`📸 Uploading ${photos.length} placeholder photos...\n`);
  for (const photo of photos) {
    process.stdout.write(`→ ${photo.categoryName}: `);
    await uploadPhoto(photo, token);
    await new Promise(r => setTimeout(r, 300)); // small delay
  }

  console.log('\n═══════════════════════════════════');
  console.log('✅ Done! Open http://localhost:5000');
  console.log('═══════════════════════════════════');
}

run();
