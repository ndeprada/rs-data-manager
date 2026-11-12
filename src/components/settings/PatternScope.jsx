// Marca una pantalla de fuera del menú (acceso, alta, familias) con su patrón de página, para que le lleguen los
// ajustes de la configuración del club. Sin ajustes guardados no cambia nada.
import React from "react";
import { BRAND } from "@/lib/brand";
import { pageInfo } from "@/lib/pagePatterns";

export function PatternScope({ page, children }) {
  const { pattern } = pageInfo(page, BRAND);
  return (
    <div data-pattern={pattern} data-page={page} data-pattern-body>
      {children}
    </div>
  );
}
