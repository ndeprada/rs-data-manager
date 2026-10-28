// Planificación → Scouting → Alertas (maqueta «Scouting · Alertas» aprobada por Nacho)
import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { RS, Card, Tag, Pills, Empty, seasonShort } from "@/components/rs2/kit";
import { titleCase, fcfDisplayName, fcfNameParts } from "@/lib/fcfNames";
import { SEASON, useAlerts, usePlanningNav } from "./useScouting";

const isF7Comp = (c) => /ALEV|BENJAM|PREBENJ/i.test(c);
const prevSeason = (s) => { const a = Number(String(s).slice(0, 4)); return `${a - 1}-${a}`; };

export function newScoutFromFcf({ name, player_id, team, competition, birth_year }) {
  const { first_name, last_name } = fcfNameParts(name);
  return {
    first_name, last_name, fcf_id: String(player_id), current_club: titleCase(team), category: titleCase(competition),
    birth_year: birth_year || null, decision: "seguir_viendo", contact_status: "no_contactado", origin: "fcf", source: "fcf",
    modality: isF7Comp(competition) ? "futbol_7" : "futbol_11",
  };
}

export default function ScoutAlerts() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { go } = usePlanningNav();
  const alerts = useAlerts();
  const [kind, setKind] = useState(null);
  const [filter, setFilter] = useState("todas");
  const all = alerts.list;
  const nFirst = alerts.fresh.filter((a) => a.kind === "primer_ano").length;
  const nUp = alerts.fresh.filter((a) => a.kind === "arriba").length;
  const rows = all.filter((a) => (!kind || a.kind === kind)
    && (filter !== "f11" || !isF7Comp(a.competition)) && (filter !== "f7" || isF7Comp(a.competition)) && (filter !== "nuevas" || !a.followed));

  const follow = useMutation({
    mutationFn: (a) => base44.entities.ScoutedPlayer.create(newScoutFromFcf(a)),
    onSuccess: (_d, a) => { qc.invalidateQueries({ queryKey: ["scouted_players"] }); toast({ title: `${fcfDisplayName(a.name)} en seguimiento`, description: "Con origen «Detectado FCF» y decisión B · Seguir viendo." }); },
    onError: () => toast({ title: "No se ha podido añadir", variant: "destructive" }),
  });
  const dismiss = useMutation({
    mutationFn: (a) => base44.entities.ScoutAlertDismiss.create({ fcf_id: String(a.player_id), kind: a.kind, season: SEASON }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scout_alert_dismiss"] }),
    onError: () => toast({ title: "No se ha podido descartar", variant: "destructive" }),
  });

  const typeCard = (k, n, title, text, dark) => {
    const on = kind === k;
    return (
      <button type="button" onClick={() => setKind(on ? null : k)} data-testid={`alert-type-${k}`} className="flex text-left"
        style={{ background: dark ? RS.granateDark : RS.naranja, color: dark ? "#fff" : RS.ink, borderRadius: 12, padding: "16px 18px", gap: 16, alignItems: "flex-start",
          outline: on ? `3px solid ${dark ? RS.naranja : RS.granateDark}` : "none", outlineOffset: 2 }}>
        <span className="rs2-display tabular-nums" style={{ fontSize: 46, lineHeight: 0.9 }}>{n}</span>
        <span className="flex flex-col" style={{ gap: 4 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>{title}</span>
          <span style={{ fontSize: 14, opacity: dark ? 0.9 : 1 }}>{text}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col" style={{ gap: 20 }} data-testid="scout-alerts">
      <div>
        <h1 className="rs2-display" style={{ margin: 0, fontSize: 44, color: RS.granateDark }}>Alertas</h1>
        <span style={{ fontSize: 14, color: RS.ink2 }}>{alerts.fresh.length} sin revisar · temporada {seasonShort(SEASON)} · calculadas con las actas leídas de la FCF</span>
      </div>

      <section aria-label="Tipos de alerta" className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
        {typeCard("primer_ano", nFirst, "Juvenil de 1.º año en categoría alta",
          `Nacido en ${Number(SEASON.slice(0, 4)) - 16} que juega en Liga Nacional, Preferent o Primera Divisió. El año se deduce de la temporada ${seasonShort(prevSeason(SEASON))} (Cadet S16).`, true)}
        {typeCard("arriba", nUp, "Jugando por arriba",
          "Aparece en actas de una categoría superior a la suya (la más joven en la que juega esta temporada).", false)}
      </section>

      <Card pad={false} testId="alerts-list" title={kind ? (kind === "arriba" ? "Jugando por arriba" : "Juveniles de 1.º año") : "Pendientes de revisar"}
        action={<Pills value={filter} onChange={setFilter} options={[{ value: "todas", label: "Todas" }, { value: "f11", label: "F11" }, { value: "f7", label: "F7" }, { value: "nuevas", label: "Solo nuevas" }]} />}>
        <div className="rs2-scroll-x">
          <div style={{ minWidth: 860 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1.4fr) minmax(0,1.4fr) 132px 200px", gap: 14, padding: "9px 18px", background: RS.head,
              borderTop: `1px solid ${RS.lineSoft}`, fontSize: 12, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: RS.muted }}>
              <span>Jugador</span><span>Equipo · competición</span><span>Motivo</span><span>PJ · Tit · Goles</span><span />
            </div>
            {rows.map((a) => (
              <div key={a.key} data-testid={`alert-${a.player_id}`} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1.4fr) minmax(0,1.4fr) 132px 200px", gap: 14, alignItems: "center", padding: "12px 18px", borderTop: `1px solid ${RS.lineSoft}` }}>
                <span className="flex flex-col" style={{ gap: 4, minWidth: 0 }}>
                  <span className="flex items-center flex-wrap" style={{ gap: 8 }}>
                    <Tag kind={a.kind === "arriba" ? "orange" : "dark"}>{a.kind === "arriba" ? "POR ARRIBA" : "1.º AÑO"}</Tag>
                    {a.birth_year && <span style={{ fontWeight: 700, fontSize: 14, padding: "2px 8px", borderRadius: 6, background: RS.soft, color: RS.granateDark }}>{a.birth_year}</span>}
                  </span>
                  <button type="button" onClick={() => go(a.followed ? { s: "jugador", sp: a.followed.id } : { s: "jugador", fcf: a.player_id })} style={{ fontWeight: 600, fontSize: 16, color: RS.ink, background: "none", textAlign: "left" }}>
                    {fcfDisplayName(a.name)}
                  </button>
                </span>
                <span className="flex flex-col" style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{titleCase(a.team)}</span>
                  <span style={{ fontSize: 13, color: RS.muted }}>{titleCase(a.competition)} · {titleCase(a.grp)}</span>
                </span>
                <span style={{ fontSize: 14, color: RS.ink2 }}>
                  {a.kind === "arriba"
                    ? `Su categoría: ${titleCase(a.own_comp)} (${titleCase(a.own_team)}) · ${a.pj} ${a.pj === 1 ? "acta" : "actas"} con el equipo superior`
                    : `${seasonShort(prevSeason(SEASON))} en ${titleCase(a.prev_comp)} (${titleCase(a.prev_team)})`}
                </span>
                <span className="tabular-nums" style={{ fontSize: 15 }}><strong>{a.pj}</strong> · {a.tit} · <strong style={{ color: RS.granate }}>{a.goals}</strong></span>
                <span className="flex justify-end" style={{ gap: 8 }}>
                  {a.followed ? (
                    <span className="inline-flex items-center" style={{ height: 40, padding: "0 12px", borderRadius: 8, background: RS.orangeSoft, color: RS.orangeInk, fontSize: 14, fontWeight: 600 }}>En seguimiento</span>
                  ) : (
                    <>
                      <button type="button" onClick={() => follow.mutate(a)} disabled={follow.isPending} data-testid={`alert-follow-${a.player_id}`}
                        style={{ height: 40, padding: "0 14px", borderRadius: 8, background: RS.granate, color: "#fff", fontSize: 14, fontWeight: 600 }}>Seguir</button>
                      <button type="button" onClick={() => dismiss.mutate(a)} disabled={dismiss.isPending}
                        style={{ height: 40, padding: "0 12px", borderRadius: 8, border: `1px solid ${RS.input}`, background: "#fff", color: RS.ink2, fontSize: 14 }}>Descartar</button>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
        {alerts.isLoading && <div style={{ padding: 20 }}><Loader2 className="animate-spin" color={RS.faint} /></div>}
        {!alerts.isLoading && rows.length === 0 && (
          <div style={{ padding: "4px 18px 14px" }}>
            <Empty>No hay alertas con este filtro.{(!kind || kind === "primer_ano") && nFirst === 0 ? ` La de juveniles de 1.º año necesita tener cargada la temporada ${seasonShort(prevSeason(SEASON))} de Cadet S16.` : ""}</Empty>
          </div>
        )}
        <p style={{ margin: 0, padding: "12px 18px", fontSize: 13, color: RS.muted, borderTop: `1px solid ${RS.lineSoft}` }}>
          «Seguir» añade el jugador a la base de datos de seguimiento con origen «Detectado FCF» y la decisión B · Seguir viendo. «Descartar» la quita de esta lista.
        </p>
      </Card>
    </div>
  );
}
