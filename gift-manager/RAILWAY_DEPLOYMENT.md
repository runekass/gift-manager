# Railway Deployment Guide

## Database Connection Issues

When deploying to Railway, you need to set the following environment variables in your Railway project:

### Environment Variables to Configure in Railway:

1. **DB_HOST** - Your database host (e.g., `switchback.proxy.rlwy.net`)
2. **DB_PORT** - Your database port (e.g., `58577`)
3. **DB_USER** - Your database username (e.g., `root`)
4. **DB_PASSWORD** - Your database password
5. **DB_NAME** - Your database name (e.g., `railway`)
6. **PORT** - The port for your Node.js server (Railway automatically sets this, but you can override it if needed)

### Steps to Configure in Railway:

1. Go to your Railway project dashboard
2. Click on your service
3. Go to the **Variables** tab
4. Add each environment variable with its corresponding value
5. Deploy or restart your service

### Important Notes:

- **Never commit `.env` file to GitHub** - The `.gitignore` should already exclude it
- Railway will provide environment variables through the Railway dashboard
- Make sure your database credentials are correct and the database is accessible from Railway's servers
- The `.env` file is only for local development

### Troubleshooting:

If you still get connection errors after setting environment variables:

1. **Check that the database host is accessible** from Railway's servers
2. **Verify credentials** are exactly correct (check for spaces, special characters)
3. **Check firewall rules** on your database host to ensure Railway's IP can connect
4. **Test locally first** with the same credentials to ensure they work
5. **Check Railway logs** for detailed error messages

### Testing Connection:

You can add a simple health check endpoint to test the database connection:

```javascript
app.get('/health', (req, res) => {
    if (db.state === 'authenticated') {
        res.json({ status: 'ok', database: 'connected' });
    } else {
        res.status(500).json({ status: 'error', database: 'disconnected' });
    }
});
```

