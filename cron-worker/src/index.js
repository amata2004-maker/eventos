// Worker programado: cada 10 min dispara los recordatorios de 24 h / 1 h.
// Cloudflare Pages no tiene cron propio; este Worker solo hace un fetch al endpoint.
export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(run(env));
  },
  // Permite probarlo a mano: GET https://<worker>/?key=CRON_SECRET
  async fetch(request, env) {
    if (new URL(request.url).searchParams.get("key") !== env.CRON_SECRET) return new Response("No autorizado", { status: 403 });
    return run(env);
  },
};

async function run(env) {
  const r = await fetch(`${env.APP_URL}/api/cron/reminders`, {
    method: "POST",
    headers: { "X-Cron-Key": env.CRON_SECRET },
  });
  const body = await r.text();
  console.log(r.status, body);
  return new Response(body, { status: r.status, headers: { "Content-Type": "application/json" } });
}
