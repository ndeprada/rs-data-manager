// Planificación → Scouting → Ficha del jugador (maqueta «Scouting · Ficha del jugador» aprobada por Nacho)
// Junta lo que sabemos del jugador: su ficha de seguimiento (decisión A/B/C, origen, posición, informes, vídeos…) y su trayectoria en la FCF.
import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, UserPlus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import ScoutedPlayerForm from "@/components/scouting/ScoutedPlayerForm";
import PlayerReportsTab from "@/components/scouting/PlayerReportsTab";
import PlayerAttributesPanel from "@/components/scouting/PlayerAttributesPanel";
import PlayerVideosTab from "@/components/scouting/PlayerVideosTab";
import PlayerImagesTab from "@/components/scouting/PlayerImagesTab";
import PlayerSeasonHistoryTab from "@/components/scouting/PlayerSeasonHistoryTab";
import PlayerFollowUpsTab from "@/components/scouting/PlayerFollowUpsTab";
import { RS, Card, Btn, BackLink, Chip, Empty, Pills, Dorsals, DECISION, DECISION_KEYS, ORIGIN, originOf, fmtDate, seasonShort } from "@/components/rs2/kit";
import { titleCase, fcfDisplayName } from "@/lib/fcfNames";
import { juvenilYear, JUV_STYLE } from "@/lib/juvenilYear";
import { nextSeason, roleFull } from "@/lib/squadPlan";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { useScouted, usePlanningNav, useIsPlanningAdmin } from "./useScouting";
import { SCOUT_POSITION, LATERALITY, CONTACT, spName, isRacingTeam } from "./labels";
import { newScoutFromFcf } from "./ScoutAlerts";

const label = { fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: RS.muted };

