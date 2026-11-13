import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { Page, RS } from "@/components/rs2/kit";
import EmptyState from "@/components/common/EmptyState";
import TransfersTab from "@/components/season/TransfersTab";
import CloseTab from "@/components/season/CloseTab";
import { CloseSteps, StartChecklist } from "@/components/season/CloseOverview";
import HistoryTab from "@/components/season/HistoryTab";
import BackupTab from "@/components/season/BackupTab";
import DuplicatesTab from "@/components/season/DuplicatesTab";
import { useT, msg } from "@/i18n";

const prevOf = (s) => { const y = Number(s.slice(0, 4)) - 1; return `${y}-${y + 1}`; };
const lbl = (s) => s.replace(/^(\d{4})-\d{2}(\d{2})$/, "$1–$2");
const TABS = [["transfers", msg("Traspasos")], ["close", msg("Cierre de temporada")], ["history", msg("Historial y copias")]];

function TabPill({ on, onClick, children, testId }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId}
      style={{ border: `1px solid ${on ? RS.granate : RS.line}`, background: on ? RS.granate : "#fff", color: on ? "#fff" : RS.ink2, borderRadius: 999, padding: "5px 13px", fontSize: 13, fontWeight: on ? 700 : 500 }}>
      {children}
    </button>
  );
}

// Temporada: traspasos de fin de temporada, cierre (con los pasos y la lista para empezar la siguiente), historial y copias.
export default function Season() {
  const t = useT();
  const isMobile = useIsMobile();
  const { isCoordinator } = useTeamAccess();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get("tab")) ? params.get("tab") : "transfers";
  const season = [CURRENT_SEASON, prevOf(CURRENT_SEASON)].includes(params.get("season")) ? params.get("season") : CURRENT_SEASON;
  const go = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  const { data: status } = useQuery({ queryKey: ["season_status", season], queryFn: () => base44.club.seasonStatus(season), enabled: isCoordinator });
  const closed = !!status?.closes?.some((c) => c.season === season && c.status === "closed");

  if (!isCoordinator) return <EmptyState icon={Lock} title={t("Solo la coordinación del club puede gestionar las temporadas")} />;

  return (
    <Page testId="season">
      <div style={{ maxWidth: 1500, margin: "0 auto", padding: isMobile ? "12px 10px 24px" : "18px 22px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="flex flex-wrap items-end" style={{ gap: "8px 22px" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".16em", color: RS.muted, textTransform: "uppercase" }}>{t("Administración · Temporada {s}", { s: lbl(season) })}</div>
            <h1 style={{ margin: "2px 0 0", lineHeight: 1 }}><span className="rs2-display" style={{ fontSize: isMobile ? 30 : 36, color: RS.granate }}>{t("TEMPORADA")}</span></h1>
          </div>
          <div className="flex flex-wrap" style={{ gap: 6, paddingBottom: 2 }}>
            {TABS.map(([k, l]) => <TabPill key={k} on={tab === k} onClick={() => go({ tab: k === "transfers" ? null : k })} testId={`season-tab-${k}`}>{t(l)}</TabPill>)}
          </div>
          <select value={season} onChange={(e) => go({ season: e.target.value === CURRENT_SEASON ? null : e.target.value })} data-testid="season-select" aria-label={t("Temporada")}
            style={{ marginLeft: "auto", fontSize: 12.5, padding: "6px 10px", borderRadius: 8, border: `1px solid ${RS.line}`, background: "#fff", color: RS.ink }}>
            {[CURRENT_SEASON, prevOf(CURRENT_SEASON)].map((s) => <option key={s} value={s}>{t("Temporada {lbl}", { lbl: lbl(s) })}</option>)}
          </select>
        </div>

        {tab === "transfers" && <TransfersTab season={season} closed={closed} />}
        {tab === "close" && (
          <>
            <CloseSteps season={season} closed={closed} />
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start" style={{ gap: 12 }}>
              <CloseTab season={season} />
              <StartChecklist season={season} closed={closed} />
            </div>
          </>
        )}
        {tab === "history" && (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start" style={{ gap: 12 }}>
            <HistoryTab season={season} />
            <div className="flex flex-col" style={{ gap: 12 }}>
              <BackupTab />
              <DuplicatesTab />
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
