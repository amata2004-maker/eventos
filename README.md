# Eventos

App multimarca (MyActif / Negocio Amway) para eventos presenciales y en línea:
página pública, registro, invitación `.ics`, recordatorios por correo 24 h y 1 h antes,
check-in con QR y enlace personal a Zoom/Meet.

**Stack:** Cloudflare Pages (estático + Pages Functions) · D1 · Resend · Worker con cron para los recordatorios.

## Qué hace

| Ruta | Qué es |
|---|---|
| `/admin/` | Panel del organizador: crear/editar eventos, registrados, check-in manual, CSV |
| `/admin/checkin.html#<id>` | Escáner QR con la cámara del teléfono (BarcodeDetector o jsQR) |
| `/e/<slug>` | Página pública del evento + formulario de registro (con OG tags para WhatsApp) |
| `/t/<token>` | Boleto del asistente: QR (presencial) o botón "Unirme" (en línea) |
| `/j/<token>` | Registra la asistencia en línea y redirige a Zoom/Meet |
| `/ics/<token>` | Descarga de la invitación de calendario |
| `/api/cron/reminders` | Envía los recordatorios de 24 h y 1 h (protegido con `CRON_SECRET`) |

Correos (Resend):
- **Confirmación**: al registrarse; lleva el QR (como tabla HTML, para que Gmail lo muestre), botón a Google Calendar y el `.ics` adjunto.
- **Recordatorio 24 h** y **1 h**: por lotes (`/emails/batch`), un solo subrequest por corrida.
- Si alguien se registra cuando faltan menos de 24 h (o de 1 h), la confirmación sustituye al recordatorio.
- Si cambias la fecha del evento, los recordatorios se vuelven a enviar con la hora nueva, y el `.ics` sube su `SEQUENCE`.

## Estructura

```
public/              ← salida estática de Pages (lo único que se sirve como archivo)
  index.html  admin/  assets/  _headers  _routes.json  robots.txt
functions/           ← Pages Functions (API + páginas renderizadas en el servidor)
  _middleware.js     ← cabeceras de seguridad para las respuestas de Functions
  _lib/              ← auth, marcas, correo, .ics, QR, zonas horarias
  api/  e/  t/  j/  ics/
cron-worker/         ← Worker con cron cada 10 min que llama a /api/cron/reminders
schema.sql           ← tablas de D1
```

## Puesta en marcha

1. **D1**: crea la base y aplica el esquema.
   ```bash
   npx wrangler d1 create eventos_db
   npx wrangler d1 execute eventos_db --remote --file=schema.sql
   ```
2. **Pages**: Workers & Pages → Create → Pages → conectar este repo, rama `main`.
   - Framework preset: *None* · Build command: *(vacío)* · **Build output directory: `public`**
3. **Binding D1**: Settings → Bindings → D1 → nombre `DB` → `eventos_db`.
4. **Variables y secretos** (Settings → Variables and secrets):
   | Nombre | Tipo | Valor |
   |---|---|---|
   | `RESEND_API_KEY` | Secret | API key de Resend |
   | `MAIL_FROM` | Text | dirección verificada en Resend, ej. `eventos@myactif.com` |
   | `MAIL_FROM_AMWAY` | Text | *(opcional)* remitente distinto para la marca Amway |
   | `CRON_SECRET` | Secret | cadena larga aleatoria |
   | `SIGNUP_CODE` | Secret | código para que nuevos organizadores creen cuenta |
   | `IP_SALT` | Secret | sal para el hash de IP |
   Después de cambiar secretos hace falta un redeploy.
5. **Primer organizador**: entra a `/admin/` → "Soy organizador nuevo". Sin `SIGNUP_CODE` solo se puede crear la primera cuenta.
6. **Recordatorios**: en `cron-worker/wrangler.toml` pon `APP_URL` con tu dominio y despliega:
   ```bash
   cd cron-worker
   npx wrangler secret put CRON_SECRET   # el mismo valor que en Pages
   npx wrangler deploy
   ```

## Desarrollo local

```bash
cp .dev.vars.example .dev.vars          # y llena los valores
# crea un wrangler.toml local (no se sube) con pages_build_output_dir = "public" y el binding DB
npx wrangler d1 execute eventos_db --local --file=schema.sql
npx wrangler pages dev
```
`RESEND_API_URL` en `.dev.vars` permite apuntar los correos a un servidor falso para pruebas.

## Marcas

Se definen en `functions/_lib/brands.js` (nombre, colores, remitente, pie).
Los eventos de Amway los organiza un Empresario Independiente: no usamos logotipos de Amway
y cada página y correo aclara que no es un evento oficial de la compañía.

Licencia de terceros: `functions/_lib/qrcode.mjs` es [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT, Kazuhiko Arase).