export default function ScoutPlayer() {
  const admin = useIsPlanningAdmin();
  const { get, go } = usePlanningNav();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: scouted = [], isLoading: loadingScouted } = useScouted();
  const spParam = get("sp");
  const fcfParam = get("fcf");
  const sp = useMemo(() => scouted.find((s) => s.id === spParam) || (fcfParam ? scouted.find((s) => String(s.fcf_id) === String(fcfParam)) : null) || null, [scouted, spParam, fcfParam]);
  const fcfId = sp?.fcf_id || fcfParam || null;
  const { data: fcf, isLoading: loadingFcf } = useQuery({ queryKey: ["fcf-player", fcfId], enabled: admin && !!fcfId, queryFn: () => base44.club.fcfPlayer(fcfId) });
  const [editOpen, setEditOpen] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [more, setMore] = useState("perfil");
  const [confirmDel, setConfirmDel] = useState(false);
  const remove = useMutation({
    mutationFn: () => base44.entities.ScoutedPlayer.delete(sp.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["scouted_players"] }); toast({ title: "Quitado de seguimiento" }); go({ s: "bd", mode: "seg" }, { replace: true }); },
    onError: () => toast({ title: "No se ha podido quitar", variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: (patch) => base44.entities.ScoutedPlayer.update(sp.id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scouted_players"] }),
    onError: () => toast({ title: "No se ha podido guardar", variant: "destructive" }),
  });
  const add = useMutation({
    mutationFn: () => {
      const cur = fcf.seasons[0];
      return base44.entities.ScoutedPlayer.create(newScoutFromFcf({ name: fcf.name, player_id: fcf.id, team: cur?.team, competition: cur?.competition, birth_year: fcf.birth_year }));
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["scouted_players"] });
      toast({ title: "En seguimiento", description: "Origen «Detectado FCF» · B · Seguir viendo. Completa posición y lateralidad en «Editar ficha»." });
      if (created?.id) go({ s: "jugador", sp: created.id }, { replace: true });
    },
    onError: () => toast({ title: "No se ha podido añadir", variant: "destructive" }),
  });

  if (loadingScouted || (fcfId && admin && loadingFcf && !sp)) return <div style={{ padding: 40 }}><Loader2 className="animate-spin" color={RS.faint} /></div>;
  if (!sp && !fcf) {
    return (
      <div className="flex flex-col" style={{ gap: 12 }}>
        <BackLink onClick={() => go({ s: "bd" })}>Base de datos</BackLink>
        <Card><Empty>No se ha encontrado este jugador.</Empty></Card>
      </div>
    );
  }

  // ── Datos combinados ──
  const name = sp ? spName(sp) : fcfDisplayName(fcf.name);
  const seasons = fcf?.seasons || [];
  const lastSeasons = [...new Set(seasons.map((s) => s.season))].slice(0, 5);
  const inLast = seasons.filter((s) => lastSeasons.includes(s.season));
  const tot = inLast.reduce((t, s) => ({ pj: t.pj + s.pj, tit: t.tit + s.tit, sup: t.sup + s.sup, goals: t.goals + s.goals, yellow: t.yellow + s.yellow + s.second_yellow, red: t.red + s.red + s.second_yellow }),
    { pj: 0, tit: 0, sup: 0, goals: 0, yellow: 0, red: 0 });
  const cur = seasons[0];
  // Dorsal de esta temporada: el del equipo en el que más juega; si juega en otro equipo (A/B o por arriba), también el de allí
  const curOthers = cur ? seasons.filter((x, i) => i > 0 && x.season === cur.season && x.dorsals?.length) : [];
  const confirmedYear = sp?.birth_date ? Number(String(sp.birth_date).slice(0, 4)) : sp?.birth_year && originOf(sp) !== "fcf" ? Number(sp.birth_year) : null;
  const year = confirmedYear || fcf?.birth_year || (sp?.birth_year ? Number(sp.birth_year) : null);
  const vsRacing = (fcf?.matches || []).filter((m) => isRacingTeam(m.home) || isRacingTeam(m.away));
  // Barras por temporada (titular / suplente)
  const bySeason = lastSeasons.map((s) => {
    const rows = seasons.filter((x) => x.season === s);
    return { season: s, pj: rows.reduce((a, r) => a + r.pj, 0), tit: rows.reduce((a, r) => a + r.tit, 0), sup: rows.reduce((a, r) => a + r.sup, 0) };
  });
  const maxPj = Math.max(1, ...bySeason.map((s) => s.pj));
  const dec = sp ? DECISION[sp.decision] || DECISION.seguir_viendo : null;

  return (
    <div className="flex flex-col" style={{ gap: 14 }} data-testid="scout-player">
      <BackLink onClick={() => (window.history.length > 1 ? window.history.back() : go({ s: "bd" }))}>Volver</BackLink>

      <section aria-label="Jugador" className="rs2-card flex flex-wrap" style={{ overflow: "hidden", borderRadius: 14 }}>
        <div className="flex flex-col" style={{ flex: "999 1 520px", minWidth: 0, padding: "14px 18px", gap: 10, borderLeft: `8px solid ${RS.granate}` }}>
          <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
            {sp ? (
              <>
                <Chip style={{ ...dec.chip, fontWeight: 700 }}>{dec.letter} · {dec.label}</Chip>
                <Chip style={{ background: RS.soft, color: RS.granateDark }}>Origen: {ORIGIN[originOf(sp)].toLowerCase()}</Chip>
                <span style={{ fontSize: 12, color: RS.muted }}>En seguimiento desde {fmtDate(sp.created_date)}</span>
              </>
            ) : (
              <Chip style={{ background: RS.bg, color: RS.ink2 }}>No está en seguimiento</Chip>
            )}
          </div>
          <h1 className="rs2-display" style={{ margin: 0, fontSize: 40, color: RS.granateDark }} data-testid="player-name">{name}</h1>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px 18px" }}>
            <div className="flex flex-col" style={{ gap: 2 }}>
              <span style={label}>Año de nacimiento</span>
              <span className="flex items-baseline" style={{ gap: 8 }}>
                <span className="rs2-display" style={{ fontSize: 22, lineHeight: 1 }}>{year || "—"}</span>
                {year && <span style={{ fontSize: 12, fontWeight: 600, color: confirmedYear ? "#2F6B3A" : RS.orangeInk }}>{confirmedYear ? "confirmado" : "estimado"}</span>}
              </span>
              {juvenilYear(year, CURRENT_SEASON) && (() => { const js = JUV_STYLE[juvenilYear(year, CURRENT_SEASON)]; return (
                <span data-testid="player-juv" style={{ alignSelf: "flex-start", marginTop: 4, fontSize: 12, fontWeight: 700, padding: "2px 9px", borderRadius: 6, background: js.bg, color: js.fg }}>Juvenil de {js.label}</span>
              ); })()}
            </div>
            <div className="flex flex-col" style={{ gap: 4 }} data-testid="player-dorsal">
              <span style={label}>Dorsal {cur ? seasonShort(cur.season) : ""}</span>
              {cur?.dorsals?.length ? <Dorsals list={cur.dorsals} size="lg" /> : <span style={{ fontSize: 14, fontWeight: 600 }}>—</span>}
              {curOthers.map((o) => <span key={o.team + o.competition} style={{ fontSize: 12, color: RS.ink2 }}>{o.dorsals.map((x) => x.d).join(" · ")} en {titleCase(o.team)}</span>)}
            </div>
            <div className="flex flex-col" style={{ gap: 2 }}>
              <span style={label}>Club actual</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{cur ? titleCase(cur.team) : sp?.current_club || "—"}</span>
              {(cur || sp?.category) && <span style={{ fontSize: 12, color: RS.ink2 }}>{cur ? `${titleCase(cur.competition)} · ${titleCase(cur.grp)}` : sp.category}</span>}
            </div>
            <div className="flex flex-col" style={{ gap: 2 }}>
              <span style={label}>Posición</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{SCOUT_POSITION[sp?.position] || "—"}</span>
              {sp?.reference_role && roleFull(sp.reference_role) && <span style={{ fontSize: 12, color: RS.ink2 }} data-testid="sp-role-view">Rol: {roleFull(sp.reference_role).toLowerCase()}</span>}
              {sp?.secondary_position && <span style={{ fontSize: 12, color: RS.ink2 }}>También: {(SCOUT_POSITION[sp.secondary_position] || sp.secondary_position).toLowerCase()}{sp.secondary_role && roleFull(sp.secondary_role) ? ` (${roleFull(sp.secondary_role).toLowerCase()})` : ""}</span>}
            </div>
            <div className="flex flex-col" style={{ gap: 2 }}>
              <span style={label}>Lateralidad</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{LATERALITY[sp?.laterality] || "—"}</span>
            </div>
          </div>
          <div className="flex flex-wrap" style={{ gap: 10, paddingTop: 4 }}>
            {sp ? (
              <>
                <Btn onClick={() => document.getElementById("informes-club")?.scrollIntoView({ behavior: "smooth" })} testId="btn-new-report"><Plus width={16} height={16} />Nuevo informe</Btn>
                <Btn kind="outline" onClick={() => setProposeOpen(true)} testId="btn-propose">Proponer para plantilla {seasonShort(nextSeason(CURRENT_SEASON))}</Btn>
                <Btn kind="ghost" onClick={() => setEditOpen(true)} testId="btn-edit">Editar ficha</Btn>
                <Btn kind="ghost" onClick={() => setConfirmDel(true)} style={{ color: "#B91C1C" }}>Quitar de seguimiento</Btn>
              </>
            ) : (
              <Btn onClick={() => add.mutate()} disabled={add.isPending || !fcf} testId="btn-follow"><UserPlus width={16} height={16} />Añadir a seguimiento</Btn>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-center" style={{ flex: "1 1 300px", background: RS.granateDark, color: "#fff", padding: "14px 18px", gap: 10 }}>
          {fcf ? (
            <>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", opacity: 0.85 }}>{lastSeasons.length === 1 ? "Última temporada" : `Últimas ${lastSeasons.length} temporadas`}</span>
              <div className="grid" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: "14px 10px" }}>
                {[["Partidos", tot.pj], ["Titular", tot.tit], ["Suplente", tot.sup], ["Goles", tot.goals, true], ["Amarillas", tot.yellow], ["Rojas", tot.red]].map(([l, v, orange]) => (
                  <div key={l} className="flex flex-col">
                    <span className="rs2-display tabular-nums" style={{ fontSize: 28, lineHeight: 1, color: orange ? RS.naranja : "#fff" }}>{v}</span>
                    <span style={{ fontSize: 12, opacity: 0.9 }}>{l}</span>
                  </div>
                ))}
              </div>
              <span style={{ fontSize: 11, opacity: 0.8 }}>Historial vinculado por su ID de la FCF ({fcf.id}) · {lastSeasons.length} {lastSeasons.length === 1 ? "temporada leída" : "temporadas leídas"}</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Sin datos de la FCF</span>
              <span style={{ fontSize: 13, opacity: 0.9 }}>Este jugador no está vinculado a la base de datos de la FCF.</span>
              {admin && <Btn kind="onDark" onClick={() => go({ s: "bd", q: sp ? `${sp.first_name || ""} ${sp.last_name || ""}`.trim() : "" })}>Buscarlo en la base de datos</Btn>}
            </>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-start" style={{ gap: 14 }}>
        <section aria-labelledby="trayectoria" className="rs2-card" style={{ flex: "999 1 640px", minWidth: 0, overflow: "hidden" }}>
          <div className="flex flex-wrap justify-between items-baseline" style={{ gap: 8, padding: "10px 14px" }}>
            <h2 id="trayectoria" className="rs2-title">Trayectoria competitiva</h2>
            <span style={{ fontSize: 12, color: RS.muted }}>Fuente: actas FCF · liga regular</span>
          </div>
          {!fcf ? (
            <div style={{ padding: "0 14px 10px" }}><Empty>Sin datos de la FCF todavía.</Empty></div>
          ) : (
            <>
              <div className="flex flex-col" style={{ padding: "0 14px 10px", gap: 8 }}>
                {bySeason.map((s) => (
                  <div key={s.season} style={{ display: "grid", gridTemplateColumns: "64px minmax(0,1fr) 40px", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: RS.ink2 }}>{seasonShort(s.season)}</span>
                    <span className="flex" style={{ height: 14, borderRadius: 4, overflow: "hidden", background: "#F1EBEA" }}>
                      <span style={{ width: `${(s.tit / maxPj) * 100}%`, background: RS.granate }} />
                      <span style={{ width: `${(s.sup / maxPj) * 100}%`, background: RS.naranja }} />
                    </span>
                    <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 700, textAlign: "right" }}>{s.pj}</span>
                  </div>
                ))}
                <div className="flex" style={{ gap: 12, fontSize: 11, color: RS.ink2, paddingLeft: 74 }}>
                  <span className="flex items-center" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: RS.granate }} />Titular</span>
                  <span className="flex items-center" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: RS.naranja }} />Suplente</span>
                </div>
              </div>
              <div className="rs2-scroll-x" style={{ borderTop: `1px solid ${RS.lineSoft}` }}>
                <table className="rs2-tbl" style={{ minWidth: 760 }}>
                  <thead>
                    <tr><th className="l" scope="col">Temporada</th><th className="l" scope="col">Equipo · competición</th><th scope="col">Juego</th><th scope="col">Dorsal</th><th scope="col">PJ</th><th scope="col">Titular</th><th scope="col">Suplente</th><th scope="col">Goles</th><th scope="col">TA</th><th scope="col">TR</th></tr>
                  </thead>
                  <tbody>
                    {seasons.map((s, i) => (
                      <tr key={i}>
                        <td className="l" style={{ fontWeight: 600 }}>{seasonShort(s.season)}</td>
                        <td className="l" style={{ whiteSpace: "normal", minWidth: 260 }}>
                          <span style={{ display: "block", fontWeight: 600 }}>{titleCase(s.team)}</span>
                          <span style={{ display: "block", fontSize: 12, color: RS.muted }}>{titleCase(s.competition)} · {titleCase(s.grp)}</span>
                        </td>
                        <td style={{ fontSize: 12, color: RS.ink2 }}>{/ALEV|BENJAM/i.test(s.competition) ? "F7" : "F11"}</td>
                        <td><Dorsals list={s.dorsals} /></td>
                        <td style={{ fontWeight: 700 }}>{s.pj}</td><td>{s.tit}</td><td>{s.sup}</td>
                        <td style={{ fontWeight: 700, color: RS.granate }}>{s.goals}</td>
                        <td>{s.yellow + s.second_yellow || ""}</td><td>{s.red + s.second_yellow || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col" style={{ padding: "9px 14px", gap: 8, borderTop: `1px solid ${RS.lineSoft}` }}>
                <h3 style={{ margin: 0, fontSize: 14 }}>Partidos contra Racing Sarrià</h3>
                {vsRacing.length === 0 ? <Empty>Ninguno en las actas leídas.</Empty> : vsRacing.map((m) => (
                  <div key={m.acta} className="flex flex-wrap items-baseline" style={{ gap: "6px 14px", fontSize: 13 }}>
                    <span style={{ fontWeight: 600, minWidth: 84 }}>{m.match_date || "—"}</span>
                    <span style={{ flex: "1 1 280px" }}>{titleCase(m.home)} – {titleCase(m.away)} · {titleCase(m.competition)} · J{m.jornada ?? "?"}</span>
                    <span style={{ color: RS.ink2 }}>{m.dorsal ? `#${m.dorsal} · ` : ""}{m.starter ? "Titular" : "Suplente"}{m.goals ? ` · ${m.goals} ${m.goals === 1 ? "gol" : "goles"}` : ""}</span>
                  </div>
                ))}
              </div>
              <MatchList matches={fcf.matches} />
            </>
          )}
        </section>

        <section id="informes-club" aria-labelledby="informes" className="rs2-card flex flex-col" style={{ flex: "1 1 380px", minWidth: 0, padding: "10px 14px", gap: 12 }}>
          <div className="flex justify-between items-baseline" style={{ gap: 8 }}>
            <h2 id="informes" className="rs2-title">Informes del club</h2>
          </div>
          {!sp ? <Empty>Añádelo a seguimiento para escribir informes, valorarlo y proponerlo para una plantilla.</Empty> : (
            <>
              <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
                <div className="flex flex-col" style={{ background: RS.head, borderRadius: 10, padding: "7px 10px", gap: 6 }}>
                  <span style={{ fontSize: 11, color: RS.muted }}>Valoración global</span>
                  <span className="flex items-center" style={{ gap: 6 }}>
                    {DECISION_KEYS.map((k) => {
                      const on = (sp.decision || "seguir_viendo") === k;
                      return (
                        <button key={k} type="button" onClick={() => !on && update.mutate({ decision: k })} title={`${DECISION[k].letter} · ${DECISION[k].label}`} data-testid={`dec-${k}`}
                          style={{ width: 34, height: 28, borderRadius: 6, fontWeight: 800, fontSize: 13, ...(on ? DECISION[k].chip : { border: `1px solid ${RS.input}`, color: RS.faint, background: "#fff" }) }}>
                          {DECISION[k].letter}
                        </button>
                      );
                    })}
                  </span>
                  <span style={{ fontSize: 11, color: RS.muted }}>A fichar · B a seguir · C descartado</span>
                </div>
                <div className="flex flex-col" style={{ background: RS.head, borderRadius: 10, padding: "7px 10px", gap: 6 }}>
                  <span style={{ fontSize: 11, color: RS.muted }}>Contacto</span>
                  <select value={sp.contact_status || "no_contactado"} onChange={(e) => update.mutate({ contact_status: e.target.value })}
                    style={{ height: 30, border: `1px solid ${RS.input}`, borderRadius: 6, padding: "0 8px", font: "inherit", fontSize: 13, fontWeight: 600, background: "#fff" }}>
                    {Object.entries(CONTACT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="rs2-embed"><PlayerReportsTab playerId={sp.id} player={sp} /></div>
            </>
          )}
        </section>
      </div>

      {sp && (
        <Card title="Más de su ficha" testId="player-more" action={
          <Pills value={more} onChange={setMore} options={[
            { value: "perfil", label: "Perfil" }, { value: "atributos", label: "Atributos" }, { value: "videos", label: "Vídeos" },
            { value: "imagenes", label: "Imágenes" }, { value: "historial", label: "Historial anotado" }, { value: "seguimientos", label: "Seguimientos" },
          ]} />}>
          <div style={{ paddingTop: 8 }}>
            {more === "perfil" && <Profile p={sp} />}
            {more === "atributos" && <PlayerAttributesPanel player={sp} />}
            {more === "videos" && <PlayerVideosTab playerId={sp.id} />}
            {more === "imagenes" && <PlayerImagesTab playerId={sp.id} />}
            {more === "historial" && <PlayerSeasonHistoryTab playerId={sp.id} />}
            {more === "seguimientos" && <PlayerFollowUpsTab playerId={sp.id} />}
          </div>
        </Card>
      )}

      {sp && (
        <ScoutedPlayerForm open={editOpen} onOpenChange={setEditOpen} player={sp} isLoading={update.isPending}
          onSave={(data) => update.mutate(data, { onSuccess: () => { setEditOpen(false); toast({ title: "Ficha guardada" }); } })} />
      )}
      {sp && proposeOpen && <ProposeDialog sp={sp} onClose={() => setProposeOpen(false)} />}
      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar a {name} de seguimiento?</AlertDialogTitle>
            <AlertDialogDescription>Se borran su ficha de scouting y lo que cuelga de ella (informes, vídeos, imágenes). Sus datos de la FCF no se tocan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()} className="bg-red-600 hover:bg-red-700 text-white">Quitar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({ k, v }) {
  if (!v) return null;
  return <div className="flex" style={{ gap: 8, fontSize: 13 }}><span style={{ color: RS.muted, width: 130, flex: "none" }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div>;
}

function Profile({ p }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
      <div className="flex flex-col" style={{ gap: 6 }}>
        <span style={label}>Datos personales</span>
        <Row k="Nacionalidad" v={p.nationality} /><Row k="Nacimiento" v={p.birth_date ? fmtDate(p.birth_date) : p.birth_year} />
        <Row k="Altura" v={p.height_cm && `${p.height_cm} cm`} /><Row k="Peso" v={p.weight_kg && `${p.weight_kg} kg`} />
        <Row k="Modalidad" v={p.modality === "futbol_7" ? "Fútbol 7" : p.modality === "futbol_11" ? "Fútbol 11" : ""} />
      </div>
      <div className="flex flex-col" style={{ gap: 6 }}>
        <span style={label}>Contacto</span>
        <Row k="Teléfono jugador" v={p.phone} /><Row k="Padre / madre" v={p.parent_name} /><Row k="Teléfono familiar" v={p.parent_phone} />
        <Row k="Estado" v={CONTACT[p.contact_status]} /><Row k="Notas" v={p.contact_notes} />
        {!p.phone && !p.parent_name && !p.parent_phone && <span style={{ fontSize: 13, color: RS.faint }}>Sin datos de contacto.</span>}
      </div>
      <div className="flex flex-col" style={{ gap: 6 }}>
        <span style={label}>Observaciones</span>
        {p.key_points && <p style={{ margin: 0, fontSize: 13 }}><strong>Puntos clave: </strong>{p.key_points}</p>}
        {p.observations && <p style={{ margin: 0, fontSize: 13 }}>{p.observations}</p>}
        <Row k="Partido observado" v={p.match_observed} /><Row k="Fecha" v={p.observation_date && fmtDate(p.observation_date)} />
        {!p.key_points && !p.observations && <span style={{ fontSize: 13, color: RS.faint }}>Sin observaciones en la ficha.</span>}
      </div>
    </div>
  );
}

function MatchList({ matches = [] }) {
  const [all, setAll] = useState(false);
  if (!matches.length) return null;
  const shown = all ? matches : matches.slice(0, 8);
  return (
    <div className="flex flex-col" style={{ padding: "9px 14px", gap: 2, borderTop: `1px solid ${RS.lineSoft}` }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 14 }}>Partido a partido</h3>
      {shown.map((m) => {
        const rival = m.team === m.home ? m.away : m.home;
        return (
          <div key={m.acta} className="flex flex-wrap items-center" style={{ gap: "4px 12px", fontSize: 13, padding: "6px 0", borderTop: `1px solid ${RS.lineSoft}` }}>
            <span className="tabular-nums" style={{ width: 84, color: RS.muted }}>{m.match_date || "—"}</span>
            <span style={{ width: 34, fontSize: 11, color: RS.faint }}>J{m.jornada ?? "?"}</span>
            <span className="tabular-nums" title="Dorsal en el acta" style={{ width: 30, textAlign: "center", fontSize: 12, fontWeight: 700, color: RS.granate }}>{m.dorsal ? `#${m.dorsal}` : ""}</span>
            <span style={{ flex: "1 1 180px" }}>vs {titleCase(rival)}</span>
            <Chip style={m.starter ? { background: RS.granate, color: "#fff", fontSize: 11 } : { background: RS.orangeSoft, color: RS.orangeInk, fontSize: 11 }}>{m.starter ? "Titular" : "Suplente"}</Chip>
            {m.goals > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: RS.granate }}>{m.goals} {m.goals === 1 ? "gol" : "goles"}</span>}
            {m.yellow > 0 && <span title="Amarilla" style={{ display: "inline-block", width: 10, height: 14, borderRadius: 2, background: "#FACC15" }} />}
            {m.second_yellow > 0 && <span title="Doble amarilla" style={{ fontSize: 11, color: "#B91C1C" }}>2A</span>}
            {m.red > 0 && <span title="Roja" style={{ display: "inline-block", width: 10, height: 14, borderRadius: 2, background: "#DC2626" }} />}
          </div>
        );
      })}
      {matches.length > 8 && (
        <button type="button" onClick={() => setAll(!all)} style={{ alignSelf: "flex-start", marginTop: 6, fontSize: 13, fontWeight: 600, color: RS.granate, background: "none" }}>
          {all ? "Ver menos" : `Ver los ${matches.length} partidos`}
        </button>
      )}
    </div>
  );
}

