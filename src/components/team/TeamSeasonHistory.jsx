import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useT } from "@/i18n";

const lbl = (s) => String(s || "").replace("-", "–");

// Historial de temporadas de un equipo (se rellena al cerrar cada temporada). Si no hay ninguna, no se muestra.
export default function TeamSeasonHistory({ teamId }) {
  const t = useT();
  const { data: rows = [] } = useQuery({
    queryKey: ["team_season_history", teamId],
    queryFn: () => base44.entities.TeamSeasonHistory.filter({ team_id: teamId }),
    enabled: !!teamId,
  });
  if (!rows.length) return null;
  const list = [...rows].sort((a, b) => String(b.season).localeCompare(String(a.season)));
  return (
    <div className="bg-white border border-gray-200 shadow-sm overflow-x-auto" style={{ borderRadius: "4px" }}>
      <div className="px-4 py-2.5 border-b border-gray-100">
        <h2 className="font-black text-sm uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{t("Historial de temporadas")}</h2>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100 text-[10px] text-gray-400 uppercase tracking-wider text-center" style={{ fontFamily: "var(--font-display)" }}>
            <th className="px-4 py-2 text-left">{t("Temporada")}</th><th className="px-2 py-2 text-left">{t("Competición")}</th>
            <th className="px-2 py-2">{t("Pos")}</th><th className="px-2 py-2">{t("Pts")}</th><th className="px-2 py-2">{t("PJ")}</th>
            <th className="px-2 py-2">{t("G")}</th><th className="px-2 py-2">{t("E")}</th><th className="px-2 py-2">{t("P")}</th><th className="px-2 py-2">{t("GF–GC")}</th><th className="px-2 py-2">{t("Jugadores")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {list.map((t) => {
            const st = t.standing, rec = t.record || {};
            const v = (k) => st?.[k] ?? rec[k] ?? "—";
            return (
              <tr key={t.id} className="text-center">
                <td className="px-4 py-1.5 text-left font-bold text-gray-900">{lbl(t.season)}</td>
                <td className="px-2 py-1.5 text-left text-gray-500">{[t.competition, t.group].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-2 py-1.5 font-black" style={{ color: "var(--granate)" }}>{st?.pos ? `${st.pos}º` : "—"}</td>
                <td className="px-2 py-1.5 font-bold">{v("pts")}</td><td className="px-2 py-1.5">{v("pj")}</td>
                <td className="px-2 py-1.5">{v("g")}</td><td className="px-2 py-1.5">{v("e")}</td><td className="px-2 py-1.5">{v("p")}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{(st?.gf ?? rec.gf) != null ? `${v("gf")}–${v("gc")}` : "—"}</td>
                <td className="px-2 py-1.5">{(t.roster || []).length}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
