import { getCategoryLabel } from "@/components/fcfCategories";
// Ficha del jugador → pestaña Historial (14/11/2026, maqueta «Maqueta Ficha del jugador · pestañas» aprobada por Nacho)
// Trayectoria por temporadas: las del club (temporadas cerradas en la app + la que está en curso) y las de las actas de la FCF.
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { RS } from "@/components/rs2/kit";
import { BRAND } from "@/lib/brand";
import { isRacingTeam } from "@/components/planning/labels";
import { titleCase, shortComp } from "@/lib/fcfNames";
import { careerRows, clubFacts, seasonKey } from "@/lib/profileTabs";
import PlayerSeasonHistorySection from "./PlayerSeasonHistorySection";
import { Box, Chip, CHIP, Note, Empty, th, td, Cols } from "./ProfileParts";
import { useT, useFormat } from "@/i18n";

export default function ProfileHistory({ player, current, staffEdit, mobile }) {
  const t = useT();
  const fmt = useFormat();
  const [editOpen, setEditOpen] = useState(false);
  const { data: club = [] } = useQuery({ queryKey: ["player_hist", player.id], queryFn: () => base44.entities.PlayerSeasonHistory.filter({ player_id: player.id }) });
  const { data: career = null, isLoading } = useQuery({ queryKey: ["player_career", player.id], queryFn: () => base44.club.playerCareer(player.id), retry: false, staleTime: 10 * 60 * 1000 });
  const rows = useMemo(() => careerRows({ club, fcf: career?.seasons || [], current, isClubTeam: isRacingTeam }), [club, career, current]);
  const facts = clubFacts(rows);
  const goalsBy = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      if (r.goals == null) continue;
      const k = seasonKey(r.season);
      const cur = m.get(k) || { club: null, fcf: 0 };
      if (r.source === "club") cur.club = (cur.club || 0) + r.goals; else cur.fcf += r.goals;
      m.set(k, cur);
    }
    return [...m.entries()].map(([k, v]) => [k, v.club ?? v.fcf]).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  }, [rows]);
  const maxGoals = Math.max(1, ...goalsBy.map(([, g]) => g));
  const teamName = (r) => (r.source === "fcf" ? (r.club ? `${BRAND.shortName || BRAND.clubName} · ${titleCase(r.team)}` : titleCase(r.team)) : r.team);
  const dash = <span style={{ color: RS.faint }}>—</span>;
  const n = (v) => (v == null || v === "" ? dash : v);

  const table = (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }} data-testid="ph-table">
        <thead><tr>
          {[t("Temporada"), t("Equipo"), t("Competición"), t("PJ"), t("Tit."), t("Minutos"), t("Goles"), t("Am."), t("Entrenos"), t("Val."), t("De dónde")].map((h, i) => <th key={i} style={th(i >= 3 && i <= 9 ? "center" : "left")}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r, i) => {
            const isOrigin = facts.origin && r === facts.origin;
            const [bg, fg] = r.source === "club" ? CHIP.info : CHIP.gray;
            return (
              <tr key={i} data-testid={`ph-row-${seasonKey(r.season)}-${r.source}`}>
                <td style={td({ fontWeight: 700, whiteSpace: "nowrap" })}>{seasonKey(r.season)}</td>
                <td style={td({ fontWeight: 600 })}>
                  {teamName(r)}
                  {r.live && <span style={{ marginLeft: 6 }}><Chip bg={CHIP.ok[0]} fg={CHIP.ok[1]}>{t("En curso")}</Chip></span>}
                  {isOrigin && <span style={{ marginLeft: 6 }}><Chip bg={CHIP.warn[0]} fg={CHIP.warn[1]}>{t("Procedencia")}</Chip></span>}
                </td>
                <td style={td({ color: RS.ink2, fontSize: 12 })}>{r.competition ? `${shortComp(r.competition)}${r.grp ? ` · ${r.grp}` : ""}` : (r.category ? getCategoryLabel(r.category) : dash)}</td>
                <td style={td({ textAlign: "center" })}>{n(r.pj)}</td>
                <td style={td({ textAlign: "center" })}>{n(r.tit)}</td>
                <td style={td({ textAlign: "center", whiteSpace: "nowrap" })}>{r.minutes == null ? dash : <>{fmt.num(r.minutes)}'{r.pctMin != null ? <span style={{ color: RS.muted }}> · {r.pctMin}%</span> : null}</>}</td>
                <td style={td({ textAlign: "center", fontWeight: 700 })}>{n(r.goals)}</td>
                <td style={td({ textAlign: "center" })}>{n(r.yellow)}</td>
                <td style={td({ textAlign: "center" })}>{r.attPct == null ? dash : `${r.attPct}%`}</td>
                <td style={td({ textAlign: "center" })}>{r.rating == null ? dash : fmt.num(r.rating)}</td>
                <td style={td()}><Chip bg={bg} fg={fg}>{r.source === "club" ? t("Club") : t("Actas FCF")}</Chip></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <div style={{ padding: "12px 4px" }}><Empty>{isLoading ? t("Cargando…") : t("Sin historial de temporadas anteriores.")}</Empty></div>}
    </div>
  );

  const left = (
    <>
      <Box title={t("Trayectoria")} testId="ph-career"
        right={staffEdit && <button type="button" onClick={() => setEditOpen(!editOpen)} data-testid="ph-edit-toggle" style={{ border: 0, background: "none", color: RS.granate, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>{t("Temporadas del club a mano")}{editOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</button>}>
        {table}
        <Note>{t("«Club» = temporadas en la app (con minutos, entrenos y valoración). «Actas FCF» = lo que dicen las actas de la federación (partidos, titular, goles y tarjetas), también de otros clubes.")}</Note>
        {career && !career.linked && <Note>{t("Su ficha aún no está vinculada a la FCF: se vincula con «Procedencia desde la FCF» en Mi equipo → Plantilla.")}</Note>}
      </Box>
      {editOpen && staffEdit && <PlayerSeasonHistorySection playerId={player.id} />}
      {goalsBy.length > 1 && (
        <Box title={t("Goles por temporada")} testId="ph-goals">
          <div className="flex items-end" style={{ gap: 10, height: 110 }}>
            {goalsBy.map(([k, g]) => (
              <div key={k} className="flex flex-col items-center" style={{ flex: 1, gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{g}</span>
                <div style={{ width: "100%", maxWidth: 34, height: `${(g / maxGoals) * 70}px`, minHeight: 2, background: RS.granate, borderRadius: 4 }} />
                <span style={{ fontSize: 10, color: RS.muted }}>{k}</span>
              </div>
            ))}
          </div>
        </Box>
      )}
    </>
  );

  const line = (k, v) => (
    <div className="flex" style={{ gap: 8, padding: "4px 0", borderTop: "1px solid #F3EEEE", fontSize: 12.5 }}><span style={{ width: 110, color: RS.muted, flex: "none" }}>{k}</span><span style={{ flex: 1, minWidth: 0 }}>{v}</span></div>
  );
  const originText = facts.origin ? `${titleCase(facts.origin.team)}${facts.origin.competition ? ` · ${shortComp(facts.origin.competition)}` : ""} (${seasonKey(facts.origin.season)})` : player.previous_club || null;
  const right = (
    <Box title={t("En el club")} testId="ph-facts">
      {line(t("Llegó"), facts.first || dash)}
      {line(t("Procedencia"), originText ? <b>{originText}</b> : dash)}
      {line(t("Temporadas"), facts.seasons ? t("{n} en el club", { n: facts.seasons }) : dash)}
      {line(t("Dorsal habitual"), facts.dorsals.length ? <><b>{facts.dorsals[0].dorsal}</b> <span style={{ color: RS.muted }}>({t("{n} partidos", { n: facts.dorsals[0].n })}){facts.dorsals[1] ? ` · ${facts.dorsals[1].dorsal} (${facts.dorsals[1].n})` : ""}</span></> : dash)}
      {line(t("Ficha FCF"), career?.linked ? <span style={{ color: "#15803D" }}>{t("vinculada")} ✓</span> : <span style={{ color: RS.muted }}>{t("sin vincular")}</span>)}
    </Box>
  );

  return <Cols mobile={mobile} ratio="2.3fr 1fr" left={left} right={right} />;
}
