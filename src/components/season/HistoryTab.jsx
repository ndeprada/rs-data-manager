import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { compareTeams } from "@/lib/teamOrder";
import { toCsv, exportFileName, downloadCsv } from "@/lib/staffExport";
import { historySummary, shortSeason } from "@/lib/seasonView";
import { RS } from "@/components/rs2/kit";
import { Head } from "@/components/rs2/dashParts";
import { useT, useLocaleTag } from "@/i18n";

const OK = "#15803D", NO = "#B91C1C";
const TH = { fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: RS.muted, padding: "6px 8px" };

function Kpi({ n, label, sub, color }) {
  return (
    <div style={{ flex: "1 1 160px", display: "flex", alignItems: "baseline", gap: 8, padding: "8px 12px", background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 10 }}>
      <span className="rs2-display tabular-nums" style={{ fontSize: 22, color: color || RS.granateDark, whiteSpace: "nowrap" }}>{n}</span>
      <span style={{ fontSize: 12, color: RS.ink2, lineHeight: 1.15 }}>{label}{sub && <span style={{ display: "block", fontSize: 11, color: RS.muted }}>{sub}</span>}</span>
    </div>
  );
}

// Historial de las temporadas cerradas: resumen del club, clasificación, resultados y plantilla de cada equipo.
export default function HistoryTab({ season: current }) {
  const t = useT();
  const tag = useLocaleTag();
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["team_season_history"], queryFn: () => base44.entities.TeamSeasonHistory.list() });
  const { data: status } = useQuery({ queryKey: ["season_status", current], queryFn: () => base44.club.seasonStatus(current), enabled: !!current });
  const seasons = useMemo(() => [...new Set(rows.map((r) => r.season))].sort().reverse(), [rows]);
  const [season, setSeason] = useState("");
  const [open, setOpen] = useState(null);
  const cur = season || seasons[0] || "";
  const list = useMemo(() => rows.filter((r) => r.season === cur).sort((a, b) => compareTeams({ name: a.team_name, category: a.category }, { name: b.team_name, category: b.category })), [rows, cur]);
  const sum = historySummary(list);
  const closedAt = status?.closes?.find((c) => c.season === cur && c.status === "closed")?.closed_at;

  const exportExcel = () => {
    const header = ["Equipo", "Competición", "Grupo", "Posición", "Puntos", "PJ", "G", "E", "P", "GF", "GC", "Jugadores"];
    const data = list.map((tm) => {
      const st = tm.standing || {}, rec = tm.record || {};
      return [tm.team_name, tm.competition || "", tm.group || "", st.pos ?? "", st.pts ?? rec.pts ?? "", st.pj ?? rec.pj ?? "", st.g ?? rec.g ?? "", st.e ?? rec.e ?? "", st.p ?? rec.p ?? "", st.gf ?? rec.gf ?? "", st.gc ?? rec.gc ?? "", (tm.roster || []).length];
    });
    downloadCsv(exportFileName(`historial-${cur}`), toCsv(header, data));
  };

  if (isLoading) return <p style={{ padding: 30, textAlign: "center", fontSize: 13, color: RS.faint }}>{t("Cargando…")}</p>;
  if (!rows.length) {
    return (
      <section style={{ background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 12, overflow: "hidden" }} data-testid="history">
        <Head title={t("Historial")} />
        <p style={{ margin: 0, padding: 16, fontSize: 13, color: RS.muted }}>
          <b style={{ color: RS.ink }}>{t("Todavía no hay temporadas cerradas")}</b><br />{t("Cuando cierres una temporada, aquí quedará la clasificación, los resultados y la plantilla de cada equipo.")}
        </p>
      </section>
    );
  }

  return (
    <section style={{ background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 12, overflow: "hidden" }} data-testid="history">
      <Head title={closedAt ? t("Temporada {s} · cerrada el {d}", { s: shortSeason(cur), d: new Date(closedAt).toLocaleDateString(tag) }) : t("Temporada {s}", { s: shortSeason(cur) })}
        right={seasons.length > 1 && (
          <span className="inline-flex" style={{ gap: 3, background: RS.soft, borderRadius: 999, padding: 3 }}>
            {seasons.map((s) => (
              <button key={s} type="button" onClick={() => { setSeason(s); setOpen(null); }} data-testid={`history-season-${s}`}
                style={{ border: "none", borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: s === cur ? 700 : 500, background: s === cur ? "#fff" : "transparent", color: s === cur ? RS.granate : RS.ink2 }}>{shortSeason(s)}</button>
            ))}
          </span>
        )} />
      <div className="flex flex-wrap" style={{ gap: 8, padding: "10px 14px" }} data-testid="history-kpis">
        <Kpi n={sum.teams} label={t("equipos")} />
        <Kpi n={`${sum.g}-${sum.e}-${sum.p}`} label={t("V-E-D de liga")} sub={sum.winPct != null ? t("{n} % de victorias", { n: sum.winPct }) : null} />
        <Kpi n={sum.champions.length} label={sum.champions.length === 1 ? t("campeón") : t("campeones")} sub={sum.champions.join(", ") || null} color={sum.champions.length ? OK : undefined} />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr>
            <th style={{ ...TH, textAlign: "left", paddingLeft: 14 }}>{t("Equipo")}</th><th style={{ ...TH, textAlign: "left" }}>{t("Competición")}</th>
            <th style={TH}>{t("Pos.")}</th><th style={TH}>{t("Pts")}</th><th style={TH}>{t("V-E-D")}</th><th style={TH}>{t("Goles")}</th><th style={TH}>{t("Jug.")}</th>
          </tr></thead>
          <tbody>
            {list.map((tm) => {
              const st = tm.standing || {}, rec = tm.record || {};
              const isOpen = open === tm.id;
              const pos = Number(st.pos);
              const g = st.g ?? rec.g, e = st.e ?? rec.e, p = st.p ?? rec.p, gf = st.gf ?? rec.gf, gc = st.gc ?? rec.gc;
              return (
                <React.Fragment key={tm.id}>
                  <tr style={{ borderTop: `1px solid ${RS.lineSoft}`, cursor: "pointer", background: isOpen ? "#FBF8F8" : undefined }} onClick={() => setOpen(isOpen ? null : tm.id)} data-testid={`history-row-${tm.id}`}>
                    <td style={{ padding: "6px 14px", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {isOpen ? <ChevronDown className="inline w-3.5 h-3.5" style={{ color: RS.faint }} /> : <ChevronRight className="inline w-3.5 h-3.5" style={{ color: RS.faint }} />} {tm.team_name}
                    </td>
                    <td style={{ fontSize: 11.5, color: RS.muted }}>{[tm.competition, tm.group].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="tabular-nums" style={{ textAlign: "center", fontWeight: 800, color: pos ? (pos <= 3 ? OK : pos >= 13 ? NO : RS.ink) : RS.faint }}>{pos ? `${pos}.º` : "—"}</td>
                    <td className="tabular-nums" style={{ textAlign: "center" }}>{st.pts ?? rec.pts ?? "—"}</td>
                    <td className="tabular-nums" style={{ textAlign: "center" }}>{g != null ? `${g}-${e}-${p}` : "—"}</td>
                    <td className="tabular-nums" style={{ textAlign: "center" }}>{gf != null ? `${gf}-${gc}` : "—"}</td>
                    <td className="tabular-nums" style={{ textAlign: "center" }}>{(tm.roster || []).length}</td>
                  </tr>
                  {isOpen && (
                    <tr><td colSpan={7} style={{ background: "#FBF8F8", padding: "8px 14px 12px" }}>
                      {(tm.staff || []).length > 0 && <p style={{ margin: "0 0 6px", fontSize: 12, color: RS.ink2 }}><b style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: RS.muted, marginRight: 8 }}>{t("Cuerpo técnico")}</b>{tm.staff.map((s) => s.name).join(" · ")}</p>}
                      <table style={{ width: "100%", maxWidth: 640, borderCollapse: "collapse", fontSize: 12 }}>
                        <thead><tr><th style={{ ...TH, textAlign: "left" }}>{t("Jugador")}</th><th style={TH}>{t("Año")}</th><th style={TH}>{t("PJ")}</th><th style={TH}>{t("Min")}</th><th style={TH}>{t("Goles")}</th><th style={TH}>{t("Asist")}</th></tr></thead>
                        <tbody>
                          {(tm.roster || []).map((p) => (
                            <tr key={p.player_id} style={{ borderTop: `1px solid ${RS.lineSoft}`, textAlign: "center" }}>
                              <td style={{ textAlign: "left", padding: "3px 8px" }}><Link to={`/PlayerProfile?id=${p.player_id}`} style={{ fontWeight: 600, color: RS.ink }}>{p.name}</Link></td>
                              <td style={{ color: RS.muted }}>{p.birth_year || ""}</td><td>{p.matches}</td><td>{p.minutes}</td><td>{p.goals}</td><td>{p.assists}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center" style={{ gap: 10, padding: "8px 14px", fontSize: 11.5, color: RS.muted, borderTop: `1px solid ${RS.lineSoft}` }}>
        <span style={{ flex: 1 }}>{t("Las estadísticas de jugadores del historial cuentan solo partidos de liga. La asistencia a entrenos está en la ficha de cada jugador.")}</span>
        <button type="button" onClick={exportExcel} data-testid="history-export" style={{ border: `1px solid ${RS.line}`, background: "#fff", color: RS.ink2, borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, display: "inline-flex", gap: 6, alignItems: "center" }}>
          <Download className="w-3.5 h-3.5" /> {t("Exportar Excel")}
        </button>
      </div>
    </section>
  );
}
