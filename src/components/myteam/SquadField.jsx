// Mi equipo → Plantilla, vista «Campo» (13/11/2026): la plantilla colocada por puestos sobre el campo (F11: 12 puestos;
// F7: los 7 del sistema base), con los mismos puestos que Planificación (src/lib/squadPlan.js). Solo para mirar:
// tocar un jugador abre su ficha. No cambia nada.
import React from "react";
import { Link } from "react-router-dom";
import { buildPlan, lineCount } from "@/lib/squadPlan";
import { PitchSvg } from "@/components/scouting/SquadPitch";
import { RS } from "@/components/rs2/kit";
import { useT, msg } from "@/i18n";

const REASON = { lesion: msg("Lesión"), enfermo: msg("Enfermo"), sancion: msg("Sanción"), viaje: msg("Viaje"), estudios: msg("Estudios") };

const LANE = { l: 0, c: 1, r: 2 };

/** rows: filas de useSquadRows; out: Map playerId → { reason } (lesión, sanción…) */
export default function SquadField({ rows, teams, teamId, isF7, outById }) {
  const t = useT();
  const plan = buildPlan({ players: rows.map((r) => r.p), teams, teamId, isF7 });
  const lines = lineCount(isF7);
  return (
    <div style={{ padding: 14 }} data-testid="squad-field">
      <div style={{ position: "relative", maxWidth: 520, margin: "0 auto", aspectRatio: isF7 ? "45 / 65" : "68 / 105", borderRadius: 12, overflow: "hidden", background: "#2F7D45" }}>
        <div style={{ position: "absolute", inset: 0 }}><PitchSvg isF7={isF7} vertical /></div>
        <div style={{ position: "absolute", inset: 8, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gridTemplateRows: `repeat(${lines}, minmax(0, 1fr))`, gap: 6 }}>
          {plan.zones.map((z) => (
            <div key={z.key} style={{ gridRow: lines - z.line, gridColumn: LANE[z.lane] + 1, display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }} data-testid={`field-zone-${z.key}`}>
              <div style={{ borderRadius: 8, padding: 3, background: z.items.length ? "rgba(0,0,0,.35)" : "rgba(0,0,0,.18)", border: `1px ${z.items.length ? "solid" : "dashed"} rgba(255,255,255,.4)`, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,.6)" }}>
                  {t(z.label)}{z.items.length > 0 && <span style={{ marginLeft: 4, opacity: 0.8 }}>{z.items.length}</span>}
                </span>
                {z.items.map((it) => {
                  const o = outById.get(it.id);
                  const bad = o && (o.reason === "lesion" || o.reason === "enfermo");
                  const r = rows.find((x) => x.p.id === it.id);
                  return (
                    <Link key={it.key} to={`/PlayerProfile?id=${it.id}`} className="flex items-center" title={o ? t(REASON[o.reason] || o.reason) : ""}
                      style={{ gap: 4, background: "#fff", borderRadius: 5, padding: "1px 5px", fontSize: 11, color: RS.ink, borderLeft: `3px solid ${bad ? "#DC2626" : o ? "#D97706" : "#16A34A"}`, minWidth: 0 }}>
                      <b style={{ color: RS.granate, minWidth: 14, textAlign: "right" }}>{r?.p.jersey_number ?? "·"}</b>
                      <span className="truncate">{it.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      {plan.unplaced.length > 0 && (
        <p style={{ fontSize: 12, color: RS.muted, marginTop: 8, textAlign: "center" }}>
          {t("Sin posición:")} {plan.unplaced.map((it) => it.name).join(", ")}
        </p>
      )}
      <p style={{ fontSize: 11.5, color: RS.muted, marginTop: 6, textAlign: "center" }}>
        <span style={{ color: "#16A34A" }}>■</span> {t("disponible")} · <span style={{ color: "#D97706" }}>■</span> {t("sanción u otro motivo")} · <span style={{ color: "#DC2626" }}>■</span> {t("lesión o enfermedad")}
      </p>
    </div>
  );
}
