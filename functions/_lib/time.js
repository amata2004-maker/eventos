// Zonas horarias sin librerías: Intl hace la conversión.
// En la base todo va en UTC; el formulario de admin trabaja en hora local del evento.

const PARTS_FMT = {};
function partsIn(ts, tz) {
  const f = (PARTS_FMT[tz] ||= new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }));
  return Object.fromEntries(f.formatToParts(new Date(ts)).map((p) => [p.type, p.value]));
}

function offsetMs(ts, tz) {
  const p = partsIn(ts, tz);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(ts / 1000) * 1000;
}

export function isValidTz(tz) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

// "2026-10-03T19:00" en tz → ISO UTC. null si el formato es inválido.
export function localToUtcIso(local, tz) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local || "");
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let ts = guess - offsetMs(guess, tz);
  ts = guess - offsetMs(ts, tz); // segunda pasada por si cae en cambio de horario
  return new Date(ts).toISOString();
}

// ISO UTC → "2026-10-03T19:00" en tz (para <input type="datetime-local">).
export function utcToLocalInput(iso, tz) {
  const p = partsIn(Date.parse(iso), tz);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function fmtDate(iso, tz) {
  const s = new Intl.DateTimeFormat("es-MX", {
    timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtTime(iso, tz) {
  return new Intl.DateTimeFormat("es-MX", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function tzLabel(iso, tz) {
  const p = new Intl.DateTimeFormat("es-MX", { timeZone: tz, timeZoneName: "short" })
    .formatToParts(new Date(iso)).find((x) => x.type === "timeZoneName");
  const city = tz.split("/").pop().replace(/_/g, " ");
  return `${city} (${p ? p.value : tz})`;
}

// "Sábado 3 de octubre de 2026 · 7:00 p.m. – 9:00 p.m. · Mexico City (GMT-6)"
export function fmtWhen(ev) {
  return `${fmtDate(ev.start_at, ev.timezone)} · ${fmtTime(ev.start_at, ev.timezone)} – ${fmtTime(ev.end_at, ev.timezone)} · hora de ${tzLabel(ev.start_at, ev.timezone)}`;
}
