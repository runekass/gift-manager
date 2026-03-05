# Quick Deployment Checklist for Railway

## ✅ Changes Made to Fix the Issue

1. **server.js** - Moved `app.use(express.static(__dirname))` to AFTER all API routes
2. **server.js** - Added environment variable support with `dotenv`
3. **index.html** - Changed all `fetch('http://localhost:3000/gifts')` to `fetch('/gifts')`
4. **index.html** - Added error handling to all fetch calls

## 🚀 Deploy to Railway

### Step 1: Verify Environment Variables in Railway
Log into Railway dashboard: https://railway.app/
- Go to your project: gift-manager-production
- Click on your service
- Go to **Variables** tab
- Ensure these are set:
  ```
  DB_HOST=switchback.proxy.rlwy.net
  DB_PORT=58577
  DB_USER=root
  DB_PASSWORD=KPrlTiiltFSYrDGEBtulBpCAEKMNsYVI
  DB_NAME=railway
  ```

### Step 2: Push Your Code
```bash
git add .
git commit -m "Fix API routing - move static files after API routes"
git push
```

### Step 3: Wait for Railway to Deploy
Railway will automatically:
- Detect your push
- Run `npm install`
- Start the server with `node server.js`

### Step 4: Test Your Deployment

**Test API (should return JSON):**
```bash
curl https://gift-manager-production.up.railway.app/gifts
```

**Expected:** JSON array like:
```json
[{"id":1,"gift_name":"Test","giver":"Rune",...}]
```

**Test Web Interface:**
Open: https://gift-manager-production.up.railway.app/

**Expected:** 
- ✅ Page loads with your styled interface
- ✅ Gifts list shows all entries from database
- ✅ Can add new gifts
- ✅ Can edit existing gifts
- ✅ Can delete gifts (when logged in)

## 🔍 If It Still Doesn't Work

1. **Check Railway Logs:**
   - Go to Railway dashboard
   - Click on your service
   - Click **Deployments** tab
   - Click on the latest deployment
   - Check logs for errors

2. **Common Issues:**
   - ❌ Environment variables not set → Set them in Railway dashboard
   - ❌ Database not accessible → Check database service is running
   - ❌ Wrong credentials → Double-check DB_PASSWORD and other vars
   - ❌ CORS issues → Already fixed with `app.use(cors())`

3. **Debug Commands:**
   ```bash
   # Test if server is responding
   curl -I https://gift-manager-production.up.railway.app/
   
   # Test API endpoint
   curl https://gift-manager-production.up.railway.app/gifts
   ```

## ✅ Success Criteria

- [ ] API endpoint returns JSON data (not HTML)
- [ ] Web interface loads properly
- [ ] Gifts list populates automatically
- [ ] Can add new gifts
- [ ] Can edit gifts
- [ ] Can delete gifts when logged in
- [ ] No console errors in browser

---

**Your Railway URL:** https://gift-manager-production.up.railway.app/

