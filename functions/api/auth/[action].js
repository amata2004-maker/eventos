// /api/auth/signup · /api/auth/login · /api/auth/logout · /api/auth/me
import { json, err, readJson, randomId, nowIso, isEmail, clip } from "../../_lib/util.js";
import { BRANDS } from "../../_lib/brands.js";
import { hashPassword, verifyPassword, createSession, currentOrganizer, destroySession } from "../../_lib/auth.js";

export async function onRequestPost({ request, env, params }) {
  const action = params.action;

  if (action === "logout") {
    await destroySession(request, env);
    return json({ ok: true });
  }

  const b = (await readJson(request)) || {};
  const email = clip(b.email, 254).toLowerCase();
  const password = String(b.password || "");

  if (action === "signup") {
    // Alta de organizadores: requiere SIGNUP_CODE. Sin código configurado,
    // solo se permite crear la PRIMERA cuenta (arranque del sistema).
    const first = !(await env.DB.prepare("SELECT 1 FROM organizers LIMIT 1").first());
    if (env.SIGNUP_CODE ? b.code !== env.SIGNUP_CODE : !first) return err("Código de invitación inválido", 403);
    const name = clip(b.name, 80);
    if (!name) return err("Escribe tu nombre");
    if (!isEmail(email)) return err("Correo inválido");
    if (password.length < 10) return err("La contraseña debe tener al menos 10 caracteres");
    if (await env.DB.prepare("SELECT 1 FROM organizers WHERE email = ?").bind(email).first()) {
      return err("Ya existe una cuenta con ese correo", 409);
    }
    const id = randomId();
    await env.DB.prepare("INSERT INTO organizers (id, email, name, pass_hash, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(id, email, name, await hashPassword(password), nowIso()).run();
    return json({ ok: true, token: await createSession(env, id), organizer: { id, email, name } });
  }

  if (action === "login") {
    const o = await env.DB.prepare("SELECT * FROM organizers WHERE email = ?").bind(email).first();
    if (!o || !(await verifyPassword(password, o.pass_hash))) return err("Correo o contraseña incorrectos", 401);
    return json({ ok: true, token: await createSession(env, o.id), organizer: { id: o.id, email: o.email, name: o.name } });
  }

  return err("No encontrado", 404);
}

export async function onRequestGet({ request, env, params }) {
  if (params.action !== "me") return err("No encontrado", 404);
  const o = await currentOrganizer(request, env);
  if (!o) return err("No autorizado", 401);
  const brands = Object.values(BRANDS).map((b) => ({ key: b.key, name: b.name }));
  return json({ organizer: o, brands });
}
