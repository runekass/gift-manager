# Gift Manager - Security Instructions

## 🔒 URGENT: Your Database Password is Exposed on GitHub

Your database password was committed to your GitHub repository. You must:

### 1. Rotate Your Database Password IMMEDIATELY
- Go to Railway Dashboard
- Select your MySQL database
- Change the password in the database settings
- Update all environment variables with the new password

### 2. Clean GitHub History
To remove sensitive data from Git history, use:

```bash
# Option 1: Using git-filter-repo (recommended)
# Install: pip install git-filter-repo

git filter-repo --invert-paths --path server.js

# Then force push (warning: this rewrites history)
git push origin --force-all
```

Or use `BFG Repo-Cleaner`:
```bash
# Download BFG from: https://rtyley.github.io/bfg-repo-cleaner/
bfg --delete-files server.js
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push origin --force-all
```

### 3. Set Up Environment Variables for Local Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your local database credentials in `.env`:
   ```
   DB_HOST=your_local_host
   DB_PORT=your_local_port
   DB_USER=your_local_user
   DB_PASSWORD=your_local_password
   DB_NAME=your_local_database
   ```

3. **NEVER commit `.env` to Git** - it's in `.gitignore`

### 4. Set Up Environment Variables on Railway

In your Railway project dashboard, go to **Variables** and set:
- `DB_HOST` - Your database host
- `DB_PORT` - Your database port
- `DB_USER` - Your database user
- `DB_PASSWORD` - Your NEW rotated password
- `DB_NAME` - Your database name

### 5. Verify Security

- ✅ `.env` file is in `.gitignore`
- ✅ `.env.example` has placeholder values only
- ✅ No credentials in `server.js`
- ✅ Database password rotated
- ✅ GitHub history cleaned

### Best Practices

- Never hardcode secrets in your code
- Use environment variables for all sensitive data
- Add `.env` and `.env.local` to `.gitignore`
- Rotate credentials regularly
- Use `.env.example` as a template for developers
- Review GitHub history for exposed secrets

