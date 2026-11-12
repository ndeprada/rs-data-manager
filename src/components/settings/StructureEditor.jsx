// Configuración → Estructura del club: nombres que usa la app para reconocer al club, apartados del menú visibles y
// accesos a equipos, campos y temporada (se gestionan en sus propias páginas, aquí solo el resumen).
import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useT } from "@/i18n";
import { MENU_SECTIONS } from "@/lib/menuSections";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { teamPlaysF7 } from "@/lib/matchFormat";
import { RS, Card } from "@/components/rs2/kit";
import { FieldRow, inputStyle } from "@/components/settings/BrandFields";

function Summary({ label, value, sub, to, testId }) {
  const t = useT();
  return (
    <Link to={to} className="block rs2-card hover:shadow-sm" style={{ padding: "10px 14px" }} data-testid={testId}>
      <div style={{ fontSize: 12, color: RS.muted }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: RS.granateDark, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: RS.ink2 }}>{sub}</div>}
      <div style={{ fontSize: 12, color: RS.granate, marginTop: 4, fontWeight: 600 }}>{t("Gestionar")} →</div>
    </Link>
  );
}

export function StructureEditor({ draft, set }) {
  const t = useT();
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: fields = [] } = useQuery({ queryKey: ["fields"], queryFn: () => base44.entities.Field.list() });
  const f7 = teams.filter(teamPlaysF7).length;
  const hidden = new Set(draft.hidden || []);
  const toggle = (k) => {
    const next = new Set(hidden);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    set({ hidden: MENU_SECTIONS.map((s) => s.key).filter((x) => next.has(x)) });
  };

  return (
    <div className="flex flex-col" style={{ gap: 12, maxWidth: 980 }}>
      <Card title={t("Equipos, campos y temporada")}>
        <p style={{ fontSize: 12, color: RS.muted, marginBottom: 8 }}>{t("Se gestionan en sus propias páginas. Aquí tienes el resumen y el acceso directo.")}</p>
        <div className="grid sm:grid-cols-3" style={{ gap: 10 }}>
          <Summary label={t("Equipos")} value={teams.length} sub={t("{f7} de fútbol 7 · {f11} de fútbol 11", { f7, f11: teams.length - f7 })} to="/Teams" testId="cfg-sum-teams" />
          <Summary label={t("Campos")} value={fields.length} to="/Fields" testId="cfg-sum-fields" />
          <Summary label={t("Temporada")} value={CURRENT_SEASON.replace("-20", "-")} sub={t("Cierre de temporada y traspasos")} to="/Season" testId="cfg-sum-season" />
        </div>
        <p style={{ fontSize: 12, color: RS.muted, marginTop: 8 }}>
          {t("Fútbol 7 hasta Aleví S12 y fútbol 11 desde Infantil S13, como marca la federación. La etapa sale de la categoría de cada equipo.")}
        </p>
      </Card>

      <Card title={t("Cómo se reconoce al club")}>
        <FieldRow label={t("Nombre corto")} help={t("Para textos breves, como el equipo propio en la pizarra de balón parado.")}>
          <input value={draft.shortName} maxLength={20} onChange={(e) => set({ shortName: e.target.value })} style={{ ...inputStyle, maxWidth: 220 }} data-testid="cfg-shortname" />
        </FieldRow>
        <FieldRow label={t("Nombre en las actas de la FCF")} help={t("El texto que llevan los equipos del club en las actas (sin la letra del equipo). Sirve para encontrar los partidos contra el club en scouting.")}>
          <input value={draft.fcfName} maxLength={40} onChange={(e) => set({ fcfName: e.target.value })} style={{ ...inputStyle, maxWidth: 320, textTransform: "uppercase" }} data-testid="cfg-fcfname" />
        </FieldRow>
      </Card>

      <Card title={t("Apartados del menú")} testId="cfg-menu">
        <p style={{ fontSize: 12, color: RS.muted, marginBottom: 6 }}>
          {t("Quita del menú lo que el club no use. No se borra nada y se puede volver a mostrar cuando quieras.")}
        </p>
        <div className="grid sm:grid-cols-3" style={{ gap: 6 }}>
          {MENU_SECTIONS.map((s) => {
            const on = !hidden.has(s.key);
            return (
              <button key={s.key} type="button" onClick={() => toggle(s.key)} data-testid={`cfg-menu-${s.key}`} data-on={on ? "1" : "0"}
                className="flex items-center justify-between text-left"
                style={{ height: 36, padding: "0 12px", borderRadius: 8, border: `1px solid ${on ? RS.line : RS.input}`, background: on ? "#fff" : "#F3EFEE", color: on ? RS.ink : RS.muted, fontSize: 13 }}>
                <span style={{ textDecoration: on ? "none" : "line-through" }}>{t(s.label)}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: on ? "#15803D" : RS.muted }}>{on ? t("Visible") : t("Oculto")}</span>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
