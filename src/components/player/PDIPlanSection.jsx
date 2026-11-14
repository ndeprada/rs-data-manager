import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Plus, Trash2, RotateCcw, ChevronDown, ChevronUp, BookOpen, AlertTriangle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  GROUP_LABELS, POSITION_CATALOG, getPositionCatalog, getRoleOptions, findRole, getSelectableCompetencies,
} from "@/lib/competencyCatalog";
import { VisibilityField, VisibilityBadge } from "@/components/player/VisibilityToggle";
import F7PositionGuide from "@/components/player/F7PositionGuide";
import { usePlayerMode } from "@/lib/playerMode";
import { stageOf, f7Info, isF7Position, f7ContentOptions, F7_POSITIONS } from "@/lib/f7Positions";
import { isF7Team } from "@/lib/teamOrder";
import { useT, useFormat, msg } from "@/i18n";
import { C as clubColor } from "@/lib/brand";

const STAGE_LABEL = { f7: msg("Fútbol 7"), f11: msg("Fútbol 11") };
const F7_GROUPS = ["tecnicas", "fisicas", "mentales"];

// Competencias de otras posiciones (generales + clave de sus roles)
function otherPositionOptions(currentKey) {
  const out = [];
  Object.entries(POSITION_CATALOG).forEach(([pk, pos]) => {
    if (pk === currentKey) return;
    Object.entries(pos.groups).forEach(([group, items]) => {
      items.forEach((text, i) => out.push({ id: `${pk}.${group}.${i}`, source: "other", group: pk, groupLabel: pos.label, subLabel: GROUP_LABELS[group], text, roleLabel: pos.label }));
    });
    pos.roles.forEach((r) => r.key.forEach((text, i) => out.push({ id: `${r.id}.key.${i}`, source: "other", group: pk, groupLabel: pos.label, subLabel: r.label, roleSub: true, text, roleLabel: pos.label })));
  });
  return out;
}

function currentQuarter() {
  const d = new Date();
  return `${d.getFullYear()} T${Math.floor(d.getMonth() / 3) + 1}`;
}

