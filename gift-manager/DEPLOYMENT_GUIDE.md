# Deployment Guide for Gift Manager to Railway

## Before Deploying

### 1. Database Configuration
Your application is already set up to handle both local and Railway deployments:
- **Local**: Uses `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- **Railway**: Automatically uses `MYSQL_URL` or `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`

### 2. Email/Mail Functionality (IMPORTANT!)
The application includes a "Send påminnelser" (Send reminders) feature that sends email notifications to users. **You MUST configure ONE of the email services before deploying.**

#### Email Service Options:

**RECOMMENDED for Railway: SendGrid (Free Tier Available)**
- Reliable SMTP on port 587
- Works perfectly with Railway
- Free tier includes 100 emails/day (enough for most use cases)
- Setup is straightforward

**Alternative: Gmail**
- Requires more setup
- May experience timeout issues on some hosting platforms (including Railway)
- Requires Gmail App Password
- Less reliable for automated sending at scale

#### Option A: SendGrid Setup (RECOMMENDED)

1. **Create SendGrid Account:**
   - Go to https://sendgrid.com/
   - Sign up for a free account (no credit card required initially)
   - Verify your email address

2. **Generate API Key:**
   - In SendGrid dashboard, go to Settings → API Keys
   - Click "Create API Key"
   - Give it a name like "Gift Manager"
   - Choose "Restricted Access" and enable:
     - Mail Send: Full Access
   - Copy the API key

3. **Add to Railway Variables:**
   - In Railway project settings, add: `SENDGRID_API_KEY=<your_api_key>`

That's it! The application will automatically use SendGrid.

#### Option B: Gmail Setup (Alternative)

1. **Enable 2-Factor Authentication:**
   - Go to your Google Account: https://myaccount.google.com/security
   - Enable 2-Step Verification if not already enabled

2. **Generate an App Password:**
   - Visit: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer" (or your device)
   - Google will generate a 16-character password
   - **Copy this password** (you'll need it for `GMAIL_PASS`)

3. **Add to Railway Variables:**
   - `GMAIL_USER=your_gmail_address@gmail.com`
   - `GMAIL_PASS=your_16_character_app_password`

4. **Keep Your Credentials Safe:**
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
   
   # Email Configuration - Choose ONE of the following:
   
   # Option A: SendGrid (RECOMMENDED)
   SENDGRID_API_KEY=your_sendgrid_api_key
   
   # Option B: Gmail (Alternative)
   GMAIL_USER=your_gmail_address@gmail.com
   GMAIL_PASS=your_gmail_app_password
   ```

5. **Database Initialization:**
   - Run the SQL migration file `add_user_roles.sql` on your Railway MySQL database
   - This adds the required `role` column to the `users` table

### 4. Verification Checklist

Before deploying to production:

- [ ] Database is configured (either `MYSQL_URL` or individual `MYSQL*` variables)
- [ ] Email is configured: EITHER `SENDGRID_API_KEY` OR `GMAIL_USER` + `GMAIL_PASS`
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

**"Email skipped: SENDGRID_API_KEY/GMAIL_USER/GMAIL_PASS not configured"**
- This warning means neither email service is configured
- Set either `SENDGRID_API_KEY` OR both `GMAIL_USER` and `GMAIL_PASS` in Railway variables

**"Failed to send email: Connection timeout" (with Gmail)**
- **This is a known issue with Gmail on Railway due to network/firewall restrictions**
- **SOLUTION: Use SendGrid instead** (see Section 2, Option A)
- SendGrid is optimized for cloud platforms and has much better reliability on Railway
- Gmail's SMTP server (smtp.gmail.com:465) often has connectivity issues on Railway's infrastructure
- The Network Flow logs showing `dropCause: "ICMP_CSUM"` indicate dropped connections to Gmail servers

**How to Migrate from Gmail to SendGrid:**
1. If you've been using Gmail, remove these variables from Railway:
   - Remove `GMAIL_USER`
   - Remove `GMAIL_PASS`
2. Follow the SendGrid setup steps in Section 2, Option A
3. Add `SENDGRID_API_KEY` to your Railway variables
4. Redeploy your application
5. Test by creating a new todo and assigning it - you should now receive the email

**Gmail authentication fails**
- Don't use your regular Gmail password - use the 16-character App Password
- Ensure 2-Factor Authentication is enabled on your Google Account
- Re-generate the App Password if needed
- Note: Even with correct credentials, you may still experience timeouts on Railway due to network restrictions

**SendGrid not working**
- Verify your API key is copied correctly (no extra spaces)
- Check SendGrid dashboard to confirm your account is active
- Look in Railway logs for specific error messages
- SendGrid is much more reliable than Gmail on Railway - if you experience issues, it's usually configuration related

**Database connection issues**
- Railway MySQL plugin should auto-populate `MYSQL_URL`
- If using individual variables, ensure all five are set correctly:
  - `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`

## Summary

**The main thing you need to do before deploying to Railway:**

1. **Choose an email service:**
   - **Recommended:** SendGrid (free, reliable on Railway)
   - **Alternative:** Gmail (requires App Password, may have timeouts)
   
2. **Set up your chosen service** (see steps in Section 2)

3. **Add environment variables** to your Railway project (see Section 3)

4. **Ensure your database is properly connected**

5. **Run the SQL migration** on your Railway database

That's it! Your application should then be fully functional with email reminder notifications.

