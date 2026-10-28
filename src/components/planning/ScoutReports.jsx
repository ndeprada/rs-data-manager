// Planificación → Scouting → Informes: todos los informes de observación y los seguimientos programados
import React, { useMemo, useState } from "react";
import FollowUpsList from "@/components/scouting/FollowUpsList";
import { RS, Card, Pills, Empty, SearchBox, DecisionChip, fmtDate } from "@/components/rs2/kit";
import { useScouted, useAllReports, usePlanningNav } from "./useScouting";
import { spName, spMeta } from "./labels";

export default function ScoutReports() {
  const { go } = usePlanningNav();
  const { data: reports = [], isLoading } = useAllReports();
  const { data: scouted = [] } = useScouted();
  const byId = useMemo(() => new Map(scouted.map((s) => [s.id, s])), [scouted]);
  const [rec, setRec] = useState("todos");
  const [q, setQ] = useState("");
  const nq = q.trim().toLowerCase();
  const rows = reports.filter((r) => {
    const p = byId.get(r.player_id);
    if (rec !== "todos" && r.recommendation !== rec) return false;
    if (nq && !`${p ? spName(p) : ""} ${r.scout_name || ""} ${r.match_observed || ""}`.toLowerCase().includes(nq)) return false;
    return true;
  });
  const count = (k) => reports.filter((r) => r.recommendation === k).length;

  return (
    <div className="flex flex-col" style={{ gap: 14 }} data-testid="scout-reports">
      <div>
        <h1 className="rs2-display" style={{ margin: 0, fontSize: 34, color: RS.granateDark }}>Informes</h1>
        <span style={{ fontSize: 13, color: RS.ink2 }}>{reports.length} informes de observación · los nuevos se crean desde la ficha de cada jugador</span>
      </div>
      <Card pad={false} testId="reports-list" title="Informes de observación"
        action={
          <div className="flex flex-wrap items-center" style={{ gap: 10 }}>
            <Pills value={rec} onChange={setRec} options={[
              { value: "todos", label: `Todos (${reports.length})` }, { value: "fichar", label: `A (${count("fichar")})` },
              { value: "seguir_viendo", label: `B (${count("seguir_viendo")})` }, { value: "descartar", label: `C (${count("descartar")})` },
            ]} />
            <div style={{ width: 240, maxWidth: "100%" }}><SearchBox value={q} onChange={setQ} placeholder="Jugador, autor o partido" /></div>
          </div>
        }>
        {rows.map((r) => {
          const p = byId.get(r.player_id);
          return (
            <button key={r.id} type="button" onClick={() => p && go({ s: "jugador", sp: p.id })} className="rs2-row w-full text-left"
              style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "4px 14px", padding: "8px 14px", background: "none" }}>
              <span className="flex flex-wrap items-center" style={{ gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{p ? spName(p) : "Jugador eliminado"}</span>
                <DecisionChip decision={r.recommendation} short empty="" />
              </span>
              <span style={{ fontSize: 12, color: RS.muted, textAlign: "right" }}>{fmtDate(r.report_date)}{r.scout_name ? ` · ${r.scout_name}` : ""}</span>
              {p && <span style={{ fontSize: 12, color: RS.ink2, gridColumn: "1 / -1" }}>{spMeta(p)}{r.match_observed ? ` · ${r.match_observed}` : ""}</span>}
              {(r.summary || r.strengths) && <span className="line-clamp-2" style={{ fontSize: 13, gridColumn: "1 / -1", lineHeight: 1.45 }}>{r.summary || r.strengths}</span>}
            </button>
          );
        })}
        {!isLoading && rows.length === 0 && <div style={{ padding: "0 18px 14px" }}><Empty>No hay informes con este filtro.</Empty></div>}
      </Card>

      <Card title="Seguimientos programados" action={<span style={{ fontSize: 12, color: RS.muted }}>Próximas observaciones de jugadores en seguimiento</span>}>
        <FollowUpsList />
      </Card>
    </div>
  );
}
