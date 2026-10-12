import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Target, CheckCircle2, Plus, Trash2, RotateCcw, ChevronDown, ChevronUp, BookOpen, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  GROUP_LABELS, getPositionCatalog, getRoleOptions, findRole, getSelectableCompetencies,
} from "@/lib/competencyCatalog";

function currentQuarter() {
  const d = new Date();
  return `${d.getFullYear()} T${Math.floor(d.getMonth() / 3) + 1}`;
}

function CompetencyPicker({ options, selectedId, onSelect }) {
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
              {g === "all" ? "Todas" : GROUP_LABELS[g] || g}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {list.length === 0 && <p className="text-sm text-gray-400">No hay competencias.</p>}
        {list.map((o) => (
          <button
            type="button"
            key={o.id}
            onClick={() => onSelect(o)}
            className={`w-full text-left text-sm rounded-xl border px-3 py-2 transition-colors ${selectedId === o.id ? "border-[var(--granate)] bg-red-50" : "border-gray-200 hover:bg-gray-50"}`}
          >
            <span className="block text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">{GROUP_LABELS[o.group] || "Rol de referencia"}</span>
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function GoalCard({ goal, onToggle, onDelete }) {
  const improved = goal.status === "mejorado";
  return (
    <div className={`rounded-xl border p-3 ${improved ? "border-green-200 bg-green-50/50" : "border-gray-200 bg-white"}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${goal.source === "role" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}`}>
              {goal.source === "role" ? `Rol · ${goal.role_label || ""}` : `General · ${GROUP_LABELS[goal.group] || ""}`}
            </span>
            {goal.period && <span className="text-[10px] text-gray-400">{goal.period}</span>}
            {improved && goal.improved_date && <span className="text-[10px] text-green-700">Mejorado el {new Date(goal.improved_date).toLocaleDateString("es-ES")}</span>}
          </div>
          <p className="text-sm text-gray-800">{goal.competency_text}</p>
          {goal.objective && <p className="text-sm text-gray-600 mt-1.5"><strong>Objetivo:</strong> {goal.objective}</p>}
          {goal.strategy && <p className="text-sm text-gray-600 mt-1"><strong>Cómo se trabaja:</strong> {goal.strategy}</p>}
          {goal.evidence && <p className="text-sm text-gray-600 mt-1"><strong>Evidencia / comportamiento observado:</strong> {goal.evidence}</p>}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={() => onToggle(goal)} title={improved ? "Volver a 'a mejorar'" : "Marcar como mejorado"} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-green-700">
            {improved ? <RotateCcw className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          </button>
          <button onClick={() => onDelete(goal)} title="Eliminar" className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PDIPlanSection({ player }) {
  const queryClient = useQueryClient();
  const playerId = player.id;
  const catalog = getPositionCatalog(player.position);
  const roleInfo = player.reference_role ? findRole(player.reference_role) : null;
  const selectable = useMemo(() => getSelectableCompetencies(player.position, player.reference_role), [player.position, player.reference_role]);

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
  const create = useMutation({
    mutationFn: (data) => base44.entities.PDIGoal.create({ ...data, player_id: playerId }),
    onSuccess: () => { refresh(); setOpen(false); setPicked(null); setForm({ objective: "", strategy: "", evidence: "", period: currentQuarter(), status: "a_mejorar" }); },
  });
  const update = useMutation({ mutationFn: ({ id, data }) => base44.entities.PDIGoal.update(id, data), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id) => base44.entities.PDIGoal.delete(id), onSuccess: refresh });

  const toImprove = goals.filter((g) => g.status !== "mejorado");
  const improved = goals.filter((g) => g.status === "mejorado");

  const submit = (e) => {
    e.preventDefault();
    if (!picked) return;
    create.mutate({
      competency_id: picked.id,
      competency_text: picked.text,
      source: picked.source,
      group: picked.group,
      role_id: picked.source === "role" ? player.reference_role : undefined,
      role_label: picked.roleLabel,
      position: catalog?.key,
      objective: form.objective,
      strategy: form.strategy,
      evidence: form.evidence,
      period: form.period,
      status: form.status === "mejorado" ? "mejorado" : "a_mejorar",
      improved_date: form.status === "mejorado" ? new Date().toISOString() : undefined,
    });
  };

  const toggle = (g) => {
    const next = g.status === "mejorado" ? "a_mejorar" : "mejorado";
    update.mutate({ id: g.id, data: { status: next, improved_date: next === "mejorado" ? new Date().toISOString() : null } });
  };

  if (!catalog) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm text-sm text-gray-500">
        Para usar el Plan de Desarrollo por competencias, asigna una <strong>posición</strong> al jugador (botón Editar del perfil).
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--granate-pale, #fdf2f4)" }}>
            <Target className="w-5 h-5" style={{ color: "var(--granate)" }} />
          </div>
          <div className="flex-1 min-w-[220px]">
            <h3 className="font-semibold text-gray-900">Plan de Desarrollo Individual · competencias</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Posición: <strong>{catalog.label}</strong>
              {roleInfo ? <> · Rol de referencia: <strong>{roleInfo.role.label}</strong></> : null}
            </p>
            {!roleInfo && (
              <div className="mt-2 max-w-xs">
                <Label className="text-xs text-gray-500">Asigna un rol de referencia</Label>
                <Select value="" onValueChange={(v) => setRole.mutate(v)}>
                  <SelectTrigger className="border-gray-200"><SelectValue placeholder="Seleccionar rol" /></SelectTrigger>
                  <SelectContent>
                    {getRoleOptions(player.position).map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {roleInfo && <p className="text-xs text-gray-500 mt-1.5 max-w-2xl">{roleInfo.role.description}</p>}
          </div>
          <Button onClick={() => { setTab(roleInfo ? "role" : "general"); setOpen(true); }} className="text-white shrink-0" style={{ background: "var(--granate)" }}>
            <Plus className="w-4 h-4 mr-2" /> Añadir aspecto
          </Button>
        </div>
        <button onClick={() => setShowRef(!showRef)} className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800">
          <BookOpen className="w-3.5 h-3.5" /> Ver competencias de referencia {showRef ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showRef && (
          <div className="mt-3 grid md:grid-cols-2 gap-4">
            {roleInfo && (
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 mb-2">Competencias clave · {roleInfo.role.label}</p>
                <ul className="list-disc pl-4 space-y-1 text-sm text-gray-700">{roleInfo.role.key.map((t, i) => <li key={i}>{t}</li>)}</ul>
                {roleInfo.role.contents?.length > 0 && <p className="text-xs text-gray-500 mt-3"><strong>Contenidos prioritarios:</strong> {roleInfo.role.contents.join(" · ")}</p>}
                {roleInfo.role.references && <p className="text-xs text-gray-500 mt-1"><strong>Referencias:</strong> {roleInfo.role.references}</p>}
              </div>
            )}
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 max-h-80 overflow-y-auto">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">Competencias generales · {catalog.label}</p>
              {Object.entries(catalog.groups).map(([g, items]) => (
                <div key={g} className="mb-3">
                  <p className="text-[11px] font-semibold text-gray-500 mb-1">{GROUP_LABELS[g]}</p>
                  <ul className="list-disc pl-4 space-y-1 text-sm text-gray-700">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-900 flex items-center gap-2"><Target className="w-4 h-4 text-orange-500" /> Aspectos a mejorar <span className="text-xs text-gray-400">({toImprove.length})</span></h4>
          </div>
          {toImprove.length > 3 && (
            <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-2 mb-3">
              <AlertTriangle className="w-4 h-4 shrink-0" /> El método recomienda un máximo de 2–3 objetivos activos por trimestre. El resto quedan registrados sin intervención principal.
            </div>
          )}
          <div className="space-y-2">
            {toImprove.length === 0 ? <p className="text-sm text-gray-400">Aún no hay aspectos a mejorar.</p> : toImprove.map((g) => <GoalCard key={g.id} goal={g} onToggle={toggle} onDelete={(x) => remove.mutate(x.id)} />)}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <h4 className="font-semibold text-gray-900 flex items-center gap-2 mb-3"><CheckCircle2 className="w-4 h-4 text-green-600" /> Trabajados y mejorados <span className="text-xs text-gray-400">({improved.length})</span></h4>
          <div className="space-y-2">
            {improved.length === 0 ? <p className="text-sm text-gray-400">Todavía no hay aspectos marcados como mejorados.</p> : improved.map((g) => <GoalCard key={g.id} goal={g} onToggle={toggle} onDelete={(x) => remove.mutate(x.id)} />)}
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white border-gray-200 max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle className="text-gray-900">Añadir aspecto al PDI</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="flex gap-2">
              {roleInfo && (
                <button type="button" onClick={() => { setTab("role"); setPicked(null); }} className={`px-3 py-1.5 rounded-lg text-sm border ${tab === "role" ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`} style={tab === "role" ? { background: "var(--granate)" } : {}}>
                  Rol: {roleInfo.role.label}
                </button>
              )}
              <button type="button" onClick={() => { setTab("general"); setPicked(null); }} className={`px-3 py-1.5 rounded-lg text-sm border ${tab === "general" ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`} style={tab === "general" ? { background: "var(--granate)" } : {}}>
                Generales de {catalog.label}
              </button>
            </div>
            <CompetencyPicker key={tab} options={tab === "role" ? selectable.role : selectable.general} selectedId={picked?.id} onSelect={setPicked} />
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-gray-700">Periodo</Label>
                <Input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} className="border-gray-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-700">Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a_mejorar">A mejorar</SelectItem>
                    <SelectItem value="mejorado">Ya trabajado y mejorado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-700">Objetivo individual (frase clara y específica)</Label>
              <Textarea rows={2} value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} className="border-gray-200" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-700">Estrategia de intervención (sesión de equipo, tarea complementaria, vídeo...)</Label>
              <Textarea rows={2} value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value })} className="border-gray-200" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-700">Comportamiento observable / evidencia</Label>
              <Textarea rows={2} value={form.evidence} onChange={(e) => setForm({ ...form, evidence: e.target.value })} className="border-gray-200" />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={!picked || create.isPending} className="text-white" style={{ background: "var(--granate)" }}>Añadir</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
