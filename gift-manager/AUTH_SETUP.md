# Role-Based Auth Implementation - Quick Start Guide

## Summary of Changes

### Files Modified:
1. **server.js** - Added auth endpoints and role-based access control
2. **index.html** - New default landing page with login UI and token-based session
3. **premieoversikt.html** - Prize management page (requires login, hidden if not logged in)

### Files Created:
- **add_user_roles.sql** - SQL migration to add role column
- **auth_schema.sql** - Initial DB schema for users and sessions (already exists)

---

## Setup Steps

### 1. Install bcryptjs dependency
```bash
cd /c/APPL/gift-manager/gift-manager
npm install bcryptjs
```

### 2. Update database schema
Run these SQL migrations on your Railway MySQL database:

```sql
-- Add role column to users table
ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';
CREATE INDEX idx_users_role ON users(role);
```

### 3. Create first admin user locally
Run this once to create an admin account:

```bash
node -e "
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const username = 'admin';
  const plainPassword = 'admin123'; // CHANGE THIS!
  const hash = await bcrypt.hash(plainPassword, 10);

  try {
    await conn.execute(
      'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
      [username, hash, 'admin']
    );
    console.log('✓ Admin user created:', username);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      console.log('✓ Admin user already exists');
    } else {
      console.error('Error:', e.message);
    }
  }
  await conn.end();
})();
"
```

### 4. Test locally
```bash
node server.js
```

Then open:
- **http://localhost:3000/** - Main page with login
- **http://localhost:3000/premieoversikt.html** - Prize management (requires login)

---

## Authentication Flow

### Login Page (index.html)
- Users enter `username` and `password`
- Can check "Remember me" for 30-day session
- Token stored in `localStorage` under key `gm_auth_token`
- Shows user role badge (`Admin` or `Bruker`) when logged in

### Premieoversikt Page (premieoversikt.html)
- Checks for valid token on page load
- **If not logged in**: Shows "Du må logge inn" message with link to login
- **If logged in**: Shows full prize form and list
  - All logged-in users can **create** and **edit** prizes
  - Only **admin users** can **delete** prizes
  - Regular users don't see delete button

---

## Role-Based Permissions

| Action | User | Admin |
|--------|------|-------|
| View prizes | ❌ (need login) | ✅ |
| Create prize | ✅ | ✅ |
| Edit prize | ✅ | ✅ |
| Delete prize | ❌ | ✅ |

---

## API Endpoints

### Auth Endpoints
- `POST /auth/login` - Login (returns token)
- `GET /auth/me` - Get current user (requires Bearer token)
- `POST /auth/logout` - Logout (requires Bearer token)

### Gift API (all require login)
- `POST /gifts` - Create gift (authRequired)
- `GET /gifts` - List gifts (authRequired)
- `PUT /gifts/:id` - Edit gift (authRequired)
- `DELETE /gifts/:id` - Delete gift (authRequired + adminRequired)

---

## Deploy to Railway

1. Run SQL migration on Railway database
2. Create admin user on Railway  (same script as above, but use Railway .env values)
3. Commit and push all changes:
   ```bash
   git add .
   git commit -m "feat: add role-based auth with token sessions"
   git push
   ```

---

## Notes

- Session tokens expire after 1 day (or 30 days if "remember me" is checked)
- Tokens are stored in localStorage - cleared on logout or session expiration
- Passwords are hashed with bcryptjs (10 salt rounds)
- All gift endpoints now require authentication
- Delete is restricted to admin role only

