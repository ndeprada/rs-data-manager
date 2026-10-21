import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Globe, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { DEFAULT_LANG, LANGUAGES, isLang, langInfo } from "./translate.js";
import { translate, DICTIONARIES } from "./dictionaries.js";
import { dateFnsLocale, localeTag, longDateTime, longDate, countryName } from "./dates.js";

export { LANGUAGES, msg } from "./translate.js";

const STORAGE_KEY = "rs_lang";
const readStored = () => {
  try { const v = localStorage.getItem(STORAGE_KEY); return isLang(v) ? v : null; } catch { return null; }
};
const writeStored = (lang) => { try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* sin almacenamiento */ } };

// Solo en desarrollo: anota en window.__i18nMissing los textos que se pidieron en otro idioma y no tienen traducción (para las pruebas)
function noteMissing(lang, text) {
  if (!import.meta.env.DEV || lang === DEFAULT_LANG || typeof text !== "string" || !/[A-Za-zÀ-ÿ]{3,}/.test(text)) return;
  if (DICTIONARIES[lang] && Object.prototype.hasOwnProperty.call(DICTIONARIES[lang], text)) return;
  (window.__i18nMissing = window.__i18nMissing || new Set()).add(text);
}

const LanguageContext = createContext({ lang: DEFAULT_LANG, setLang: () => {}, t: (s, v) => translate(DEFAULT_LANG, s, v) });

/**
 * Idioma de la app. Orden de preferencia: el guardado en el perfil de la persona, el elegido en este dispositivo y, si no hay ninguno, español.
 * Lo que se elige antes de entrar (pantalla de acceso) se guarda en el perfil en el primer acceso.
 */
export function LanguageProvider({ children }) {
  const { user } = useAuth();
  const [lang, setLangState] = useState(() => readStored() || DEFAULT_LANG);
  const userId = user?.id;
  const profileLang = user?.language;

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  // Al entrar: manda el idioma del perfil; si el perfil no tiene ninguno y se había elegido uno antes de entrar, se guarda en el perfil
  useEffect(() => {
    if (!userId) return;
    if (isLang(profileLang)) {
      setLangState(profileLang);
      writeStored(profileLang);
    } else {
      const stored = readStored();
      if (stored && stored !== DEFAULT_LANG) base44.auth.updateMe({ language: stored }).catch(() => {});
    }
  }, [userId, profileLang]);

  const setLang = useCallback((next) => {
    if (!isLang(next)) return;
    setLangState(next);
    writeStored(next);
    if (userId) base44.auth.updateMe({ language: next }).catch(() => {});
  }, [userId]);

  const value = useMemo(() => ({ lang, setLang, t: (text, vars) => { noteMissing(lang, text); return translate(lang, text, vars); } }), [lang, setLang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
/** Función de traducción: t("Mi equipo", { variable }) */
export const useT = () => useContext(LanguageContext).t;
/** Idioma de date-fns para format(..., { locale }) */
export const useDateLocale = () => dateFnsLocale(useContext(LanguageContext).lang);
/** Formatos de fecha y número del idioma elegido */
export function useFormat() {
  const { lang } = useContext(LanguageContext);
  return useMemo(() => ({
    lang,
    locale: dateFnsLocale(lang),
    tag: localeTag(lang),
    longDateTime: (d) => longDateTime(d, lang),
    longDate: (d) => longDate(d, lang),
    country: (a2, fallback) => countryName(a2, fallback, lang),
    num: (n, opts) => (n == null ? "" : Number(n).toLocaleString(localeTag(lang), opts)),
  }), [lang]);
}
/** Etiqueta para toLocaleDateString / Intl («es-ES», «en-GB», «fr-FR», «ca-ES») */
export const useLocaleTag = () => localeTag(useContext(LanguageContext).lang);

/**
 * Selector de idioma para cualquier persona: desplegable pequeño (globo + idioma actual).
 * variant="compact": solo el código (ES, EN, FR, CA), para barras y menús; variant="names": el nombre completo, para las pantallas de acceso.
 * tone="dark" sobre fondo granate; "light" sobre fondo claro. La elección se guarda en el perfil y se puede cambiar cuando se quiera.
 */
export function LanguageSelector({ variant = "compact", tone = "light", className = "" }) {
  const { lang, setLang, t } = useLanguage();
  const dark = tone === "dark";
  const current = langInfo(lang);
  const look = dark ? "text-white/80 hover:text-white hover:bg-white/10" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100";
  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={`${t("Idioma")}: ${current.name}`} title={t("Idioma")}
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${look}`}>
            <Globe className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {variant === "names" ? current.name : current.short}
            <ChevronDown className="w-3 h-3 shrink-0 opacity-70" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[9rem]">
          <DropdownMenuRadioGroup value={lang} onValueChange={setLang}>
            {LANGUAGES.map((l) => (
              <DropdownMenuRadioItem key={l.code} value={l.code} lang={l.code}>{l.name}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export { langInfo };
