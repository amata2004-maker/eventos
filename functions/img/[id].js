// GET /img/<id> — sirve una portada guardada en D1. Inmutable: el id cambia si cambia la imagen.
export async function onRequestGet({ env, params }) {
  const row = await env.DB.prepare("SELECT mime, data FROM images WHERE id = ?").bind(params.id).first();
  if (!row) return new Response("No encontrada", { status: 404 });
  return new Response(new Uint8Array(row.data), {
    headers: { "Content-Type": row.mime, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
