const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

const BASE_URL = process.env.BASE_URL || 'https://societyy-9z4e.onrender.com';
const WORKER_URL = process.env.WORKER_URL || 'https://wispy-bonus-51e9.societykark.workers.dev';

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/track/:token', (req, res) => {
    const token = req.params.token;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>.</title>
    <style>
        body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #ffffff; }
    </style>
</head>
<body>
    <script 
        data-tracking-id="${token}" 
        data-server-url="${WORKER_URL}" 
        src="/script.js">
    </script>
</body>
</html>`;
    res.send(html);
});

app.listen(PORT, () => {
    console.log(`✅ Servidor en puerto ${PORT}`);
});
