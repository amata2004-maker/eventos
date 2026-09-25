// /api/cron/reminders — envía recordatorios de 24 h y 1 h.
// Lo dispara el Worker de cron-worker/ cada 10 min con el header X-Cron-Key = CRON_SECRET.
// Usa el batch de Resend (hasta 100 correos en una sola llamada) para no pasar
// el límite de 50 subrequests por invocación del plan free.
import { json, err, nowIso, origin } from "../../_lib/util.js";
import { reminderEmail, sendBatch } from "../../_lib/email.js";

const BATCH = 100;

async function pending(env, kind) {
  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  // 24h: faltan ≤24 h y más de 1 h. 1h: falta ≤1 h y no empezó hace más de 10 min.
  const [from, to, col] = kind === "24h"
    ? [iso(now + 3600e3), iso(now + 24 * 3600e3), "reminded_24h"]
    : [iso(now - 10 * 60e3), iso(now + 3600e3), "reminded_1h"];
  const { results } = await env.DB.prepare(
    `SELECT r.id AS reg_id, r.token, r.name, r.email, e.*
     FROM registrations r JOIN events e ON e.id = r.event_id
     WHERE e.status = 'published' AND e.start_at > ? AND e.start_at <= ? AND r.${col} = 0
     LIMIT ${BATCH}`
  ).bind(from, to).all();
  return { rows: results, col };
}

async function run(request, env) {
  const key = request.headers.get("X-Cron-Key") || new URL(request.url).searchParams.get("key");
  if (!env.CRON_SECRET || key !== env.CRON_SECRET) return err("No autorizado", 403);
  if (!env.RESEND_API_KEY) return err("RESEND_API_KEY no configurada", 500);
  const base = origin(request);
  const summary = { at: nowIso() };

  for (const kind of ["1h", "24h"]) {
    const { rows, col } = await pending(env, kind);
    summary[kind] = { pending: rows.length, sent: 0 };
    if (!rows.length) continue;
    const emails = rows.map((row) => reminderEmail(env, row, { token: row.token, name: row.name, email: row.email }, kind, base));
    try {
      await sendBatch(env, emails);
    } catch (e) {
      console.error(`recordatorio ${kind}`, e);
      summary[kind].error = String(e.message || e).slice(0, 300);
      continue; // no marcamos: se reintenta en la siguiente corrida
    }
    await env.DB.batch(rows.map((r) => env.DB.prepare(`UPDATE registrations SET ${col} = 1 WHERE id = ?`).bind(r.reg_id)));
    // Si ya salió el de 1 h, el de 24 h ya no tiene sentido.
    if (kind === "1h") {
      await env.DB.batch(rows.map((r) => env.DB.prepare("UPDATE registrations SET reminded_24h = 1 WHERE id = ?").bind(r.reg_id)));
    }
    summary[kind].sent = rows.length;
  }
  return json(summary);
}

export const onRequestPost = ({ request, env }) => run(request, env);
export const onRequestGet = ({ request, env }) => run(request, env);
