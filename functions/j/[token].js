// Enlace personal para unirse a un evento en línea: /j/<token>
// Registra la asistencia (joined_at) y redirige a Zoom/Meet. Así el enlace real
// de la reunión no aparece en la página pública y sabemos quién entró.
import { nowIso } from "../_lib/util.js";

const EARLY_MS = 60 * 60e3; // cuenta como asistencia desde 1 h antes del inicio

export async function onRequestGet({ env, params }) {
  const row = await env.DB.prepare(
    `SELECT r.id, r.joined_at, e.meeting_url, e.start_at, e.end_at, e.status, e.mode
     FROM registrations r JOIN events e ON e.id = r.event_id WHERE r.token = ?`
  ).bind(params.token).first();
  if (!row || row.mode !== "online" || !row.meeting_url || row.status === "cancelled") {
    return new Response("Enlace no disponible", { status: 404 });
  }
  const now = Date.now();
  if (!row.joined_at && now >= Date.parse(row.start_at) - EARLY_MS && now <= Date.parse(row.end_at)) {
    await env.DB.prepare("UPDATE registrations SET joined_at = ? WHERE id = ?").bind(nowIso(), row.id).run();
  }
  return new Response(null, { status: 302, headers: { Location: row.meeting_url, "Cache-Control": "no-store" } });
}
