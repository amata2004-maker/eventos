// Utilidades compartidas por todas las Functions.

export function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

export const err = (message, status = 400) => json({ error: message }, status);

export async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

export const nowIso = () => new Date().toISOString();

// Id aleatorio en base64url (18 bytes → 24 caracteres).
export function randomId(bytes = 18) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Hash de la IP (con sal opcional) — nunca guardamos la IP cruda.
export async function ipHash(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  return sha256Hex(`${env.IP_SALT || "eventos"}:${ip}`);
}

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Texto plano → HTML con saltos de línea y enlaces https clicables.
export function richText(s) {
  return escapeHtml(s)
    .replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, "<br>");
}

export const isEmail = (s) => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(s || "");

export function isHttpsUrl(s) {
  if (!s) return false;
  try { return new URL(s).protocol === "https:"; } catch { return false; }
}

export function slugify(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const clip = (s, n) => String(s ?? "").trim().slice(0, n);

export function origin(request) {
  return new URL(request.url).origin;
}
