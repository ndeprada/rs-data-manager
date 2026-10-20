import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { sortTeams, isF7Team } from "@/lib/teamOrder";
import PeoplePicker, { peopleLabel } from "@/components/avisos/PeoplePicker";

const norm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const STAGES = [
  ["Primer equipo", "primer"], ["Juvenil", "juvenil"], ["Cadete", "cadet"], ["Infantil", "infantil"],
  ["Aleví", "alevi"], ["Benjamín", "benjam"], ["Prebenjamín", "prebenjam"], ["Escuela", "escuela"],
];
// "benjam" también está dentro de "prebenjam": se distingue por el inicio del nombre
const inStage = (team, key) => norm(team.name).startsWith(key);

const GROUPS = [
  { key: "jugadores", label: "Jugadores" },
  { key: "familiares", label: "Familiares" },
  { key: "tecnico", label: "Cuerpo técnico" },
];

const Chip = ({ on, onClick, children }) => (
  <button type="button" onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${on ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}
    style={on ? { background: "var(--granate)" } : undefined}>
    {children}
  </button>
);

// Formulario para enviar un aviso eligiendo equipos y tipo de destinatario.
// `fixed` (opcional) = { player_ids, label } para avisar solo a un grupo concreto de jugadores (p. ej. los convocados).
export default function Composer({ fixed = null, defaultTitle = "", defaultBody = "", defaultUrl, onSent }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isCoord = user?.role === "admin" || ["director", "director_deportivo", "coordinador_general", "coordinador_f7", "coordinador_f11"].includes(user?.app_role);
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const myTeamIds = useMemo(() => new Set([...(user?.team_ids || []), ...(user?.team_id ? [user.team_id] : [])]), [user]);
  const available = sortTeams(isCoord ? teams : teams.filter((t) => myTeamIds.has(t.id)));

  // Selecciones rápidas: por formato (F11 / F7) y por etapa
  const quick = useMemo(() => {
    const list = [
      ["Fútbol 11", available.filter((t) => !isF7Team(t))],
      ["Fútbol 7", available.filter((t) => isF7Team(t))],
      ...STAGES.map(([label, key]) => [label, available.filter((t) => inStage(t, key))]),
    ];
    return list.filter(([, ts]) => ts.length > 0).map(([label, ts]) => ({ label, ids: ts.map((t) => t.id) }));
  }, [available]);

  const [mode, setMode] = useState("teams");       // "teams" = por equipos · "people" = a personas concretas
  const [picked, setPicked] = useState([]);
  const people = !fixed && mode === "people";
  const [title, setTitle] = useState(defaultTitle);
  const [body, setBody] = useState(defaultBody);
  const [teamIds, setTeamIds] = useState([]);
  const [allClub, setAllClub] = useState(false);
  const [groups, setGroups] = useState(fixed ? ["jugadores", "familiares"] : ["jugadores", "familiares"]);
  const [count, setCount] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const quickOn = (ids) => !allClub && ids.every((id) => teamIds.includes(id));
  const toggleQuick = (ids) => {
    setAllClub(false);
    setTeamIds(quickOn(ids) ? teamIds.filter((id) => !ids.includes(id)) : [...new Set([...teamIds, ...ids])]);
  };

  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const audience = useMemo(() => (people
    ? { all_club: false, team_ids: [], player_ids: [], user_ids: picked.map((p) => p.id), groups: [] }
    : {
      all_club: !fixed && allClub,
      team_ids: fixed ? [] : teamIds,
      player_ids: fixed ? fixed.player_ids : [],
      groups,
    }), [people, picked, fixed, allClub, teamIds, groups]);

  const label = useMemo(() => {
    if (people) return peopleLabel(picked);
    const who = groups.map((g) => GROUPS.find((x) => x.key === g)?.label).filter(Boolean).join(" + ");
    if (fixed) return `${fixed.label} · ${who}`;
    const where = allClub ? "Todo el club" : teams.filter((t) => teamIds.includes(t.id)).map((t) => t.name).join(", ");
    return `${where} · ${who}`;
  }, [people, picked, fixed, allClub, teamIds, groups, teams]);

  const hasTarget = people ? picked.length > 0 : fixed ? fixed.player_ids.length > 0 : allClub || teamIds.length > 0;
  // Por equipos hay que elegir también a qué grupo de personas llega; a una persona concreta, no
  const groupsOk = people || groups.length > 0;

  useEffect(() => {
    setCount(null);
    if (!hasTarget || !groupsOk) return;
    const t = setTimeout(() => base44.club.preview(audience).then(setCount).catch(() => setCount(null)), 300);
    return () => clearTimeout(t);
  }, [audience, hasTarget, groupsOk]);

  const send = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await base44.club.send({ title, body, url: defaultUrl, audience, audience_label: label });
      setMsg({ ok: true, text: `Enviado a ${r.recipients} persona${r.recipients === 1 ? "" : "s"} (${r.sent} dispositivo${r.sent === 1 ? "" : "s"} con aviso activado).` });
      setTitle(defaultTitle); setBody(defaultBody); setPicked([]);
      qc.invalidateQueries({ queryKey: ["noticeHistory"] });
      onSent?.(r);
    } catch (e) {
      setMsg({ ok: false, text: e.data?.error === "no_recipients" ? "No hay nadie a quien enviar con esa selección." : (e.message || "No se pudo enviar") });
    }
    setBusy(false);
  };

  const canSend = title.trim() && body.trim() && hasTarget && groupsOk && (count?.recipients ?? 0) > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
      {!fixed && (
        <div className="flex gap-1.5">
          <Chip on={mode === "teams"} onClick={() => setMode("teams")}>Por equipos</Chip>
          <Chip on={mode === "people"} onClick={() => setMode("people")}>A una persona</Chip>
        </div>
      )}
      {people && <PeoplePicker picked={picked} setPicked={setPicked} />}
      {!fixed && !people && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Equipos <span className="normal-case tracking-normal font-normal">· puedes combinar grupos y equipos sueltos</span></p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {isCoord && <Chip on={allClub} onClick={() => setAllClub(!allClub)}>Todo el club</Chip>}
            {quick.map((g) => <Chip key={g.label} on={quickOn(g.ids)} onClick={() => toggleQuick(g.ids)}>{g.label}</Chip>)}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
            {available.map((t) => (
              <Chip key={t.id} on={!allClub && teamIds.includes(t.id)} onClick={() => { setAllClub(false); toggle(teamIds, setTeamIds, t.id); }}>{t.name}</Chip>
            ))}
          </div>
        </div>
      )}
      {fixed && <p className="text-xs text-gray-500">Para: <b>{fixed.label}</b></p>}
      {!people && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">A quién le llega</p>
          <div className="flex flex-wrap gap-1.5">
            {GROUPS.filter((g) => !(fixed && g.key === "tecnico")).map((g) => (
              <Chip key={g.key} on={groups.includes(g.key)} onClick={() => toggle(groups, setGroups, g.key)}>{g.label}</Chip>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="Título"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2" />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={600} rows={4} placeholder="Mensaje" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-400">
          {count ? <>Llegará a <b className="text-gray-700">{count.recipients}</b> persona{count.recipients === 1 ? "" : "s"} · <b className="text-gray-700">{count.with_push}</b> con avisos activados</> : hasTarget ? "Calculando…" : "Elige a quién enviar"}
        </p>
        <button onClick={send} disabled={!canSend || busy}
          className="flex items-center gap-1.5 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full disabled:opacity-40"
          style={{ background: "var(--granate)" }}>
          <Send className="w-3.5 h-3.5" /> {busy ? "Enviando…" : "Enviar"}
        </button>
      </div>
      {count && count.with_push < count.recipients && (
        <p className="text-[11px] text-gray-400">Los que no tienen los avisos activados lo verán igualmente en la pestaña Avisos de la app.</p>
      )}
      {msg && <p className={`text-xs ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}
