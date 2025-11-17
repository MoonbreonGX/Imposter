# Deploying Imposter Game to Render

This guide walks you through deploying the Imposter game backend to Render.

## Prerequisites

- Your code is pushed to GitHub (your repo: `MoonbreonGX/Imposter`)
- A Render.com account (sign up at https://render.com)
- PostgreSQL database (optional but recommended for production; Render offers free PostgreSQL)

---

## Step 1: Prepare Your Repository

1. **Ensure `.gitignore` includes sensitive files:**
   ```
   node_modules/
   .env
   .env.local
   imposter_game.db
   *.db
   ```

2. **Commit and push all changes to GitHub:**
   ```bash
   git add .
   git commit -m "Add gifting system and anti-cheat measures"
   git push origin main
   ```

---

## Step 2: Create a Render Web Service

1. Go to **https://dashboard.render.com**
2. Click **"New +"** → **"Web Service"**
3. Select **"Build and deploy from a Git repository"**
4. Click **"Connect"** next to your GitHub account and authorize Render
5. Select the repository: **`MoonbreonGX/Imposter`**
6. Fill in the service details:
   - **Name:** `imposter-game-api` (or any name)
   - **Environment:** `Node`
   - **Build Command:** `cd server && npm install`
   - **Start Command:** `cd server && npm start`
   - **Instance Type:** `Free` (for testing) or `Starter` ($7/month, recommended)

---

## Step 3: Configure Environment Variables

Before clicking "Create Web Service", scroll down to **Environment** section and add the following variables:

### Essential Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Required for production mode |
| `PORT` | `3000` | (Auto-set by Render, but good to include) |
| `JWT_SECRET` | `your-very-long-random-secret-key-at-least-32-chars` | **IMPORTANT:** Use a strong random string. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DATABASE_URL` | (see below) | PostgreSQL connection string |

### Database Setup Options

#### Option A: Use Render's PostgreSQL (Recommended)

1. In Render dashboard, click **"New +"** → **"PostgreSQL"**
2. Name it `imposter-game-db`
3. Choose **Free** tier (limited) or **Standard** tier
4. Create the database
5. Copy the **Internal Database URL** (it will be shown after creation)
6. In your Web Service, set `DATABASE_URL` to this URL
7. Also set `USE_PG=true` to enable PostgreSQL mode

#### Option B: Use SQLite (Development/Testing Only)

Skip the PostgreSQL setup. The server defaults to SQLite if `DATABASE_URL` is not set.

### Additional Recommended Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `USE_PG` | `true` | Force PostgreSQL mode (set if using Render PostgreSQL) |
| `LOG_LEVEL` | `info` | Optional: control logging verbosity |

---

## Step 4: Create the Web Service

1. Click **"Create Web Service"**
2. Render will start the deployment:
   - Clones your repo
   - Runs the build command
   - Deploys the server
   - Assigns a public URL (e.g., `https://imposter-game-api.onrender.com`)

3. Monitor the deployment in the **Logs** tab. It should complete in 2-3 minutes.

---

## Step 5: Verify Deployment

Once the deployment shows "Live", test the server:

### Test 1: Health Check
```bash
curl https://imposter-game-api.onrender.com/api/leaderboard
# Should return: []
```

### Test 2: Register a User
```bash
curl -X POST https://imposter-game-api.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"testpass123"}'
# Should return: {"success":true,"token":"...","playerId":"...","username":"testuser"}
```

### Test 3: Login
```bash
curl -X POST https://imposter-game-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123"}'
# Should return: {"success":true,"token":"...","playerId":"...","username":"testuser",...}
```

---

## Step 6: Update Frontend to Use Render API

In your frontend files (e.g., `js/api-client.js`, `js/account.js`), update the API base URL:

**Before (localhost):**
```javascript
const API_BASE = 'http://localhost:3000';
```

**After (Render):**
```javascript
const API_BASE = 'https://imposter-game-api.onrender.com';
```

Or better, use environment detection:
```javascript
const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000'
  : 'https://imposter-game-api.onrender.com';
```

---

## Step 7: Deploy Frontend (Static HTML)

You have two options:

### Option A: Host Frontend on Render (Using Static Site)

1. Ensure all HTML/CSS/JS files are at the **root** or in a `public/` folder
2. Create another Render service:
   - **"New +" → "Static Site"**
   - Select your GitHub repo
   - **Build Command:** (leave empty or specify folder)
   - **Publish Directory:** `.` (or `public/` if using that folder)
   - Create the service

3. Render will assign a URL like `https://imposter-game.onrender.com`

### Option B: Use GitHub Pages (Free)

1. Push your frontend files to the root or `docs/` folder
2. In GitHub: **Settings → Pages → Source → Branch: main, folder: root (or /docs)**
3. GitHub Pages will assign a URL like `https://moonbreonGX.github.io/Imposter`

### Option C: Use Netlify (Free tier available)

1. Connect your repo to Netlify
2. Set **Build command:** (none, or specify if using build step)
3. Set **Publish directory:** `.` (root)
4. Netlify will assign a URL

---

## Environment Variables Summary

| Variable | Purpose | Required | Example |
|----------|---------|----------|---------|
| `NODE_ENV` | Node environment mode | Yes | `production` |
| `JWT_SECRET` | Secret key for JWT signing | Yes | `a1b2c3d4e5f6...` (32+ chars) |
| `DATABASE_URL` | PostgreSQL connection string | No (defaults to SQLite) | `postgresql://user:pass@host:5432/db` |
| `USE_PG` | Force PostgreSQL mode | No | `true` |
| `PORT` | Server port | No (Render auto-assigns) | `3000` |

---

## Troubleshooting

### Issue: "Build failed" or "npm not found"

**Solution:** Ensure your `server/package.json` exists and has correct `"scripts"` section:
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

### Issue: "DATABASE_URL is not valid" or PostgreSQL connection errors

**Solution:**
1. Double-check the `DATABASE_URL` format (should start with `postgresql://`)
2. Ensure the PostgreSQL database is created and accessible
3. If using free tier, verify you have an active free tier database
4. Check that `USE_PG=true` is set in environment

### Issue: "JWT_SECRET not set" or "Cannot sign token"

**Solution:** Add `JWT_SECRET` to environment variables with a strong random string:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and paste it into the `JWT_SECRET` environment variable.

### Issue: Frontend cannot connect to backend (CORS errors)

**Solution:** Ensure `server.js` has CORS enabled:
```javascript
app.use(cors()); // Should be in server.js
```

And update your frontend API base URL to match the Render URL.

---

## Monitoring & Logs

1. In Render dashboard, click on your Web Service
2. Go to **Logs** tab to view real-time server logs
3. Check **Metrics** tab for CPU, memory, bandwidth usage

---

## Scaling & Optimization

- **Free tier:** Good for testing; Render spins down after 30 mins of inactivity
- **Starter tier ($7/month):** Always on, recommended for production
- **Pro tier:** For high traffic; includes auto-scaling, better performance

To upgrade, click **Settings** on your service and change the Instance Type.

---

## Production Checklist

- [ ] `JWT_SECRET` is a strong random key (32+ characters)
- [ ] `NODE_ENV` is set to `production`
- [ ] Database is PostgreSQL (recommended) or properly configured SQLite
- [ ] Frontend API base URL points to Render backend
- [ ] CORS is enabled on backend
- [ ] Rate limiting is active (already added in anti-cheat measures)
- [ ] Logging is configured (check `Logs` tab regularly)
- [ ] Backups are enabled if using Render PostgreSQL (Settings → Backups)

---

## Quick Reference Commands

### Generate a JWT Secret
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Test API locally before deploying
```bash
cd server
npm install
npm start
# Server runs on http://localhost:3000
```

### View Render deployment logs
```
1. Go to https://dashboard.render.com
2. Select your service
3. Click "Logs" tab
```

---

## Support

- **Render Docs:** https://render.com/docs
- **PostgreSQL Setup:** https://render.com/docs/databases
- **Node.js on Render:** https://render.com/docs/deploy-node
- **Your GitHub Repo:** https://github.com/MoonbreonGX/Imposter

Good luck! 🚀
