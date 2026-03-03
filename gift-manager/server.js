const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const db = mysql.createConnection({
    host: 'switchback.proxy.rlwy.net',
    port: 58577,
    user: 'root',
    password: 'KPrlTiiltFSYrDGEBtulBpCAEKMNsYVI',
    database: 'railway'
});

db.connect(err => {
    if (err) throw err;
    console.log('MySQL connected...');
});

// API endpoints
app.post('/gifts', (req, res) => {
    const { gift_name, giver, price, responsible, completed } = req.body;
    const sql = 'INSERT INTO gifts (gift_name, giver, price, responsible, completed) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [gift_name, giver, price, responsible, completed], (err, result) => {
        if (err) throw err;
        res.send('Gift added...');
    });
});

app.get('/gifts', (req, res) => {
    db.query('SELECT * FROM gifts', (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});