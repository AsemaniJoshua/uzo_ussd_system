# Namecheap Deployment Guide

## ✅ Build Complete!

Your frontend has been built successfully. The static files are in the `frontend/out/` folder.

---

## 📦 **What You Have**

```
frontend/out/
├── index.html           # Home page
├── admin/              # Admin dashboard files
│   ├── login/
│   ├── dashboard/
│   ├── packages/
│   ├── products/
│   ├── transactions/
│   └── simulator/
├── _next/              # Next.js assets (CSS, JS)
└── *.html              # Other pages
```

---

## 🚀 **Deploy to Namecheap (cPanel)**

### **Step 1: Access cPanel**
1. Login to your Namecheap account
2. Go to **Hosting List** → **Manage**
3. Click **cPanel** button

### **Step 2: Upload Files**

**Option A: File Manager (Recommended)**
1. In cPanel, open **File Manager**
2. Navigate to `public_html/` (or your domain folder)
3. **Delete all existing files** in the folder (if fresh install)
4. Click **Upload** button
5. Upload ALL files from `frontend/out/` folder
   - You can drag & drop or select all files
6. Make sure the structure is:
   ```
   public_html/
   ├── index.html
   ├── admin/
   ├── _next/
   └── ...
   ```

**Option B: FTP (Alternative)**
1. In cPanel, go to **FTP Accounts** → Create FTP account
2. Use FileZilla or any FTP client
3. Connect to your site
4. Upload contents of `frontend/out/` to `public_html/`

### **Step 3: Configure .htaccess for SPA Routing**

Create/Edit `.htaccess` file in `public_html/`:

```apache
# Enable Rewrite Engine
RewriteEngine On

# Handle Next.js static export routing
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{REQUEST_URI} !^/_next
RewriteCond %{REQUEST_URI} !\.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$
RewriteRule ^(.*)$ /$1.html [L]

# Fallback for 404
ErrorDocument 404 /404.html

# Security Headers
<IfModule mod_headers.c>
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "SAMEORIGIN"
    Header set X-XSS-Protection "1; mode=block"
</IfModule>

# Cache Control for Assets
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
    ExpiresByType application/x-javascript "access plus 1 month"
</IfModule>

# Compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css
    AddOutputFilterByType DEFLATE application/javascript application/json
    AddOutputFilterByType DEFLATE image/svg+xml
</IfModule>
```

### **Step 4: Set Correct Permissions**

In File Manager:
1. Select `index.html` and all `.html` files
2. Right-click → **Permissions**
3. Set to `644` (owner can read/write, others can read)
4. For folders (`admin/`, `_next/`, etc.):
   - Set to `755` (owner full access, others can read/execute)

---

## 🔗 **Configure API Backend URL**

Your frontend needs to connect to your backend API at `https://data-ussd.onrender.com`.

This is already configured in `frontend/lib/api.ts`:
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://data-ussd.onrender.com'
```

If you need to change it later:
1. Edit `frontend/lib/api.ts`
2. Update the URL
3. Run `npm run build` again
4. Re-upload the `out/` folder

---

## ✅ **Test Your Deployment**

1. Visit your domain: `http://yourdomain.com`
2. Test these URLs:
   - Home: `http://yourdomain.com`
   - Admin Login: `http://yourdomain.com/admin/login`
   - Dashboard: `http://yourdomain.com/admin/dashboard` (after login)
   - Packages: `http://yourdomain.com/admin/packages`

3. Login with:
   - Username: `admin`
   - Password: `admin`

---

## 🐛 **Troubleshooting**

### **404 Errors on Page Refresh**
**Problem:** Pages work initially but show 404 when refreshed
**Solution:** Make sure `.htaccess` is uploaded and configured correctly

### **CSS/JS Not Loading**
**Problem:** Page loads but looks broken
**Solution:** 
- Check that `_next/` folder is uploaded
- Verify file permissions (644 for files, 755 for folders)
- Clear browser cache

### **API Errors (CORS)**
**Problem:** Cannot connect to backend
**Solution:**
- Backend must allow your domain in CORS settings
- Update backend `main.py`:
  ```python
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["https://yourdomain.com", "http://yourdomain.com"],
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```

### **Blank Pages**
**Problem:** Pages show blank/white screen
**Solution:**
- Check browser console for errors (F12)
- Verify all files uploaded correctly
- Check that index.html is in the root of public_html

---

## 🔄 **Update Your Site (After Changes)**

When you make changes to the frontend:

1. **Make your code changes**
2. **Rebuild:**
   ```bash
   cd frontend
   npm run build
   ```
3. **Upload new files:**
   - Delete old files in `public_html/`
   - Upload new files from `frontend/out/`
4. **Clear cache:**
   - In cPanel: Go to **Optimize Website** → Clear cache
   - In browser: Hard refresh (Ctrl+Shift+R)

---

## 📱 **Custom Domain Setup**

If using custom domain (e.g., `dataussd.com`):

1. In Namecheap, go to **Domain List**
2. Click **Manage** on your domain
3. Go to **Advanced DNS**
4. Add these records:
   ```
   Type: A Record
   Host: @
   Value: [Your cPanel server IP]
   TTL: Automatic

   Type: CNAME Record
   Host: www
   Value: yourdomain.com
   TTL: Automatic
   ```
5. Wait 24-48 hours for DNS propagation

---

## 🔐 **Enable HTTPS (SSL)**

In cPanel:
1. Go to **SSL/TLS Status**
2. Select your domain
3. Click **Run AutoSSL**
4. Wait for certificate installation
5. Update all links to use `https://`

---

## 📊 **Performance Tips**

1. **Enable Gzip Compression** (already in .htaccess)
2. **Use Cloudflare** (free CDN):
   - Sign up at cloudflare.com
   - Add your domain
   - Update nameservers in Namecheap
   - Free SSL + performance boost

3. **Monitor Performance:**
   - Use Google PageSpeed Insights
   - Check lighthouse scores
   - Monitor API response times

---

## ✨ **Quick Upload Script**

To make future uploads easier, you can use this structure:

1. Zip the `out/` folder
2. Upload to cPanel
3. Extract in File Manager
4. Move contents to `public_html/`

Or use this PowerShell script:

```powershell
# Quick upload script
cd "C:\Users\User\Music\Frontend\data_ussd\frontend"
npm run build
Write-Host "Build complete! Files ready in out/ folder"
Write-Host "Now upload out/ folder contents to public_html/"
```

---

## 🎉 **You're Done!**

Your NetService USSD admin dashboard is now live on Namecheap!

Access it at: `http://yourdomain.com/admin/login`

**Support:**
- Backend API: https://data-ussd.onrender.com
- GitHub Repo: AsemaniJoshua/data_ussd
