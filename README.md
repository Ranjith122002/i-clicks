# 📷 I-Clicks — iPhone Photography Gallery

A full-stack Pinterest-style photo gallery website built for iPhone photography, with an admin dashboard for managing photos and categories.

---

## 🗂 Project Structure

```
i-clicks/
├── frontend/               ← Public-facing gallery website
│   ├── index.html          ← Homepage with masonry gallery
│   ├── css/
│   │   ├── main.css        ← Global styles
│   │   ├── gallery.css     ← Masonry grid + lightbox
│   │   └── responsive.css  ← Mobile responsive
│   ├── js/
│   │   ├── api.js          ← API helper
│   │   └── gallery.js      ← Gallery + lightbox logic
│   └── robots.txt          ← SEO crawling rules
│
├── admin/                  ← Admin dashboard (protected)
│   ├── login.html          ← Admin login
│   ├── dashboard.html      ← Stats + overview
│   ├── upload.html         ← Upload photos (drag & drop)
│   ├── photos.html         ← Manage all photos
│   ├── categories.html     ← Manage categories
│   ├── css/admin.css
│   └── js/admin.js
│
├── backend/                ← Express.js API
│   ├── server.js           ← Entry point
│   ├── .env                ← Environment variables
│   ├── config/db.js        ← MongoDB connection
│   ├── models/
│   │   ├── Photo.js
│   │   ├── Category.js
│   │   └── Admin.js
│   ├── routes/
│   │   ├── photos.js       ← Photo CRUD + upload
│   │   ├── categories.js
│   │   ├── auth.js
│   │   └── sitemap.js      ← Dynamic XML sitemap
│   ├── middleware/
│   │   └── authMiddleware.js
│   └── uploads/            ← Stored images (auto-created)
│
└── package.json
```

---

## ⚡ Quick Start

### 1. Prerequisites

- **Node.js** v16+ → https://nodejs.org
- **MongoDB** → https://www.mongodb.com/try/download/community
  - Or use MongoDB Atlas (free cloud) → https://cloud.mongodb.com

### 2. Install dependencies

```bash
cd i-clicks
npm install
```

### 3. Configure environment

Edit `backend/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/iclicks
JWT_SECRET=change_this_to_a_long_random_string
ADMIN_EMAIL=admin@iclicks.com
ADMIN_PASSWORD=yourpassword123
NODE_ENV=development
```

### 4. Start the server

```bash
# Development (auto-restart on file change)
npm run dev

# Production
npm start
```

### 5. Create the first admin account

Open your browser or use curl:
```
POST http://localhost:5000/api/auth/setup
```

Or use curl:
```bash
curl -X POST http://localhost:5000/api/auth/setup
```

This only works once (when no admin exists).

### 6. Open the app

| URL | Description |
|-----|-------------|
| http://localhost:5000 | Public gallery |
| http://localhost:5000/admin | Admin login |

---

## 🔑 Admin Workflow

1. Go to `http://localhost:5000/admin`
2. Log in with your credentials
3. **Upload photos** → drag & drop + fill in title, tags, category
4. **Manage categories** → add/edit/delete categories
5. **Manage photos** → edit, publish/unpublish, delete, mark as featured

---

## 🌐 SEO & Google Indexing

### Sitemap
A dynamic sitemap is auto-generated at:
```
http://yourdomain.com/sitemap.xml
```

### To get indexed on Google:

1. **Deploy your site** (see Deployment below)
2. Go to [Google Search Console](https://search.google.com/search-console)
3. Add your domain as a property
4. Submit your sitemap URL: `https://yourdomain.com/sitemap.xml`
5. Request indexing for your homepage

### robots.txt
Located at `/robots.txt` — allows all crawlers on public pages, blocks `/admin/` and `/api/`.

---

## 🚀 Deployment Options

### Option A: Railway (recommended, free tier)

1. Push your code to GitHub
2. Go to https://railway.app → New Project → Deploy from GitHub
3. Add MongoDB plugin (or use MongoDB Atlas)
4. Set environment variables in Railway dashboard
5. Done — Railway gives you a public URL

### Option B: Render.com (free tier)

1. Push to GitHub
2. Go to https://render.com → New Web Service
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables
6. Use MongoDB Atlas for the database

### Option C: VPS (DigitalOcean, Linode)

```bash
# Install Node.js + MongoDB on your server
# Clone your repo
git clone your-repo
cd i-clicks
npm install
# Use PM2 to keep it running
npm install -g pm2
pm2 start backend/server.js --name iclicks
pm2 startup
pm2 save
# Set up Nginx as reverse proxy + SSL with Certbot
```

### Custom Domain
After deployment, point your domain's DNS `A record` to your server IP, or use a CNAME for Railway/Render.

---

## 🛠 API Endpoints

### Public
| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/photos` | List photos (paginated) |
| GET | `/api/photos/:id` | Single photo + related |
| GET | `/api/categories` | All categories with counts |
| GET | `/api/stats` | Site stats |
| GET | `/sitemap.xml` | XML sitemap |

### Query params for `/api/photos`
- `?page=1&limit=20`
- `?category=<id>`
- `?tag=nature`
- `?search=sunset`
- `?featured=true`

### Admin (requires `Authorization: Bearer <token>`)
| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/auth/login` | Admin login |
| GET | `/api/auth/me` | Get current admin |
| POST | `/api/photos` | Upload photo (multipart) |
| PUT | `/api/photos/:id` | Update photo |
| DELETE | `/api/photos/:id` | Delete photo |
| GET | `/api/photos/admin/all` | All photos (unpublished too) |
| POST | `/api/categories` | Create category |
| PUT | `/api/categories/:id` | Update category |
| DELETE | `/api/categories/:id` | Delete category |

---

## 🎨 Customization

### Change site name
Search and replace `I-Clicks` in all HTML files with your desired name.

### Add more categories
Use the admin panel → Categories page.

### Change color scheme
Edit `frontend/css/main.css` — look for the `:root` CSS variables block.

### Image storage (production)
For production, consider replacing local file storage with **Cloudinary** or **AWS S3**:
- Install `cloudinary` npm package
- Replace the `sharp` file-save logic in `backend/routes/photos.js`
- Store the Cloudinary URL in the `url` field

---

## 📋 Features

- ✅ Pinterest-style masonry grid
- ✅ Lightbox photo viewer with keyboard navigation
- ✅ Infinite scroll + load more
- ✅ Search by title/description/tags
- ✅ Filter by category and tags
- ✅ Admin login with JWT auth
- ✅ Drag & drop photo upload with progress bar
- ✅ Auto-generates thumbnails with Sharp
- ✅ SEO: meta tags, JSON-LD schema, sitemap, robots.txt
- ✅ Fully responsive (mobile, tablet, desktop)
- ✅ Dark theme
- ✅ Photo download button
- ✅ Featured photos badge
- ✅ View count tracking
