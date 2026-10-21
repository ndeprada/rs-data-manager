import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, isToday, isTomorrow } from "date-fns";
import { CheckCircle2, XCircle, CalendarDays, MapPin, User, Swords, Dumbbell, IdCard } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { playerFullName } from "@/lib/playerName";
import TeamMatchesColumns from "@/components/team/TeamMatchesColumns";
import FCFClassificationsPanel from "@/components/dashboard/FCFClassificationsPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { scoreText } from "@/lib/matchScore";
import { isCancelled, cancelText } from "@/lib/eventCancel";
import { useT, useFormat, msg } from "@/i18n";

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];
const TYPE_LABEL = { partido_amistoso: msg("Amistoso"), partido_liga: msg("Liga"), torneo: msg("Torneo"), entrenamiento: msg("Entrenamiento"), reunion: msg("Reunión") };
const POS = { portero: msg("POR"), lateral: msg("LAT"), central: msg("CTR"), libre: msg("LIB"), mediocentro: msg("MC"), interior: msg("INT"), mediapunta: msg("MP"), delantero_centro: msg("DC"), extremo: msg("EXT") };
const dayLabel = (d, t, locale) => (isToday(d) ? t("Hoy") : isTomorrow(d) ? t("Mañana") : format(d, "EEE d MMM", { locale }));

