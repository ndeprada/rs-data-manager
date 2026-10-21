import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { COUNTRIES, PROVINCES, regionOfProvince, countryOf } from "@/lib/countries";
import { getRoleOptions, findRole } from "@/lib/competencyCatalog";
import { LEVELS, EXTRA_LEVELS, getExtraPositions } from "@/lib/playerPositions";
import { positionChoices, stageOf, f7Info } from "@/lib/f7Positions";
import { isF7Team } from "@/lib/teamOrder";
import { F7PositionDetail } from "@/components/player/F7PositionGuide";
import { Plus, X } from "lucide-react";
import { useT, useFormat, msg } from "@/i18n";

const LATERALITY = [
  { value: "diestro", label: msg("Diestro") },
  { value: "zurdo", label: msg("Zurdo") },
  { value: "ambidiestro", label: msg("Ambidiestro") },
];

const emptyForm = {
  first_name: "", last_name: "", nickname: "", birth_date: "", birth_year: "", position: "", reference_role: "", extra_positions: [],
  laterality: "", nationality: "", region: "", birth_province: "", birth_place: "", jersey_number: "", phone: "", email: "", status: "activo", team_id: "",
};

export default function AddPlayerDialog({ open, onOpenChange, teamId, editingPlayer }) {
  const t = useT();
  const fmt = useFormat();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  // Etapa del jugador (fútbol 7 hasta Aleví S12, fútbol 11 desde Infantil S13): decide qué posiciones se ofrecen
  const formTeam = teams.find((t) => t.id === (form.team_id || teamId));
  const stage = stageOf(editingPlayer, formTeam ? isF7Team(formTeam) : false);
  const f7 = stage === "f7";

  useEffect(() => {
    if (editingPlayer) {
      setForm({
        first_name: editingPlayer.first_name || "",
        last_name: editingPlayer.last_name || "",
        nickname: editingPlayer.nickname || "",
        birth_date: editingPlayer.birth_date || "",
        birth_year: editingPlayer.birth_year || (editingPlayer.birth_date ? String(editingPlayer.birth_date).slice(0, 4) : ""),
        position: editingPlayer.position || "",
        reference_role: editingPlayer.reference_role || "",
        extra_positions: getExtraPositions(editingPlayer).map((e) => ({ position: e.position, role: e.role || "", level: e.level === "competente" ? "competente" : "secundaria" })),
        laterality: editingPlayer.laterality || "",
        nationality: countryOf(editingPlayer)?.a3 || "",
        region: editingPlayer.region || "",
        birth_province: editingPlayer.birth_province || "",
        birth_place: editingPlayer.birth_place || "",
        jersey_number: editingPlayer.jersey_number || "",
        phone: editingPlayer.phone || "",
        email: editingPlayer.email || "",
        status: editingPlayer.status || "activo",
        team_id: editingPlayer.team_id || "",
      });
    } else {
      setForm({ ...emptyForm, team_id: teamId || "" });
    }
  }, [editingPlayer, open, teamId]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Player.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["players"] }); onOpenChange(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Player.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["players"] }); onOpenChange(false); },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const extras = (form.extra_positions || []).filter((e) => e.position && !(e.position === form.position && (e.role || "") === (form.reference_role || "")));
    const data = { ...form, extra_positions: extras, secondary_position: extras[0]?.position || "", birth_year: form.birth_year ? Number(form.birth_year) : null, birth_date: form.birth_date || null, team_id: form.team_id || teamId, jersey_number: form.jersey_number ? Number(form.jersey_number) : undefined };
    if (editingPlayer) {
      updateMutation.mutate({ id: editingPlayer.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-gray-200 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-900">{editingPlayer ? t("Editar Jugador") : t("Añadir Jugador")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!teamId && (
            <div className="space-y-2">
              <Label className="text-gray-700">{t("Equipo *")}</Label>
              <Select value={form.team_id} onValueChange={v => setForm({ ...form, team_id: v })}>
                <SelectTrigger className="border-gray-200"><SelectValue placeholder={t("Seleccionar equipo")} /></SelectTrigger>
                <SelectContent>
                  {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-700">{t("Nombre *")}</Label>
              <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required className="border-gray-200" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">{t("Apellidos *")}</Label>
              <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required className="border-gray-200" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-gray-700">{t("Apodo")} <span className="text-gray-400 font-normal">{t("(opcional)")}</span></Label>
            <Input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} className="border-gray-200" />
            <p className="text-[11px] text-gray-400">{t("Se muestra en la app en lugar del nombre. El nombre y apellidos oficiales (FCF) no cambian.")}</p>
          </div>
          <div className="space-y-3 rounded-md border border-gray-200 p-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: LEVELS.natural.color }} />
              <Label className="text-gray-700">{t("Posición natural (principal)")}</Label>
            </div>
            <div className={f7 ? "" : "grid grid-cols-2 gap-3"}>
              <Select value={form.position} onValueChange={(v) => setForm({ ...form, position: v, reference_role: "" })}>
                <SelectTrigger className="border-gray-200"><SelectValue placeholder={t("Posición")} /></SelectTrigger>
                <SelectContent>
                  {positionChoices(stage, form.position).map((p) => <SelectItem key={p.value} value={p.value}>{t(p.label)}</SelectItem>)}
                </SelectContent>
              </Select>
              {!f7 && getRoleOptions(form.position).length > 0 ? (
                <Select value={form.reference_role} onValueChange={(v) => setForm({ ...form, reference_role: v })}>
                  <SelectTrigger className="border-gray-200"><SelectValue placeholder={t("Rol")} /></SelectTrigger>
                  <SelectContent>
                    {getRoleOptions(form.position).map((r) => <SelectItem key={r.value} value={r.value}>{t(r.label)}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (f7 ? null : <div />)}
            </div>
            {f7 && f7Info(form.position) && <F7PositionDetail position={form.position} />}
            {!f7 && form.reference_role && <p className="text-xs text-gray-500">{findRole(form.reference_role)?.role.description}</p>}

            <div className="pt-1 space-y-2">
              <Label className="text-gray-700">{t("Otras posiciones")} <span className="text-gray-400 font-normal">{t("(verde claro = secundaria · naranja = competente)")}</span></Label>
              {(form.extra_positions || []).map((e, idx) => {
                const upd = (patch) => setForm({ ...form, extra_positions: form.extra_positions.map((x, i) => (i === idx ? { ...x, ...patch } : x)) });
                const roles = f7 ? [] : getRoleOptions(e.position);
                return (
                  <div key={idx}>
                  <div className={`grid ${f7 ? "grid-cols-[1fr_auto_auto]" : "grid-cols-[1fr_1fr_auto_auto]"} gap-2 items-center`}>
                    <Select value={e.position} onValueChange={(v) => upd({ position: v, role: "" })}>
                      <SelectTrigger className="border-gray-200"><SelectValue placeholder={t("Posición")} /></SelectTrigger>
                      <SelectContent>{positionChoices(stage, e.position).map((p) => <SelectItem key={p.value} value={p.value}>{t(p.label)}</SelectItem>)}</SelectContent>
                    </Select>
                    {roles.length > 0 ? (
                      <Select value={e.role} onValueChange={(v) => upd({ role: v })}>
                        <SelectTrigger className="border-gray-200"><SelectValue placeholder={t("Rol")} /></SelectTrigger>
                        <SelectContent>{roles.map((r) => <SelectItem key={r.value} value={r.value}>{t(r.label)}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (f7 ? null : <div />)}
                    <Select value={e.level} onValueChange={(v) => upd({ level: v })}>
                      <SelectTrigger className="border-gray-200 w-[130px]">
                        <span className="w-2.5 h-2.5 rounded-full mr-1.5 shrink-0" style={{ background: LEVELS[e.level]?.color }} /><SelectValue />
                      </SelectTrigger>
                      <SelectContent>{EXTRA_LEVELS.map((l) => <SelectItem key={l} value={l}>{t(LEVELS[l].label)}</SelectItem>)}</SelectContent>
                    </Select>
                    <button type="button" aria-label={t("Quitar posición")} onClick={() => setForm({ ...form, extra_positions: form.extra_positions.filter((_, i) => i !== idx) })} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {f7 && f7Info(e.position) && (
                    <details className="mt-1">
                      <summary className="text-[11px] font-semibold text-gray-500 cursor-pointer select-none">{t("Cualidades y contenidos de {label}", { label: f7Info(e.position).label })}</summary>
                      <F7PositionDetail position={e.position} className="mt-1" />
                    </details>
                  )}
                  </div>
                );
              })}
              <button type="button" onClick={() => setForm({ ...form, extra_positions: [...(form.extra_positions || []), { position: "", role: "", level: "secundaria" }] })}
                className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--granate)" }}>
                <Plus className="w-3.5 h-3.5" /> {t("Añadir posición")}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-700">{t("Lateralidad")}</Label>
              <Select value={form.laterality} onValueChange={(v) => setForm({ ...form, laterality: v })}>
                <SelectTrigger className="border-gray-200"><SelectValue placeholder={t("Seleccionar")} /></SelectTrigger>
                <SelectContent>
                  {LATERALITY.map((l) => <SelectItem key={l.value} value={l.value}>{t(l.label)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">{t("Dorsal")}</Label>
              <Input type="number" value={form.jersey_number} onChange={(e) => setForm({ ...form, jersey_number: e.target.value })} className="border-gray-200" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700">{t("Nacionalidad")}</Label>
            <Select value={form.nationality || "none"} onValueChange={(v) => setForm({ ...form, nationality: v === "none" ? "" : v, region: v === "ESP" ? form.region : "", birth_province: v === "ESP" ? form.birth_province : "" })}>
              <SelectTrigger className="border-gray-200"><SelectValue placeholder={t("Seleccionar")} /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="none">{t("Sin indicar")}</SelectItem>
                {COUNTRIES.map((c) => <SelectItem key={c.a3} value={c.a3}>{fmt.country(c.a2, c.name)} ({c.a3})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {form.nationality && (
            <div className="grid grid-cols-2 gap-4">
              {form.nationality === "ESP" && (
                <div className="space-y-2">
                  <Label className="text-gray-700">{t("Provincia de nacimiento")}</Label>
                  <Select value={form.birth_province || "none"} onValueChange={(v) => { const p = v === "none" ? "" : v; setForm({ ...form, birth_province: p, region: regionOfProvince(p) }); }}>
                    <SelectTrigger className="border-gray-200"><SelectValue placeholder={t("Seleccionar")} /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="none">{t("Sin indicar")}</SelectItem>
                      {PROVINCES.map((p) => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className={`space-y-2 ${form.nationality === "ESP" ? "" : "col-span-2"}`}>
                <Label className="text-gray-700">{t("Ciudad / municipio")}</Label>
                <Input value={form.birth_place} onChange={(e) => setForm({ ...form, birth_place: e.target.value })} className="border-gray-200" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-700">{t("Año de nacimiento")}</Label>
              <Input type="number" min="1980" max="2030" placeholder="2009" value={form.birth_year}
                onChange={(e) => setForm({ ...form, birth_year: e.target.value })} className="border-gray-200" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">{t("Fecha completa")} <span className="text-gray-400 font-normal">{t("(opcional)")}</span></Label>
              <Input type="date" value={form.birth_date || ""}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value, birth_year: e.target.value ? e.target.value.slice(0, 4) : form.birth_year })} className="border-gray-200" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-700">{t("Teléfono")}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="border-gray-200" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">{t("Email")}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="border-gray-200" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700">{t("Estado")}</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="activo">{t("Activo")}</SelectItem>
                <SelectItem value="lesionado">{t("Lesionado")}</SelectItem>
                <SelectItem value="baja">{t("Baja")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("Cancelar")}</Button>
            <Button variant="club" type="submit">
              {editingPlayer ? t("Guardar") : t("Añadir")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}