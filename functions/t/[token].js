// Boleto del asistente: /t/<token>. Muestra QR (presencial) o botón para unirse (online).
// El token es el secreto: quien lo tiene ve el boleto; por eso nunca se lista en páginas públicas.
import { escapeHtml, richText, origin } from "../_lib/util.js";
import { getBrand } from "../_lib/brands.js";
import { fmtDate, fmtTime, tzLabel } from "../_lib/time.js";
import { googleCalendarUrl } from "../_lib/ics.js";
import { qrSvg } from "../_lib/qr.js";
import { page } from "../_lib/page.js";

export async function onRequestGet({ request, env, params }) {
  const row = await env.DB.prepare(
    `SELECT r.token, r.name, r.email AS reg_email, r.phone AS reg_phone, r.checked_in_at, e.* FROM registrations r JOIN events e ON e.id = r.event_id WHERE r.token = ?`
  ).bind(params.token).first();
  if (!row) {
    return page({ brand: getBrand(), title: "Boleto no encontrado", status: 404,
      body: `<section class="card"><h1>Boleto no encontrado</h1><p>Revisa el enlace de tu correo de confirmación.</p></section>` });
  }
  const brand = getBrand(row.brand);
  const base = origin(request);
  const ticketUrl = `${base}/t/${row.token}`;

  const main = row.status === "cancelled"
    ? `<div class="notice bad">Este evento fue cancelado.</div>`
    : row.mode === "online"
      ? `<a class="btn big" href="/j/${escapeHtml(row.token)}">Unirme a la sesión</a>
         ${row.meeting_info ? `<p class="muted center">${richText(row.meeting_info)}</p>` : ""}`
      : `<div class="qr">${qrSvg(ticketUrl)}</div>
         <p class="center"><strong>${escapeHtml(row.name)}</strong></p>
         <p class="center muted">${row.checked_in_at ? "✅ Check-in registrado" : "Muestra este código en la entrada"}</p>`;

  const where = row.mode === "online" ? "💻 En línea"
    : `📍 ${escapeHtml([row.venue_name, row.address].filter(Boolean).join(", "))}${row.maps_url ? ` · <a href="${escapeHtml(row.maps_url)}" target="_blank" rel="noopener">Mapa</a>` : ""}`;

  const body = `
<section class="card ticket">
  <span class="badge">Tu boleto</span>
  <h1>${escapeHtml(row.title)}</h1>
  <div class="guest">
    <div class="muted small">Registro a nombre de</div>
    <strong>${escapeHtml(row.name)}</strong>
    <div class="muted small">${escapeHtml(row.reg_email)}${row.reg_phone ? ` · ${escapeHtml(row.reg_phone)}` : ""}</div>
  </div>
  <p>🗓️ ${escapeHtml(fmtDate(row.start_at, row.timezone))}<br>
     <span class="muted">${escapeHtml(fmtTime(row.start_at, row.timezone))} – ${escapeHtml(fmtTime(row.end_at, row.timezone))} · hora de ${escapeHtml(tzLabel(row.start_at, row.timezone))}</span></p>
  <p>${where}</p>
  ${main}
  <div class="actions">
    <a class="btn ghost" href="${escapeHtml(googleCalendarUrl(row, ticketUrl))}" target="_blank" rel="noopener">Google Calendar</a>
    <a class="btn ghost" href="/ics/${escapeHtml(row.token)}">Apple / Outlook (.ics)</a>
    <a class="btn ghost" href="/e/${escapeHtml(row.slug)}">Ver evento</a>
  </div>
</section>`;

  const res = page({ brand, body, title: `Boleto · ${row.title}` });
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}