// Área del jugador: su equipo, calendario, convocatorias y compañeros (solo lectura).
export default function PlayerTeam() {
  const t = useT();
  const { locale, longDateTime } = useFormat();
  const { user } = useAuth();
  const playerId = user?.player_id;
  const [openMatch, setOpenMatch] = useState(null);

  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: convocs = [] } = useQuery({ queryKey: ["convocatorias_all"], queryFn: () => base44.entities.Convocatoria.list() });

  const me = players.find((p) => p.id === playerId);
  const team = teams.find((t) => t.id === me?.team_id);
  const mates = useMemo(() => players.filter((p) => p.team_id === me?.team_id && p.status !== "baja")
    .sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999) || playerFullName(a).localeCompare(playerFullName(b), "es")), [players, me]);
  const convBy = useMemo(() => new Map(convocs.map((c) => [c.event_id, c])), [convocs]);
  const upcoming = useMemo(() => {
    const now = new Date();
    return events.filter((e) => new Date(e.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 8);
  }, [events]);
  const nextMatch = upcoming.find((e) => MATCH_TYPES.includes(e.type) && !isCancelled(e));
  const nextConv = nextMatch ? convBy.get(nextMatch.id) : null;
  const called = nextConv ? (nextConv.player_ids || []).includes(playerId) : null;

  if (!me) return <p className="text-center text-gray-400 py-20">{t("Tu cuenta todavía no está vinculada a una ficha de jugador. Avisa al club.")}</p>;

  const matchRow = openMatch && convBy.get(openMatch.id);
  const calledPlayers = matchRow ? players.filter((p) => (matchRow.player_ids || []).includes(p.id)) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>{t("Mi equipo")}</p>
          <h1 className="text-2xl font-black uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{team?.name || t("Equipo")}</h1>
        </div>
        <Link to="/PlayerProfile" className="inline-flex items-center gap-2 text-sm font-bold text-white px-3 py-2 rounded" style={{ background: "var(--granate)" }}>
          <IdCard className="w-4 h-4" /> {t("Mi ficha y estadísticas")}
        </Link>
      </div>

      {nextMatch && (
        <button onClick={() => setOpenMatch(nextMatch)} className="w-full text-left bg-white border border-gray-200 shadow-sm p-4 flex items-center gap-4 hover:bg-gray-50" style={{ borderRadius: "4px", borderLeft: "4px solid var(--granate)" }}>
          <Swords className="w-6 h-6 shrink-0" style={{ color: "var(--granate)" }} />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">{t("Próximo partido")} · {dayLabel(new Date(nextMatch.date), t, locale)} {format(new Date(nextMatch.date), "HH:mm")}</p>
            <p className="font-bold text-gray-900 truncate">{nextMatch.title || t("vs {rival}", { rival: nextMatch.opponent })}</p>
            {nextMatch.location && <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{nextMatch.location}</p>}
          </div>
          {called == null ? (
            <span className="text-xs font-bold px-2.5 py-1 rounded bg-gray-100 text-gray-500 shrink-0">{t("Convocatoria pendiente")}</span>
          ) : called ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded bg-green-50 text-green-700 border border-green-200 shrink-0"><CheckCircle2 className="w-3.5 h-3.5" /> {t("Convocado")}</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded bg-red-50 text-red-700 border border-red-200 shrink-0"><XCircle className="w-3.5 h-3.5" /> {t("No convocado")}</span>
          )}
        </button>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
          <div className="px-3 py-2 border-b border-gray-100"><h3 className="font-black text-xs uppercase tracking-wider" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{t("Calendario")}</h3></div>
          {upcoming.length === 0 ? <p className="px-3 py-4 text-sm text-gray-400">{t("Sin eventos próximos.")}</p> : (
            <div className="divide-y divide-gray-50">
              {upcoming.map((e) => {
                const isMatch = MATCH_TYPES.includes(e.type);
                const d = new Date(e.date);
                const c = convBy.get(e.id);
                const inConv = c ? (c.player_ids || []).includes(playerId) : null;
                return (
                  <button key={e.id} onClick={() => isMatch && setOpenMatch(e)} className={`w-full px-3 py-2 flex items-center gap-3 text-left ${isMatch ? "hover:bg-gray-50" : "cursor-default"}`}>
                    <div className="w-20 shrink-0 text-xs font-bold text-gray-500 capitalize">{dayLabel(d, t, locale)}<span className="block text-[10px] font-normal text-gray-400">{format(d, "HH:mm")}</span></div>
                    {isMatch ? <Swords className="w-4 h-4 shrink-0 text-[#73000A]" /> : <Dumbbell className="w-4 h-4 shrink-0 text-orange-500" />}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${isCancelled(e) ? "text-gray-400 line-through" : "text-gray-900"}`}>{isMatch ? (e.title || t("vs {rival}", { rival: e.opponent })) : (e.title || t(TYPE_LABEL[e.type] || msg("Evento")))}</p>
                      {e.location && !isCancelled(e) && <p className="text-[11px] text-gray-400 truncate">{e.location}</p>}
                    </div>
                    {isCancelled(e) && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-300 shrink-0">{cancelText(e, t)}</span>}
                    {isMatch && !isCancelled(e) && inConv != null && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${inConv ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{inConv ? t("Convocado") : t("No conv.")}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
          <div className="px-3 py-2 border-b border-gray-100"><h3 className="font-black text-xs uppercase tracking-wider" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{t("Plantilla")} ({mates.length})</h3></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 divide-gray-50 max-h-[26rem] overflow-y-auto">
            {mates.map((p) => (
              <div key={p.id} className={`px-3 py-1.5 flex items-center gap-2 ${p.id === playerId ? "bg-[#fdf2f4]" : ""}`}>
                <span className="w-6 text-xs font-black text-gray-400 text-center">{p.jersey_number ?? "—"}</span>
                <span className="w-6 h-6 rounded overflow-hidden border border-gray-200 flex items-center justify-center shrink-0 bg-gray-50">
                  {p.photo_url ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : <User className="w-3.5 h-3.5 text-gray-300" />}
                </span>
                <span className={`text-sm truncate flex-1 ${p.id === playerId ? "font-bold" : ""}`}>{playerFullName(p)}</span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-sm" style={{ background: "var(--granate-pale)", color: "var(--granate)" }}>{POS[p.position] ? t(POS[p.position]) : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <TeamMatchesColumns matches={events.filter((e) => MATCH_TYPES.includes(e.type))} onOpen={(m) => setOpenMatch(m)} />

      {team?.fcf_group_url && <FCFClassificationsPanel teams={[team]} />}

      <Dialog open={!!openMatch} onOpenChange={(o) => { if (!o) setOpenMatch(null); }}>
        <DialogContent className="bg-white border-gray-200 max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-gray-900">{openMatch?.title || t("vs {rival}", { rival: openMatch?.opponent || "" })}</DialogTitle></DialogHeader>
          {openMatch && (
            <div className="space-y-3 text-sm">
              <p className="text-gray-500 flex items-center gap-2"><CalendarDays className="w-4 h-4" />{longDateTime(openMatch.date)}</p>
              {openMatch.location && <p className="text-gray-500 flex items-center gap-2"><MapPin className="w-4 h-4" />{openMatch.location}</p>}
              {openMatch.score_home != null && openMatch.score_away != null && <p className="font-black text-lg">{scoreText(openMatch)}</p>}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">{t("Convocatoria")} {matchRow ? `(${calledPlayers.length})` : ""}</p>
                {!matchRow ? <p className="text-gray-400">{t("Todavía no hay convocatoria.")}</p> : (
                  <ul className="space-y-1">
                    {calledPlayers.map((p) => <li key={p.id} className={`flex items-center gap-2 ${p.id === playerId ? "font-bold" : ""}`}><span className="w-6 text-xs text-gray-400">{p.jersey_number ?? ""}</span>{playerFullName(p)}</li>)}
                  </ul>
                )}
                {matchRow?.notes && <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2">{matchRow.notes}</p>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
