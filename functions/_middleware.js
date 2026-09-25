// Cabeceras de seguridad para todo lo que sirven las Functions
// (_headers solo aplica a archivos estáticos, no a respuestas de Functions).
import { json } from "./_lib/util.js";

const SECURITY = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
};

export async function onRequest(context) {
  let res;
  try {
    if (!context.env.DB) return json({ error: "Base de datos no configurada (binding DB)" }, 500);
    res = await context.next();
  } catch (e) {
    console.error(e);
    res = json({ error: "Error interno" }, 500);
  }
  res = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY)) if (!res.headers.has(k)) res.headers.set(k, v);
  return res;
}
