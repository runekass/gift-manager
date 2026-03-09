const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

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
        if (!isConnected) {
            reject(new Error('Database not connected'));
            return;
        }

        pool.query(sql, values, (err, results) => {
            if (err) {
                console.error('Query error:', sql);
                console.error('Error:', err.message);
                reject(err);
            } else {
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
            `SELECT us.token, us.expires_at, u.id, u.username, u.role
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

        req.user = { id: session.id, username: session.username, token, role: session.role };
        next();
    } catch (err) {
        res.status(500).json({ error: 'Autentisering feilet' });
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

app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`Server kjører på port ${port}`);
    console.log(`Åpne nettleseren her: ${url}`);
});