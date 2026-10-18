import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Skeleton } from "@/components/ui/skeleton";

const RES = {
  G: { cls: "bg-green-600 text-white", label: "Victoria" },
  E: { cls: "bg-gray-400 text-white", label: "Empate" },
  P: { cls: "bg-red-600 text-white", label: "Derrota" },
};
const fmtDay = (d) => { try { return new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "short" }); } catch { return ""; } };
const rec = (r) => `${r.g}G ${r.e}E ${r.p}P`;

const Stat = ({ label, value, sub }) => (
  <div className="min-w-0">
    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
    <p className="text-sm font-black text-gray-900 leading-tight">{value}</p>
    {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
  </div>
);

// Ficha del rival con datos públicos de la FCF: de un vistazo cómo llega el rival al partido.
export default function RivalReport({ eventId, enabled = true }) {
  const { data, isLoading } = useQuery({
    queryKey: ["rival_report", eventId],
    queryFn: () => base44.club.rivalReport(eventId),
    enabled: !!eventId && enabled,
    staleTime: 15 * 60 * 1000,
  });

  if (!enabled) return null;
  if (isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (!data?.available) return null; // sin datos de la FCF no se enseña nada (el análisis manual sigue debajo)

  const { rival, us, form, home, away, scorers, insights, next, cleanSheets } = data;
  const pg = (n) => (rival.pj ? (n / rival.pj).toFixed(1).replace(".", ",") : "–");

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden" style={{ borderLeft: "3px solid var(--granate)" }}>
      <div className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-100">
        <div className="flex items-center gap-2.5 min-w-0 flex-1" style={{ minWidth: "11rem" }}>
          {rival.logo && <img src={rival.logo} alt="" className="w-9 h-9 object-contain shrink-0" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
          <div className="min-w-0">
            <p className="text-sm font-black text-gray-900 truncate" style={{ fontFamily: "var(--font-display)" }}>{rival.name}</p>
            <p className="text-[11px] text-gray-400 truncate">{[data.competition, data.group].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Stat label="Puesto" value={`${rival.pos}º`} sub={us ? `Nosotros ${us.pos}º` : null} />
          <Stat label="Puntos" value={rival.pts} sub={us ? `Nosotros ${us.pts}` : null} />
          <Stat label="Partidos" value={rival.pj} sub={rec(rival)} />
          <Stat label="Goles" value={`${rival.gf}–${rival.gc}`} sub={`${pg(rival.gf)} / ${pg(rival.gc)} por partido`} />
        </div>
      </div>

      <div className="px-4 py-3 grid gap-x-6 gap-y-3 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Últimos partidos</p>
          {form.length ? (
            <div className="flex gap-1.5 flex-wrap">
              {form.map((f, i) => (
                <span key={i} title={`${f.home ? "Local" : "Visitante"} vs ${f.vs} (${fmtDay(f.date)}): ${f.gf}-${f.gc}`}
                  className={`inline-flex flex-col items-center justify-center w-10 h-10 rounded-md text-[11px] font-black leading-none ${RES[f.result].cls}`}>
                  <span>{f.result === "G" ? "V" : f.result === "E" ? "E" : "D"}</span>
                  <span className="text-[10px] font-bold opacity-90 mt-0.5">{f.gf}-{f.gc}</span>
                </span>
              ))}
            </div>
          ) : <p className="text-xs text-gray-400">Aún no ha jugado.</p>}
          <p className="text-[10px] text-gray-400 mt-1">El más reciente a la izquierda.</p>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Local y visitante</p>
          <div className="text-xs text-gray-700 space-y-0.5">
            <p><span className="font-bold">En casa:</span> {home.pj ? `${rec(home)} · ${home.gf}–${home.gc}` : "sin partidos"}</p>
            <p><span className="font-bold">Fuera:</span> {away.pj ? `${rec(away)} · ${away.gf}–${away.gc}` : "sin partidos"}</p>
            {rival.pj > 0 && <p><span className="font-bold">Portería a cero:</span> {cleanSheets} de {rival.pj}</p>}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Goleadores</p>
          {scorers.length ? (
            <ul className="text-xs text-gray-700 space-y-0.5">
              {scorers.map((s) => <li key={s.name}><span className="font-bold">{s.goals}</span> · {s.name}</li>)}
            </ul>
          ) : <p className="text-xs text-gray-400">Sin goles todavía.</p>}
        </div>
      </div>

      {insights.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Claves</p>
          <ul className="text-xs text-gray-700 space-y-0.5 list-disc pl-4">
            {insights.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}

      {next.length > 0 && (
        <p className="px-4 pb-3 text-[11px] text-gray-400">
          Después juega: {next.map((n) => `${fmtDay(n.date)} ${n.home ? "contra" : "en"} ${n.vs}`).join(" · ")}
        </p>
      )}
      <p className="px-4 pb-2 text-[10px] text-gray-300">Datos públicos de la FCF · se actualizan cada pocos minutos</p>
    </div>
  );
}
