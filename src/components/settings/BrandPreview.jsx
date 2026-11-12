// Vista previa de la configuración del club sin guardar: una pantalla de la app en pequeño y la pantalla de acceso.
// Usa los valores del borrador directamente (no los del club guardados), así que cambia al momento.
import React from "react";
import { useT, msg } from "@/i18n";
import { RS } from "@/components/rs2/kit";

const NAV = [msg("Panel"), msg("Calendario"), msg("Equipos"), msg("Jugadores"), msg("Planificación")];
const KPIS = [["12", msg("Jugadores")], ["86%", msg("Asistencia")], ["7", msg("Partidos")]];

export function BrandPreview({ brand }) {
  const t = useT();
  const c = brand.colors, f = brand.fonts;
  const title = `'${f.titleName}', '${f.bodyName}', sans-serif`;
  const body = `'${f.bodyName}', sans-serif`;
  const nums = `'${f.numbersName}', '${f.bodyName}', sans-serif`;
  return (
    <div className="flex flex-col" style={{ gap: 12, fontFamily: body }} data-testid="brand-preview">
      {/* Pantalla de la app */}
      <div style={{ border: `1px solid ${RS.line}`, borderRadius: 12, overflow: "hidden", background: "#F5F2F1", display: "grid", gridTemplateColumns: "104px minmax(0,1fr)", minHeight: 300 }}>
        <div style={{ background: c.primary, color: "#fff", padding: "10px 8px" }} data-testid="pv-sidebar">
          <div className="flex items-center" style={{ gap: 6, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,.12)" }}>
            <div style={{ width: 22, height: 22, borderRadius: 5, background: "rgba(255,255,255,.13)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {brand.logoWhite && <img src={brand.logoWhite} alt="" style={{ width: 16, height: 16, objectFit: "contain" }} />}
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", lineHeight: 1.1 }} data-testid="pv-appname">{brand.appName}</span>
          </div>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: ".06em", opacity: 0.55, margin: "8px 4px 4px", textTransform: "uppercase" }}>{t("Administración")}</div>
          {NAV.map((n, i) => (
            <div key={n} style={{ fontSize: 10, padding: "4px 6px", borderRadius: 5, marginBottom: 2, background: i === 0 ? "rgba(255,255,255,.16)" : "transparent", fontWeight: i === 0 ? 600 : 400, opacity: i === 0 ? 1 : 0.8 }}>{t(n)}</div>
          ))}
        </div>
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontFamily: title, color: c.primary, fontSize: 22, textTransform: "uppercase", letterSpacing: ".04em", lineHeight: 1 }} data-testid="pv-title">{t("Mi equipo")}</div>
          <div style={{ color: c.accent, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>{t("Próximo partido")}</div>
          <div style={{ background: `linear-gradient(135deg, ${c.primary} 0%, ${c.primaryDark} 100%)`, color: "#fff", borderRadius: 10, padding: "10px 12px" }} data-testid="pv-band">
            <div style={{ fontFamily: title, fontSize: 16, textTransform: "uppercase", letterSpacing: ".04em" }}>{brand.clubName} · Rival</div>
            <div style={{ fontSize: 10, opacity: 0.8 }}>{t("Sábado")} · 10:30</div>
          </div>
          <div className="grid grid-cols-3" style={{ gap: 6 }}>
            {KPIS.map(([v, l]) => (
              <div key={l} style={{ background: "#fff", border: "1px solid #E6DEDD", borderRadius: 8, padding: "6px 8px" }}>
                <div style={{ fontSize: 9, color: RS.muted }}>{t(l)}</div>
                <div style={{ fontFamily: nums, fontSize: 20, color: c.primaryDark, lineHeight: 1.05 }}>{v}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center" style={{ gap: 6 }}>
            <span style={{ background: c.primary, color: "#fff", fontSize: 10, fontWeight: 600, padding: "5px 10px", borderRadius: 6 }}>{t("Guardar")}</span>
            <span style={{ background: c.accent, color: "#1F1416", fontSize: 10, fontWeight: 700, padding: "5px 10px", borderRadius: 6 }}>{t("Nuevo")}</span>
            <span style={{ border: `1px solid ${c.primary}`, color: c.primary, fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: "#fff" }}>{t("Cancelar")}</span>
            <span style={{ background: c.primarySoft, color: c.primary, fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 999 }}>{t("Convocado")}</span>
            <span style={{ background: c.accentSoft, color: c.accent, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999 }}>{t("Duda")}</span>
          </div>
          <div style={{ background: c.deep, borderRadius: 8, height: 26, display: "flex", alignItems: "center", gap: 6, padding: "0 8px" }} title={t("Barras de la pizarra")}>
            {[0, 1, 2, 3].map((i) => <span key={i} style={{ width: 14, height: 14, borderRadius: 4, background: i === 1 ? c.accent : "rgba(255,255,255,.18)" }} />)}
            <span style={{ fontSize: 9, color: "rgba(255,255,255,.7)", marginLeft: 4 }}>{t("Pizarra")}</span>
          </div>
        </div>
      </div>

      {/* Pantalla de acceso */}
      <div style={{ border: `1px solid ${RS.line}`, borderRadius: 12, overflow: "hidden", height: 170, position: "relative", background: brand.loginImage ? `center / cover no-repeat url("${brand.loginImage}")` : "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center" }} data-testid="pv-login">
        {brand.loginImage && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.35)" }} />}
        <div style={{ position: "relative", background: "#fff", borderRadius: 10, padding: "12px 18px", textAlign: "center", boxShadow: "0 2px 10px rgba(0,0,0,.12)", minWidth: 170 }}>
          {brand.logo && <img src={brand.logo} alt="" style={{ width: 30, height: 30, objectFit: "contain", margin: "0 auto 4px" }} />}
          <div style={{ fontFamily: body, color: c.primary, fontSize: 16, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em" }}>{brand.appName}</div>
          <div style={{ marginTop: 8, background: c.primary, color: "#fff", fontSize: 10, fontWeight: 600, borderRadius: 6, padding: "5px 0" }}>{t("Entrar")}</div>
        </div>
      </div>
    </div>
  );
}
