import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "react-router-dom";
import { getCategoryLabel } from "@/components/fcfCategories";
import { useT, useFormat, msg } from "@/i18n";

const FORM = { G: [msg("V"), "#16a34a"], E: [msg("E"), "#ea580c"], P: [msg("D"), "#dc2626"] };
const logoUrl = (f) => (f ? `https://files.fcf.cat/escudos/clubes/escudos/${f}` : null);
const shortName = (n) => String(n || "").replace(/\s+/g, " ").replace(/ ([A-Z])$/, " $1").trim();

async function fetchStanding(teamId) {
  const r = await fetch(`/api/sync-fcf?standings=${teamId}`, { credentials: "include" });
  if (!r.ok) throw new Error("error");
  return r.json();
}

export default function FCFTeamStanding({ team }) {
  const t = useT();
  const fmt = useFormat();
  const [full, setFull] = useState(false);
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["fcf-standing", team.id],
    queryFn: () => fetchStanding(team.id),
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const rows = data?.rows || [];
  const meIdx = rows.findIndex((r) => r.teamId === data?.ourTeamId);
  const me = meIdx >= 0 ? rows[meIdx] : null;
  // Vista corta: 5 filas alrededor de nuestro equipo
  let shown = rows;
  if (!full && rows.length > 6) {
    const start = Math.max(0, Math.min(meIdx - 2, rows.length - 5));
    shown = rows.slice(start, start + 5);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/TeamDetail?id=${team.id}`} className="font-semibold text-gray-900 hover:underline text-sm truncate block">{team.name}</Link>
          <p className="text-xs text-gray-400 truncate">{data?.competition ? `${data.competition} · ${data.group}` : getCategoryLabel(team.category)}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {me && (
            <span className="text-xs font-black mr-1" style={{ color: "var(--granate)" }}>{t("{pos}º · {pts} pts", { pos: me.pos, pts: me.pts })}</span>
          )}
          <button onClick={() => refetch()} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600" title={t("Actualizar")}>
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
          {team.fcf_group_url && (
            <a href={team.fcf_group_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600" title={t("Ver en FCF")}>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-2 animate-pulse">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-5 bg-gray-100 rounded" />)}</div>
      ) : isError || !data?.available ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 p-4">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{t("Clasificación no disponible por ahora.")} <button onClick={() => refetch()} className="underline hover:text-gray-600">{t("Reintentar")}</button></span>
        </div>
      ) : (
        <>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-gray-400 bg-gray-50">
                <th className="py-1.5 pl-3 text-left font-bold w-6">#</th>
                <th className="py-1.5 text-left font-bold">{t("Equipo")}</th>
                <th className="py-1.5 text-center font-bold">{t("PJ")}</th>
                <th className="py-1.5 text-center font-bold hidden sm:table-cell">{t("G")}</th>
                <th className="py-1.5 text-center font-bold hidden sm:table-cell">{t("E")}</th>
                <th className="py-1.5 text-center font-bold hidden sm:table-cell">{t("P")}</th>
                <th className="py-1.5 text-center font-bold">{t("DG")}</th>
                <th className="py-1.5 text-center font-bold">{t("Pts")}</th>
                <th className="py-1.5 pr-3 text-center font-bold" title={t("Puntos por partido jugado")} data-testid="standing-ppg-head">{t("Pts/PJ")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {shown.map((r) => {
                const mine = r.teamId === data.ourTeamId;
                return (
                  <tr key={r.teamId + r.pos} className={mine ? "font-bold" : ""} style={mine ? { background: "var(--granate-pale)" } : undefined}>
                    <td className="py-1.5 pl-3 text-gray-500" style={r.color ? { boxShadow: `inset 3px 0 0 ${r.color}` } : undefined}>{r.pos}</td>
                    <td className="py-1.5">
                      <span className="flex items-center gap-1.5 min-w-0">
                        {logoUrl(r.logo) ? <img src={logoUrl(r.logo)} alt="" loading="lazy" className="w-4 h-4 object-contain shrink-0" /> : <span className="w-4 shrink-0" />}
                        <span className="truncate max-w-[9.5rem]" style={mine ? { color: "var(--granate)" } : undefined}>{shortName(r.team)}</span>
                      </span>
                    </td>
                    <td className="py-1.5 text-center">{r.pj}</td>
                    <td className="py-1.5 text-center hidden sm:table-cell">{r.g}</td>
                    <td className="py-1.5 text-center hidden sm:table-cell">{r.e}</td>
                    <td className="py-1.5 text-center hidden sm:table-cell">{r.p}</td>
                    <td className="py-1.5 text-center text-gray-600">{r.gf - r.gc > 0 ? `+${r.gf - r.gc}` : r.gf - r.gc}</td>
                    <td className="py-1.5 text-center font-black">{r.pts}</td>
                    <td className="py-1.5 pr-3 text-center text-gray-500 tabular-nums" data-testid="standing-ppg">
                      {Number(r.pj) > 0 ? fmt.num(Number(r.pts) / Number(r.pj), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "–"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between">
            <div className="flex gap-1">
              {(me?.form || []).slice().reverse().map((f, i) => (
                <span key={i} className="w-5 h-5 rounded text-[10px] font-black text-white flex items-center justify-center" style={{ background: (FORM[f] || ["?", "#9ca3af"])[1] }}>{FORM[f] ? t(FORM[f][0]) : "?"}</span>
              ))}
            </div>
            {rows.length > 6 && (
              <button onClick={() => setFull((v) => !v)} className="text-xs font-bold inline-flex items-center gap-1" style={{ color: "var(--granate)" }}>
                {full ? <>{t("Ver menos")} <ChevronUp className="w-3.5 h-3.5" /></> : <>{t("Clasificación completa")} <ChevronDown className="w-3.5 h-3.5" /></>}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
