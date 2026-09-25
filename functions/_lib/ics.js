// Invitación de calendario (.ics, RFC 5545) y enlace a Google Calendar.

const icsDate = (iso) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const esc = (s) => String(s ?? "")
  .replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Pliega líneas a 75 octetos sin partir caracteres UTF-8.
function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = "", bytes = 0, limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) { out.push(cur); cur = ""; bytes = 0; limit = 74; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function eventLocation(ev, ticketUrl) {
  if (ev.mode === "online") return `En línea · enlace en tu boleto: ${ticketUrl}`;
  return [ev.venue_name, ev.address].filter(Boolean).join(", ");
}

export function buildIcs(ev, reg, { ticketUrl, joinUrl, brand, host }) {
  const lines = [
    `Consulta tu boleto: ${ticketUrl}`,
    ev.mode === "online" && joinUrl ? `Unirte a la sesión: ${joinUrl}` : "",
    ev.meeting_info && ev.mode === "online" ? ev.meeting_info : "",
    ev.mode === "presencial" && ev.maps_url ? `Mapa: ${ev.maps_url}` : "",
    "",
    ev.description || "",
  ].filter((x, i) => x || i === 4);
  const status = ev.status === "cancelled" ? "CANCELLED" : "CONFIRMED";
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${brand.name}//Eventos//ES`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${reg.token}@${host}`,
    `SEQUENCE:${ev.sequence || 0}`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(ev.start_at)}`,
    `DTEND:${icsDate(ev.end_at)}`,
    `SUMMARY:${esc(ev.title)}`,
    `DESCRIPTION:${esc(lines.join("\n"))}`,
    `LOCATION:${esc(eventLocation(ev, ticketUrl))}`,
    `URL:${ticketUrl}`,
    `STATUS:${status}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(ev.title)}`,
    "TRIGGER:-PT1H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return body.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(ev, ticketUrl) {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${icsDate(ev.start_at)}/${icsDate(ev.end_at)}`,
    details: `Tu boleto: ${ticketUrl}`,
    location: eventLocation(ev, ticketUrl),
    ctz: ev.timezone,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

// base64 de un string UTF-8 (para adjuntos de Resend).
export function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
