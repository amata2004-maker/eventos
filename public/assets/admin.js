// Panel de organizadores (SPA mínima con rutas por hash).
//   #/            lista de eventos
//   #/new         crear evento
//   #/edit/<id>   editar evento
//   #/event/<id>  registrados + check-in manual + CSV
(function () {
  const app = document.getElementById("app");
  const logoutBtn = document.getElementById("logout");
  const TZ_LIST = ["America/Mexico_City", "America/Monterrey", "America/Cancun", "America/Tijuana", "America/Hermosillo",
    "America/Mazatlan", "America/Bogota", "America/Lima", "America/Santiago", "America/Argentina/Buenos_Aires",
    "America/Guatemala", "America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/Madrid"];
  let me = null;
  let brands = [];

  const store = {
    get() { try { return localStorage.getItem("ev_token") || ""; } catch { return ""; } },
    set(t) { try { t ? localStorage.setItem("ev_token", t) : localStorage.removeItem("ev_token"); } catch {} },
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function api(path, opts = {}) {
    const r = await fetch(path, {
      ...opts,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${store.get()}`, ...(opts.headers || {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && !path.startsWith("/api/auth/")) { store.set(""); me = null; setTimeout(route); }
    if (!r.ok) throw new Error(data.error || `Error ${r.status}`);
    return data;
  }

  const fmt = (iso, tz) => new Intl.DateTimeFormat("es-MX", { timeZone: tz, weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  const fmtShort = (iso) => iso ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso)) : "";
  const publicUrl = (ev) => `${location.origin}/e/${ev.slug}`;
  const brandName = (k) => (brands.find((b) => b.key === k) || {}).name || k;
  const STATUS = { published: "Publicado", draft: "Borrador", cancelled: "Cancelado" };

  // ─── Acceso ─────────────────────────────────────────────
  function viewAuth(mode = "login") {
    logoutBtn.hidden = true;
    const signup = mode === "signup";
    app.innerHTML = `
<section class="card" style="max-width:440px;margin:30px auto">
  <h1>${signup ? "Crear cuenta" : "Entrar"}</h1>
  <form class="form" id="authf">
    ${signup ? '<label>Nombre<input name="name" required maxlength="80"></label>' : ""}
    <label>Correo<input name="email" type="email" required autocomplete="email"></label>
    <label>Contraseña<input name="password" type="password" required minlength="${signup ? 10 : 1}" autocomplete="${signup ? "new-password" : "current-password"}"></label>
    ${signup ? '<label>Código de invitación <span class="muted">(si te lo dieron)</span><input name="code" autocomplete="off"></label>' : ""}
    <button class="btn">${signup ? "Crear cuenta" : "Entrar"}</button>
    <p class="msg"></p>
  </form>
  <p class="small center"><button class="link" id="swap">${signup ? "Ya tengo cuenta" : "Soy organizador nuevo"}</button></p>
</section>`;
    document.getElementById("swap").onclick = () => viewAuth(signup ? "login" : "signup");
    const f = document.getElementById("authf");
    f.onsubmit = async (e) => {
      e.preventDefault();
      const msg = f.querySelector(".msg");
      msg.textContent = "";
      try {
        const data = await api(`/api/auth/${signup ? "signup" : "login"}`, { method: "POST", body: Object.fromEntries(new FormData(f)) });
        store.set(data.token);
        await loadMe();
        location.hash = "#/";
        route();
      } catch (err) { msg.textContent = err.message; }
    };
  }

  async function loadMe() {
    if (!store.get()) return (me = null);
    try { const d = await api("/api/auth/me"); me = d.organizer; brands = d.brands; }
    catch { me = null; }
  }

  // ─── Lista ──────────────────────────────────────────────
  async function viewList() {
    app.innerHTML = `<div class="head"><h1>Mis eventos</h1><a class="btn" href="#/new">+ Nuevo evento</a></div><div id="list"><p class="muted">Cargando…</p></div>`;
    const { events } = await api("/api/events");
    const list = document.getElementById("list");
    if (!events.length) {
      list.innerHTML = `<section class="card center"><p>Aún no tienes eventos.</p><a class="btn" href="#/new">Crear mi primer evento</a></section>`;
      return;
    }
    const now = new Date().toISOString();
    list.innerHTML = events.map((ev) => `
<section class="card ev">
  <div><span class="pill ${ev.status}">${STATUS[ev.status]}</span><span class="pill">${esc(brandName(ev.brand))}</span><span class="pill">${ev.mode === "online" ? "En línea" : "Presencial"}</span>${ev.end_at < now ? '<span class="pill">Pasado</span>' : ""}</div>
  <h3>${esc(ev.title)}</h3>
  <div class="meta">${esc(fmt(ev.start_at, ev.timezone))}</div>
  <div class="stats"><span><b>${ev.registered}</b>${ev.capacity ? ` / ${ev.capacity}` : ""} registrados</span>
    ${ev.mode === "presencial" ? `<span><b>${ev.checked_in}</b> con check-in</span>` : `<span><b>${ev.joined}</b> se unieron</span>`}</div>
  <div class="btns">
    <a class="btn sm" href="#/event/${ev.id}">Registrados</a>
    ${ev.mode === "presencial" ? `<a class="btn sm" href="/admin/checkin.html#${ev.id}">Check-in QR</a>` : ""}
    <a class="btn sm ghost" href="#/edit/${ev.id}">Editar</a>
    <button class="btn sm ghost" data-copy="${esc(publicUrl(ev))}">Copiar enlace</button>
    <a class="btn sm ghost" href="${esc(publicUrl(ev))}" target="_blank" rel="noopener">Ver página</a>
  </div>
</section>`).join("");
  }

  // ─── Formulario ─────────────────────────────────────────
  async function viewForm(id) {
    let ev = { brand: brands[0]?.key || "myactif", mode: "presencial", timezone: "America/Mexico_City", status: "published" };
    if (id) ev = (await api(`/api/events/${id}`)).event;
    const tzs = TZ_LIST.includes(ev.timezone) ? TZ_LIST : [ev.timezone, ...TZ_LIST];
    app.innerHTML = `
<div class="head"><h1>${id ? "Editar evento" : "Nuevo evento"}</h1><a href="#/" class="small">← Volver</a></div>
<form class="card form" id="evf">
  <div class="grid">
    <label class="full">Título<input name="title" required maxlength="140" value="${esc(ev.title)}"></label>
    <label>Marca<select name="brand">${brands.map((b) => `<option value="${b.key}" ${b.key === ev.brand ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select></label>
    <label>Estado<select name="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === ev.status ? "selected" : ""}>${v}</option>`).join("")}</select></label>
    <label class="full">Modalidad
      <div class="seg">
        <label><input type="radio" name="mode" value="presencial" ${ev.mode === "presencial" ? "checked" : ""}>📍 Presencial</label>
        <label><input type="radio" name="mode" value="online" ${ev.mode === "online" ? "checked" : ""}>💻 En línea</label>
      </div></label>
    <label>Inicio<input name="start_local" type="datetime-local" required value="${esc(ev.start_local)}"></label>
    <label>Fin <span class="muted">(opcional, 2 h por defecto)</span><input name="end_local" type="datetime-local" value="${esc(ev.end_local)}"></label>
    <label>Zona horaria<select name="timezone">${tzs.map((t) => `<option ${t === ev.timezone ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>
    <label>Cupo <span class="muted">(vacío = sin límite)</span><input name="capacity" type="number" min="1" value="${esc(ev.capacity ?? "")}"></label>
  </div>
  <fieldset id="f-presencial" class="grid">
    <label>Lugar<input name="venue_name" maxlength="140" value="${esc(ev.venue_name)}" placeholder="Salón Los Arcos"></label>
    <label>Enlace de Google Maps<input name="maps_url" type="url" value="${esc(ev.maps_url)}" placeholder="https://maps.app.goo.gl/…"></label>
    <label class="full">Dirección<input name="address" maxlength="300" value="${esc(ev.address)}"></label>
  </fieldset>
  <fieldset id="f-online" class="grid">
    <label class="full">Enlace de Zoom / Google Meet<input name="meeting_url" type="url" value="${esc(ev.meeting_url)}" placeholder="https://zoom.us/j/… o https://meet.google.com/…"></label>
    <label class="full">Datos de acceso <span class="muted">(ID, código — solo los ven los registrados)</span><input name="meeting_info" maxlength="500" value="${esc(ev.meeting_info)}"></label>
  </fieldset>
  <label>Descripción<textarea name="description" maxlength="5000">${esc(ev.description)}</textarea></label>
  <div class="grid">
    <label>Imagen de portada (URL)<input name="cover_url" type="url" value="${esc(ev.cover_url)}" placeholder="https://…"></label>
    <label>Dirección web <span class="muted">(/e/…)</span><input name="slug" maxlength="60" value="${esc(ev.slug)}" placeholder="se genera del título"></label>
  </div>
  ${id && ev.registered ? '<p class="small muted">Si cambias la fecha, los registrados recibirán de nuevo los recordatorios con la hora nueva.</p>' : ""}
  <button class="btn">${id ? "Guardar cambios" : "Crear evento"}</button>
  <p class="msg"></p>
  ${id ? '<p class="small center"><button type="button" class="link" id="del">Eliminar evento</button></p>' : ""}
</form>`;
    const f = document.getElementById("evf");
    const sync = () => {
      const online = f.mode.value === "online";
      document.getElementById("f-online").hidden = !online;
      document.getElementById("f-presencial").hidden = online;
    };
    f.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener("change", sync));
    sync();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const msg = f.querySelector(".msg");
      const btn = f.querySelector("button.btn");
      msg.textContent = "";
      btn.disabled = true;
      try {
        const body = Object.fromEntries(new FormData(f));
        const { event } = await api(id ? `/api/events/${id}` : "/api/events", { method: id ? "PUT" : "POST", body });
        location.hash = `#/event/${event.id}`;
      } catch (err) { msg.textContent = err.message; btn.disabled = false; }
    };
    const del = document.getElementById("del");
    if (del) del.onclick = async () => {
      if (!confirm(`¿Eliminar "${ev.title}" y sus ${ev.registered} registros? No se puede deshacer.`)) return;
      await api(`/api/events/${id}`, { method: "DELETE" });
      location.hash = "#/";
    };
  }

  // ─── Detalle / registrados ──────────────────────────────
  async function viewEvent(id) {
    const [{ event: ev }, { registrations: regs }] = await Promise.all([api(`/api/events/${id}`), api(`/api/events/${id}/registrations`)]);
    const presencial = ev.mode === "presencial";
    app.innerHTML = `
<div class="head"><h1>${esc(ev.title)}</h1><a href="#/" class="small">← Mis eventos</a></div>
<section class="card ev">
  <div class="meta">${esc(fmt(ev.start_at, ev.timezone))} · ${presencial ? "Presencial" : "En línea"} · ${esc(brandName(ev.brand))} · ${STATUS[ev.status]}</div>
  <div class="copy">${esc(publicUrl(ev))}</div>
  <div class="stats"><span><b>${ev.registered}</b>${ev.capacity ? ` / ${ev.capacity}` : ""} registrados</span>
    ${presencial ? `<span><b id="cin">${ev.checked_in}</b> con check-in</span>` : `<span><b>${ev.joined}</b> se unieron</span>`}</div>
  <div class="btns">
    <button class="btn sm" data-copy="${esc(publicUrl(ev))}">Copiar enlace</button>
    ${presencial ? `<a class="btn sm" href="/admin/checkin.html#${ev.id}">Abrir escáner QR</a>` : ""}
    <a class="btn sm ghost" href="#/edit/${ev.id}">Editar</a>
    <button class="btn sm ghost" id="csv">Descargar CSV</button>
  </div>
</section>
<section class="card">
  <input class="search" id="q" placeholder="Buscar por nombre o correo…">
  <div class="tablewrap"><table class="table"><thead><tr><th>Nombre</th><th>Contacto</th><th>Registro</th><th>${presencial ? "Check-in" : "Se unió"}</th></tr></thead><tbody id="rows"></tbody></table></div>
</section>`;
    const tbody = document.getElementById("rows");
    const render = (q = "") => {
      const ql = q.toLowerCase();
      const list = regs.filter((r) => !ql || r.name.toLowerCase().includes(ql) || r.email.includes(ql));
      tbody.innerHTML = list.map((r) => `<tr>
  <td>${esc(r.name)}</td>
  <td>${esc(r.email)}${r.phone ? `<br><span class="muted">${esc(r.phone)}</span>` : ""}</td>
  <td class="muted">${esc(fmtShort(r.created_at))}</td>
  <td>${presencial
    ? (r.checked_in_at ? `<span class="ok-txt">✓ ${esc(fmtShort(r.checked_in_at))}</span> <button class="link small" data-undo="${r.id}">deshacer</button>` : `<button class="btn sm" data-in="${r.id}">Check-in</button>`)
    : (r.joined_at ? `<span class="ok-txt">✓ ${esc(fmtShort(r.joined_at))}</span>` : '<span class="muted">—</span>')}</td>
</tr>`).join("") || `<tr><td colspan="4" class="muted center">Sin registros${q ? " con esa búsqueda" : " todavía"}.</td></tr>`;
    };
    render();
    document.getElementById("q").oninput = (e) => render(e.target.value);
    tbody.onclick = async (e) => {
      const idIn = e.target.dataset.in, idUndo = e.target.dataset.undo;
      if (!idIn && !idUndo) return;
      e.target.disabled = true;
      try {
        const res = await api("/api/checkin", { method: "POST", body: { event_id: ev.id, registration_id: idIn || idUndo, undo: !!idUndo } });
        const r = regs.find((x) => x.id === (idIn || idUndo));
        r.checked_in_at = res.undone ? null : res.checked_in_at;
        document.getElementById("cin").textContent = regs.filter((x) => x.checked_in_at).length;
        render(document.getElementById("q").value);
      } catch (err) { alert(err.message); e.target.disabled = false; }
    };
    document.getElementById("csv").onclick = () => {
      const head = ["nombre", "correo", "whatsapp", "registro", presencial ? "check_in" : "se_unio"];
      const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = [head, ...regs.map((r) => [r.name, r.email, r.phone, r.created_at, presencial ? r.checked_in_at : r.joined_at])].map((l) => l.map(cell).join(","));
      const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `registrados-${ev.slug}.csv`;
      a.click();
    };
  }

  // Copiar enlace (delegado)
  app.addEventListener("click", async (e) => {
    const url = e.target.dataset && e.target.dataset.copy;
    if (!url) return;
    try { await navigator.clipboard.writeText(url); e.target.textContent = "¡Copiado!"; }
    catch { prompt("Copia el enlace:", url); }
  });

  logoutBtn.onclick = async () => {
    try { await api("/api/auth/logout", { method: "POST" }); } catch {}
    store.set(""); me = null; location.hash = "#/"; route();
  };

  async function route() {
    if (!me) return viewAuth();
    logoutBtn.hidden = false;
    const [, view, id] = location.hash.replace(/^#/, "").split("/");
    try {
      if (view === "new") await viewForm();
      else if (view === "edit" && id) await viewForm(id);
      else if (view === "event" && id) await viewEvent(id);
      else await viewList();
      window.scrollTo(0, 0);
    } catch (err) {
      app.innerHTML = `<section class="card"><p class="msg">${esc(err.message)}</p><a href="#/">Volver</a></section>`;
    }
  }

  window.addEventListener("hashchange", route);
  loadMe().then(route);
})();
