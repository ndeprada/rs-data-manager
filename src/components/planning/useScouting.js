// Datos de Planificación → Scouting (jugadores en seguimiento, informes, equipos seguidos, base de datos FCF y alertas).
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { CURRENT_SEASON } from "@/lib/staffRoles";

export const SEASON = CURRENT_SEASON;

export function useIsPlanningAdmin() {
  const { perms } = useTeamAccess();
  return !!perms?.administration;
}

// Navegación dentro de Planificación con la dirección de la página (así «atrás» del navegador funciona y se puede compartir)
export function usePlanningNav() {
  const [params, setParams] = useSearchParams();
  const get = (k, d = "") => params.get(k) ?? d;
  const go = (patch, { replace = false, keep = false } = {}) => {
    const next = keep ? new URLSearchParams(params) : new URLSearchParams();
    if (!keep) for (const k of ["t", "s"]) if (params.get(k) && !(k in patch)) next.set(k, params.get(k));
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === "") next.delete(k); else next.set(k, String(v));
    }
    setParams(next, { replace });
  };
  return { params, get, go };
}

export function useScouted() {
  return useQuery({ queryKey: ["scouted_players"], queryFn: () => base44.entities.ScoutedPlayer.list("-created_date", 500) });
}

export function useAllReports() {
  return useQuery({ queryKey: ["scouting_reports_all"], queryFn: () => base44.entities.ScoutingReport.list("-report_date", 300) });
}

export function useFollows(enabled = true) {
  return useQuery({ queryKey: ["scout_follows"], enabled, queryFn: () => base44.entities.ScoutFollow.list("-created_date", 300) });
}

export function useFcfMeta(enabled = true) {
  return useQuery({ queryKey: ["fcf-meta"], enabled, queryFn: () => base44.club.fcfMeta(), staleTime: 60_000 });
}

// Alertas de la temporada sin las descartadas; las de jugadores que ya se siguen quedan marcadas como «en seguimiento»
export function useAlerts(enabled = true) {
  const { data: raw = [], isLoading } = useQuery({ queryKey: ["fcf-alerts", SEASON], enabled, queryFn: () => base44.club.fcfAlerts(SEASON), staleTime: 60_000 });
  const { data: dismissed = [] } = useQuery({ queryKey: ["scout_alert_dismiss"], enabled, queryFn: () => base44.entities.ScoutAlertDismiss.list("-created_date", 1000) });
  const { data: scouted = [] } = useScouted();
  return useMemo(() => {
    const off = new Set(dismissed.map((d) => `${d.kind}:${d.fcf_id}`));
    const followed = new Map(scouted.filter((s) => s.fcf_id).map((s) => [String(s.fcf_id), s]));
    const list = raw
      .filter((a) => !off.has(`${a.kind}:${a.player_id}`))
      .map((a) => ({ ...a, key: `${a.kind}:${a.player_id}:${a.competition}`, followed: followed.get(String(a.player_id)) || null }));
    return { list, fresh: list.filter((a) => !a.followed), dismissed, isLoading };
  }, [raw, dismissed, scouted, isLoading]);
}

// Jugadores en seguimiento indexados por su ID de la FCF
export function useScoutedByFcf() {
  const { data: scouted = [] } = useScouted();
  return useMemo(() => new Map(scouted.filter((s) => s.fcf_id).map((s) => [String(s.fcf_id), s])), [scouted]);
}

// Ids FCF de los jugadores que juegan por arriba (para pintar el año en naranja)
export function useUpIds(alertList) {
  return useMemo(() => new Set((alertList || []).filter((a) => a.kind === "arriba").map((a) => String(a.player_id))), [alertList]);
}
