// GET / PUT / DELETE /api/events/:id — solo eventos del organizador de la sesión.
import { json, err, readJson, nowIso } from "../../_lib/util.js";
import { currentOrganizer, ownedEvent } from "../../_lib/auth.js";
import { parseEventInput, uniqueSlug, adminEvent } from "../../_lib/events.js";

async function load(request, env, id) {
  const org = await currentOrganizer(request, env);
  if (!org) return { res: err("No autorizado", 401) };
  const ev = await ownedEvent(env, org.id, id);
  if (!ev) return { res: err("Evento no encontrado", 404) };
  return { org, ev };
}

export async function onRequestGet({ request, env, params }) {
  const { res, ev } = await load(request, env, params.id);
  if (res) return res;
  const counts = await env.DB.prepare(
    `SELECT COUNT(*) AS registered, COUNT(checked_in_at) AS checked_in, COUNT(joined_at) AS joined
     FROM registrations WHERE event_id = ?`
  ).bind(ev.id).first();
  return json({ event: adminEvent(ev, counts) });
}

export async function onRequestPut({ request, env, params }) {
  const { res, ev } = await load(request, env, params.id);
  if (res) return res;
  const { data, error } = parseEventInput(await readJson(request));
  if (error) return err(error);
  const slug = data.slug && data.slug !== ev.slug ? await uniqueSlug(env, data.slug, data.title, ev.id) : ev.slug;
  const timeChanged = data.start_at !== ev.start_at || data.end_at !== ev.end_at;
  await env.DB.prepare(
    `UPDATE events SET brand=?, slug=?, title=?, description=?, mode=?, venue_name=?, address=?, maps_url=?,
       meeting_url=?, meeting_info=?, start_at=?, end_at=?, timezone=?, capacity=?, cover_url=?, status=?,
       sequence = sequence + ?, updated_at=? WHERE id=?`
  ).bind(data.brand, slug, data.title, data.description, data.mode, data.venue_name, data.address, data.maps_url,
    data.meeting_url, data.meeting_info, data.start_at, data.end_at, data.timezone, data.capacity, data.cover_url,
    data.status, timeChanged ? 1 : 0, nowIso(), ev.id).run();
  if (timeChanged) {
    // Nueva fecha: los recordatorios vuelven a salir según la hora nueva.
    await env.DB.prepare("UPDATE registrations SET reminded_24h = 0, reminded_1h = 0 WHERE event_id = ?").bind(ev.id).run();
  }
  const updated = await env.DB.prepare("SELECT * FROM events WHERE id = ?").bind(ev.id).first();
  return json({ event: adminEvent(updated) });
}

export async function onRequestDelete({ request, env, params }) {
  const { res, ev } = await load(request, env, params.id);
  if (res) return res;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM registrations WHERE event_id = ?").bind(ev.id),
    env.DB.prepare("DELETE FROM events WHERE id = ?").bind(ev.id),
  ]);
  return json({ ok: true });
}
