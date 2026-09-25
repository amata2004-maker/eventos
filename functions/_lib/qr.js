// QR generado en el servidor (qrcode-generator, MIT, vendorizado en qrcode.mjs).
import qrcode from "./qrcode.mjs";

function make(text) {
  const q = qrcode(0, "M");
  q.addData(text);
  q.make();
  return q;
}

// SVG escalable para el boleto web.
export function qrSvg(text) {
  return make(text).createSvgTag({ cellSize: 8, margin: 2, scalable: true });
}

// Tabla HTML para correos: Gmail/Outlook no muestran SVG ni data: URIs,
// pero sí celdas con color de fondo.
export function qrEmailTable(text, cell = 5) {
  const q = make(text);
  const n = q.getModuleCount();
  const quiet = 3;
  const size = n + quiet * 2;
  let rows = "";
  for (let r = -quiet; r < n + quiet; r++) {
    rows += "<tr>";
    let c = -quiet;
    while (c < n + quiet) {
      const dark = r >= 0 && r < n && c >= 0 && c < n && q.isDark(r, c);
      let span = 1;
      while (c + span < n + quiet) {
        const cc = c + span;
        const d2 = r >= 0 && r < n && cc >= 0 && cc < n && q.isDark(r, cc);
        if (d2 !== dark) break;
        span++;
      }
      rows += `<td${span > 1 ? ` colspan="${span}"` : ""} width="${cell * span}" height="${cell}" style="width:${cell * span}px;height:${cell}px;padding:0;background:${dark ? "#000" : "#fff"};font-size:0;line-height:0;"></td>`;
      c += span;
    }
    rows += "</tr>";
  }
  // Fila invisible que fija el ancho de cada columna (necesaria para que colspan cuadre).
  const sizer = `<tr>${`<td width="${cell}" style="width:${cell}px;height:0;padding:0;font-size:0;line-height:0;"></td>`.repeat(size)}</tr>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 auto;table-layout:fixed;">${sizer}${rows}</table>`;
}
