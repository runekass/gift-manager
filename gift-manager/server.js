const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
// Don't use static middleware yet - we'll add it at the end after API routes

// Parse DATABASE_URL if provided by Railway
let dbConfig;
if (process.env.DATABASE_URL) {
    // Parse the DATABASE_URL (format: mysql://user:password@host:port/database)
    const url = new URL(process.env.DATABASE_URL);
    dbConfig = {
        host: url.hostname,
        port: parseInt(url.port) || 3306,
        user: url.username,
        password: url.password,
        database: url.pathname.substring(1) // Remove leading slash
    };
    console.log('Using DATABASE_URL from Railway');
} else {
    // Use individual environment variables
    dbConfig = {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    };
    console.log('Using individual database environment variables');
}

const db = mysql.createConnection(dbConfig);

function connectDB() {
    db.connect(err => {
        if (err) {
            console.error('MySQL connection failed:', err.message);
            console.log('Retrying in 5 seconds...');
            setTimeout(connectDB, 5000);
        } else {
            console.log('MySQL tilkoblet...');
        }
    });
}

connectDB();

// API-endepunkter
app.get('/health', (req, res) => {
    const status = {
        status: 'ok',
        port: port,
        timestamp: new Date().toISOString()
    };

    // Check database connection
    db.ping((err) => {
        if (err) {
            status.database = 'disconnected';
            status.error = err.message;
            res.status(500).json(status);
        } else {
            status.database = 'connected';
            res.json(status);
        }
    });
});

app.post('/gifts', (req, res) => {
    const { gift_name, giver, price, responsible, completed } = req.body;

    // Hent max id og legg til 1
    db.query('SELECT MAX(id) as maxId FROM gifts', (err, results) => {
        if (err) {
            console.error('Error fetching max id:', err);
            return res.status(500).send('Feil ved henting av ID');
        }

        const newId = (results[0].maxId || 0) + 1;
        const sql = 'INSERT INTO gifts (id, gift_name, giver, price, responsible, completed) VALUES (?, ?, ?, ?, ?, ?)';
        db.query(sql, [newId, gift_name, giver, price, responsible, completed ? 1 : 0], (err, result) => {
            if (err) {
                console.error('Error inserting gift:', err);
                return res.status(500).send('Feil ved innsetting av gave');
            }
            res.send('Gave lagt til...');
        });
    });
});

app.get('/gifts', (req, res) => {
    db.query('SELECT * FROM gifts', (err, results) => {
        if (err) {
            console.error('Error fetching gifts:', err);
            return res.status(500).send('Feil ved henting av gaver');
        }
        res.json(results);
    });
});

app.put('/gifts/:id', (req, res) => {
    const { gift_name, giver, price, responsible, completed } = req.body;
    const id = req.params.id;
    const sql = 'UPDATE gifts SET gift_name = ?, giver = ?, price = ?, responsible = ?, completed = ? WHERE id = ?';
    db.query(sql, [gift_name, giver, price, responsible, completed ? 1 : 0, id], (err, result) => {
        if (err) {
            console.error('Error updating gift:', err);
            return res.status(500).send('Feil ved oppdatering av gave');
        }
        res.send('Gave oppdatert...');
    });
});

app.delete('/gifts/:id', (req, res) => {
    const id = req.params.id;
    const sql = 'DELETE FROM gifts WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error deleting gift:', err);
            return res.status(500).send('Feil ved sletting av gave');
        }
        res.send('Gave slettet...');
    });
});

app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`Server kjører på port ${port}`);
    console.log(`Åpne nettleseren her: ${url}`);
});