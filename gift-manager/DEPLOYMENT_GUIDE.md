# Deployment Guide for Gift Manager to Railway

## Before Deploying

### 1. Database Configuration
Your application is already set up to handle both local and Railway deployments:
- **Local**: Uses `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- **Railway**: Automatically uses `MYSQL_URL` or `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`

### 2. Email/Mail Functionality (IMPORTANT!)
The application includes a "Send påminnelser" (Send reminders) feature that sends email notifications to users. **You MUST configure the following variables before deploying:**

#### Required Environment Variables:
- `GMAIL_USER` - Your Gmail address (e.g., `your_email@gmail.com`)
- `GMAIL_PASS` - Your Gmail App Password (NOT your regular Gmail password)

#### How to Set Up Gmail for Email Sending:

1. **Enable 2-Factor Authentication:**
   - Go to your Google Account: https://myaccount.google.com/security
   - Enable 2-Step Verification if not already enabled

2. **Generate an App Password:**
   - Visit: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer" (or your device)
   - Google will generate a 16-character password
   - **Copy this password** (you'll need it for `GMAIL_PASS`)

3. **Keep Your Credentials Safe:**
   - NEVER commit `.env` to version control
   - The `.gitignore` should already exclude `.env`
   - Only use these credentials in production environment variables

### 3. Setting Up on Railway

1. **Create a Railway Project** (if you haven't already)

2. **Add MySQL Database:**
   - Click "Add" → Select "MySQL"
   - Railway will provide you with connection details

3. **Deploy Your Application:**
   - Connect your GitHub repository
   - Railway will auto-detect the Node.js application

4. **Set Environment Variables in Railway:**
   - Go to your Railway project settings
   - Under "Variables", add the following:

   ```
   NODE_ENV=production
   PORT=3000
   
   # Database (Railway may auto-populate these from MySQL plugin)
   MYSQL_URL=<will be provided by Railway MySQL plugin>
   # OR these individual variables:
   MYSQLHOST=<hostname>
   MYSQLPORT=3306
   MYSQLUSER=<username>
   MYSQLPASSWORD=<password>
   MYSQLDATABASE=<database_name>
   
   # Email Configuration (REQUIRED for reminder feature)
   GMAIL_USER=your_gmail_address@gmail.com
   GMAIL_PASS=your_gmail_app_password
   ```

5. **Database Initialization:**
   - Run the SQL migration file `add_user_roles.sql` on your Railway MySQL database
   - This adds the required `role` column to the `users` table

### 4. Verification Checklist

Before deploying to production:

- [ ] Database is configured (either `MYSQL_URL` or individual `MYSQL*` variables)
- [ ] `GMAIL_USER` is set to your Gmail address
- [ ] `GMAIL_PASS` is set to your App Password (not your regular Gmail password)
- [ ] `NODE_ENV` is set to `production`
- [ ] `.env` file is in `.gitignore` and NOT committed to git
- [ ] SQL migration (`add_user_roles.sql`) has been applied to the database
- [ ] Test the application in Railway to ensure emails are being sent correctly

### 5. Testing Email Functionality

Once deployed to Railway:

1. Log in to the application
2. Navigate to the "Todos" (Aktiviteter) page
3. Create a todo and assign it to a user
4. Click "Send påminnelser" button
5. Check that the user receives the email notification

If emails are not being sent:
- Verify `GMAIL_USER` and `GMAIL_PASS` are correctly set in Railway
- Check the Railway logs for error messages
- Ensure 2-Factor Authentication is enabled on your Gmail account
- Ensure the App Password is correctly generated and set

### 6. Troubleshooting

**"Email skipped: GMAIL_USER/GMAIL_PASS not configured"**
- This warning means the environment variables are not set
- Add `GMAIL_USER` and `GMAIL_PASS` to your Railway project variables

**Gmail authentication fails**
- Don't use your regular Gmail password - use the 16-character App Password
- Ensure 2-Factor Authentication is enabled on your Gmail account
- Re-generate the App Password if needed

**Database connection issues**
- Railway MySQL plugin should auto-populate `MYSQL_URL`
- If using individual variables, ensure all four are set correctly:
  - `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`

## Summary

**The main thing you need to do before deploying to Railway:**

1. Set up Gmail App Password (see steps above)
2. Add `GMAIL_USER` and `GMAIL_PASS` to your Railway environment variables
3. Ensure your database is properly connected
4. Run the SQL migration on your Railway database

That's it! Your application should then be fully functional with email reminder notifications.

