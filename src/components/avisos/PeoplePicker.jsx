import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, BellOff, Search, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { FUNCTION_LABELS } from "@/lib/staffRoles";
import { useT } from "@/i18n";

// Máximo de personas en un mismo aviso (el servidor aplica el mismo límite)
export const MAX_PEOPLE = 30;

const roleLabel = (r) => (r === "familiar" ? "Familiar" : FUNCTION_LABELS[r] || "Usuario");

// Texto de apoyo de una persona: su equipo, o de quién es familiar
export function personDetail(p, t) {
  const team = (x) => (x.team ? ` (${x.team})` : "");
  if (p.role === "familiar") return p.players.length ? t("de {names}", { names: p.players.map((x) => `${x.name}${team(x)}`).join(", ") }) : "";
  if (p.players.length) return p.players.map((x) => x.team).filter(Boolean).join(", ");
  return (p.teams || []).join(", ");
}

// Etiqueta del aviso en el historial: «Personal · María López, Álex Entrenador y 2 más»
export function peopleLabel(picked) {
  const names = picked.slice(0, 3).map((p) => p.name).join(", ");
  return `Personal · ${names}${picked.length > 3 ? ` y ${picked.length - 3} más` : ""}`;
}

function Bell1({ on }) {
  const t = useT();
  return on
    ? <span title={t("Tiene los avisos activados en el móvil")} className="shrink-0"><Bell className="w-3.5 h-3.5 text-green-600" /></span>
    : <span title={t("Sin avisos en el móvil: lo verá en la pestaña Avisos de la app")} className="shrink-0"><BellOff className="w-3.5 h-3.5 text-gray-300" /></span>;
}

// Buscador de personas con cuenta en la app (jugadores, familiares, entrenadores…) para avisarles de forma individual.
export default function PeoplePicker({ picked, setPicked }) {
  const t = useT();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);

  const enabled = q.length >= 2;
  const { data: found = [], isFetching } = useQuery({
    queryKey: ["avisosPeople", q], queryFn: () => base44.club.people(q), enabled, staleTime: 30000,
  });
  const pickedIds = new Set(picked.map((p) => p.id));
  const results = found.filter((p) => !pickedIds.has(p.id));
  const full = picked.length >= MAX_PEOPLE;

  const add = (p) => { if (!full) { setPicked([...picked, p]); setText(""); setQ(""); } };
  const remove = (id) => setPicked(picked.filter((p) => p.id !== id));

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
        {t("Destinatarios")} <span className="normal-case tracking-normal font-normal">{t("· una o varias personas; a un familiar lo encuentras por el nombre de su hijo")}</span>
      </p>
      {picked.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {picked.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs font-bold text-white" style={{ background: "var(--granate)" }}>
              {p.name}
              <span className="font-normal opacity-80">· {t(roleLabel(p.role))}</span>
              <button type="button" onClick={() => remove(p.id)} aria-label={t("Quitar a {name}", { name: p.name })} className="rounded-full p-0.5 hover:bg-white/20"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={text} onChange={(e) => setText(e.target.value)} disabled={full} autoComplete="off"
          placeholder={full ? t("Máximo {MAX_PEOPLE} personas", { MAX_PEOPLE }) : t("Buscar jugador, familiar o entrenador…")}
          className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:bg-gray-50" />
      </div>
      {enabled && (
        <div className="mt-1.5 border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
          {isFetching && results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400">{t("Buscando…")}</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400">{found.length > 0 ? t("Ya has añadido a todas las personas encontradas.") : t("No hay nadie con ese nombre a quien puedas avisar. Solo salen personas con cuenta en la app.")}</p>
          ) : results.map((p) => (
            <button key={p.id} type="button" onClick={() => add(p)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50">
              <Bell1 on={p.has_push} />
              <span className="font-bold text-sm text-gray-900">{p.name}</span>
              <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-sm" style={{ background: "var(--granate-pale)", color: "var(--granate)" }}>{t(roleLabel(p.role))}</span>
              <span className="text-xs text-gray-500 truncate">{personDetail(p, t)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
