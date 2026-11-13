// Cabecera común de Mi equipo → Partidos, Desarrollo y Plantilla (rediseño del 13/11/2026): línea pequeña, título grande
// con el nombre del equipo, cambio de equipo (botones hasta 4 equipos; si no, desplegable) y botones a la derecha.
import React from "react";
import { Shield } from "lucide-react";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import { TeamSelectTrigger } from "@/components/myteam/TeamPageHeader";
import { useSelectedTeam } from "@/lib/useSelectedTeam";
import { RS } from "@/components/rs2/kit";
import { useT } from "@/i18n";

const PILL_MAX = 4;

export function TeamSwitch({ teams }) {
  const t = useT();
  const { selectedTeamId, selectTeam, isCoordinator, canSwitch, teamIds } = useSelectedTeam();
  const list = teams.filter((x) => isCoordinator || (teamIds || []).includes(x.id));
  if (!canSwitch || list.length < 2) return null;
  if (list.length > PILL_MAX) {
    return (
      <Select value={selectedTeamId || ""} onValueChange={(v) => v && selectTeam(v)}>
        <TeamSelectTrigger />
        <SelectContent>{list.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
      </Select>
    );
  }
  return (
    <div className="flex" style={{ gap: 4, background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 999, padding: 3 }} role="group" aria-label={t("Equipo")} data-testid="team-switch">
      {list.map((x) => (
        <button key={x.id} type="button" onClick={() => selectTeam(x.id)} aria-pressed={x.id === selectedTeamId}
          style={{ fontSize: 12, fontWeight: x.id === selectedTeamId ? 700 : 400, padding: "5px 12px", borderRadius: 999, border: 0, background: x.id === selectedTeamId ? RS.granate : "none", color: x.id === selectedTeamId ? "#fff" : RS.ink2 }}>{x.name}</button>
      ))}
    </div>
  );
}

/** Cabecera: `kicker` (línea pequeña), `title`, equipo y `children` (botones de la derecha) */
export default function TeamTop({ kicker, title, teams = [], children }) {
  return (
    <div className="flex flex-wrap items-end" style={{ gap: 12 }}>
      <div className="min-w-0">
        <p className="rs2-label truncate" style={{ letterSpacing: ".14em", textTransform: "uppercase" }}>{kicker}</p>
        <h1 style={{ margin: "2px 0 0" }}><span className="rs2-display" style={{ fontSize: 34, color: RS.granate }}>{title}</span></h1>
      </div>
      <div className="flex flex-wrap items-center" style={{ marginLeft: "auto", gap: 8 }}>
        <TeamSwitch teams={teams} />
        {children}
      </div>
    </div>
  );
}

/** Sin equipo elegido: el coordinador elige uno; el resto, aviso */
export function NoTeam({ teams = [] }) {
  const t = useT();
  const { selectTeam, isCoordinator } = useSelectedTeam();
  return isCoordinator ? (
    <div className="rs2-card" style={{ padding: 32, textAlign: "center" }}>
      <Shield className="w-10 h-10 mx-auto mb-3" style={{ color: RS.faint }} />
      <p style={{ color: RS.muted, marginBottom: 16 }}>{t("Selecciona un equipo")}</p>
      <div className="flex justify-center">
        <Select value="" onValueChange={selectTeam}>
          <TeamSelectTrigger />
          <SelectContent>{teams.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  ) : <p style={{ color: RS.muted }}>{t("No tienes un equipo asignado. Contacta con el coordinador.")}</p>;
}
