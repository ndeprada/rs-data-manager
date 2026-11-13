// Metodología (rediseño rs2 del 13/11/2026, maqueta «Maqueta Metodología · RS Manager» aprobada por Nacho):
// Sesiones · Control de contenidos · Biblioteca de tareas (?tab=control|biblioteca).
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Page, RS } from "@/components/rs2/kit";
import TaskLibrary from "@/components/methodology/TaskLibrary";
import SessionsHome from "@/components/sessions/SessionsHome";
import ContentControl from "@/components/sessions/ContentControl";
import { PillBtn } from "@/components/methodology/MethParts";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { useT, msg } from "@/i18n";

const TABS = [["sesiones", msg("Sesiones")], ["control", msg("Control de contenidos")], ["biblioteca", msg("Biblioteca de tareas")]];
const lbl = (s) => s.replace(/^(\d{4})-\d{2}(\d{2})$/, "$1–$2");

export default function Methodology() {
  const t = useT();
  const isMobile = useIsMobile();
  const { isCoordinator, teamIds, selectedTeamId, perms } = useTeamAccess();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get("tab")) ? params.get("tab") : "sesiones";
  const [libQuery, setLibQuery] = useState("");
  const go = (k) => {
    const next = new URLSearchParams(params);
    if (k === "sesiones") next.delete("tab"); else next.set("tab", k);
    next.delete("session");
    setParams(next, { replace: true });
  };

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  // Coordinadores ven todos los equipos, entrenadores solo los suyos
  const visibleTeams = isCoordinator || perms.allTeams ? teams : teams.filter((x) => teamIds.includes(x.id));

  return (
    <Page testId="methodology">
      <div style={{ maxWidth: 1500, margin: "0 auto", padding: isMobile ? "12px 10px 24px" : "18px 22px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="flex flex-wrap items-end" style={{ gap: "8px 22px" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".16em", color: RS.muted, textTransform: "uppercase" }}>{t("Herramientas · Temporada {s}", { s: lbl(CURRENT_SEASON) })}</div>
            <h1 style={{ margin: "2px 0 0", lineHeight: 1 }}><span className="rs2-display" style={{ fontSize: isMobile ? 30 : 36, color: RS.granate }}>{t("METODOLOGÍA")}</span></h1>
          </div>
          <div className="flex flex-wrap" style={{ gap: 6, paddingBottom: 2 }}>
            {TABS.map(([k, l]) => <PillBtn key={k} on={tab === k} onClick={() => go(k)} testId={`meth-tab-${k}`}>{t(l)}</PillBtn>)}
          </div>
        </div>
        {tab === "sesiones" && <SessionsHome teams={visibleTeams} isCoordinator={isCoordinator} defaultTeamId={selectedTeamId} onGoControl={() => go("control")} />}
        {tab === "control" && <ContentControl teams={visibleTeams} isCoordinator={isCoordinator} defaultTeamId={selectedTeamId} onGoLibrary={(q) => { setLibQuery(q); go("biblioteca"); }} />}
        {tab === "biblioteca" && <TaskLibrary teams={visibleTeams} initialQuery={libQuery} />}
      </div>
    </Page>
  );
}
