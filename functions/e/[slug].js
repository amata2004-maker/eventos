// Página pública del evento con formulario de registro: /e/<slug>
import { escapeHtml, richText, nowIso, origin } from "../_lib/util.js";
import { getBrand } from "../_lib/brands.js";
import { fmtDate, fmtTime, tzLabel } from "../_lib/time.js";
import { page } from "../_lib/page.js";

export async function onRequestGet({ request, env, params }) {
  const ev = await env.DB.prepare("SELECT * FROM events WHERE slug = ? AND status != 'draft'").bind(params.slug).first();
  if (!ev) {
    return page({ brand: getBrand(), title: "Evento no encontrado", status: 404,
      body: `<section class="card"><h1>Evento no encontrado</h1><p>Revisa el enlace o pregunta a quien te invitó.</p></section>` });
  }
  const brand = getBrand(ev.brand);
  const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM registrations WHERE event_id = ?").bind(ev.id).first();
  const left = ev.capacity ? Math.max(0, ev.capacity - c.n) : null;
  const ended = ev.end_at <= nowIso();

  let formHtml;
  if (ev.status === "cancelled") formHtml = `<div class="notice bad">Este evento fue cancelado.</div>`;
  else if (ended) formHtml = `<div class="notice">Este evento ya terminó. ¡Gracias a quienes asistieron!</div>`;
  else if (left === 0) formHtml = `<div class="notice">Cupo lleno. ¡Gracias por tu interés!</div>`;
  else formHtml = `
<form id="reg" class="form" data-slug="${escapeHtml(ev.slug)}" novalidate>
  <h2>Reserva tu lugar</h2>
  <label>Nombre completo<input name="name" required maxlength="100" autocomplete="name"></label>
  <label>Correo electrónico<input name="email" type="email" required maxlength="254" autocomplete="email"></label>
  <label>WhatsApp <span class="muted">(opcional)</span><input name="phone" type="tel" maxlength="30" autocomplete="tel"></label>
  <input name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
  <button type="submit" class="btn">Registrarme gratis</button>
  <p class="muted small">Te enviaremos tu ${ev.mode === "online" ? "enlace de acceso" : "pase con código QR"} y la invitación para tu calendario.</p>
  <p class="msg" role="status"></p>
</form>
<div id="done" class="notice ok" hidden></div>`;

  const where = ev.mode === "online"
    ? `<div class="row"><span class="ic">💻</span><div><strong>En línea</strong><div class="muted">El enlace de acceso llega a tu correo al registrarte.</div></div></div>`
    : `<div class="row"><span class="ic">📍</span><div><strong>${escapeHtml(ev.venue_name || "Lugar")}</strong>
       <div class="muted">${escapeHtml(ev.address)}</div>
       ${ev.maps_url ? `<a href="${escapeHtml(ev.maps_url)}" target="_blank" rel="noopener">Ver en el mapa →</a>` : ""}</div></div>`;

  const body = `
${ev.cover_url ? `<img class="cover" src="${escapeHtml(ev.cover_url)}" alt="">` : ""}
<section class="card">
  <span class="badge">${ev.mode === "online" ? "Evento en línea" : "Evento presencial"}</span>
  <h1>${escapeHtml(ev.title)}</h1>
  <div class="row"><span class="ic">🗓️</span><div><strong>${escapeHtml(fmtDate(ev.start_at, ev.timezone))}</strong>
    <div class="muted">${escapeHtml(fmtTime(ev.start_at, ev.timezone))} – ${escapeHtml(fmtTime(ev.end_at, ev.timezone))} · hora de ${escapeHtml(tzLabel(ev.start_at, ev.timezone))}</div></div></div>
  ${where}
  ${left !== null && left > 0 && !ended ? `<div class="row"><span class="ic">🎟️</span><div>Quedan <strong>${left}</strong> lugares</div></div>` : ""}
  ${ev.description ? `<div class="desc">${richText(ev.description)}</div>` : ""}
</section>
<section class="card">${formHtml}</section>`;

  return page({
    brand, body,
    title: ev.title,
    description: `${fmtDate(ev.start_at, ev.timezone)} · ${ev.description || brand.tagline}`,
    image: ev.cover_url.startsWith("/") ? `${origin(request)}${ev.cover_url}` : ev.cover_url, // og:image debe ser absoluta
    url: `${origin(request)}/e/${ev.slug}`,
    scripts: ["/assets/register.js"],
  });
}
