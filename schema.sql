-- Eventos · esquema D1
-- Aplicar una vez:  npx wrangler d1 execute eventos_db --remote --file=schema.sql
-- Fechas: ISO-8601 en UTC ("2026-10-03T01:00:00.000Z"), así se comparan como texto.

CREATE TABLE IF NOT EXISTS organizers (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  pass_hash   TEXT NOT NULL,           -- "pbkdf2$<iter>$<saltHex>$<hashHex>"
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash    TEXT PRIMARY KEY,      -- SHA-256 del token; el token crudo nunca se guarda
  organizer_id  TEXT NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  expires_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id            TEXT PRIMARY KEY,
  organizer_id  TEXT NOT NULL REFERENCES organizers(id),
  brand         TEXT NOT NULL DEFAULT 'myactif',   -- ver functions/_lib/brands.js
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  mode          TEXT NOT NULL DEFAULT 'presencial', -- 'presencial' | 'online'
  venue_name    TEXT NOT NULL DEFAULT '',
  address       TEXT NOT NULL DEFAULT '',
  maps_url      TEXT NOT NULL DEFAULT '',
  meeting_url   TEXT NOT NULL DEFAULT '',          -- Zoom / Meet; solo se muestra a registrados
  meeting_info  TEXT NOT NULL DEFAULT '',          -- ID de reunión, código, etc.
  start_at      TEXT NOT NULL,
  end_at        TEXT NOT NULL,
  timezone      TEXT NOT NULL DEFAULT 'America/Mexico_City',
  capacity      INTEGER,                           -- NULL = sin límite
  cover_url     TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'published', -- 'draft' | 'published' | 'cancelled'
  sequence      INTEGER NOT NULL DEFAULT 0,        -- sube con cada cambio de fecha (SEQUENCE del .ics)
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_org   ON events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_at);

CREATE TABLE IF NOT EXISTS registrations (
  id             TEXT PRIMARY KEY,
  event_id       TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  token          TEXT NOT NULL UNIQUE,  -- va en el QR y en los enlaces del boleto
  name           TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT NOT NULL DEFAULT '',
  ip_hash        TEXT NOT NULL DEFAULT '',  -- SHA-256 de la IP, nunca la IP cruda
  created_at     TEXT NOT NULL,
  checked_in_at  TEXT,                  -- check-in QR (presencial)
  joined_at      TEXT,                  -- clic en "Unirme" (online)
  reminded_24h   INTEGER NOT NULL DEFAULT 0,
  reminded_1h    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(event_id, email)
);
CREATE INDEX IF NOT EXISTS idx_reg_event ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_reg_ip    ON registrations(ip_hash, created_at);

-- Portadas subidas desde el panel. Se reducen en el navegador (≤1600 px, JPEG)
-- antes de subir, así que pesan ~100–400 KB y caben en una fila de D1 (límite 2 MB).
CREATE TABLE IF NOT EXISTS images (
  id            TEXT PRIMARY KEY,
  organizer_id  TEXT NOT NULL REFERENCES organizers(id),
  mime          TEXT NOT NULL,
  size          INTEGER NOT NULL,
  data          BLOB NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_images_org ON images(organizer_id, created_at);
