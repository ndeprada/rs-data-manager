import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import PageHeader from "@/components/common/PageHeader";
import TabBar from "@/components/common/TabBar";
import EmptyState from "@/components/common/EmptyState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TransfersTab from "@/components/season/TransfersTab";
import CloseTab from "@/components/season/CloseTab";
import HistoryTab from "@/components/season/HistoryTab";
import BackupTab from "@/components/season/BackupTab";
import DuplicatesTab from "@/components/season/DuplicatesTab";
import { useT, msg } from "@/i18n";

const prevOf = (s) => { const y = Number(s.slice(0, 4)) - 1; return `${y}-${y + 1}`; };
const lbl = (s) => s.replace("-", "–");

export default function Season() {
  const t = useT();
  const { isCoordinator } = useTeamAccess();
  const [tab, setTab] = useState("transfers");
  const [season, setSeason] = useState(CURRENT_SEASON);

  // ¿Esta temporada ya está cerrada? (para bloquear los traspasos)
  const { data: status } = useQuery({
    queryKey: ["season_status", season],
    queryFn: () => base44.club.seasonStatus(season),
    enabled: isCoordinator,
  });
  const closed = !!status?.closes?.some((c) => c.season === season && c.status === "closed");

  if (!isCoordinator) {
    return <EmptyState icon={Lock} title={t("Solo la coordinación del club puede gestionar las temporadas")} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        kicker={t("Administración")}
        title={t("Temporada")}
        subtitle={t("{lbl}: traspasos de jugadores, cierre, historial y copias de seguridad", { lbl: lbl(season) })}
        actions={
          <Select value={season} onValueChange={setSeason}>
            <SelectTrigger className="h-9 w-40 text-xs font-bold bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[CURRENT_SEASON, prevOf(CURRENT_SEASON)].map((s) => <SelectItem key={s} value={s}>{t("Temporada {lbl}", { lbl: lbl(s) })}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
      <TabBar
        value={tab}
        onChange={setTab}
        items={[
          { value: "transfers", label: msg("Traspasos") },
          { value: "close", label: msg("Nueva temporada") },
          { value: "history", label: msg("Historial") },
          { value: "backup", label: msg("Copias") },
          { value: "dupes", label: msg("Duplicados") },
        ]}
      />
      {tab === "transfers" && <TransfersTab season={season} closed={closed} />}
      {tab === "close" && <CloseTab season={season} />}
      {tab === "history" && <HistoryTab />}
      {tab === "backup" && <BackupTab />}
      {tab === "dupes" && <DuplicatesTab />}
    </div>
  );
}
