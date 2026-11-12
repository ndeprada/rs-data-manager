// Configuración → Modo y copia (fase 5, 12/11/2026): modo claro u oscuro y exportar / importar toda la configuración.
// El modo se guarda en la configuración (`theme`): light = como siempre (no se guarda nada), dark = oscuro para todos,
// choice = cada persona elige con el botón del menú (se recuerda en su navegador).
// Importar no guarda: carga el archivo en el borrador para revisarlo y, si convence, pulsar Guardar.
import React, { useRef, useState } from "react";
import { useT, msg } from "@/i18n";
import { brandDiff, fullBrand } from "@/lib/brand";
import { DARK } from "@/lib/darkTheme";
import { RS, Card, Btn } from "@/components/rs2/kit";
import { FieldRow } from "@/components/settings/BrandFields";
import { configFile, readConfigFile, configSummary } from "@/lib/configFile";

const SUMMARY_LABEL = {
  names: msg("nombres"), images: msg("escudo e imágenes"), links: msg("web y redes"), colors: msg("colores"),
  fonts: msg("tipografías"), patterns: msg("patrones de página"), structure: msg("estructura del club"), theme: msg("modo de color"),
};

const MODES = [
  { key: "light", label: msg("Claro (como siempre)"), help: msg("Fondo claro para todos.") },
  { key: "dark", label: msg("Oscuro"), help: msg("Fondo oscuro para todos. Cansa menos la vista por la noche.") },
  { key: "choice", label: msg("Cada persona elige"), help: msg("Sale un botón «Modo oscuro» en el menú; cada persona elige en su móvil u ordenador. Empieza en claro.") },
];

function ModeSample({ dark, colors }) {
  const bg = dark ? DARK.bg : "#F5F2F1", card = dark ? DARK.surface : "#fff", line = dark ? DARK.line : "#E6DEDD";
  const ink = dark ? DARK.ink : "#1E1416", muted = dark ? DARK.muted : "#6B5E60";
  return (
    <div className="rs-nodark" style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: `1px solid ${line}`, height: 112, width: 220 }}>
      <div style={{ width: 46, background: colors.primary }} />
      <div style={{ flex: 1, background: bg, padding: 8 }}>
        <div style={{ height: 8, width: 70, borderRadius: 4, background: colors.primary, opacity: dark ? 0.9 : 1, marginBottom: 8 }} />
        <div style={{ background: card, border: `1px solid ${line}`, borderRadius: 6, padding: 6 }}>
          <div style={{ fontSize: 10, color: ink, fontWeight: 600 }}>Juvenil A</div>
          <div style={{ fontSize: 9, color: muted }}>18 jugadores · 3 bajas</div>
          <div style={{ marginTop: 6, height: 14, width: 54, borderRadius: 4, background: colors.accent }} />
        </div>
      </div>
    </div>
  );
}

export function ThemeBackup({ draft, set, replace }) {
  const t = useT();
  const fileRef = useRef(null);
  const [imp, setImp] = useState(null); // { ok, text, summary }
  const mode = draft.theme || "light";

  const exportFile = () => {
    const data = configFile(brandDiff(draft), { clubName: draft.clubName, appName: draft.appName });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `configuracion-${(draft.appName || "app").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  const importFile = async (file) => {
    if (!file) return;
    try {
      const brand = readConfigFile(JSON.parse(await file.text()));
      replace(fullBrand(brand));
      setImp({ ok: true, summary: configSummary(brand) });
    } catch (e) {
      setImp({ ok: false, text: e?.message === "not_config" ? t("Este archivo no es una configuración de la app.") : t("No se ha podido leer el archivo.") });
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex flex-col" style={{ gap: 12, maxWidth: 980 }}>
      <Card title={t("Modo de color")}>
        <div className="flex flex-wrap" style={{ gap: 18, alignItems: "flex-start" }}>
          <div className="flex flex-col" style={{ gap: 8, flex: "1 1 360px" }}>
            {MODES.map((m) => (
              <label key={m.key} className="flex items-start cursor-pointer" style={{ gap: 10, padding: "8px 10px", borderRadius: 8, border: `1px solid ${mode === m.key ? RS.granate : RS.line}` }} data-testid={`cfg-theme-${m.key}`}>
                <input type="radio" name="cfg-theme" checked={mode === m.key} onChange={() => set({ theme: m.key })} style={{ marginTop: 3, accentColor: RS.granate }} />
                <span>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: RS.ink }}>{t(m.label)}</span>
                  <span style={{ display: "block", fontSize: 12, color: RS.muted }}>{t(m.help)}</span>
                </span>
              </label>
            ))}
            <p style={{ fontSize: 12, color: RS.muted }}>
              {t("Primera versión del modo oscuro: puede quedar algún detalle en claro. La pizarra, el editor de vídeo, las hojas impresas y los PDF siempre salen como siempre.")}
            </p>
          </div>
          <div className="flex" style={{ gap: 10 }}>
            <div style={{ textAlign: "center", fontSize: 11, color: RS.muted }}><ModeSample colors={draft.colors} />{t("Claro")}</div>
            <div style={{ textAlign: "center", fontSize: 11, color: RS.muted }}><ModeSample dark colors={draft.colors} />{t("Oscuro")}</div>
          </div>
        </div>
      </Card>

      <Card title={t("Copia de la configuración")}>
        <FieldRow label={t("Exportar")} help={t("Descarga un archivo con toda la configuración (nombres, imágenes, colores, tipografías, patrones, estructura y modo). Sirve de copia de seguridad o para llevarla a otra copia de la app.")}>
          <Btn kind="ghost" onClick={exportFile} testId="cfg-export">{t("Descargar la configuración")}</Btn>
        </FieldRow>
        <FieldRow label={t("Importar")} help={t("Carga un archivo exportado antes. No se guarda solo: se ve en la vista previa y se puede probar; para quedarse con él, pulsa Guardar.")}>
          <div className="flex flex-col" style={{ gap: 6 }}>
            <div>
              <Btn kind="ghost" onClick={() => fileRef.current?.click()} testId="cfg-import">{t("Cargar un archivo…")}</Btn>
              <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={(e) => importFile(e.target.files?.[0])} data-testid="cfg-import-file" />
            </div>
            {imp && (
              <div style={{ fontSize: 12, borderRadius: 8, padding: "8px 10px", background: imp.ok ? "#F0FDF4" : "#FEF2F2", color: imp.ok ? "#166534" : "#B91C1C", border: `1px solid ${imp.ok ? "#BBF7D0" : "#FECACA"}` }} data-testid="cfg-import-result">
                {imp.ok
                  ? <>{t("Archivo cargado. Revisa las pestañas y pulsa Guardar para quedarte con él (o Descartar cambios).")}{imp.summary.length > 0 && <div style={{ marginTop: 4 }}>{t("Incluye:")} {imp.summary.map((s) => t(SUMMARY_LABEL[s])).join(" · ")}</div>}{imp.summary.length === 0 && <div style={{ marginTop: 4 }}>{t("El archivo no cambia nada: es la configuración de siempre.")}</div>}</>
                  : imp.text}
              </div>
            )}
          </div>
        </FieldRow>
        <p style={{ fontSize: 12, color: RS.muted, paddingTop: 8 }}>
          {t("Las imágenes y tipografías subidas van como enlaces: si se borran de esta app, el archivo deja de mostrarlas.")}
        </p>
      </Card>
    </div>
  );
}
