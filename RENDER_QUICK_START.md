# Render Deployment - Quick Reference

## TL;DR - Deployment in 5 Minutes

### 1. **Prepare GitHub** (one-time)
```bash
cd /path/to/Imposter.html
git add .
git commit -m "Add gifting system and deployment configs"
git push origin main
```

### 2. **Create Render Web Service**
- Go to https://dashboard.render.com
- Click **"New +" → "Web Service"**
- Connect GitHub repo: `MoonbreonGX/Imposter`
- Fill form:
  - **Build Command:** `cd server && npm install`
  - **Start Command:** `cd server && npm start`

### 3. **Add Environment Variables** (Critical)

Before clicking "Create", scroll to **Environment** and add:

```
NODE_ENV=production
JWT_SECRET=<generate-strong-secret>
```

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. **Optional: Add PostgreSQL**
- In Render, click **"New +" → "PostgreSQL"**
- Name: `imposter-game-db`
- Create, then copy the **Internal Database URL**
- Add to Web Service environment:
  ```
  DATABASE_URL=<paste-database-url>
  USE_PG=true
  ```

### 5. **Deploy**
- Click **"Create Web Service"**
- Wait 2-3 minutes for deployment
- Check **Logs** for any errors

### 6. **Verify Live**
```bash
# Test health endpoint
curl https://<your-service>.onrender.com/api/health

# Test registration
curl -X POST https://<your-service>.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"test123"}'
```

### 7. **Update Frontend**
In your frontend code (e.g., `js/api-client.js`):
```javascript
const API_BASE = 'https://<your-service>.onrender.com';
```

---

## Environment Variables Explained

| Variable | What | Example | Required |
|----------|------|---------|----------|
| `NODE_ENV` | App mode | `production` | ✅ Yes |
| `JWT_SECRET` | Token signing key | `a1b2c3d4e5f6...` (32+ chars) | ✅ Yes |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@host/db` | ❌ No (defaults to SQLite) |
| `USE_PG` | Force PostgreSQL mode | `true` | ❌ No (only if using DATABASE_URL) |

---

## Troubleshooting Quick Fixes

| Problem | Fix |
|---------|-----|
| "Build failed" | Check that `server/package.json` exists with correct scripts |
| "Cannot start server" | Verify `JWT_SECRET` is set in environment variables |
| "PostgreSQL connection error" | Double-check `DATABASE_URL` format and `USE_PG=true` |
| "Frontend can't reach API" | Update frontend `API_BASE` to match Render URL; enable CORS in server |
| "Free tier auto-sleeps" | Upgrade to Starter ($7/month) to stay always-on |

---

## Key Endpoints to Test

```bash
# Health check
GET https://<service>.onrender.com/api/health

# Register
POST https://<service>.onrender.com/api/auth/register
Body: {"username":"x","email":"x@y","password":"z"}

# Login
POST https://<service>.onrender.com/api/auth/login
Body: {"username":"x","password":"z"}

# Leaderboard
GET https://<service>.onrender.com/api/leaderboard

# Gift inbox (auth required)
GET https://<service>.onrender.com/api/gifts/inbox
Header: Authorization: Bearer <token>
```

---

## Links

- **Render Dashboard:** https://dashboard.render.com
- **Full Guide:** See `RENDER_DEPLOYMENT.md` in project root
- **Server README:** See `server/README.md`
- **Your Repo:** https://github.com/MoonbreonGX/Imposter

---

## Support Articles

- [Deploying Node.js to Render](https://render.com/docs/deploy-node)
- [PostgreSQL on Render](https://render.com/docs/databases)
- [Environment Variables](https://render.com/docs/environment-variables)
- [Free Tier Limits](https://render.com/docs/free)