function CompetencyPicker({ options, selectedId, onSelect, labelOf }) {
  const t = useT();
  const [group, setGroup] = useState("all");
  const groups = [...new Set(options.map((o) => o.group))];
  const list = options.filter((o) => group === "all" || o.group === group);
  return (
    <div>
      {groups.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {["all", ...groups].map((g) => (
            <button
              type="button"
              key={g}
              onClick={() => setGroup(g)}
              className={`px-2.5 py-1 rounded-full text-xs border ${group === g ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`}
              style={group === g ? { background: "var(--granate)" } : {}}
            >
              {g === "all" ? t("Todas") : (labelOf ? labelOf(g) : t(GROUP_LABELS[g] || g))}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {list.length === 0 && <p className="text-sm text-gray-400">{t("No hay competencias.")}</p>}
        {list.map((o) => (
          <button
            type="button"
            key={o.id}
            onClick={() => onSelect(o)}
            className={`w-full text-left text-sm rounded-xl border px-3 py-2 transition-colors ${selectedId === o.id ? "border-[var(--granate)] bg-red-50" : "border-gray-200 hover:bg-gray-50"}`}
          >
            <span className="block text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">{o.subLabel ? `${t(o.groupLabel)} · ${o.roleSub ? t("Rol {rol}", { rol: t(o.subLabel) }) : t(o.subLabel)}` : t(GROUP_LABELS[o.group] || msg("Rol de referencia"))}</span>
            {t(o.text)}
          </button>
        ))}
      </div>
    </div>
  );
}

const STATE_COLOR = { a_mejorar: "#F59E0B", trabajando: "#2563EB", mejorado: "#15803D" };
function GoalCard({ goal, onAdvance, onBack, onDelete, onToggleVisible, readOnly }) {
  const t = useT();
  const { tag: dateTag } = useFormat();
  const st = goal.status === "mejorado" ? "mejorado" : goal.status === "trabajando" ? "trabajando" : "a_mejorar";
  const rl = goal.role_label ? t(goal.role_label) : "";
  const tag = goal.source === "role" ? t("Rol · {rol}", { rol: rl }) : goal.source === "f7" ? t("Contenido · {rol}", { rol: rl }) : goal.source === "other" ? t("Otra posición · {rol}", { rol: rl }) : t("General · {grupo}", { grupo: GROUP_LABELS[goal.group] ? t(GROUP_LABELS[goal.group]) : "" });
  const d = (x) => { const v = x ? new Date(x) : null; return v && !isNaN(v) ? v.toLocaleDateString(dateTag, { day: "numeric", month: "short" }) : ""; };
  const since = st === "mejorado" ? (goal.improved_date ? t("Mejorado el {fecha}", { fecha: d(goal.improved_date) }) : "") : goal.created_date ? t("Desde el {fecha}", { fecha: d(goal.created_date) }) : goal.period || "";
  const btn = { font: "inherit", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, border: "1px solid #E6DEDD", background: "#fff", color: clubColor.primary, display: "inline-flex", alignItems: "center", gap: 3 };
  return (
    <div className="bg-white" style={{ border: "1px solid #E6DEDD", borderRadius: 10, padding: "8px 10px" }} data-testid={`pdi-goal-${goal.id}`}>
      <div className="flex items-center" style={{ gap: 6 }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#6B5E60", flex: 1, minWidth: 0 }} className="truncate">{tag}</span>
        {!readOnly && <VisibilityBadge value={goal.visible_to_player} onToggle={(v) => onToggleVisible(goal, v)} />}
      </div>
      <p style={{ fontSize: 13, fontWeight: 700, margin: "3px 0 0", color: "#1E1416" }}>{t(goal.competency_text)}</p>
      {goal.objective && <p style={{ fontSize: 12, color: "#4A3D3F", margin: "3px 0 0" }}>{goal.objective}</p>}
      {goal.strategy && <p style={{ fontSize: 11.5, color: "#6B5E60", margin: "3px 0 0" }}><b>{t("Cómo se trabaja:")}</b> {goal.strategy}</p>}
      {goal.evidence && <p style={{ fontSize: 11.5, color: "#6B5E60", margin: "3px 0 0" }}><b>{t("Evidencia / comportamiento observado:")}</b> {goal.evidence}</p>}
      <div className="flex flex-wrap items-center" style={{ gap: 5, marginTop: 6 }}>
        <span style={{ fontSize: 11, color: "#6B5E60", marginRight: "auto" }}>{since}</span>
        {!readOnly && st !== "a_mejorar" && <button type="button" style={btn} onClick={() => onBack(goal)} title={st === "mejorado" ? t("Reabrir (a mejorar)") : t("Volver a 'a mejorar'")} data-testid={`pdi-back-${goal.id}`}><RotateCcw className="w-3 h-3" /></button>}
        {!readOnly && st === "a_mejorar" && <button type="button" style={btn} onClick={() => onAdvance(goal)} data-testid={`pdi-advance-${goal.id}`}><Play className="w-3 h-3" />{t("Empezar a trabajarlo")}</button>}
        {!readOnly && st === "trabajando" && <button type="button" style={{ ...btn, color: "#15803D" }} onClick={() => onAdvance(goal)} data-testid={`pdi-advance-${goal.id}`}><CheckCircle2 className="w-3 h-3" />{t("Mejorado")}</button>}
        {!readOnly && <button type="button" style={{ ...btn, color: "#9CA3AF" }} onClick={() => onDelete(goal)} title={t("Eliminar")}><Trash2 className="w-3 h-3" /></button>}
      </div>
    </div>
  );
}

function Column({ title, color, list, children, testId }) {
  return (
    <div style={{ flex: "1 1 220px", minWidth: 0, background: "#FAF7F6", border: "1px solid #E6DEDD", borderRadius: 12, padding: 8 }} data-testid={testId}>
      <div className="flex items-center" style={{ gap: 6, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 9, background: color }} />
        <b style={{ fontSize: 13 }}>{title}</b><span style={{ fontSize: 11, color: "#6B5E60" }}>{list.length}</span>
      </div>
      <div className="flex flex-col" style={{ gap: 6 }}>{children}</div>
    </div>
  );
}

export default function PDIPlanSection({ player, team }) {
  const t = useT();
  const queryClient = useQueryClient();
  const playerMode = usePlayerMode();
  const [visible, setVisible] = useState(null);
  const [visError, setVisError] = useState(false);
  const playerId = player.id;
  const catalog = getPositionCatalog(player.position);
  const roleInfo = player.reference_role ? findRole(player.reference_role) : null;
  // Etapa: la fijada a mano en la ficha o, si no, la del equipo (fútbol 7 hasta Aleví S12)
  const stage = stageOf(player, team ? isF7Team(team) : false);
  const isF7 = stage === "f7";
  const f7 = isF7 ? f7Info(player.position) : null; // posición de fútbol 7 con su descripción y contenidos
  const posLabel = t(f7?.label || catalog?.label || "");
  const selectableAll = useMemo(() => getSelectableCompetencies(player.position, player.reference_role), [player.position, player.reference_role]);
  const selectable = useMemo(() => ({
    role: isF7 ? [] : selectableAll.role,
    general: isF7 ? selectableAll.general.filter((o) => F7_GROUPS.includes(o.group)) : selectableAll.general,
  }), [selectableAll, isF7]);
  const f7Own = useMemo(() => (f7 ? f7ContentOptions(player.position) : []), [f7, player.position]);
  const others = useMemo(() => (f7 ? f7ContentOptions(player.position, { other: true }) : otherPositionOptions(catalog?.key)), [f7, player.position, catalog?.key]);

  const [open, setOpen] = useState(false);
  const [showRef, setShowRef] = useState(false);
  const [tab, setTab] = useState("role");
  const [picked, setPicked] = useState(null);
  const [form, setForm] = useState({ objective: "", strategy: "", evidence: "", period: currentQuarter(), status: "a_mejorar" });

  const { data: goals = [] } = useQuery({
    queryKey: ["pdi_goals", playerId],
    queryFn: () => base44.entities.PDIGoal.filter({ player_id: playerId }, "-created_date"),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["pdi_goals", playerId] });

  const setRole = useMutation({
    mutationFn: (role) => base44.entities.Player.update(playerId, { reference_role: role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players"] }),
  });
  const setStage = useMutation({
    mutationFn: (v) => base44.entities.Player.update(playerId, { pdi_stage: v }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players"] }),
  });
  const create = useMutation({
    mutationFn: (data) => base44.entities.PDIGoal.create({ ...data, player_id: playerId }),
    onSuccess: () => { refresh(); setOpen(false); setPicked(null); setVisible(null); setVisError(false); setForm({ objective: "", strategy: "", evidence: "", period: currentQuarter(), status: "a_mejorar" }); },
  });
  const update = useMutation({ mutationFn: ({ id, data }) => base44.entities.PDIGoal.update(id, data), onSuccess: refresh });
  const toggleVisible = (g, v) => update.mutate({ id: g.id, data: { visible_to_player: v } });
  const remove = useMutation({ mutationFn: (id) => base44.entities.PDIGoal.delete(id), onSuccess: refresh });

  const toImprove = goals.filter((g) => g.status !== "mejorado");
  const active = toImprove.filter((g) => g.status === "trabajando");
  const improved = goals.filter((g) => g.status === "mejorado");

  const submit = (e) => {
    e.preventDefault();
    if (!picked) return;
    if (visible == null) { setVisError(true); return; }
    create.mutate({
      visible_to_player: visible,
      competency_id: picked.id,
      competency_text: picked.text,
      source: picked.source,
      group: picked.group,
      role_id: picked.source === "role" ? player.reference_role : undefined,
      role_label: picked.roleLabel,
      position: catalog?.key || player.position,
      objective: form.objective,
      strategy: form.strategy,
      evidence: form.evidence,
      period: form.period,
      stage,
      status: ["mejorado", "trabajando"].includes(form.status) ? form.status : "a_mejorar",
      improved_date: form.status === "mejorado" ? new Date().toISOString() : undefined,
    });
  };

  const advance = (g) => {
    const next = g.status === "trabajando" ? "mejorado" : "trabajando";
    update.mutate({ id: g.id, data: { status: next, improved_date: next === "mejorado" ? new Date().toISOString() : null } });
  };
  const back = (g) => {
    const next = g.status === "mejorado" ? "trabajando" : "a_mejorar";
    update.mutate({ id: g.id, data: { status: next, improved_date: null } });
  };

  if (!catalog && !f7) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{t("Etapa:")}</span>
          {["f7", "f11"].map((k) => (
            <button key={k} type="button" onClick={() => setStage.mutate(k)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${stage === k ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`}
              style={stage === k ? { background: "var(--granate)" } : {}}>{t(STAGE_LABEL[k])}</button>
          ))}
          {!player.pdi_stage && <span className="text-[10px] text-gray-400">{t("(según el equipo)")}</span>}
        </div>
        <p className="text-sm text-gray-500">
          {isF7Position(player.position)
            ? t("«{pos}» es una posición de fútbol 7. Para planificar en fútbol 11, asigna una posición de esa etapa (botón Editar del perfil).", { pos: t(f7Info(player.position).label) })
            : t("Para planificar competencias por posición, asigna una posición al jugador (botón Editar del perfil).")}
        </p>
      </div>
    );
  }

  const stageBtns = !playerMode && (
    <span className="inline-flex items-center" style={{ gap: 4 }}>
      {["f7", "f11"].map((k) => (
        <button key={k} type="button" onClick={() => setStage.mutate(k)}
          style={{ font: "inherit", fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, border: `1px solid ${stage === k ? clubColor.primary : "#E6DEDD"}`, background: stage === k ? clubColor.primary : "#fff", color: stage === k ? "#fff" : "#4A3D3F" }}>{t(STAGE_LABEL[k])}</button>
      ))}
      {!player.pdi_stage && <span style={{ fontSize: 10, color: "#9C8E90" }}>{t("(según el equipo)")}</span>}
    </span>
  );
  const goalProps = { onAdvance: advance, onBack: back, onDelete: (x) => remove.mutate(x.id), onToggleVisible: toggleVisible, readOnly: playerMode };
  const toDo = toImprove.filter((g) => g.status !== "trabajando");

  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <section className="rs2-card" style={{ padding: "10px 14px" }} data-testid="pdi-plan">
        <div className="flex flex-wrap items-center" style={{ gap: 8, marginBottom: 8 }}>
          <h2 style={{ margin: 0, borderLeft: `3px solid ${clubColor.accent}`, paddingLeft: 7, lineHeight: 1 }}><span className="rs2-display" style={{ fontSize: 17, color: clubColor.primary }}>{t("Plan de desarrollo")}</span></h2>
          {!playerMode && <span style={{ marginLeft: "auto" }}><Button variant="club" size="sm" onClick={() => { setTab(roleInfo && !isF7 ? "role" : f7 ? "f7" : catalog ? "general" : "other"); setOpen(true); }} data-testid="pdi-add"><Plus className="w-3.5 h-3.5 mr-1" />{t("Añadir aspecto")}</Button></span>}
        </div>
        <div className="flex flex-wrap items-center" style={{ gap: 10, fontSize: 12, marginBottom: 10 }}>
          <span>{t("Posición:")} <b>{posLabel}</b></span>
          {roleInfo && !isF7 && <span>· {t("Rol de referencia:")} <b>{t(roleInfo.role.label)}</b></span>}
          {!roleInfo && !isF7 && !playerMode && (
            <span style={{ minWidth: 200 }}>
              <Select value="" onValueChange={(v) => setRole.mutate(v)}>
                <SelectTrigger className="border-gray-200 h-8 text-xs"><SelectValue placeholder={t("Asigna un rol de referencia")} /></SelectTrigger>
                <SelectContent>{getRoleOptions(player.position).map((r) => <SelectItem key={r.value} value={r.value}>{t(r.label)}</SelectItem>)}</SelectContent>
              </Select>
            </span>
          )}
          {stageBtns}
          {catalog && <button type="button" onClick={() => setShowRef(!showRef)} className="inline-flex items-center" style={{ marginLeft: "auto", gap: 4, border: 0, background: "none", fontSize: 12, fontWeight: 700, color: clubColor.primary }}>
            <BookOpen className="w-3.5 h-3.5" /> {t("Ver competencias de referencia")} {showRef ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>}
        </div>
        {isF7 && !f7 && <p className="text-xs text-gray-500" style={{ margin: "0 0 8px" }}>{t("En Fútbol 7 la posición pesa poco: se trabajan sobre todo competencias técnicas, físicas y mentales.")}</p>}
        {f7 && <F7PositionGuide player={player} className="mb-3" />}
        {catalog && showRef && (
          <div className="grid md:grid-cols-2 gap-4" style={{ marginBottom: 10 }}>
            {roleInfo && (
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 mb-2">{t("Competencias clave · {rol}", { rol: t(roleInfo.role.label) })}</p>
                <ul className="list-disc pl-4 space-y-1 text-sm text-gray-700">{roleInfo.role.key.map((k, i) => <li key={i}>{t(k)}</li>)}</ul>
                {roleInfo.role.contents?.length > 0 && <p className="text-xs text-gray-500 mt-3"><strong>{t("Contenidos prioritarios:")}</strong> {roleInfo.role.contents.map((c) => t(c)).join(" · ")}</p>}
                {roleInfo.role.references && <p className="text-xs text-gray-500 mt-1"><strong>{t("Referencias:")}</strong> {t(roleInfo.role.references)}</p>}
              </div>
            )}
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 max-h-80 overflow-y-auto">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">{t("Competencias generales · {pos}", { pos: t(catalog.label) })}</p>
              {Object.entries(catalog.groups).map(([g, items]) => (
                <div key={g} className="mb-3">
                  <p className="text-[11px] font-semibold text-gray-500 mb-1">{t(GROUP_LABELS[g])}</p>
                  <ul className="list-disc pl-4 space-y-1 text-sm text-gray-700">{items.map((k, i) => <li key={i}>{t(k)}</li>)}</ul>
                </div>
              ))}
            </div>
          </div>
        )}
        {active.length > 3 && (
          <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-2" style={{ marginBottom: 8 }}>
            <AlertTriangle className="w-4 h-4 shrink-0" /> {t("El método recomienda un máximo de 2–3 objetivos activos por trimestre. El resto quedan registrados sin intervención principal.")}
          </div>
        )}
        <div className="flex flex-wrap" style={{ gap: 10, alignItems: "flex-start" }}>
          <Column title={t("A mejorar")} color={STATE_COLOR.a_mejorar} list={toDo} testId="pdi-col-a_mejorar">
            {toDo.length === 0 ? <p style={{ fontSize: 12, color: "#9C8E90", margin: 4 }}>{t("Aún no hay aspectos a mejorar.")}</p> : toDo.map((g) => <GoalCard key={g.id} goal={g} {...goalProps} />)}
          </Column>
          <Column title={t("Trabajando")} color={STATE_COLOR.trabajando} list={active} testId="pdi-col-trabajando">
            {active.length === 0 ? <p style={{ fontSize: 12, color: "#9C8E90", margin: 4 }}>{t("Nada en marcha ahora.")}</p> : active.map((g) => <GoalCard key={g.id} goal={g} {...goalProps} />)}
          </Column>
          <Column title={t("Mejorado")} color={STATE_COLOR.mejorado} list={improved} testId="pdi-col-mejorado">
            {improved.length === 0 ? <p style={{ fontSize: 12, color: "#9C8E90", margin: 4 }}>{t("Todavía no hay aspectos marcados como mejorados.")}</p> : improved.map((g) => <GoalCard key={g.id} goal={g} {...goalProps} />)}
          </Column>
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white border-gray-200 max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle className="text-gray-900">{t("Añadir aspecto al PDI")}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="flex gap-2">
              {roleInfo && !isF7 && (
                <button type="button" onClick={() => { setTab("role"); setPicked(null); }} className={`px-3 py-1.5 rounded-lg text-sm border ${tab === "role" ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`} style={tab === "role" ? { background: "var(--granate)" } : {}}>
                  {t("Rol: {rol}", { rol: t(roleInfo.role.label) })}
                </button>
              )}
              {f7 && (
                <button type="button" onClick={() => { setTab("f7"); setPicked(null); }} className={`px-3 py-1.5 rounded-lg text-sm border ${tab === "f7" ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`} style={tab === "f7" ? { background: "var(--granate)" } : {}}>
                  {t("Contenidos: {pos}", { pos: t(f7.label) })}
                </button>
              )}
              {catalog && (
                <button type="button" onClick={() => { setTab("general"); setPicked(null); }} className={`px-3 py-1.5 rounded-lg text-sm border ${tab === "general" ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`} style={tab === "general" ? { background: "var(--granate)" } : {}}>
                  {t("Generales de {pos}", { pos: t(catalog.label) })}
                </button>
              )}
              <button type="button" onClick={() => { setTab("other"); setPicked(null); }} className={`px-3 py-1.5 rounded-lg text-sm border ${tab === "other" ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`} style={tab === "other" ? { background: "#7e22ce" } : {}}>
                {f7 ? t("Contenidos de otras posiciones") : t("Competencias de otras posiciones")}
              </button>
            </div>
            {tab === "other" && <p className="text-xs text-purple-800 bg-purple-50 border border-purple-100 rounded-lg p-2">{f7 ? t("Contenidos de otras posiciones: quedarán marcados como «Otra posición».") : t("Competencias de otras posiciones: quedarán marcados como «Otra posición».")}</p>}
            <CompetencyPicker key={tab} options={tab === "role" ? selectable.role : tab === "other" ? others : tab === "f7" ? f7Own : selectable.general} selectedId={picked?.id} onSelect={setPicked}
              labelOf={tab === "other" ? (g) => t(F7_POSITIONS[g]?.label || POSITION_CATALOG[g]?.label || g) : undefined} />
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-gray-700">{t("Periodo")}</Label>
                <Input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} className="border-gray-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-700">{t("Estado")}</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a_mejorar">{t("A mejorar")}</SelectItem>
                    <SelectItem value="trabajando">{t("Trabajando")}</SelectItem>
                    <SelectItem value="mejorado">{t("Ya trabajado y mejorado")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-700">{t("Objetivo individual (frase clara y específica)")}</Label>
              <Textarea rows={2} value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} className="border-gray-200" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-700">{t("Estrategia de intervención (sesión de equipo, tarea complementaria, vídeo...)")}</Label>
              <Textarea rows={2} value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value })} className="border-gray-200" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-700">{t("Comportamiento observable / evidencia")}</Label>
              <Textarea rows={2} value={form.evidence} onChange={(e) => setForm({ ...form, evidence: e.target.value })} className="border-gray-200" />
            </div>
            <VisibilityField value={visible} onChange={setVisible} error={visError} />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("Cancelar")}</Button>
              <Button variant="club" type="submit" disabled={!picked || create.isPending}>{t("Añadir")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
