// POST /api/images — sube una portada (cuerpo binario, Content-Type image/*).
// El navegador ya la redujo; aquí solo validamos tipo, tamaño y cuota.
import { json, err, randomId, nowIso } from "../_lib/util.js";
import { currentOrganizer } from "../_lib/auth.js";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 1.5 * 1024 * 1024;
const MAX_PER_DAY = 50;

export async function onRequestPost({ request, env }) {
  const org = await currentOrganizer(request, env);
  if (!org) return err("No autorizado", 401);
  const mime = (request.headers.get("Content-Type") || "").split(";")[0].trim();
  if (!TYPES.includes(mime)) return err("Formato no soportado (usa JPG, PNG o WebP)");
  const buf = await request.arrayBuffer();
  if (!buf.byteLength) return err("Imagen vacía");
  if (buf.byteLength > MAX_BYTES) return err("La imagen pesa demasiado (máx. 1.5 MB)");

  const since = new Date(Date.now() - 864e5).toISOString();
  const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM images WHERE organizer_id = ? AND created_at > ?").bind(org.id, since).first();
  if (c.n >= MAX_PER_DAY) return err("Límite de imágenes por día alcanzado", 429);

  const id = randomId(12);
  await env.DB.prepare("INSERT INTO images (id, organizer_id, mime, size, data, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, org.id, mime, buf.byteLength, buf, nowIso()).run();
  return json({ url: `/img/${id}` }, 201);
}
