// Núcleo de traducción (sin React ni alias, para poder probarlo con node --test).
// El texto en español es la clave: t("Mi equipo") devuelve «My team» en inglés. Si falta la traducción, se muestra el español.

export const LANGUAGES = [
  { code: "es", name: "Español", short: "ES", locale: "es-ES" },
  { code: "en", name: "English", short: "EN", locale: "en-GB" },
  { code: "fr", name: "Français", short: "FR", locale: "fr-FR" },
  { code: "ca", name: "Català", short: "CA", locale: "ca-ES" },
];
export const DEFAULT_LANG = "es";
export const LANG_CODES = LANGUAGES.map((l) => l.code);
export const isLang = (code) => LANG_CODES.includes(code);
export const langInfo = (code) => LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];

/** Marca un texto para traducir más tarde (constantes, errores…): msg("Amistoso") devuelve el mismo texto; luego se muestra con t(...) */
export const msg = (text) => text;

// Sustituye {nombre} por el valor correspondiente
export function interpolate(text, vars) {
  if (!vars) return text;
  return String(text).replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
}

// Filas [español, inglés, francés, catalán] → diccionarios por idioma
export function buildDictionaries(rows) {
  const dicts = { en: {}, fr: {}, ca: {} };
  rows.forEach(([es, en, fr, ca]) => {
    if (!es) return;
    if (en) dicts.en[es] = en;
    if (fr) dicts.fr[es] = fr;
    if (ca) dicts.ca[es] = ca;
  });
  return dicts;
}

export function makeTranslate(dicts) {
  return function translate(lang, text, vars) {
    if (text === undefined || text === null || text === "") return text ?? "";
    const dict = dicts[lang];
    const found = dict ? dict[text] : undefined;
    return interpolate(found !== undefined ? found : text, vars);
  };
}
