// POST /api/register  { slug, name, email, phone, website(honeypot) }
// Registro público a un evento. Envía confirmación con .ics y QR.
import { json, err, readJson, randomId, nowIso, isEmail, clip, ipHash, origin } from "../_lib/util.js";
import { confirmationEmail, sendEmail } from "../_lib/email.js";

const MAX_PER_IP_HOUR = 10;

export async function onRequestPost(context) {
  const { request, env } = context;
  const b = (await readJson(request)) || {};
  if (b.website) return json({ ok: true }); // honeypot: bots llenan este campo oculto

  const name = clip(b.name, 100);
  const email = clip(b.email, 254).toLowerCase();
  const phone = clip(b.phone, 30).replace(/[^\d+\s()-]/g, "");
  if (!name) return err("Escribe tu nombre");
  if (!isEmail(email)) return err("Escribe un correo válido");

  const ev = await env.DB.prepare("SELECT * FROM events WHERE slug = ? AND status = 'published'").bind(clip(b.slug, 80)).first();
  if (!ev) return err("Evento no disponible", 404);
  const now = nowIso();
  if (ev.end_at <= now) return err("Este evento ya terminó");

  const ih = await ipHash(request, env);
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM registrations WHERE ip_hash = ? AND created_at > ?")
    .bind(ih, new Date(Date.now() - 3600e3).toISOString()).first();
  if (recent.n >= MAX_PER_IP_HOUR) return err("Demasiados registros desde esta conexión. Intenta más tarde.", 429);

  const org = await env.DB.prepare("SELECT email, name FROM organizers WHERE id = ?").bind(ev.organizer_id).first();
  const base = origin(request);

  const existing = await env.DB.prepare("SELECT * FROM registrations WHERE event_id = ? AND email = ?").bind(ev.id, email).first();
  if (existing) {
    // No devolvemos el token: solo el dueño del correo puede ver su boleto.
    context.waitUntil(sendEmail(env, confirmationEmail(env, ev, existing, org, base)).catch((e) => console.error(e)));
    return json({ ok: true, existing: true });
  }

  if (ev.capacity) {
    const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM registrations WHERE event_id = ?").bind(ev.id).first();
    if (c.n >= ev.capacity) return err("Cupo lleno. ¡Gracias por tu interés!", 409);
  }

  // Si ya estamos dentro de la ventana de un recordatorio, la confirmación lo sustituye.
  const msToStart = Date.parse(ev.start_at) - Date.now();
  const reg = {
    id: randomId(), token: randomId(), event_id: ev.id, name, email, phone, ip_hash: ih, created_at: now,
    reminded_24h: msToStart <= 24 * 3600e3 ? 1 : 0,
    reminded_1h: msToStart <= 3600e3 ? 1 : 0,
  };
  try {
    await env.DB.prepare(
      `INSERT INTO registrations (id, event_id, token, name, email, phone, ip_hash, created_at, reminded_24h, reminded_1h)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(reg.id, reg.event_id, reg.token, name, email, phone, ih, now, reg.reminded_24h, reg.reminded_1h).run();
  } catch (e) {
    if (String(e).includes("UNIQUE")) return json({ ok: true, existing: true }); // doble clic
    throw e;
  }

  context.waitUntil(sendEmail(env, confirmationEmail(env, ev, reg, org, base)).catch((e) => console.error("confirmación", e)));
  return json({ ok: true, ticket_url: `/t/${reg.token}` }, 201);
}
