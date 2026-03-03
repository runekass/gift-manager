const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'switchback.proxy.rlwy.net',
    port: process.env.DB_PORT || 58577,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'KPrlTiiltFSYrDGEBtulBpCAEKMNsYVI',
    database: process.env.DB_NAME || 'railway'
});

function connectDB() {
    db.connect(err => {
        if (err) {
            console.error('MySQL connection failed:', err);
            setTimeout(connectDB, 5000);
        } else {
            console.log('MySQL tilkoblet...');
        }
    });
}

connectDB();

// API-endepunkter
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
    console.log(`Server kjører på port ${port}`);
});
