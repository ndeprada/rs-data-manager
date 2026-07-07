import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Shirt, RotateCcw } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";

const KIT_LABELS = { segunda: "2ª Equipación", tercera: "3ª Equipación" };
const KIT_COLORS = { segunda: "bg-amber-100 text-amber-800", tercera: "bg-purple-100 text-purple-800" };
const STATUS_COLORS = {
  prestado: "bg-blue-100 text-blue-700",
  devuelto: "bg-green-100 text-green-700",
  pendiente_lavado: "bg-orange-100 text-orange-700",
};
const STATUS_LABELS = { prestado: "Prestado", devuelto: "Devuelto", pendiente_lavado: "Pendiente lavado" };

const EMPTY_FORM = {
  team_id: "", staff_member_id: "", kit_type: "segunda", matchday: "",
  loan_date: new Date().toISOString().split("T")[0], return_date: "",
  quantity: 1, sizes: "", status: "prestado", rival_team: "", notes: "",
};

export default function KitLoansTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterStatus, setFilterStatus] = useState("prestado");

  const { data: loans = [] } = useQuery({
    queryKey: ["kit_loans"],
    queryFn: () => base44.entities.KitLoan.list("-loan_date"),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["staff_members"],
    queryFn: () => base44.entities.StaffMember.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.KitLoan.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kit_loans"] });
      setShowForm(false);
      setForm(EMPTY_FORM);
      toast({ title: "Préstamo de equipación registrado" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.KitLoan.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kit_loans"] });
      toast({ title: "Estado actualizado" });
    },
  });

  const getTeamName = (id) => teams.find(t => t.id === id)?.name || "—";
  const getStaffName = (id) => {
    const s = staff.find(m => m.id === id);
    return s ? `${s.first_name} ${s.last_name}` : null;
  };

  const filtered = filterStatus === "all" ? loans : loans.filter(l => l.status === filterStatus);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...form, quantity: Number(form.quantity) };
    if (!payload.staff_member_id) delete payload.staff_member_id;
    if (!payload.return_date) delete payload.return_date;
    saveMutation.mutate(payload);
  };

  // Stats
  const activePrestado = loans.filter(l => l.status === "prestado").length;
  const pendingLavado = loans.filter(l => l.status === "pendiente_lavado").length;

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total préstamos", value: loans.length, color: "text-gray-900" },
          { label: "Activos", value: activePrestado, color: "text-blue-700" },
          { label: "Pendientes lavado", value: pendingLavado, color: "text-orange-600" },
          { label: "2ª Equipaciones", value: loans.filter(l => l.kit_type === "segunda").length, color: "text-amber-700" },
        ].map(s => (
          <div key={s.label} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="prestado">Prestados</SelectItem>
            <SelectItem value="pendiente_lavado">Pendiente lavado</SelectItem>
            <SelectItem value="devuelto">Devueltos</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowForm(true)} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Registrar préstamo
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Shirt className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No hay préstamos registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(loan => (
            <div key={loan.id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-start gap-3">
              <div className={`shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center ${KIT_COLORS[loan.kit_type]}`}>
                <Shirt className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <span className="font-semibold text-sm text-gray-900">{getTeamName(loan.team_id)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${KIT_COLORS[loan.kit_type]}`}>
                    {KIT_LABELS[loan.kit_type]}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[loan.status]}`}>
                    {STATUS_LABELS[loan.status]}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                  {getStaffName(loan.staff_member_id) && <span>Entrenador: {getStaffName(loan.staff_member_id)}</span>}
                  {loan.matchday && <span>Jornada: <strong>{loan.matchday}</strong></span>}
                  {loan.rival_team && <span>Rival: {loan.rival_team}</span>}
                  <span>Cantidad: <strong>{loan.quantity}</strong></span>
                  {loan.sizes && <span>Tallas: {loan.sizes}</span>}
                  <span>Préstamo: {loan.loan_date ? format(new Date(loan.loan_date), "dd/MM/yyyy") : "—"}</span>
                  {loan.return_date && <span>Devuelto: {format(new Date(loan.return_date), "dd/MM/yyyy")}</span>}
                </div>
                {loan.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{loan.notes}</p>}
              </div>
              {loan.status === "prestado" && (
                <div className="flex flex-col gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-orange-600" onClick={() => updateMutation.mutate({ id: loan.id, data: { status: "pendiente_lavado", return_date: new Date().toISOString().split("T")[0] } })}>
                    Pend. lavado
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-green-700 gap-1" onClick={() => updateMutation.mutate({ id: loan.id, data: { status: "devuelto", return_date: new Date().toISOString().split("T")[0] } })}>
                    <RotateCcw className="w-3 h-3" /> Devuelto
                  </Button>
                </div>
              )}
              {loan.status === "pendiente_lavado" && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-green-700 gap-1 shrink-0" onClick={() => updateMutation.mutate({ id: loan.id, data: { status: "devuelto" } })}>
                  <RotateCcw className="w-3 h-3" /> Devuelto
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={v => !v && setShowForm(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar préstamo de equipación</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Equipo *</Label>
                <Select value={form.team_id} onValueChange={v => setForm({ ...form, team_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de equipación *</Label>
                <Select value={form.kit_type} onValueChange={v => setForm({ ...form, kit_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="segunda">2ª Equipación</SelectItem>
                    <SelectItem value="tercera">3ª Equipación</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Entrenador responsable</Label>
              <Select value={form.staff_member_id} onValueChange={v => setForm({ ...form, staff_member_id: v })}>
                <SelectTrigger><SelectValue placeholder="Opcional..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Sin especificar</SelectItem>
                  {staff.map(s => <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Jornada / Partido</Label>
                <Input value={form.matchday} onChange={e => setForm({ ...form, matchday: e.target.value })} placeholder="Ej: J15 o 12/04" />
              </div>
              <div>
                <Label>Rival</Label>
                <Input value={form.rival_team} onChange={e => setForm({ ...form, rival_team: e.target.value })} placeholder="Equipo rival" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cantidad</Label>
                <Input type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
              </div>
              <div>
                <Label>Tallas</Label>
                <Input value={form.sizes} onChange={e => setForm({ ...form, sizes: e.target.value })} placeholder="S×2, M×5, L×3" />
              </div>
            </div>
            <div>
              <Label>Fecha préstamo</Label>
              <Input type="date" value={form.loan_date} onChange={e => setForm({ ...form, loan_date: e.target.value })} />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Observaciones adicionales..." />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={!form.team_id || saveMutation.isPending}>Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}