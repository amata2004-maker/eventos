// Autenticación de organizadores.
// El organizador SIEMPRE se deriva del token de sesión (header Authorization),
// nunca de un parámetro de la URL o del body.
import { sha256Hex, randomId, nowIso } from "./util.js";

const PBKDF2_ITER = 100000; // tope de WebCrypto en Workers
const SESSION_DAYS = 30;

const toHex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
const fromHex = (hex) => new Uint8Array(hex.match(/.{2}/g).map((h) => parseInt(h, 16)));

async function pbkdf2Hex(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256);
  return toHex(bits);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITER}$${toHex(salt)}$${await pbkdf2Hex(password, salt, PBKDF2_ITER)}`;
}

export async function verifyPassword(password, stored) {
  const [kind, iter, saltHex, hashHex] = String(stored || "").split("$");
  if (kind !== "pbkdf2") return false;
  const got = await pbkdf2Hex(password, fromHex(saltHex), +iter);
  // comparación en tiempo constante
  if (got.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ hashHex.charCodeAt(i);
  return diff === 0;
}

export async function createSession(env, organizerId) {
  const token = randomId(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(nowIso()).run();
  await env.DB.prepare("INSERT INTO sessions (token_hash, organizer_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256Hex(token), organizerId, expires).run();
  return token;
}

function bearer(request) {
  const h = request.headers.get("Authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

export async function currentOrganizer(request, env) {
  const token = bearer(request);
  if (!token) return null;
  return env.DB.prepare(
    `SELECT o.id, o.email, o.name FROM sessions s JOIN organizers o ON o.id = s.organizer_id
     WHERE s.token_hash = ? AND s.expires_at > ?`
  ).bind(await sha256Hex(token), nowIso()).first();
}

export async function destroySession(request, env) {
  const token = bearer(request);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
}

// Evento del organizador actual, o null (no distingue "no existe" de "no es tuyo").
export async function ownedEvent(env, organizerId, eventId) {
  return env.DB.prepare("SELECT * FROM events WHERE id = ? AND organizer_id = ?").bind(eventId, organizerId).first();
}
