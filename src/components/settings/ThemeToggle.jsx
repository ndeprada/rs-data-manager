// Botón de modo claro / oscuro del menú. Solo sale si en Configuración el club ha elegido «Cada persona elige».
// Lo elegido se guarda en este navegador (localStorage rs_theme) y se aplica al momento, sin recargar.
import React, { useState } from "react";
import { Sun, Moon } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { setThemePref, themePref } from "@/lib/applyBrand";
import { useT } from "@/i18n";

export function ThemeToggle({ className = "" }) {
  const t = useT();
  const [dark, setDark] = useState(() => themePref() === "dark");
  if (BRAND.theme !== "choice") return null;
  const flip = () => { const next = !dark; setDark(next); setThemePref(next ? "dark" : "light"); };
  return (
    <button
      type="button"
      onClick={flip}
      className={`inline-flex items-center gap-1.5 rounded-md text-[11px] text-white/70 hover:text-white hover:bg-white/10 px-1.5 py-1 ${className}`}
      title={dark ? t("Pasar a modo claro") : t("Pasar a modo oscuro")}
      aria-label={dark ? t("Pasar a modo claro") : t("Pasar a modo oscuro")}
      data-testid="theme-toggle"
      data-dark={dark ? "1" : "0"}
    >
      {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      <span className="hidden lg:inline">{dark ? t("Modo claro") : t("Modo oscuro")}</span>
    </button>
  );
}
