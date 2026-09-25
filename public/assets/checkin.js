// Escáner QR para la entrada: /admin/checkin.html#<event_id>
// Usa BarcodeDetector (Chrome/Android) y, si no existe (iPhone/Safari), jsQR.
(function () {
  const eventId = location.hash.slice(1);
  const token = (() => { try { return localStorage.getItem("ev_token") || ""; } catch { return ""; } })();
  const video = document.getElementById("video");
  const result = document.getElementById("result");
  const startBtn = document.getElementById("start");
  const countEl = document.getElementById("count");
  let lastCode = "", lastAt = 0, busy = false, detector = null, jsQR = null;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!token) { location.href = "/admin/"; return; }

  async function api(path, opts = {}) {
    const r = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) location.href = "/admin/";
    if (!r.ok) throw Object.assign(new Error(data.error || `Error ${r.status}`), { status: r.status });
    return data;
  }

  async function refreshHeader() {
    try {
      const { event } = await api(`/api/events/${encodeURIComponent(eventId)}`);
      document.getElementById("title").textContent = event.title;
      countEl.textContent = `${event.checked_in} / ${event.registered}`;
    } catch (e) { show("bad", e.message); }
  }

  function show(kind, text) {
    result.hidden = false;
    result.className = `result ${kind}`;
    result.textContent = text;
    if (navigator.vibrate) navigator.vibrate(kind === "good" ? 80 : [60, 60, 60]);
  }

  async function checkIn(code) {
    busy = true;
    try {
      const d = await api("/api/checkin", { method: "POST", body: JSON.stringify({ event_id: eventId, token: code }) });
      if (d.already) show("warn", `⚠️ ${d.registration.name} ya había entrado (${new Date(d.checked_in_at).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" })})`);
      else show("good", `✅ Bienvenido(a), ${d.registration.name}`);
      refreshHeader();
    } catch (e) {
      show("bad", `❌ ${e.message}`);
    } finally { busy = false; }
  }

  async function loadJsQR() {
    if (jsQR) return jsQR;
    await new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
      s.onload = ok; s.onerror = fail;
      document.head.appendChild(s);
    });
    return (jsQR = window.jsQR);
  }

  async function detect() {
    if (video.readyState < 2) return null;
    if (detector) {
      const codes = await detector.detect(video);
      return codes[0] ? codes[0].rawValue : null;
    }
    const w = video.videoWidth, h = video.videoHeight;
    const scale = Math.min(1, 640 / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
    return code ? code.data : null;
  }

  async function loop() {
    if (!busy) {
      try {
        const code = await detect();
        // evita leer el mismo QR varias veces seguidas
        if (code && (code !== lastCode || Date.now() - lastAt > 4000)) {
          lastCode = code; lastAt = Date.now();
          await checkIn(code);
        }
      } catch {}
    }
    requestAnimationFrame(loop);
  }

  startBtn.onclick = async () => {
    startBtn.disabled = true;
    try {
      if ("BarcodeDetector" in window && (await BarcodeDetector.getSupportedFormats()).includes("qr_code")) {
        detector = new BarcodeDetector({ formats: ["qr_code"] });
      } else {
        await loadJsQR();
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      video.srcObject = stream;
      await video.play();
      startBtn.hidden = true;
      loop();
    } catch (e) {
      show("bad", "No se pudo abrir la cámara. Revisa los permisos o usa la validación manual.");
      startBtn.disabled = false;
    }
  };

  document.getElementById("manual").onsubmit = (e) => {
    e.preventDefault();
    const v = e.target.token.value.trim();
    if (v) checkIn(v).then(() => { e.target.token.value = ""; });
  };

  refreshHeader();
})();
