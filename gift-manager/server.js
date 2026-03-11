const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Setup email transporter - supports Gmail and SendGrid
let transporter;

function createTransporter() {
    // Try SendGrid first (better for production on Railway)
    if (process.env.SENDGRID_API_KEY) {
        console.log('[EMAIL] Configuring SendGrid transporter...');
        return nodemailer.createTransport({
            host: 'smtp.sendgrid.net',
            port: 587,
            secure: false,
            auth: {
                user: 'apikey',
                pass: process.env.SENDGRID_API_KEY
            },
            connectionTimeout: 10000,
            socketTimeout: 10000
        });
    }

    // Fall back to Gmail
    console.log('[EMAIL] Configuring Gmail transporter...');
    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,  // Use STARTTLS instead of SSL
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS
        },
        connectionTimeout: 10000,
        socketTimeout: 10000
    });
}

transporter = createTransporter();

console.log('========================================');
console.log('🚀 Gift Manager Server Starting');
console.log('========================================');
console.log(`[CONFIG] GMAIL_USER: ${process.env.GMAIL_USER ? '✓ SET' : '✗ NOT SET'}`);
console.log(`[CONFIG] GMAIL_PASS: ${process.env.GMAIL_PASS ? '✓ SET' : '✗ NOT SET'}`);
console.log(`[CONFIG] NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`[CONFIG] PORT: ${process.env.PORT || 3000}`);
console.log('========================================\n');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Determine which database config to use
let dbConfig;
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
    // On Railway: Check if we have MYSQL_URL (preferred) or individual variables
    if (process.env.MYSQL_URL) {
        console.log('Using MYSQL_URL connection string');
        // Parse the URL and extract config
        try {
            const url = new URL(process.env.MYSQL_URL);
            dbConfig = {
                host: url.hostname,
                port: url.port || 3306,
                user: url.username,
                password: url.password,
                database: url.pathname.substring(1), // Remove leading /
                connectionTimeout: 20000,
                enableKeepAlive: true,
                keepAliveInitialDelayMs: 0
            };
        } catch (e) {
            console.error('Failed to parse MYSQL_URL:', e.message);
            dbConfig = null;
        }
    }

    // If no MYSQL_URL or parsing failed, use individual variables with fallback
    if (!dbConfig) {
        console.log('Using individual database variables (Railway or local)');
        dbConfig = {
            // Try Railway MYSQL* variables first, then fall back to DB_* variables
            host: process.env.MYSQLHOST || process.env.DB_HOST,
            port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
            user: process.env.MYSQLUSER || process.env.DB_USER,
            password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
            database: process.env.MYSQLDATABASE || process.env.DB_NAME,
            connectionTimeout: 20000,
            enableKeepAlive: true,
            keepAliveInitialDelayMs: 0
        };
    }
} else {
    // Local development
    console.log('Development mode detected');
    dbConfig = {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        connectionTimeout: 30000,
        enableKeepAlive: true,
        keepAliveInitialDelayMs: 0,
        waitForConnections: true,
        connectionLimit: 5
    };
}

console.log('Database config:', {
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    database: dbConfig.database
});

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test connection with retry
let isConnected = false;
let connectionAttempts = 0;
const maxAttempts = 5;

function testConnection() {
    connectionAttempts++;
    console.log(`Connection attempt ${connectionAttempts}/${maxAttempts}...`);

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('❌ Connection failed:', err.message);

            if (connectionAttempts < maxAttempts) {
                const delay = Math.min(1000 * Math.pow(2, connectionAttempts - 1), 10000);
                console.log(`Retrying in ${delay}ms...`);
                setTimeout(testConnection, delay);
            } else {
                console.error('⚠️  Max connection attempts reached.');
                console.error('The database may be temporarily unavailable.');
                console.error('The server will continue, but API calls will fail.');
            }
        } else {
            isConnected = true;
            console.log('✓ MySQL tilkoblet...');
            connection.release();
        }
    });
}

testConnection();

// Handle pool errors
pool.on('error', (err) => {
    console.error('MySQL pool error:', err.message);
    isConnected = false;
});

// Helper function to query the database
function query(sql, values) {
    return new Promise((resolve, reject) => {
        pool.query(sql, values, (err, results) => {
            if (err) {
                console.error('Query error:', sql);
                console.error('Error:', err.message);
                // Mark disconnected only for connection-level failures
                if (err.fatal || err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
                    isConnected = false;
                }
                reject(err);
            } else {
                // If query succeeds, the pool is reachable
                isConnected = true;
                resolve(results);
            }
        });
    });
}

function createSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

async function authRequired(req, res, next) {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) {
            return res.status(401).json({ error: 'Ikke innlogget' });
        }

        const rows = await query(
            `SELECT us.token, us.expires_at, us.user_id, u.id, u.username, u.avatar, u.role
             FROM user_sessions us
             JOIN users u ON u.id = us.user_id
             WHERE us.token = ?`,
            [token]
        );

        if (!rows.length) {
            return res.status(401).json({ error: 'Ugyldig sesjon' });
        }

        const session = rows[0];
        const now = new Date();
        const expiresAt = new Date(session.expires_at);
        if (expiresAt < now) {
            await query('DELETE FROM user_sessions WHERE token = ?', [token]);
            return res.status(401).json({ error: 'Sesjon utløpt' });
        }

        req.user = {
            id: session.user_id,
            username: session.username,
            avatar: session.avatar || 'avatar1',
            role: session.role,
            token
        };
        next();
    } catch (err) {
        res.status(500).json({ error: 'Autentisering feilet' });
    }
}

function isMailerConfigured() {
    // Check if either SendGrid or Gmail is configured
    const hasSendGrid = Boolean(process.env.SENDGRID_API_KEY);
    const hasGmail = Boolean(process.env.GMAIL_USER && process.env.GMAIL_PASS);
    return hasSendGrid || hasGmail;
}

function parseNotifyPrefs(value) {
    if (!value) return { assignment: true, deadline: true };
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch (_) {
        return { assignment: true, deadline: true };
    }
}

async function sendEmail({ to, subject, text, html }) {
    console.log(`[EMAIL] sendEmail called: to=${to}, subject="${subject}"`);

    if (!isMailerConfigured()) {
        const usingSendGrid = Boolean(process.env.SENDGRID_API_KEY);
        const usingGmail = Boolean(process.env.GMAIL_USER && process.env.GMAIL_PASS);
        console.warn(`[EMAIL] No email service configured - Email skipped`);
        console.warn(`[EMAIL] SendGrid: ${usingSendGrid ? 'SET' : 'NOT SET'}`);
        console.warn(`[EMAIL] Gmail: ${usingGmail ? 'SET' : 'NOT SET'}`);
        return { skipped: true };
    }

    if (!to) {
        console.log('[EMAIL] No recipient email - Email skipped');
        return { skipped: true };
    }

    try {
        // Determine sender email
        const fromEmail = process.env.SENDGRID_API_KEY
            ? 'noreply@giftmanager.com'  // SendGrid needs a verified domain
            : process.env.GMAIL_USER;

        const provider = process.env.SENDGRID_API_KEY ? 'SendGrid' : 'Gmail';
        console.log(`[EMAIL] Attempting to send email via ${provider}...`);
        console.log(`[EMAIL] Email details: from=${fromEmail}, to=${to}, subject=${subject}`);

        const sendPromise = transporter.sendMail({
            from: fromEmail,
            to,
            subject,
            text,
            html
        });

        // Add timeout wrapper (60 seconds for email)
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Email send timeout after 60 seconds')), 60000)
        );

        const info = await Promise.race([sendPromise, timeoutPromise]);
        console.log(`[EMAIL] ✓ Email sent successfully via ${provider}. Message ID: ${info.messageId}`);
        return { messageId: info.messageId };
    } catch (err) {
        console.error(`[EMAIL] ✗ Failed to send email: ${err.message}`);
        console.error(`[EMAIL] Error code: ${err.code}`);
        console.error(`[EMAIL] Error details:`, err);
        throw err;
    }
}

async function sendAssignmentNotification(todoId) {
    console.log(`[EMAIL] sendAssignmentNotification called for todoId=${todoId}`);

    // Join todos -> users by responsible username
    const rows = await query(
        `SELECT t.id, t.task, t.status, t.due_date, t.responsible,
                u.email, u.notify_preferences
         FROM todos t
         LEFT JOIN users u ON u.username = t.responsible
         WHERE t.id = ?`,
        [todoId]
    );

    console.log(`[EMAIL] Query returned ${rows.length} rows`);
    if (!rows.length) {
        console.log(`[EMAIL] No rows found for todoId=${todoId}`);
        return;
    }

    const todo = rows[0];
    console.log(`[EMAIL] Todo found: task="${todo.task}", responsible="${todo.responsible}", email="${todo.email}"`);

    const prefs = parseNotifyPrefs(todo.notify_preferences);
    console.log(`[EMAIL] Notify prefs: ${JSON.stringify(prefs)}`);

    if (!prefs.assignment) {
        console.log(`[EMAIL] Assignment notifications disabled for this user`);
        return;
    }

    if (!todo.email) {
        console.warn(`[EMAIL] Assignment email skipped: no email for responsible='${todo.responsible}'`);
        return;
    }

    console.log(`[EMAIL] Mailer configured: ${isMailerConfigured()}`);
    const due = todo.due_date ? new Date(todo.due_date).toLocaleString('nb-NO') : 'Ikke satt';

    try {
        const result = await sendEmail({
            to: todo.email,
            subject: `Ny aktivitet tildelt: ${todo.task}`,
            text: `Hei ${todo.responsible},\n\nDu har fått en aktivitet:\n- Oppgave: ${todo.task}\n- Status: ${todo.status}\n- Frist: ${due}\n\nMvh\nGift Manager`,
            html: `<p>Hei <strong>${todo.responsible}</strong>,</p>
                   <p>Du har fått en aktivitet:</p>
                   <ul>
                     <li><strong>Oppgave:</strong> ${todo.task}</li>
                     <li><strong>Status:</strong> ${todo.status}</li>
                     <li><strong>Frist:</strong> ${due}</li>
                   </ul>
                   <p>Mvh<br/>Gift Manager</p>`
        });
        console.log(`[EMAIL] sendEmail result: ${JSON.stringify(result)}`);
    } catch (err) {
        console.error(`[EMAIL] Error sending email: ${err.message}`);
        throw err;
    }
}


function adminRequired(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Kun admins kan gjøre dette' });
    }
    next();
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        database: isConnected ? 'connected' : 'disconnected',
        environment: process.env.NODE_ENV || 'development'
    });
});

// Email configuration test endpoint
app.get('/api/email-config', (req, res) => {
    console.log('[EMAIL-CONFIG] Test endpoint called');
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_PASS;
    const sendgridKey = process.env.SENDGRID_API_KEY;

    res.json({
        configured: Boolean((gmailUser && gmailPass) || sendgridKey),
        gmail_configured: Boolean(gmailUser && gmailPass),
        gmail_user: gmailUser ? `${gmailUser.substring(0, 3)}***` : 'NOT SET',
        gmail_pass: gmailPass ? `***${gmailPass.substring(gmailPass.length - 3)}` : 'NOT SET',
        sendgrid_configured: Boolean(sendgridKey),
        sendgrid_key: sendgridKey ? `***${sendgridKey.substring(sendgridKey.length - 8)}` : 'NOT SET',
        node_env: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
    });
});

/* -------- Auth endpoints -------- */

app.post('/auth/login', async (req, res) => {
    try {
        const { username, password, remember } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Brukernavn og passord er påkrevd' });
        }

        const users = await query(
            'SELECT id, username, password_hash, role FROM users WHERE username = ?',
            [username]
        );

        if (!users.length) {
            return res.status(401).json({ error: 'Feil brukernavn eller passord' });
        }

        const user = users[0];
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            return res.status(401).json({ error: 'Feil brukernavn eller passord' });
        }

        const token = createSessionToken();
        const days = remember ? 30 : 1;
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

        await query(
            'INSERT INTO user_sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
            [user.id, token, expiresAt]
        );

        res.json({
            token,
            user: { id: user.id, username: user.username, role: user.role },
            expiresAt
        });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'Innlogging feilet', details: err.message });
    }
});

app.get('/auth/me', authRequired, async (req, res) => {
    res.json({ user: req.user });
});

app.post('/auth/logout', authRequired, async (req, res) => {
    try {
        await query('DELETE FROM user_sessions WHERE token = ?', [req.user.token]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Utlogging feilet' });
    }
});

// API-endepunkter
app.post('/gifts', authRequired, async (req, res) => {
    try {
        const { gift_name, giver, contact_person, phone, email, price, responsible, completed } = req.body;

        // Hent max id og legg til 1
        const results = await query('SELECT MAX(id) as maxId FROM gifts', []);
        const newId = (results[0].maxId || 0) + 1;

        await query(
            'INSERT INTO gifts (id, gift_name, giver, contact_person, phone, email, price, responsible, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [newId, gift_name, giver, contact_person, phone, email, price, responsible, completed ? 1 : 0]
        );

        res.send('Gave lagt til...');
    } catch (err) {
        console.error('Error inserting gift:', err);
        res.status(500).send('Feil ved innsetting av gave');
    }
});

app.get('/gifts', authRequired, async (req, res) => {
    try {
        const results = await query('SELECT * FROM gifts', []);
        res.json(results);
    } catch (err) {
        console.error('Error fetching gifts:', err);
        res.status(500).json({
            error: 'Feil ved henting av gaver',
            message: err.message,
            code: err.code
        });
    }
});

app.get('/gifts/:id', authRequired, async (req, res) => {
    try {
        const { id } = req.params;
        const results = await query('SELECT * FROM gifts WHERE id = ?', [id]);
        if (results.length === 0) {
            return res.status(404).send('Gave ikke funnet');
        }
        res.json(results[0]);
    } catch (err) {
        console.error('Error fetching gift:', err);
        res.status(500).send('Feil ved henting av gave');
    }
});

app.put('/gifts/:id', authRequired, async (req, res) => {
    try {
        const { gift_name, giver, contact_person, phone, email, price, responsible, completed } = req.body;
        const { id } = req.params;

        await query(
            'UPDATE gifts SET gift_name = ?, giver = ?, contact_person = ?, phone = ?, email = ?, price = ?, responsible = ?, completed = ? WHERE id = ?',
            [gift_name, giver, contact_person, phone, email, price, responsible, completed ? 1 : 0, id]
        );

        res.send('Gave oppdatert...');
    } catch (err) {
        console.error('Error updating gift:', err);
        res.status(500).send('Feil ved oppdatering av gave');
    }
});

app.delete('/gifts/:id', authRequired, adminRequired, async (req, res) => {
    try {
        const { id } = req.params;
        await query('DELETE FROM gifts WHERE id = ?', [id]);
        res.send('Gave slettet...');
    } catch (err) {
        console.error('Error deleting gift:', err);
        res.status(500).send('Feil ved sletting av gave');
    }
});

/* -------- Todos API -------- */

// List todos (logged-in users)
app.get('/todos', authRequired, async (req, res) => {
    try {
        const rows = await query(
            'SELECT id, created_date, task, status, due_date, responsible FROM todos ORDER BY created_date DESC',
            []
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching todos:', err.message);
        res.status(500).json({ error: 'Feil ved henting av oppgaver' });
    }
});

// Create todo (logged-in users)
app.post('/todos', authRequired, async (req, res) => {
    try {
        const { task, status, due_date, responsible } = req.body;
        console.log(`[TODO] POST /todos called: task="${task}", status="${status}", responsible="${responsible}"`);

        if (!task || !status || !responsible) {
            console.log('[TODO] Missing required fields');
            return res.status(400).json({ error: 'task, status og responsible er påkrevd' });
        }

        const allowed = ['Ny', 'Pågår', 'Utført'];
        if (!allowed.includes(status)) {
            console.log(`[TODO] Invalid status: ${status}`);
            return res.status(400).json({ error: 'Ugyldig status' });
        }

        const result = await query(
            'INSERT INTO todos (task, status, due_date, responsible) VALUES (?, ?, ?, ?)',
            [task, status, due_date || null, responsible]
        );
        console.log(`[TODO] Todo inserted with ID: ${result.insertId}`);

       // Send assignment notification email
        try {
            if (result.insertId) {
                console.log(`[TODO] Triggering email notification for todoId=${result.insertId}`);
                await sendAssignmentNotification(result.insertId);
            }
        } catch (mailErr) {
            console.warn(`[TODO] Assignment email failed: ${mailErr.message}`);
        }

        console.log('[TODO] Response sent successfully');
        res.json({ ok: true, message: 'Oppgave opprettet' });
    } catch (err) {
        console.error(`[TODO] Error creating todo: ${err.message}`);
        res.status(500).json({ error: 'Feil ved oppretting av oppgave' });
    }
});

// Update todo (logged-in users)
app.put('/todos/:id', authRequired, async (req, res) => {
    try {
        const { id } = req.params;
        const { task, status, due_date, responsible } = req.body;

        if (!task || !status || !responsible) {
            return res.status(400).json({ error: 'task, status og responsible er påkrevd' });
        }

        const allowed = ['Ny', 'Pågår', 'Utført'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ error: 'Ugyldig status' });
        }

        await query(
            'UPDATE todos SET task = ?, status = ?, due_date = ?, responsible = ? WHERE id = ?',
            [task, status, due_date || null, responsible, id]
        );

        // Send assignment notification email
        try {
            await sendAssignmentNotification(id);
        } catch (mailErr) {
            console.warn('Assignment email failed:', mailErr.message);
        }

        res.json({ ok: true, message: 'Oppgave oppdatert' });
    } catch (err) {
        console.error('Error updating todo:', err.message);
        res.status(500).json({ error: 'Feil ved oppdatering av oppgave' });
    }
});

// Delete todo (admin only)
app.delete('/todos/:id', authRequired, adminRequired, async (req, res) => {
    try {
        const { id } = req.params;
        await query('DELETE FROM todos WHERE id = ?', [id]);
        res.json({ ok: true, message: 'Oppgave slettet' });
    } catch (err) {
        console.error('Error deleting todo:', err.message);
        res.status(500).json({ error: 'Feil ved sletting av oppgave' });
    }
});

// Get all users (admin only)
app.get('/users', authRequired, adminRequired, async (req, res) => {
    try {
        const rows = await query(
            'SELECT id, username, first_name, last_name, email, avatar, role FROM users ORDER BY username',
            []
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching users:', err.message);
        res.status(500).json({ error: 'Feil ved henting av brukere' });
    }
});

// Public user list for dropdowns (authenticated users)
app.get('/users/public-list', authRequired, async (req, res) => {
    try {
        const rows = await query(
            `SELECT username, first_name, last_name,
                    TRIM(CONCAT(COALESCE(first_name, ''), 
                                 ' ',
                                 COALESCE(last_name, ''))) AS display_name
             FROM users ORDER BY first_name, last_name, username`,
            []
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching public user list:', err.message);
        res.status(500).json({ error: 'Feil ved henting av brukerliste' });
    }
});

// Get single user (admin only)
app.get('/users/:id', authRequired, adminRequired, async (req, res) => {
    try {
        const { id } = req.params;
        const rows = await query(
            'SELECT id, username, first_name, last_name, email, avatar, role FROM users WHERE id = ?',
            [id]
        );
        if (!rows.length) {
            return res.status(404).json({ error: 'Bruker ikke funnet' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('Error fetching user:', err.message);
        res.status(500).json({ error: 'Feil ved henting av bruker' });
    }
});

// Create user (admin only)
app.post('/users', authRequired, adminRequired, async (req, res) => {
    try {
        const { username, email, first_name, last_name, avatar, role } = req.body;

        if (!username || !email) {
            return res.status(400).json({ error: 'Brukernavn og e-post er påkrevd' });
        }

        // Check for duplicate username
        const existingUsername = await query(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );
        if (existingUsername.length) {
            return res.status(400).json({ error: 'Brukernavn eksisterer allerede' });
        }

        // Check for duplicate email
        const existingEmail = await query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );
        if (existingEmail.length) {
            return res.status(400).json({ error: 'E-post eksisterer allerede' });
        }

        const defaultPassword = crypto.randomBytes(8).toString('hex');
        const passwordHash = await bcrypt.hash(defaultPassword, 10);

        await query(
            'INSERT INTO users (username, email, password_hash, first_name, last_name, avatar, role, notify_preferences) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [username, email, passwordHash, first_name || '', last_name || '', avatar || 'avatar1', role || 'user', JSON.stringify({ assignment: true, deadline: true })]
        );

        res.json({ ok: true, message: 'Bruker opprettet', tempPassword: defaultPassword });
    } catch (err) {
        console.error('Error creating user:', err.message);
        res.status(500).json({ error: 'Feil ved oppretting av bruker' });
    }
});


// Get current user profile
app.get('/profile', authRequired, async (req, res) => {
    try {
        const rows = await query(
            'SELECT id, username, first_name, last_name, email, avatar, notify_preferences FROM users WHERE id = ?',
            [req.user.id]
        );

        if (!rows.length) {
            return res.status(404).json({ error: 'Bruker profil ikke funnet' });
        }

        const profile = rows[0];
        // Handle JSON parsing for notify_preferences
        if (typeof profile.notify_preferences === 'string') {
            profile.notify_preferences = JSON.parse(profile.notify_preferences || '{}');
        }
        profile.notify_preferences = profile.notify_preferences || { assignment: true, deadline: true };
        res.json(profile);
    } catch (err) {
        console.error('Error fetching profile:', err.message);
        res.status(500).json({ error: 'Feil ved henting av profil' });
    }
});


// Update current user profile
app.put('/profile', authRequired, async (req, res) => {
    try {
        const { first_name, last_name, email, avatar, notify_preferences } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'E-post er påkrevd' });
        }

        await query(
            'UPDATE users SET first_name = ?, last_name = ?, email = ?, avatar = ?, notify_preferences = ? WHERE id = ?',
            [first_name || '', last_name || '', email, avatar || 'avatar1', JSON.stringify(notify_preferences || { assignment: true, deadline: true }), req.user.id]
        );

        res.json({ ok: true, message: 'Profil oppdatert' });
    } catch (err) {
        console.error('Error updating profile:', err.message);
        res.status(500).json({ error: 'Feil ved oppdatering av profil' });
    }
});

// Update user (admin only)
app.put('/users/:id', authRequired, adminRequired, async (req, res) => {
    try {
        const { id } = req.params;
        const { first_name, last_name, email, avatar, role } = req.body;

        await query(
            'UPDATE users SET first_name = ?, last_name = ?, email = ?, avatar = ?, role = ? WHERE id = ?',
            [first_name || '', last_name || '', email, avatar || 'avatar1', role || 'user', id]
        );

        res.json({ ok: true, message: 'Bruker oppdatert' });
    } catch (err) {
        console.error('Error updating user:', err.message);
        res.status(500).json({ error: 'Feil ved oppdatering av bruker' });
    }
});

// Delete user (admin only)
app.delete('/users/:id', authRequired, adminRequired, async (req, res) => {
    try {
        const { id } = req.params;
        await query('DELETE FROM users WHERE id = ?', [id]);
        res.json({ ok: true, message: 'Bruker slettet' });
    } catch (err) {
        console.error('Error deleting user:', err.message);
        res.status(500).json({ error: 'Feil ved sletting av bruker' });
    }
});

// Get avatar (inline SVG)
app.get('/avatars/:name', (req, res) => {
    const avatars = {
        avatar1: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#FF6B6B"/><circle cx="50" cy="35" r="15" fill="white"/><ellipse cx="50" cy="70" rx="20" ry="25" fill="white"/></svg>',
        avatar2: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#4ECDC4"/><circle cx="50" cy="35" r="15" fill="white"/><ellipse cx="50" cy="70" rx="20" ry="25" fill="white"/></svg>',
        avatar3: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#FFE66D"/><circle cx="50" cy="35" r="15" fill="white"/><ellipse cx="50" cy="70" rx="20" ry="25" fill="white"/></svg>',
        avatar4: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#95E1D3"/><circle cx="50" cy="35" r="15" fill="white"/><ellipse cx="50" cy="70" rx="20" ry="25" fill="white"/></svg>',
        avatar5: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#A8D8EA"/><circle cx="50" cy="35" r="15" fill="white"/><ellipse cx="50" cy="70" rx="20" ry="25" fill="white"/></svg>',
        avatar6: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#C7CEEA"/><circle cx="50" cy="35" r="15" fill="white"/><ellipse cx="50" cy="70" rx="20" ry="25" fill="white"/></svg>',
        avatar7: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#F38181"/><circle cx="50" cy="35" r="15" fill="white"/><ellipse cx="50" cy="70" rx="20" ry="25" fill="white"/></svg>',
        avatar8: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#AA96DA"/><circle cx="50" cy="35" r="15" fill="white"/><ellipse cx="50" cy="70" rx="20" ry="25" fill="white"/></svg>'
    };

    const svg = avatars[req.params.name];
    if (!svg) {
        return res.status(404).json({ error: 'Avatar not found' });
    }

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(svg);
});


// Send due-date reminder emails (admin only)
app.post('/notifications/due-reminders', authRequired, adminRequired, async (req, res) => {
    try {
        const daysAhead = Number(req.body?.daysAhead ?? 2);
        const now = new Date();
        const until = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

        const rows = await query(
            `SELECT t.id, t.task, t.status, t.due_date, t.responsible,
                    u.email, u.notify_preferences
             FROM todos t
             LEFT JOIN users u ON u.username = t.responsible
             WHERE t.due_date IS NOT NULL
               AND t.status <> 'Utført'
               AND t.due_date >= ?
               AND t.due_date <= ?`,
            [now, until]
        );

        let sent = 0;
        let skipped = 0;

        for (const todo of rows) {
            const prefs = parseNotifyPrefs(todo.notify_preferences);
            if (!prefs.deadline || !todo.email) {
                skipped++;
                continue;
            }

            const due = new Date(todo.due_date).toLocaleString('nb-NO');

            try {
                await sendEmail({
                    to: todo.email,
                    subject: `⏰ Påminnelse: Frist nærmer seg - ${todo.task}`,
                    text: `Hei ${todo.responsible},\n\nFristen nærmer seg for:\n- Oppgave: ${todo.task}\n- Status: ${todo.status}\n- Frist: ${due}\n\nMvh\nArrangementsportalen`,
                    html: `<p>Hei <strong>${todo.responsible}</strong>,</p>
                           <p>Fristen nærmer seg for en oppgave:</p>
                           <ul>
                             <li><strong>Oppgave:</strong> ${todo.task}</li>
                             <li><strong>Status:</strong> ${todo.status}</li>
                             <li><strong>Frist:</strong> ${due}</li>
                           </ul>
                           <p>Mvh<br/>Arrangementsportalen</p>`
                });
                console.log(`Reminder sent to ${todo.email} for todo: ${todo.task}`);
                sent++;
            } catch (mailErr) {
                console.warn(`Reminder mail failed for todo ${todo.id}:`, mailErr.message);
                skipped++;
            }
        }

        res.json({ ok: true, scanned: rows.length, sent, skipped, daysAhead });
    } catch (err) {
        console.error('Reminder job failed:', err.message);
        res.status(500).json({ error: 'Feil ved utsending av påminnelser' });
    }
});

app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`Server kjører på port ${port}`);
    console.log(`Åpne nettleseren her: ${url}`);
});