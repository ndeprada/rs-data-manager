import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Skeleton } from "@/components/ui/skeleton";
import { useT, useFormat, useLocaleTag, msg } from "@/i18n";

const RES = {
  G: { cls: "bg-green-600 text-white", label: msg("Victoria") },
  E: { cls: "bg-gray-400 text-white", label: msg("Empate") },
  P: { cls: "bg-red-600 text-white", label: msg("Derrota") },
  // (la letra del recuadro es la inicial de la palabra traducida)
};
const fmtDay = (d, tag) => { try { return new Date(d).toLocaleDateString(tag, { day: "numeric", month: "short" }); } catch { return ""; } };
const f1 = (n, num) => num(Math.round(n * 10) / 10, { minimumFractionDigits: 0, maximumFractionDigits: 1 });

const H2H_VERB = { G: msg("ganasteis"), P: msg("perdisteis"), E: msg("empatasteis") };
const H2H_WHERE = { away: msg("jugando fuera"), home: msg("en casa") };
// Claves automáticas del servidor: llegan como {id, v} para poder traducirlas.
const insightText = (it, t, num) => {
  const v = it.v || {};
  switch (it.id) {
    case "streakWins": return t("Racha de {n} victorias seguidas.", { n: v.n });
    case "unbeaten": return t("Lleva {n} partidos sin perder.", { n: v.n });
    case "winless": return t("Lleva {n} partidos sin ganar.", { n: v.n });
    case "attackTop": return t("Ataque nº {pos} del grupo: {gf} goles ({pg} por partido).", { pos: v.pos, gf: v.gf, pg: f1(v.pg, num) });
    case "scoresLittle": return t("Marca poco: {pg} goles por partido.", { pg: f1(v.pg, num) });
    case "defenceTop": return t("Defensa nº {pos} del grupo: solo {gc} goles encajados ({pg} por partido).", { pos: v.pos, gc: v.gc, pg: f1(v.pg, num) });
    case "concedesMuch": return t("Encaja mucho: {pg} goles por partido.", { pg: f1(v.pg, num) });
    case "cleanSheets": return t("Ha dejado la portería a cero en {n} de {pj} partidos.", { n: v.n, pj: v.pj });
    case "strongerHome": return t("Mucho más fuerte en casa ({home} pts/partido) que fuera ({away}).", { home: f1(v.home, num), away: f1(v.away, num) });
    case "strongerAway": return t("Rinde más fuera ({away} pts/partido) que en casa ({home}).", { home: f1(v.home, num), away: f1(v.away, num) });
    case "depends": return t("Depende de {name}: {goals} de sus {gf} goles.", { name: v.name, goals: v.goals, gf: v.gf });
    case "h2h": return t("Ya os enfrentasteis: {verb} {our}-{rival} {where}.", {
      verb: t(H2H_VERB[v.result]),
      our: v.our, rival: v.rival, where: t(v.away ? H2H_WHERE.away : H2H_WHERE.home),
    });
    default: return "";
  }
};
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
  const t = useT();
  const { num } = useFormat();
  const tag = useLocaleTag();
  const { data, isLoading } = useQuery({
    queryKey: ["rival_report", eventId],
    queryFn: () => base44.club.rivalReport(eventId),
    enabled: !!eventId && enabled,
    staleTime: 15 * 60 * 1000,
  });

  if (!enabled) return null;
  if (isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (!data?.available) return null; // sin datos de la FCF no se enseña nada (el análisis manual sigue debajo)

  const { rival, us, form, home, away, scorers, insights, insightItems, next, cleanSheets } = data;
  // Con servidor antiguo (sin insightItems) se enseñan los textos tal cual, en español.
  const lines = insightItems?.length === insights.length ? insightItems.map((it) => insightText(it, t, num) || "").filter(Boolean) : insights;
  const pg = (n) => (rival.pj ? f1(n / rival.pj, num) : "–");

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
          <Stat label={t("Puesto")} value={t("{pos}º", { pos: rival.pos })} sub={us ? t("Nosotros {pos}º", { pos: us.pos }) : null} />
          <Stat label={t("Puntos")} value={rival.pts} sub={us ? t("Nosotros {pts}", { pts: us.pts }) : null} />
          <Stat label={t("Partidos")} value={rival.pj} sub={rec(rival)} />
          <Stat label={t("Goles")} value={`${rival.gf}–${rival.gc}`} sub={t("{pg} / {pg2} por partido", { pg: pg(rival.gf), pg2: pg(rival.gc) })} />
        </div>
      </div>

      <div className="px-4 py-3 grid gap-x-6 gap-y-3 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">{t("Últimos partidos")}</p>
          {form.length ? (
            <div className="flex gap-1.5 flex-wrap">
              {form.map((f, i) => (
                <span key={i} title={`${t(f.home ? "Local" : "Visitante")} vs ${f.vs} (${fmtDay(f.date, tag)}): ${f.gf}-${f.gc}`}
                  className={`inline-flex flex-col items-center justify-center w-10 h-10 rounded-md text-[11px] font-black leading-none ${RES[f.result].cls}`}>
                  <span>{t(RES[f.result].label).charAt(0).toUpperCase()}</span>
                  <span className="text-[10px] font-bold opacity-90 mt-0.5">{f.gf}-{f.gc}</span>
                </span>
              ))}
            </div>
          ) : <p className="text-xs text-gray-400">{t("Aún no ha jugado.")}</p>}
          <p className="text-[10px] text-gray-400 mt-1">{t("El más reciente a la izquierda.")}</p>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">{t("Local y visitante")}</p>
          <div className="text-xs text-gray-700 space-y-0.5">
            <p><span className="font-bold">{t("En casa:")}</span> {home.pj ? `${rec(home)} · ${home.gf}–${home.gc}` : t("sin partidos")}</p>
            <p><span className="font-bold">{t("Fuera:")}</span> {away.pj ? `${rec(away)} · ${away.gf}–${away.gc}` : t("sin partidos")}</p>
            {rival.pj > 0 && <p><span className="font-bold">{t("Portería a cero:")}</span> {t("{cleanSheets} de {pj}", { cleanSheets, pj: rival.pj })}</p>}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">{t("Goleadores")}</p>
          {scorers.length ? (
            <ul className="text-xs text-gray-700 space-y-0.5">
              {scorers.map((s) => <li key={s.name}><span className="font-bold">{s.goals}</span> · {s.name}</li>)}
            </ul>
          ) : <p className="text-xs text-gray-400">{t("Sin goles todavía.")}</p>}
        </div>
      </div>

      {lines.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{t("Claves")}</p>
          <ul className="text-xs text-gray-700 space-y-0.5 list-disc pl-4">
            {lines.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </div>
      )}

      {next.length > 0 && (
        <p className="px-4 pb-3 text-[11px] text-gray-400">
          {t("Después juega:")} {next.map((n) => (n.home ? t("{day} contra {vs}", { day: fmtDay(n.date, tag), vs: n.vs }) : t("{day} en {vs}", { day: fmtDay(n.date, tag), vs: n.vs }))).join(" · ")}
        </p>
      )}
      <p className="px-4 pb-2 text-[10px] text-gray-300">{t("Datos públicos de la FCF · se actualizan cada pocos minutos")}</p>
    </div>
  );
}
