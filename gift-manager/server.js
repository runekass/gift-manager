const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Create a connection pool instead of a single connection
const pool = mysql.createPool({
    connectionLimit: 10,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Test the connection
pool.getConnection((err, connection) => {
    if (err) {
        console.error('MySQL connection pool failed:', err);
    } else {
        console.log('MySQL tilkoblet...');
        console.log('DB Host:', process.env.DB_HOST);
        console.log('DB Port:', process.env.DB_PORT);
        console.log('DB Name:', process.env.DB_NAME);
        connection.release();
    }
});

// Helper function to query the database
function query(sql, values) {
    return new Promise((resolve, reject) => {
        pool.query(sql, values, (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
}

// API-endepunkter
app.post('/gifts', async (req, res) => {
    try {
        const { gift_name, giver, price, responsible, completed } = req.body;

        // Hent max id og legg til 1
        const results = await query('SELECT MAX(id) as maxId FROM gifts', []);
        const newId = (results[0].maxId || 0) + 1;

        await query(
            'INSERT INTO gifts (id, gift_name, giver, price, responsible, completed) VALUES (?, ?, ?, ?, ?, ?)',
            [newId, gift_name, giver, price, responsible, completed ? 1 : 0]
        );

        res.send('Gave lagt til...');
    } catch (err) {
        console.error('Error inserting gift:', err);
        res.status(500).send('Feil ved innsetting av gave');
    }
});

app.get('/gifts', async (req, res) => {
    try {
        const results = await query('SELECT * FROM gifts', []);
        res.json(results);
    } catch (err) {
        console.error('Error fetching gifts:', err);
        res.status(500).send('Feil ved henting av gaver');
    }
});

app.get('/gifts/:id', async (req, res) => {
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

app.put('/gifts/:id', async (req, res) => {
    try {
        const { gift_name, giver, price, responsible, completed } = req.body;
        const { id } = req.params;

        await query(
            'UPDATE gifts SET gift_name = ?, giver = ?, price = ?, responsible = ?, completed = ? WHERE id = ?',
            [gift_name, giver, price, responsible, completed ? 1 : 0, id]
        );

        res.send('Gave oppdatert...');
    } catch (err) {
        console.error('Error updating gift:', err);
        res.status(500).send('Feil ved oppdatering av gave');
    }
});

app.delete('/gifts/:id', async (req, res) => {
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