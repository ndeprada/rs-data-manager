import { format } from "date-fns";
import { es } from "date-fns/locale/es";
import { enGB } from "date-fns/locale/en-GB";
import { fr } from "date-fns/locale/fr";
import { ca } from "date-fns/locale/ca";
import { langInfo } from "./translate.js";

const LOCALES = { es, en: enGB, fr, ca };
export const dateFnsLocale = (lang) => LOCALES[lang] || es;
// Etiqueta BCP-47 para toLocaleDateString / toLocaleString / Intl
export const localeTag = (lang) => langInfo(lang).locale;

// «sábado 24 de octubre, 16:00» / «Saturday 24 October at 16:00» / «samedi 24 octobre à 16:00» / «dissabte, 24 d’octubre, a les 16:00»
export function longDateTime(date, lang) {
  const d = date instanceof Date ? date : new Date(date);
  if (lang === "es" || !lang) return format(d, "EEEE d 'de' MMMM, HH:mm", { locale: es });
  return new Intl.DateTimeFormat(localeTag(lang), { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

// «24 de octubre de 2026» / «24 October 2026» / «24 octobre 2026» / «24 d’octubre del 2026»
export function longDate(date, lang) {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(localeTag(lang || "es"), { day: "numeric", month: "long", year: "numeric" }).format(d);
}

// Nombre de un país en el idioma elegido (ISO2). Si el navegador no lo sabe, se devuelve el nombre en español.
export function countryName(a2, fallback, lang) {
  try { return new Intl.DisplayNames([localeTag(lang || "es")], { type: "region" }).of(String(a2).toUpperCase()) || fallback; } catch { return fallback; }
}