// Proponer para la plantilla de la temporada siguiente: queda como objetivo (o jugador seguido) en el campograma de ese equipo
function ProposeDialog({ sp, onClose }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { go } = usePlanningNav();
  const season = nextSeason(CURRENT_SEASON);
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const [teamId, setTeamId] = useState("");
  const [role, setRole] = useState("objetivo");
  const save = useMutation({
    mutationFn: async () => {
      const ex = await base44.entities.SquadPlanEntry.filter({ season, team_id: teamId, kind: "scout", ref_id: sp.id });
      if (ex.length) return { dup: true };
      await base44.entities.SquadPlanEntry.create({ season, team_id: teamId, kind: "scout", ref_id: sp.id, role, position: sp.position || null, side: null, note: "" });
      return { dup: false };
    },
    onSuccess: ({ dup }) => {
      qc.invalidateQueries({ queryKey: ["squad-plan"] });
      const t = teams.find((x) => x.id === teamId)?.name || "el equipo";
      toast({ title: dup ? `Ya estaba en el plan de ${t}` : `Propuesto para ${t} ${seasonShort(season)}`, description: role === "seguido" ? "Como jugador seguido." : "Como objetivo de scouting." });
      onClose();
      go({ t: "plantillas", s: null, team: teamId });
    },
    onError: () => toast({ title: "No se ha podido proponer", variant: "destructive" }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rs2" style={{ background: "#fff" }}>
        <DialogHeader>
          <DialogTitle>Proponer para plantilla {seasonShort(season)}</DialogTitle>
          <DialogDescription>{spName(sp)} entra en el campograma del equipo elegido. Después se puede mover de puesto o quitar desde Plantillas.</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col" style={{ gap: 6 }}>
          <span style={label}>Equipo</span>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="rs2-input" data-testid="propose-team">
            <option value="">Elige un equipo</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <div className="flex flex-col" style={{ gap: 6 }}>
          <span style={label}>Cómo</span>
          <Pills value={role} onChange={setRole} options={[{ value: "objetivo", label: "Objetivo de fichaje" }, { value: "seguido", label: "Jugador seguido" }]} />
        </div>
        <div className="flex justify-end" style={{ gap: 10, paddingTop: 6 }}>
          <Btn kind="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={() => save.mutate()} disabled={!teamId || save.isPending} testId="propose-save">Proponer</Btn>
        </div>
      </DialogContent>
    </Dialog>
  );
}
