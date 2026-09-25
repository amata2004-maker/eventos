// GET /api/events/:id/registrations — lista de registrados (solo el dueño del evento).
import { json, err } from "../../../_lib/util.js";
import { currentOrganizer, ownedEvent } from "../../../_lib/auth.js";

export async function onRequestGet({ request, env, params }) {
  const org = await currentOrganizer(request, env);
  if (!org) return err("No autorizado", 401);
  const ev = await ownedEvent(env, org.id, params.id);
  if (!ev) return err("Evento no encontrado", 404);
  const { results } = await env.DB.prepare(
    `SELECT id, name, email, phone, created_at, checked_in_at, joined_at
     FROM registrations WHERE event_id = ? ORDER BY created_at DESC`
  ).bind(ev.id).all();
  return json({ registrations: results });
}
