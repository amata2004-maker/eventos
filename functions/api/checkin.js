// POST /api/checkin  { event_id, token | registration_id, undo? }
// Check-in en la entrada (escáner QR o lista manual). Solo el dueño del evento.
import { json, err, readJson, nowIso, clip } from "../_lib/util.js";
import { currentOrganizer, ownedEvent } from "../_lib/auth.js";

// Acepta el token solo o la URL completa del QR (https://…/t/<token>).
function tokenFrom(raw) {
  const s = clip(raw, 300);
  const m = /\/t\/([A-Za-z0-9_-]{10,64})/.exec(s);
  return m ? m[1] : s;
}

export async function onRequestPost({ request, env }) {
  const org = await currentOrganizer(request, env);
  if (!org) return err("No autorizado", 401);
  const b = (await readJson(request)) || {};
  const ev = await ownedEvent(env, org.id, clip(b.event_id, 64));
  if (!ev) return err("Evento no encontrado", 404);

  const reg = b.registration_id
    ? await env.DB.prepare("SELECT * FROM registrations WHERE id = ? AND event_id = ?").bind(clip(b.registration_id, 64), ev.id).first()
    : await env.DB.prepare("SELECT * FROM registrations WHERE token = ?").bind(tokenFrom(b.token)).first();
  if (!reg) return err("QR no reconocido", 404);
  if (reg.event_id !== ev.id) return err("Este pase es de otro evento", 409);

  const who = { id: reg.id, name: reg.name, email: reg.email };
  if (b.undo) {
    await env.DB.prepare("UPDATE registrations SET checked_in_at = NULL WHERE id = ?").bind(reg.id).run();
    return json({ ok: true, undone: true, registration: who });
  }
  if (reg.checked_in_at) return json({ ok: true, already: true, checked_in_at: reg.checked_in_at, registration: who });
  const at = nowIso();
  await env.DB.prepare("UPDATE registrations SET checked_in_at = ? WHERE id = ?").bind(at, reg.id).run();
  return json({ ok: true, checked_in_at: at, registration: who });
}
