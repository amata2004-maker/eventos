// GET  /api/events  → eventos del organizador con conteos
// POST /api/events  → crear evento
import { json, err, readJson, randomId, nowIso } from "../../_lib/util.js";
import { currentOrganizer } from "../../_lib/auth.js";
import { parseEventInput, uniqueSlug, adminEvent } from "../../_lib/events.js";

export async function onRequestGet({ request, env }) {
  const org = await currentOrganizer(request, env);
  if (!org) return err("No autorizado", 401);
  const { results } = await env.DB.prepare(
    `SELECT e.*,
       (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) AS registered,
       (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.checked_in_at IS NOT NULL) AS checked_in,
       (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.joined_at IS NOT NULL) AS joined
     FROM events e WHERE e.organizer_id = ? ORDER BY e.start_at DESC LIMIT 200`
  ).bind(org.id).all();
  return json({ events: results.map((e) => adminEvent(e, e)) });
}

export async function onRequestPost({ request, env }) {
  const org = await currentOrganizer(request, env);
  if (!org) return err("No autorizado", 401);
  const { data, error } = parseEventInput(await readJson(request));
  if (error) return err(error);
  const id = randomId();
  const slug = await uniqueSlug(env, data.slug, data.title);
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO events (id, organizer_id, brand, slug, title, description, mode, venue_name, address, maps_url,
       meeting_url, meeting_info, start_at, end_at, timezone, capacity, cover_url, status, sequence, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).bind(id, org.id, data.brand, slug, data.title, data.description, data.mode, data.venue_name, data.address,
    data.maps_url, data.meeting_url, data.meeting_info, data.start_at, data.end_at, data.timezone, data.capacity,
    data.cover_url, data.status, now, now).run();
  const ev = await env.DB.prepare("SELECT * FROM events WHERE id = ?").bind(id).first();
  return json({ event: adminEvent(ev) }, 201);
}
