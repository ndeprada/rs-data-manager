// Planificación → Scouting → Alertas (maqueta «Scouting · Alertas» aprobada por Nacho)
import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { RS, Card, Tag, Pills, Empty, seasonShort, Dorsals, YearBadge, useDensity, DensityToggle } from "@/components/rs2/kit";
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
  const [density, setDensity] = useDensity();
  const dense = density === "lista";
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
        style={{ background: dark ? RS.granateDark : RS.naranja, color: dark ? "#fff" : RS.ink, borderRadius: 12, padding: "10px 14px", gap: 12, alignItems: "flex-start",
          outline: on ? `3px solid ${dark ? RS.naranja : RS.granateDark}` : "none", outlineOffset: 2 }}>
        <span className="rs2-display tabular-nums" style={{ fontSize: 46, lineHeight: 0.9 }}>{n}</span>
        <span className="flex flex-col" style={{ gap: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
          <span style={{ fontSize: 13, opacity: dark ? 0.9 : 1 }}>{text}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col" style={{ gap: 14 }} data-testid="scout-alerts">
      <div>
        <h1 className="rs2-display" style={{ margin: 0, fontSize: 34, color: RS.granateDark }}>Alertas</h1>
        <span style={{ fontSize: 13, color: RS.ink2 }}>{alerts.fresh.length} sin revisar · temporada {seasonShort(SEASON)} · calculadas con las actas leídas de la FCF</span>
      </div>

      <section aria-label="Tipos de alerta" className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 10 }}>
        {typeCard("primer_ano", nFirst, "Juvenil de 1.º año titular",
          `Nacido en ${Number(SEASON.slice(0, 4)) - 16}, titular en el 80 % de sus partidos (y al menos 4 veces) en Juvenil Preferent, Primera o Segona. El resto de juveniles se distinguen por el color de su año.`, true)}
        {typeCard("arriba", nUp, "Jugando por arriba",
          "Aparece en actas de una categoría superior a la suya (la más joven en la que juega esta temporada).", false)}
      </section>

      <Card pad={false} testId="alerts-list" title={kind ? (kind === "arriba" ? "Jugando por arriba" : "Juveniles de 1.º año") : "Pendientes de revisar"}
        action={<span className="inline-flex flex-wrap items-center" style={{ gap: 10 }}><Pills value={filter} onChange={setFilter} options={[{ value: "todas", label: "Todas" }, { value: "f11", label: "F11" }, { value: "f7", label: "F7" }, { value: "nuevas", label: "Solo nuevas" }]} /><DensityToggle value={density} onChange={setDensity} /></span>}>
        {dense && (
          <div className="rs2-scroll-x">
            <table className="rs2-tbl rs2-compact" style={{ minWidth: 980 }} data-testid="alerts-table">
              <thead><tr>
                <th className="l" scope="col">Tipo</th><th scope="col">Dorsal</th><th className="l" scope="col">Jugador</th><th scope="col">Año</th><th className="l" scope="col">Equipo</th><th className="l" scope="col">Competición · grupo</th>
                <th className="l" scope="col">Motivo</th><th scope="col">PJ</th><th scope="col">Tit.</th><th scope="col">Goles</th><th scope="col"><span className="sr-only">Acciones</span></th>
              </tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.key} data-testid={`alert-${a.player_id}`} className="rs2-click" onClick={() => go(a.followed ? { s: "jugador", sp: a.followed.id } : { s: "jugador", fcf: a.player_id })}>
                    <td className="l"><span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 5px", borderRadius: 4, ...(a.kind === "arriba" ? { background: RS.naranja, color: RS.ink } : { background: RS.granateDark, color: "#fff" }) }}>{a.kind === "arriba" ? "POR ARRIBA" : "1.º AÑO"}</span></td>
                    <td>{a.dorsals?.length ? <Dorsals list={a.dorsals} size="sm" /> : "—"}</td>
                    <td className="l" style={{ fontWeight: 600 }}>{fcfDisplayName(a.name)}</td>
                    <td>{a.birth_year ? <YearBadge year={a.birth_year} estimated sm /> : "—"}</td>
                    <td className="l" style={{ maxWidth: 210, overflow: "hidden", textOverflow: "ellipsis" }} title={titleCase(a.team)}>{titleCase(a.team)}</td>
                    <td className="l" style={{ maxWidth: 230, overflow: "hidden", textOverflow: "ellipsis", color: RS.muted }}>{titleCase(a.competition)} · {titleCase(a.grp)}</td>
                    <td className="l" style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", color: RS.ink2 }}
                      title={a.kind === "arriba" ? `Su categoría: ${titleCase(a.own_comp)} (${titleCase(a.own_team)})` : a.prev_comp ? `${seasonShort(prevSeason(SEASON))} en ${titleCase(a.prev_comp)} (${titleCase(a.prev_team)})` : undefined}>
                      {a.kind === "arriba" ? `Su categoría: ${titleCase(a.own_comp)}` : `Titular ${a.tit} de ${a.pj}`}
                    </td>
                    <td style={{ fontWeight: 600 }}>{a.pj}</td><td>{a.tit}</td><td style={{ fontWeight: 700, color: RS.granate }}>{a.goals}</td>
                    <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: "nowrap" }}>
                      {a.followed ? <span style={{ fontSize: 11, fontWeight: 600, color: RS.orangeInk }}>En seguimiento</span> : (
                        <span className="inline-flex" style={{ gap: 6 }}>
                          <button type="button" onClick={() => follow.mutate(a)} disabled={follow.isPending} data-testid={`alert-follow-${a.player_id}`}
                            style={{ height: 22, padding: "0 9px", borderRadius: 6, background: RS.granate, color: "#fff", fontSize: 11.5, fontWeight: 600 }}>Seguir</button>
                          <button type="button" onClick={() => dismiss.mutate(a)} disabled={dismiss.isPending}
                            style={{ height: 22, padding: "0 8px", borderRadius: 6, border: `1px solid ${RS.input}`, background: "#fff", color: RS.ink2, fontSize: 11.5 }}>Descartar</button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!dense && <div className="rs2-scroll-x">
          <div style={{ minWidth: 860 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1.4fr) minmax(0,1.4fr) 132px 200px", gap: 10, padding: "6px 14px", background: RS.head,
              borderTop: `1px solid ${RS.lineSoft}`, fontSize: 11, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: RS.muted }}>
              <span>Jugador</span><span>Equipo · competición</span><span>Motivo</span><span>PJ · Tit · Goles</span><span />
            </div>
            {rows.map((a) => (
              <div key={a.key} data-testid={`alert-${a.player_id}`} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1.4fr) minmax(0,1.4fr) 132px 200px", gap: 10, alignItems: "center", padding: "8px 14px", borderTop: `1px solid ${RS.lineSoft}` }}>
                <span className="flex flex-col" style={{ gap: 4, minWidth: 0 }}>
                  <span className="flex items-center flex-wrap" style={{ gap: 8 }}>
                    <Tag kind={a.kind === "arriba" ? "orange" : "dark"}>{a.kind === "arriba" ? "POR ARRIBA" : "1.º AÑO"}</Tag>
                    {a.birth_year && <YearBadge year={a.birth_year} estimated />}
                    {a.dorsals?.length > 0 && <Dorsals list={a.dorsals} />}
                  </span>
                  <button type="button" onClick={() => go(a.followed ? { s: "jugador", sp: a.followed.id } : { s: "jugador", fcf: a.player_id })} style={{ fontWeight: 600, fontSize: 14, color: RS.ink, background: "none", textAlign: "left" }}>
                    {fcfDisplayName(a.name)}
                  </button>
                </span>
                <span className="flex flex-col" style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{titleCase(a.team)}</span>
                  <span style={{ fontSize: 12, color: RS.muted }}>{titleCase(a.competition)} · {titleCase(a.grp)}</span>
                </span>
                <span style={{ fontSize: 13, color: RS.ink2 }}>
                  {a.kind === "arriba"
                    ? `Su categoría: ${titleCase(a.own_comp)} (${titleCase(a.own_team)}) · ${a.pj} ${a.pj === 1 ? "acta" : "actas"} con el equipo superior`
                    : `${a.tit} titularidades en ${a.pj} partidos${a.prev_comp ? ` · ${seasonShort(prevSeason(SEASON))} en ${titleCase(a.prev_comp)} (${titleCase(a.prev_team)})` : ""}`}
                </span>
                <span className="tabular-nums" style={{ fontSize: 13 }}><strong>{a.pj}</strong> · {a.tit} · <strong style={{ color: RS.granate }}>{a.goals}</strong></span>
                <span className="flex justify-end" style={{ gap: 8 }}>
                  {a.followed ? (
                    <span className="inline-flex items-center" style={{ height: 32, padding: "0 12px", borderRadius: 8, background: RS.orangeSoft, color: RS.orangeInk, fontSize: 13, fontWeight: 600 }}>En seguimiento</span>
                  ) : (
                    <>
                      <button type="button" onClick={() => follow.mutate(a)} disabled={follow.isPending} data-testid={`alert-follow-${a.player_id}`}
                        style={{ height: 32, padding: "0 14px", borderRadius: 8, background: RS.granate, color: "#fff", fontSize: 13, fontWeight: 600 }}>Seguir</button>
                      <button type="button" onClick={() => dismiss.mutate(a)} disabled={dismiss.isPending}
                        style={{ height: 32, padding: "0 12px", borderRadius: 8, border: `1px solid ${RS.input}`, background: "#fff", color: RS.ink2, fontSize: 13 }}>Descartar</button>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>}
        {alerts.isLoading && <div style={{ padding: 20 }}><Loader2 className="animate-spin" color={RS.faint} /></div>}
        {!alerts.isLoading && rows.length === 0 && (
          <div style={{ padding: "4px 18px 14px" }}>
            <Empty>No hay alertas con este filtro.{(!kind || kind === "primer_ano") && nFirst === 0 ? ` La de juveniles de 1.º año necesita tener cargada la temporada ${seasonShort(prevSeason(SEASON))} de Cadet S16.` : ""}</Empty>
          </div>
        )}
        <p style={{ margin: 0, padding: "8px 14px", fontSize: 12, color: RS.muted, borderTop: `1px solid ${RS.lineSoft}` }}>
          «Seguir» añade el jugador a la base de datos de seguimiento con origen «Detectado FCF» y la decisión B · Seguir viendo. «Descartar» la quita de esta lista.
        </p>
      </Card>
    </div>
  );
}
