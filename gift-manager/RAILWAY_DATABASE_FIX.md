# Railway Database Connection Fix

## The Issue

Your application had a database connection problem when deployed to Railway. The environment variables in your `.env` file and Railway's configuration didn't match what the app was trying to use.

## Why It Wasn't Working

### Your Original Setup (in `.env`):
```
DB_HOST=switchback.proxy.rlwy.net    # External proxy
DB_PORT=58577                         # External proxy port
DB_USER=root
DB_PASSWORD=...
DB_NAME=railway
```

### Railway's Internal Setup (what it actually provides):
```
MYSQLHOST=railway.internal           # Internal connection
MYSQLPORT=3306                       # Internal port
MYSQLUSER=root
MYSQLPASSWORD=...
MYSQLDATABASE=railway
```

**The Problem:** When your app runs on Railway, it should use the internal connection (MYSQLHOST/MYSQLPORT), not the external proxy. The external proxy is meant for connections FROM outside Railway.

## The Solution

I updated `server.js` to use Railway's native environment variables with fallback to your custom variables:

```javascript
const db = mysql.createConnection({
    host: process.env.MYSQLHOST || process.env.DB_HOST,
    port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
    user: process.env.MYSQLUSER || process.env.DB_USER,
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
    database: process.env.MYSQLDATABASE || process.env.DB_NAME
});
```

**How it works:**
1. **On Railway:** Uses `MYSQLHOST`, `MYSQLPORT`, etc. (internal connection - fast & reliable)
2. **Locally:** Falls back to `DB_HOST`, `DB_PORT`, etc. from your `.env` file
3. **Default port:** Falls back to `3306` if nothing is set

## What This Means

✅ **On Railway:** Connects via internal network → Fast & reliable
✅ **Locally:** Connects via external proxy → Works for development
✅ **Logging:** Now shows which connection details are being used

## How to Deploy

1. **Commit your changes:**
   ```bash
   git add server.js
   git commit -m "Fix Railway database connection - use internal MYSQL variables"
   git push
   ```

2. **Railway will automatically redeploy** with your changes

3. **Test after deployment:**
   ```bash
   # Should return JSON data
   curl https://gift-manager-production.up.railway.app/gifts
   
   # Should show the web app
   https://gift-manager-production.up.railway.app/
   ```

## Verification Checklist

- [ ] Commit and push changes
- [ ] Wait for Railway to rebuild (check Deployments tab)
- [ ] Check Railway logs for "MySQL tilkoblet..." message
- [ ] Test API returns JSON: `curl https://gift-manager-production.up.railway.app/gifts`
- [ ] Web app loads and shows gifts
- [ ] Can add/edit/delete gifts

## If It Still Doesn't Work

1. **Check Railway Logs:**
   - Go to Railway dashboard
   - Click your service
   - Click "Deployments"
   - Click latest deployment
   - Look for "MySQL tilkoblet..." message

2. **Verify connection details:**
   - Should show: `host: railway.internal`, `port: 3306`
   - If showing external proxy details, Railway variables aren't being picked up

3. **Contact info:**
   - Database URL: `mysql://root:PASSWORD@railway.internal:3306/railway`
   - This is the internal connection you should be using on Railway

---

**Summary:** Your app now automatically uses the correct connection method depending on where it's running (Railway internal or local external proxy).

