// Validación y serialización de eventos (compartido por las APIs de admin).
import { BRAND_KEYS } from "./brands.js";
import { clip, isHttpsUrl, slugify, randomId } from "./util.js";
import { isValidTz, localToUtcIso, utcToLocalInput } from "./time.js";

const STATUSES = ["draft", "published", "cancelled"];

// Devuelve { data } o { error }. `b` viene del formulario de admin.
export function parseEventInput(b) {
  if (!b || typeof b !== "object") return { error: "Datos inválidos" };
  const title = clip(b.title, 140);
  if (!title) return { error: "El título es obligatorio" };

  const brand = BRAND_KEYS.includes(b.brand) ? b.brand : null;
  if (!brand) return { error: "Marca inválida" };

  const mode = b.mode === "online" ? "online" : b.mode === "presencial" ? "presencial" : null;
  if (!mode) return { error: "Modalidad inválida" };

  const timezone = clip(b.timezone, 64) || "America/Mexico_City";
  if (!isValidTz(timezone)) return { error: "Zona horaria inválida" };

  const start_at = localToUtcIso(b.start_local, timezone);
  if (!start_at) return { error: "Fecha/hora de inicio inválida" };
  let end_at = b.end_local ? localToUtcIso(b.end_local, timezone) : null;
  if (b.end_local && !end_at) return { error: "Fecha/hora de fin inválida" };
  if (!end_at) end_at = new Date(Date.parse(start_at) + 2 * 3600e3).toISOString();
  if (end_at <= start_at) return { error: "El fin debe ser después del inicio" };

  const meeting_url = clip(b.meeting_url, 500);
  const maps_url = clip(b.maps_url, 500);
  const cover_url = clip(b.cover_url, 500);
  for (const [k, v] of [["enlace de la reunión", meeting_url], ["enlace del mapa", maps_url], ["imagen de portada", cover_url]]) {
    if (v && !isHttpsUrl(v)) return { error: `El ${k} debe empezar con https://` };
  }
  if (mode === "online" && !meeting_url) return { error: "Para un evento en línea agrega el enlace de Zoom/Meet" };
  const venue_name = clip(b.venue_name, 140);
  const address = clip(b.address, 300);
  if (mode === "presencial" && !venue_name && !address) return { error: "Para un evento presencial agrega el lugar o la dirección" };

  let capacity = null;
  if (b.capacity !== "" && b.capacity != null) {
    capacity = parseInt(b.capacity, 10);
    if (!(capacity > 0 && capacity <= 100000)) return { error: "Cupo inválido" };
  }

  const status = STATUSES.includes(b.status) ? b.status : "published";
  const slug = slugify(b.slug || "");

  return {
    data: {
      title, brand, mode, timezone, start_at, end_at, capacity, status, slug,
      description: clip(b.description, 5000),
      venue_name, address, maps_url, cover_url,
      meeting_url: mode === "online" ? meeting_url : "",
      meeting_info: mode === "online" ? clip(b.meeting_info, 500) : "",
    },
  };
}

export async function uniqueSlug(env, wanted, title, excludeId = "") {
  const base = wanted || slugify(title) || "evento";
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const hit = await env.DB.prepare("SELECT id FROM events WHERE slug = ? AND id != ?").bind(slug, excludeId).first();
    if (!hit) return slug;
    slug = `${base.slice(0, 54)}-${randomId(3).toLowerCase().replace(/[^a-z0-9]/g, "x")}`;
  }
  return `${base.slice(0, 50)}-${Date.now().toString(36)}`;
}

export function adminEvent(ev, counts = {}) {
  return {
    ...ev,
    start_local: utcToLocalInput(ev.start_at, ev.timezone),
    end_local: utcToLocalInput(ev.end_at, ev.timezone),
    registered: counts.registered ?? 0,
    checked_in: counts.checked_in ?? 0,
    joined: counts.joined ?? 0,
  };
}
