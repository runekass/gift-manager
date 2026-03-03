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
    host: 'switchback.proxy.rlwy.net',
    port: 58577,
    user: 'root',
    password: 'KPrlTiiltFSYrDGEBtulBpCAEKMNsYVI',
    database: 'railway'
});

db.connect(err => {
    if (err) throw err;
    console.log('MySQL tilkoblet...');
});

// API-endepunkter
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
    db.query('SELECT * FROM gifts', (err, results) => {
        if (err) throw err;
        res.json(results);
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

app.listen(port, () => {
    console.log(`Server kjører på port ${port}`);
});
