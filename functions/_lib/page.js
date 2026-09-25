// Plantilla HTML de las páginas públicas renderizadas en el servidor (/e, /t).
import { escapeHtml } from "./util.js";

export function page({ brand, title, description = "", image = "", url = "", body, scripts = [], status = 200 }) {
  const html = `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description.slice(0, 200))}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description.slice(0, 200))}">
${url ? `<meta property="og:url" content="${escapeHtml(url)}">` : ""}
${image ? `<meta property="og:image" content="${escapeHtml(image)}"><meta name="twitter:card" content="summary_large_image">` : ""}
<link rel="stylesheet" href="/assets/public.css">
<style>:root{--brand:${brand.primary};--brand-dark:${brand.dark};--accent:${brand.accent};--soft:${brand.soft};}</style>
</head><body>
<header class="top"><div class="wrap">${escapeHtml(brand.tagline)}</div></header>
<main class="wrap">${body}</main>
<footer class="foot"><div class="wrap">${escapeHtml(brand.footer)}</div></footer>
${scripts.map((s) => `<script src="${s}" defer></script>`).join("")}
</body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
