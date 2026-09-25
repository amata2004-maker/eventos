// Descarga de la invitación .ics: /ics/<token>
import { origin } from "../_lib/util.js";
import { getBrand } from "../_lib/brands.js";
import { buildIcs } from "../_lib/ics.js";
import { links } from "../_lib/email.js";

export async function onRequestGet({ request, env, params }) {
  const row = await env.DB.prepare(
    "SELECT r.token, e.* FROM registrations r JOIN events e ON e.id = r.event_id WHERE r.token = ?"
  ).bind(params.token).first();
  if (!row) return new Response("No encontrado", { status: 404 });
  const base = origin(request);
  const ics = buildIcs(row, { token: row.token }, { ...links(base, row), brand: getBrand(row.brand), host: new URL(base).host });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="evento.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
