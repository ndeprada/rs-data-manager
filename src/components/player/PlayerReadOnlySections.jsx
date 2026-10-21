import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { FileText, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useCountedStats } from "@/lib/matchStatus";
import { useT, useFormat, msg } from "@/i18n";
import { INJURY_TYPE_LABELS, BODY_PART_LABELS, DOCUMENT_TYPE_LABELS, labelOf } from "@/lib/injuryLabels";

const Card = ({ title, children }) => (
  <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
    {title && <div className="px-4 py-3 border-b border-gray-100"><h3 className="font-semibold text-gray-900 text-sm">{title}</h3></div>}
    {children}
  </div>
);
const Empty = ({ children }) => <p className="px-4 py-6 text-sm text-gray-400 text-center">{children}</p>;
const makeD = (locale) => (x) => { try { return x ? format(new Date(x), "d MMM yyyy", { locale }) : "—"; } catch { return "—"; } };

// Partidos del propio jugador (sin valoración del entrenador ni notas)
export function PlayerMatchesReadOnly({ playerId }) {
  const t = useT();
  const d = makeD(useFormat().locale);
  const { data: raw = [] } = useQuery({ queryKey: ["matchstats", playerId], queryFn: () => base44.entities.MatchStats.filter({ player_id: playerId }, "-date") });
  const stats = useCountedStats(raw);
  return (
    <Card title={t("Mis partidos")}>
      {stats.length === 0 ? <Empty>{t("Todavía no hay partidos cerrados con tus estadísticas.")}</Empty> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-400">
              {[msg("Fecha"), msg("Rival"), msg("Titular"), msg("Min"), msg("Goles"), msg("Asist."), msg("TA"), msg("TR")].map((h, i) => <th key={h} className={`px-3 py-2 font-bold ${i < 2 ? "text-left" : "text-center"}`}>{t(h)}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {[...stats].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{d(s.date)}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{s.opponent || "—"}</td>
                  <td className="px-3 py-2 text-center text-gray-500">{s.starter === false ? t("Supl.") : t("Tit.")}</td>
                  <td className="px-3 py-2 text-center">{s.minutes_played || 0}'</td>
                  <td className="px-3 py-2 text-center font-bold">{s.goals || 0}</td>
                  <td className="px-3 py-2 text-center">{s.assists || 0}</td>
                  <td className="px-3 py-2 text-center text-gray-500">{(s.yellow_cards || 0) + (s.double_yellow_card || 0)}</td>
                  <td className="px-3 py-2 text-center text-gray-500">{s.red_cards || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function PlayerInjuriesReadOnly({ playerId }) {
  const t = useT();
  const d = makeD(useFormat().locale);
  const { data = [] } = useQuery({ queryKey: ["player_injuries_ro", playerId], queryFn: () => base44.entities.Injury.filter({ player_id: playerId }, "-injury_date") });
  return (
    <Card title={t("Lesiones")}>
      {data.length === 0 ? <Empty>{t("Sin lesiones registradas.")}</Empty> : (
        <div className="divide-y divide-gray-50">
          {data.map((i) => (
            <div key={i.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{labelOf(INJURY_TYPE_LABELS, i.type, t) || t("Lesión")}{i.body_part ? ` · ${labelOf(BODY_PART_LABELS, i.body_part, t)}` : ""}</p>
                <p className="text-xs text-gray-400">{d(i.injury_date)}{i.status === "alta" ? ` → ${t("alta")} ${d(i.actual_return)}` : i.expected_return ? ` · ${t("alta prevista")} ${d(i.expected_return)}` : ""}</p>
              </div>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${i.status === "alta" ? "bg-green-50 text-green-700 border-green-200" : "bg-orange-50 text-orange-700 border-orange-200"}`}>{i.status === "alta" ? t("Alta") : t("En recuperación")}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function PlayerDocumentsReadOnly({ playerId }) {
  const t = useT();
  const d = makeD(useFormat().locale);
  const { data = [] } = useQuery({ queryKey: ["player_docs_ro", playerId], queryFn: () => base44.entities.PlayerDocument.filter({ player_id: playerId }, "-upload_date") });
  return (
    <Card title={t("Documentos")}>
      {data.length === 0 ? <Empty>{t("Sin documentos.")}</Empty> : (
        <div className="divide-y divide-gray-50">
          {data.map((x) => (
            <a key={x.id} href={x.file_url} target="_blank" rel="noopener noreferrer" className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
              <FileText className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{x.title || t("Documento")}</p>
                <p className="text-xs text-gray-400">{labelOf(DOCUMENT_TYPE_LABELS, x.document_type, t)}{x.upload_date ? ` · ${d(x.upload_date)}` : ""}</p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-gray-300" />
            </a>
          ))}
        </div>
      )}
    </Card>
  );
}

export function PlayerHistoryReadOnly({ playerId }) {
  const t = useT();
  const { data = [] } = useQuery({ queryKey: ["player_hist_ro", playerId], queryFn: () => base44.entities.PlayerSeasonHistory.filter({ player_id: playerId }) });
  return (
    <Card title={t("Historial por temporadas")}>
      {data.length === 0 ? <Empty>{t("Sin historial de temporadas anteriores.")}</Empty> : (
        <div className="divide-y divide-gray-50">
          {[...data].sort((a, b) => String(b.season).localeCompare(String(a.season))).map((s) => (
            <div key={s.id} className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              <p className="text-sm font-bold text-gray-900 w-24">{s.season}</p>
              <p className="text-sm text-gray-600 flex-1 min-w-[8rem]">{s.team_name || "—"}{s.category ? ` · ${s.category}` : ""}</p>
              <p className="text-xs text-gray-500">{s.matches_played || 0} {t("PJ")} · {s.minutes_played || 0}' · {s.goals || 0} {t("goles")} · {s.assists || 0} {t("asist.")}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
