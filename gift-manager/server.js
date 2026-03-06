const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');

// Only load .env in development, not on Railway (production)
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Ensure no caching issues
app.use((req, res, next) => {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.header('Referrer-Policy', 'no-referrer');
    next();
});

const db = mysql.createConnection({
    host: process.env.MYSQLHOST || process.env.DB_HOST,
    port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
    user: process.env.MYSQLUSER || process.env.DB_USER,
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
    database: process.env.MYSQLDATABASE || process.env.DB_NAME
});

db.connect(err => {
    if (err) {
        console.error('Databasefeil:', err.message);
        console.error('DB Host:', process.env.MYSQLHOST || process.env.DB_HOST);
        console.error('DB Port:', process.env.MYSQLPORT || process.env.DB_PORT);
        console.error('DB User:', process.env.MYSQLUSER || process.env.DB_USER);
        console.error('DB Name:', process.env.MYSQLDATABASE || process.env.DB_NAME);
        console.error('NODE_ENV:', process.env.NODE_ENV);
        console.error('Using Railway internal:', !process.env.DB_HOST && process.env.MYSQLHOST);
        throw err;
    }
    console.log('MySQL tilkoblet...');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('Tilkobling:', {
        host: process.env.MYSQLHOST || process.env.DB_HOST,
        port: process.env.MYSQLPORT || process.env.DB_PORT,
        user: process.env.MYSQLUSER || process.env.DB_USER,
        database: process.env.MYSQLDATABASE || process.env.DB_NAME
    });
});

// API-endpoints
app.post('/gifts', (req, res) => {
    const { gift_name, giver, price, responsible, completed } = req.body;

    // Hent max id og legg til 1
    db.query('SELECT MAX(id) as maxId FROM gifts', (err, results) => {
        if (err) throw err;

        const newId = (results[0].maxId || 0) + 1;
        const sql = 'INSERT INTO gifts (id, gift_name, giver, price, responsible, completed) VALUES (?, ?, ?, ?, ?, ?)';
        db.query(sql, [newId, gift_name, giver, price, responsible, completed], (err, result) => {
            if (err) throw err;
            res.send('Gave lagt til...');
        });
    });
});

app.get('/gifts', (req, res) => {
    console.log('GET /gifts - Henter alle gaver');
    db.query('SELECT * FROM gifts', (err, results) => {
        if (err) {
            console.error('Database feil ved henting av gaver:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        console.log(`Returnerer ${results.length} gaver`);
        res.json(results);
    });
});

app.get('/gifts/:id', (req, res) => {
    const id = req.params.id;
    db.query('SELECT * FROM gifts WHERE id = ?', [id], (err, results) => {
        if (err) {
            console.error('Database feil ved henting av gave:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        if (results.length === 0) {
            res.status(404).json({ error: 'Gave ikke funnet' });
            return;
        }
        res.json(results[0]);
    });
});

app.put('/gifts/:id', (req, res) => {
    const { gift_name, giver, price, responsible, completed } = req.body;
    const id = req.params.id;
    const sql = 'UPDATE gifts SET gift_name = ?, giver = ?, price = ?, responsible = ?, completed = ? WHERE id = ?';
    db.query(sql, [gift_name, giver, price, responsible, completed, id], (err, result) => {
        if (err) throw err;
        res.send('Gave oppdatert...');
    });
});

app.delete('/gifts/:id', (req, res) => {
    const id = req.params.id;
    const sql = 'DELETE FROM gifts WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) throw err;
        res.send('Gave slettet...');
    });
});

// Serve static files AFTER API routes
app.use(express.static(__dirname));

app.listen(port, () => {
    console.log(`Server kjører på http://localhost:${port}`);
});
