# Eventos

App multimarca (MyActif / Negocio Amway) de eventos presenciales y en línea. Ver README.md para rutas y puesta en marcha.

## Stack e infraestructura

- Cloudflare Pages: output directory **`public`** (no la raíz — así `schema.sql` y `cron-worker/` no se sirven). Functions en `/functions/`.
- D1 `eventos_db` (id `5481cd74-9368-456b-82db-33685df87193`, región WNAM) con binding **`DB`**. Esquema en `schema.sql` (ya aplicado el 25-sep-2026). Fechas en ISO UTC (`toISOString()`), comparadas como texto — no mezclar otros formatos.
- Resend para correo. Remitente por marca: `MAIL_FROM_<MARCA>` o `MAIL_FROM`.
- Pages no tiene cron: `cron-worker/` es un Worker aparte que llama `/api/cron/reminders` cada 10 min con `X-Cron-Key`.
- **Pedir confirmación a Alex antes de cada deploy** (push a `main` una vez conectado a Pages, `wrangler deploy` del cron, cambios remotos en D1).

## Reglas (no romper)

- El organizador SIEMPRE sale del token de sesión (`currentOrganizer`), y todo acceso a un evento pasa por `ownedEvent(env, org.id, id)`. Nunca confiar en ids del body/URL sin eso.
- El `token` de registro es el secreto del boleto (QR, `/t`, `/j`, `/ics`). No devolverlo si el correo ya estaba registrado (se reenvía por correo) y nunca listarlo en endpoints públicos. La lista de admin tampoco lo expone.
- `meeting_url` solo lo ven los registrados (vía `/j/<token>`), nunca la página pública.
- IP: solo hash SHA-256 con sal (`ip_hash`), nunca cruda.
- Recordatorios: se marcan como enviados solo después de que Resend acepta el lote. Usar `/emails/batch` (límite de 50 subrequests por invocación en plan free).
- Sin JS inline: la CSP no tiene `unsafe-inline` en `script-src`. Scripts van en `public/assets/`.
- Amway: sin logotipos; mantener el aviso "No es un evento oficial de Amway".

## Contexto

- Alex trabaja solo en este proyecto. UI y correos en español (México).
