import React from "react";
import { Home, Plane, ChevronRight, MapPin } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Convención de la app: score_home = goles de NUESTRO equipo, score_away = goles del rival.
export function resultOf(m) {
  if (m.score_home == null || m.score_away == null) return null;
  const h = Number(m.score_home), a = Number(m.score_away);
  return h > a ? "victoria" : h < a ? "derrota" : "empate";
}

const BADGE = {
  victoria: "bg-green-50 text-green-700 border-green-200",
  empate: "bg-gray-50 text-gray-600 border-gray-200",
  derrota: "bg-red-50 text-red-700 border-red-200",
};

export function HomeAwayIcon({ match, className = "w-4 h-4" }) {
  const home = match.is_home !== false;
  return home ? (
    <span title="Juegas en casa" className="inline-flex"><Home className={`${className} text-emerald-600`} /></span>
  ) : (
    <span title="Juegas fuera" className="inline-flex"><Plane className={`${className} text-sky-600`} /></span>
  );
}

function Row({ m, onOpen }) {
  const result = resultOf(m);
  const past = new Date(m.date) < new Date();
  return (
    <button
      type="button"
      onClick={() => onOpen?.(m)}
      className="w-full px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left group"
    >
      <div className="w-10 text-center shrink-0">
        <p className="text-lg font-black leading-none" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{format(new Date(m.date), "d")}</p>
        <p className="text-[10px] uppercase text-gray-400">{format(new Date(m.date), "MMM", { locale: es })}</p>
      </div>
      <HomeAwayIcon match={m} className="w-5 h-5 shrink-0" />
      {m.opponent_logo_url && <img src={m.opponent_logo_url} alt="" loading="lazy" className="w-7 h-7 object-contain shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 truncate" style={{ fontFamily: "var(--font-display)" }}>{m.opponent ? `vs ${m.opponent}` : m.title}</p>
        <p className="text-xs text-gray-400 truncate flex items-center gap-1">
          <MapPin className="w-3 h-3 shrink-0" />{m.location || "—"} · {format(new Date(m.date), "HH:mm")}
        </p>
      </div>
      <div className="text-right shrink-0">
        {result ? (
          <>
            <p className="text-xl font-black leading-none" style={{ fontFamily: "var(--font-display)" }}>{m.score_home} - {m.score_away}</p>
            <span className={`inline-block mt-1 text-[10px] font-bold uppercase border px-2 py-0.5 rounded-sm ${BADGE[result]}`}>{result}</span>
          </>
        ) : (
          <span className="text-xs text-gray-400">{past ? "Sin resultado" : "Próximo"}</span>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0" />
    </button>
  );
}

export default function MatchesTimeline({ matches, onOpen, title = "Partidos", count = 3 }) {
  const now = new Date();
  const upcoming = matches.filter((m) => new Date(m.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, count);
  const last = matches.filter((m) => new Date(m.date) < now).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, count);
  if (upcoming.length === 0 && last.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-black text-base uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{title}</h2>
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1"><Home className="w-3.5 h-3.5 text-emerald-600" /> Casa</span>
          <span className="inline-flex items-center gap-1"><Plane className="w-3.5 h-3.5 text-sky-600" /> Fuera</span>
        </div>
      </div>
      {upcoming.length > 0 && (
        <div>
          <p className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Próximos {upcoming.length}</p>
          <div className="divide-y divide-gray-50">{upcoming.map((m) => <Row key={m.id} m={m} onOpen={onOpen} />)}</div>
        </div>
      )}
      {last.length > 0 && (
        <div className={upcoming.length ? "border-t border-gray-100" : ""}>
          <p className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Últimos {last.length} jugados</p>
          <div className="divide-y divide-gray-50">{last.map((m) => <Row key={m.id} m={m} onOpen={onOpen} />)}</div>
        </div>
      )}
    </div>
  );
}
