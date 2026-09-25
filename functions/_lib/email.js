// Correos transaccionales vía Resend: confirmación (con .ics y QR) y recordatorios.
import { getBrand } from "./brands.js";
import { escapeHtml, richText } from "./util.js";
import { fmtWhen } from "./time.js";
import { buildIcs, googleCalendarUrl, toBase64 } from "./ics.js";
import { qrEmailTable } from "./qr.js";

// Remitente por marca: MAIL_FROM_MYACTIF / MAIL_FROM_AMWAY o, si no existe, MAIL_FROM.
// Valor = solo la dirección (ej. eventos@myactif.com); el nombre visible sale de la marca.
function fromFor(env, brand) {
  const addr = env[`MAIL_FROM_${brand.key.toUpperCase()}`] || env.MAIL_FROM;
  if (!addr) throw new Error("MAIL_FROM no configurado");
  return `${brand.sender} <${addr}>`;
}

export function links(origin, reg) {
  return {
    ticketUrl: `${origin}/t/${reg.token}`,
    joinUrl: `${origin}/j/${reg.token}`,
    icsUrl: `${origin}/ics/${reg.token}`,
  };
}

async function resend(env, path, payload) {
  const r = await fetch(`${env.RESEND_API_URL || "https://api.resend.com"}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return r.json();
}

function button(href, label, bg, color = "#ffffff") {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${bg};color:${color};border:2px solid ${color === "#ffffff" ? bg : color};text-decoration:none;font-size:15px;font-weight:700;padding:13px 26px;border-radius:999px;margin:4px 2px;">${label}</a>`;
}

function layout(brand, inner) {
  return `<!DOCTYPE html><html lang="es"><body style="margin:0;padding:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="background:${brand.dark};padding:18px 28px;color:#ffffff;font-size:14px;font-weight:700;letter-spacing:.3px;">${escapeHtml(brand.tagline)}</td></tr>
<tr><td style="padding:28px 28px 8px;color:#222;font-size:15px;line-height:1.6;">${inner}</td></tr>
<tr><td style="padding:18px 28px 26px;color:#888;font-size:12px;line-height:1.5;text-align:center;">${escapeHtml(brand.footer)}<br>Recibes este correo porque te registraste a este evento.</td></tr>
</table></td></tr></table></body></html>`;
}

function eventBlock(ev, brand) {
  const where = ev.mode === "online"
    ? "💻 En línea"
    : `📍 ${escapeHtml([ev.venue_name, ev.address].filter(Boolean).join(", "))}${ev.maps_url ? ` · <a href="${escapeHtml(ev.maps_url)}" style="color:${brand.primary};">Ver mapa</a>` : ""}`;
  return `<div style="background:${brand.soft};border-radius:12px;padding:16px 18px;margin:16px 0;">
  <div style="font-size:18px;font-weight:800;color:${brand.dark};margin-bottom:6px;">${escapeHtml(ev.title)}</div>
  <div>🗓️ ${escapeHtml(fmtWhen(ev))}</div>
  <div>${where}</div>
</div>`;
}

function onlineBlock(ev, l, brand) {
  if (ev.mode !== "online") return "";
  return `<p style="text-align:center;margin:18px 0 6px;">${button(l.joinUrl, "Unirme a la sesión", brand.primary)}</p>
${ev.meeting_info ? `<p style="text-align:center;color:#555;font-size:13px;margin:0;">${richText(ev.meeting_info)}</p>` : ""}`;
}

function qrBlock(ev, l) {
  if (ev.mode !== "presencial") return "";
  return `<p style="text-align:center;margin:18px 0 6px;font-weight:700;">Tu pase de entrada</p>
${qrEmailTable(l.ticketUrl)}
<p style="text-align:center;color:#666;font-size:13px;margin:8px 0 0;">Muéstralo en la entrada para tu check-in.</p>`;
}

export function confirmationEmail(env, ev, reg, org, origin) {
  const brand = getBrand(ev.brand);
  const l = links(origin, reg);
  const host = new URL(origin).host;
  const first = escapeHtml(reg.name.split(" ")[0]);
  const html = layout(brand, `
<p style="margin:0 0 6px;">Hola ${first},</p>
<p style="margin:0;">¡Tu lugar está confirmado! 🎉</p>
${eventBlock(ev, brand)}
${qrBlock(ev, l)}
${onlineBlock(ev, l, brand)}
<p style="text-align:center;margin:20px 0 0;">
  ${button(l.ticketUrl, "Ver mi boleto", brand.dark)}
  ${button(googleCalendarUrl(ev, l.ticketUrl), "Agregar a Google Calendar", "#ffffff", brand.dark)}
</p>
<p style="color:#666;font-size:13px;margin:18px 0 0;">Adjuntamos la invitación (.ics) para Apple Calendar u Outlook. Te enviaremos un recordatorio 24 horas y 1 hora antes.</p>`);
  return {
    from: fromFor(env, brand),
    to: [reg.email],
    reply_to: org?.email || undefined,
    subject: `Confirmado: ${ev.title}`,
    html,
    attachments: [{ filename: "evento.ics", content: toBase64(buildIcs(ev, reg, { ...l, brand, host })), content_type: "text/calendar; charset=utf-8; method=PUBLISH" }],
  };
}

export function reminderEmail(env, ev, reg, kind, origin) {
  const brand = getBrand(ev.brand);
  const l = links(origin, reg);
  const first = escapeHtml(reg.name.split(" ")[0]);
  const soon = kind === "1h";
  const html = layout(brand, `
<p style="margin:0 0 6px;">Hola ${first},</p>
<p style="margin:0;">${soon ? "Empezamos <strong>en 1 hora</strong>. ¡Te esperamos!" : "Te recordamos que <strong>mañana</strong> es el evento."}</p>
${eventBlock(ev, brand)}
${onlineBlock(ev, l, brand)}
<p style="text-align:center;margin:20px 0 0;">${button(l.ticketUrl, ev.mode === "presencial" ? "Ver mi pase (QR)" : "Ver mi boleto", brand.dark)}</p>`);
  return {
    from: fromFor(env, brand),
    to: [reg.email],
    subject: soon ? `En 1 hora: ${ev.title}` : `Mañana: ${ev.title}`,
    html,
  };
}

export const sendEmail = (env, payload) => resend(env, "/emails", payload);

// Hasta 100 correos por llamada — un solo subrequest (límite de 50 en plan free).
export const sendBatch = (env, payloads) => resend(env, "/emails/batch", payloads);
