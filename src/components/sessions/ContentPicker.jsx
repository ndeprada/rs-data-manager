import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronDown, ChevronRight, Plus, Search, X } from "lucide-react";
import {
  BLOCKS, PRIORITY, STAGES, blockInfo, contentBlock, contentName, paletteContentId, priorityOf, stageContents, stageInfo, stagesOfContent, targetPct,
} from "@/lib/sessionPlan";

const MAX_PRINCIPAL = 2;
// Secundarios sin límite (03/11/2026, Nacho: «hay contenidos que se trabajan a la vez… no limitemos los secundarios»)
const MAX_SECONDARY = Infinity;
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Chip de un contenido ya elegido (en la tarea y en la ficha)
export function ContentChip({ id, stage, kind, onRemove, task }) {
  const pr = priorityOf(stage, id);
  const b = blockInfo(contentBlock(id, task));
  const palette = String(id).startsWith("pal.");
  const main = kind === "principal";
  // Aspecto de la maqueta: principal en granate claro, secundario en gris con «· sec.»
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full ${onRemove ? "pl-2 pr-1" : "px-2"} py-[3px] text-[11px] font-semibold whitespace-nowrap max-w-full`} title={b?.label}
      style={main ? { background: "#FBEDEE", border: "1px solid #E6B9BE", color: "#73000A" } : { background: "#F7F4F4", border: "1px solid #DDD3D4", color: "#6B5E60" }}>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: b?.color || "#999" }} />
      <span className="truncate">{contentName(id, task)}{!main && " · sec."}</span>
      {pr && <span className="text-[10px] font-extrabold rounded px-1" style={{ background: PRIORITY[pr].bg, color: PRIORITY[pr].color }} title={`Prioridad ${PRIORITY[pr].label.toLowerCase()} en la etapa`}>{PRIORITY[pr].short}</span>}
      {!pr && palette && <span className="text-[10px] rounded px-1 bg-orange-100 text-orange-800" title="Contenido de la paleta del club">paleta</span>}
      {!pr && !palette && <span className="text-[10px] rounded px-1 bg-amber-100 text-amber-700" title="Este contenido no es de la etapa del equipo">otra etapa</span>}
      {onRemove && <button type="button" onClick={onRemove} className="p-0.5 rounded-full hover:bg-black/10" aria-label={`Quitar ${contentName(id, task)}`}><X className="w-3 h-3" /></button>}
    </span>
  );
}

const stageShort = (ids) => ids.map((s) => stageInfo(s)?.label).filter(Boolean).join(", ");

/**
 * Elegir los contenidos de una tarea (02/11/2026, rediseño pedido por Nacho: como el control de contenidos).
 * Cada área se despliega con sus contenidos en el orden del currículum; en cada uno se toca P (principal, máx. 2) o S (secundario, sin límite).
 * Se pueden sumar contenidos de otras etapas y los de la paleta del club (SessionContent), y proponer contenidos nuevos.
 */
export default function ContentPicker({ open, onOpenChange, stage, principal = [], secondary = [], custom = {}, onChange }) {
  const { user } = useAuth();
  const { perms } = useTeamAccess();
  const queryClient = useQueryClient();
  const isCoord = !!(perms?.administration || perms?.isAdmin);
  const [q, setQ] = useState("");
  const [showOther, setShowOther] = useState(false);
  const [showPalette, setShowPalette] = useState(true);
  const [openBlocks, setOpenBlocks] = useState(() => new Set());
  const [proposeIn, setProposeIn] = useState(null);
  const [proposal, setProposal] = useState("");

  const { data: palette = [] } = useQuery({ queryKey: ["session_contents"], queryFn: () => base44.entities.SessionContent.list("name", 500), enabled: open });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["session_contents"] });
  const create = useMutation({
    mutationFn: (data) => base44.entities.SessionContent.create(data),
    onSuccess: () => { invalidate(); setProposal(""); setProposeIn(null); },
  });
  const review = useMutation({
    mutationFn: ({ id, data }) => (data ? base44.entities.SessionContent.update(id, data) : base44.entities.SessionContent.delete(id)),
    onSuccess: invalidate,
  });

  const own = useMemo(() => stageContents(stage), [stage]);
  const ownIds = useMemo(() => new Set(own.map((c) => c.id)), [own]);
  const others = useMemo(() => {
    if (!showOther) return [];
    const seen = new Set(ownIds);
    const out = [];
    for (const s of STAGES) {
      if (s.id === stage) continue;
      for (const c of stageContents(s.id)) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        out.push({ ...c, priority: null, other: stageShort(stagesOfContent(c.id)) });
      }
    }
    return out;
  }, [showOther, ownIds, stage]);
  const pal = useMemo(() => palette
    .filter((d) => d.status === "aprobado" ? showPalette && (d.stage === stage || showOther || !d.stage) : d.status === "propuesto" && (isCoord || d.author_id === user?.id))
    .map((d) => ({ id: paletteContentId(d.id), docId: d.id, name: d.name, block: d.block, priority: null, palette: true, pending: d.status !== "aprobado", stageLabel: d.stage && d.stage !== stage ? stageInfo(d.stage)?.label : "", author: d.author_name })),
  [palette, showPalette, showOther, stage, isCoord, user?.id]);

  const all = [...own, ...others, ...pal];
  const query = norm(q.trim());
  const filtered = query ? all.filter((c) => norm(c.name).includes(query)) : all;

  const toggle = (c, kind) => {
    if (c.pending) return;
    const inP = principal.includes(c.id), inS = secondary.includes(c.id);
    let p = principal, s = secondary;
    if (kind === "principal") {
      if (inP) p = p.filter((x) => x !== c.id);
      else { if (p.length >= MAX_PRINCIPAL) return; p = [...p, c.id]; s = s.filter((x) => x !== c.id); }
    } else {
      if (inS) s = s.filter((x) => x !== c.id);
      else { if (s.length >= MAX_SECONDARY) return; s = [...s, c.id]; p = p.filter((x) => x !== c.id); }
    }
    const keep = new Set([...p, ...s]);
    const nextCustom = Object.fromEntries(Object.entries(custom || {}).filter(([id]) => keep.has(id)));
    if (c.palette && keep.has(c.id)) nextCustom[c.id] = { name: c.name, block: c.block };
    onChange({ principal: p, secondary: s, custom_contents: nextCustom });
  };
  const removeId = (id) => {
    const p = principal.filter((x) => x !== id), s = secondary.filter((x) => x !== id);
    const nextCustom = { ...(custom || {}) }; delete nextCustom[id];
    onChange({ principal: p, secondary: s, custom_contents: nextCustom });
  };

  const toggleBlock = (id) => setOpenBlocks((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const propose = (block) => {
    const name = proposal.trim();
    if (!name) return;
    create.mutate({ name, block, stage: stage || null, status: isCoord ? "aprobado" : "propuesto", author_id: user?.id, author_name: user?.full_name || user?.email || "" });
  };
  const info = stageInfo(stage);
  const pFull = principal.length >= MAX_PRINCIPAL, sFull = secondary.length >= MAX_SECONDARY;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-2xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0" data-testid="content-picker">
        <DialogHeader className="p-4 pb-2 shrink-0">
          <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Contenidos de la tarea</DialogTitle>
          <DialogDescription className="text-xs">
            {info ? `${info.label} (${info.teams}). ` : ""}En cada contenido toca <b>P</b> (principal, hasta 2) o <b>S</b> (secundario, hasta 2). Los dos cuentan todo el tiempo de la tarea, cada uno por su lado.
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 pb-2 space-y-2 shrink-0 border-b border-gray-100">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[12rem]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar contenido en todas las áreas…" className="pl-8 h-9" data-testid="content-search" />
            </div>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
              <span className="px-2.5 py-2 bg-[var(--granate)] text-white">Su etapa</span>
              <button type="button" onClick={() => setShowOther((v) => !v)} aria-pressed={showOther} data-testid="content-other"
                className={`px-2.5 py-2 border-l border-gray-200 ${showOther ? "bg-[var(--granate)] text-white" : "text-gray-600 hover:bg-gray-50"}`}>+ otras etapas</button>
              <button type="button" onClick={() => setShowPalette((v) => !v)} aria-pressed={showPalette} data-testid="content-palette"
                className={`px-2.5 py-2 border-l border-gray-200 ${showPalette ? "bg-[var(--granate)] text-white" : "text-gray-600 hover:bg-gray-50"}`}>+ paleta del club</button>
            </div>
          </div>
          <p className="text-[11px] text-gray-600">Elegidos: <b className="text-[var(--granate)]">principales {principal.length}/{MAX_PRINCIPAL}</b> · <b>secundarios {secondary.length}</b> (sin límite). El bloque del primer principal es donde cuenta el tiempo de la tarea.</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {BLOCKS.map((b) => {
            const items = filtered.filter((c) => c.block === b.id);
            const pickedHere = [...principal, ...secondary].filter((id) => contentBlock(id, { custom_contents: custom }) === b.id);
            if (!items.length && query) return null;
            const isOpen = query ? true : openBlocks.has(b.id);
            const pHere = pickedHere.filter((id) => principal.includes(id)).length, sHere = pickedHere.length - pHere;
            return (
              <div key={b.id} className="border-t border-gray-100 first:border-t-0">
                <button type="button" onClick={() => toggleBlock(b.id)} className={`w-full text-left px-4 py-2.5 grid grid-cols-[1rem_0.7rem_1fr_auto_auto] items-center gap-2 hover:bg-gray-50 ${isOpen ? "bg-gray-50/70" : ""}`} data-testid={`content-block-${b.id}`}>
                  {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }} />
                  <span className="text-sm font-black uppercase tracking-wide truncate" style={{ fontFamily: "var(--font-display)", color: b.color }}>{b.label}</span>
                  <span className="text-[11px] whitespace-nowrap">
                    {pickedHere.length ? <b className={pHere ? "text-[var(--granate)]" : "text-gray-700"}>{[pHere ? `${pHere} P` : "", sHere ? `${sHere} S` : ""].filter(Boolean).join(" · ")}</b> : <span className="text-gray-400">{items.length} contenidos</span>}
                  </span>
                  <span className="text-[11px] text-gray-400 whitespace-nowrap w-14 text-right">ref. {targetPct(b.id, stage)}%</span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-3 pl-10">
                    <div className="rounded-lg border border-gray-100 divide-y divide-gray-100 bg-white">
                      {items.map((c) => {
                        const isP = principal.includes(c.id), isS = secondary.includes(c.id);
                        const pr = c.priority ? PRIORITY[c.priority] : null;
                        return (
                          <div key={c.id} className={`grid grid-cols-[1.6rem_1fr_auto] items-center gap-2 px-2 py-1.5 text-sm ${c.palette ? "bg-orange-50/40" : ""}`} data-testid={`content-row-${c.id}`}>
                            {pr ? <span className="text-[9px] font-black rounded px-1 text-center" style={{ background: pr.bg, color: pr.color }} title={`Prioridad ${pr.label.toLowerCase()} en la etapa`}>{pr.short}</span>
                              : c.palette ? <span className="text-[9px] font-black rounded px-1 text-center bg-orange-100 text-orange-800" title="Paleta del club">+</span>
                              : <span className="text-[9px] font-bold rounded px-1 text-center bg-amber-50 text-amber-700" title={`De otra etapa: ${c.other}`}>·</span>}
                            <span className={`min-w-0 ${isP || isS ? "font-bold" : ""}`}>
                              {c.name}
                              {c.other && <span className="text-[10px] text-amber-700 font-normal"> · {c.other}</span>}
                              {c.palette && !c.pending && <span className="text-[10px] text-orange-800 font-normal"> · paleta del club{c.stageLabel ? ` (${c.stageLabel})` : ""}</span>}
                              {c.pending && <span className="text-[10px] text-gray-500 font-normal"> · pendiente de aprobar{c.author ? ` (propuesto por ${c.author})` : ""}</span>}
                            </span>
                            {c.pending ? (
                              isCoord ? (
                                <span className="flex gap-1">
                                  <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => review.mutate({ id: c.docId, data: { status: "aprobado" } })}>Aprobar</Button>
                                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-red-600" onClick={() => review.mutate({ id: c.docId, data: null })}>Rechazar</Button>
                                </span>
                              ) : <span />
                            ) : (
                              <span className="flex gap-1">
                                <button type="button" onClick={() => toggle(c, "principal")} disabled={!isP && pFull} aria-pressed={isP} title="Contenido principal"
                                  className={`h-7 w-11 rounded-md border text-[11px] font-black ${isP ? "bg-[var(--granate)] text-white border-[var(--granate)]" : pFull ? "text-gray-300 border-gray-100" : "text-gray-600 border-gray-300 hover:bg-gray-50"}`}>{isP ? <><Check className="w-3 h-3 inline -mt-0.5" /> P</> : "P"}</button>
                                <button type="button" onClick={() => toggle(c, "secondary")} disabled={!isS && sFull} aria-pressed={isS} title="Contenido secundario"
                                  className={`h-7 w-11 rounded-md border text-[11px] font-black ${isS ? "bg-gray-700 text-white border-gray-700" : sFull ? "text-gray-300 border-gray-100" : "text-gray-600 border-gray-300 hover:bg-gray-50"}`}>{isS ? <><Check className="w-3 h-3 inline -mt-0.5" /> S</> : "S"}</button>
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {!items.length && <p className="px-2 py-2 text-xs text-gray-400">Esta etapa no tiene contenidos en esta área.</p>}
                      {proposeIn === b.id ? (
                        <div className="flex items-center gap-2 px-2 py-2">
                          <Input autoFocus value={proposal} onChange={(e) => setProposal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") propose(b.id); }} placeholder="Nombre del contenido nuevo" className="h-8 text-sm" />
                          <Button type="button" size="sm" variant="club" className="h-8" onClick={() => propose(b.id)} disabled={!proposal.trim() || create.isPending}>{isCoord ? "Añadir" : "Proponer"}</Button>
                          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => { setProposeIn(null); setProposal(""); }}>Cancelar</Button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => { setProposeIn(b.id); setProposal(""); }} className="w-full text-left px-2 py-1.5 text-xs font-semibold text-[var(--granate)] hover:bg-gray-50 flex items-center gap-1" data-testid={`content-propose-${b.id}`}>
                          <Plus className="w-3.5 h-3.5" /> {isCoord ? "Añadir un contenido a la paleta del club en esta área" : "Proponer un contenido para esta área"}
                        </button>
                      )}
                    </div>
                    {proposeIn === b.id && !isCoord && <p className="text-[10px] text-gray-500 mt-1">Coordinación lo revisa; cuando lo apruebe, lo podrán elegir todos los entrenadores de la etapa.</p>}
                  </div>
                )}
              </div>
            );
          })}
          {query && !filtered.length && <p className="text-sm text-gray-400 text-center py-6">No hay contenidos con ese nombre. Prueba con «+ otras etapas».</p>}
          <p className="text-[10px] text-gray-400 px-4 py-2">A = prioridad alta · M = media · B = baja (currículum de la etapa) · + = paleta del club.</p>
        </div>

        <div className="p-3 border-t border-gray-100 flex items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap gap-1 min-w-0">
            {principal.map((id) => <ContentChip key={id} id={id} stage={stage} kind="principal" task={{ custom_contents: custom }} onRemove={() => removeId(id)} />)}
            {secondary.map((id) => <ContentChip key={id} id={id} stage={stage} kind="secondary" task={{ custom_contents: custom }} onRemove={() => removeId(id)} />)}
          </div>
          <Button variant="club" onClick={() => onOpenChange(false)} className="shrink-0">Listo</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
