// Marcas disponibles. Para agregar una nueva, añade una entrada aquí
// y (opcional) la variable MAIL_FROM_<KEY> con su remitente verificado en Resend.
//
// Nota Amway: los eventos los organiza un Empresario Independiente, no la
// compañía. No usamos logotipos de Amway y el pie lo aclara en cada página y correo.

export const BRANDS = {
  myactif: {
    key: "myactif",
    name: "MyActif",
    tagline: "Eventos MyActif",
    sender: "MyActif Eventos",
    primary: "#0E7C66",
    dark: "#0B2E2A",
    accent: "#F2A541",
    soft: "#E8F4F1",
    footer: "Organizado por MyActif · myactif.com",
  },
  amway: {
    key: "amway",
    name: "Negocio Amway",
    tagline: "Evento de negocio · Empresario Independiente Amway",
    sender: "Eventos de Negocio",
    primary: "#1F4E8C",
    dark: "#0F2744",
    accent: "#C9A227",
    soft: "#EAF0F8",
    footer: "Evento organizado por un Empresario Independiente Amway. No es un evento oficial de Amway.",
  },
};

export const BRAND_KEYS = Object.keys(BRANDS);

export function getBrand(key) {
  return BRANDS[key] || BRANDS.myactif;
}
