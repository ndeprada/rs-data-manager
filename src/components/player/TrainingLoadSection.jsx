import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Zap, TrendingUp, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { format, startOfWeek, endOfWeek, eachWeekOfInterval, subWeeks } from "date-fns";
import { es } from "date-fns/locale";

const RPE_LABELS = {
  1: "Muy fácil", 2: "Fácil", 3: "Moderado", 4: "Algo duro",
  5: "Duro", 6: "Duro+", 7: "Muy duro", 8: "Muy duro+",
  9: "Máximo", 10: "Absoluto máximo"
};

const RPE_COLORS = {
  1: "#22c55e", 2: "#4ade80", 3: "#86efac", 4: "#fbbf24",
  5: "#f97316", 6: "#fb923c", 7: "#ef4444", 8: "#dc2626",
  9: "#b91c1c", 10: "#7f1d1d"
};

const SESSION_TYPES = [
  { value: "entrenamiento", label: "Entrenamiento" },
  { value: "partido", label: "Partido" },
  { value: "fisico", label: "Físico" },
  { value: "recuperacion", label: "Recuperación" },
  { value: "otro", label: "Otro" },
];

const emptyForm = {
  date: new Date().toISOString().split("T")[0],
  rpe: "",
  duration_minutes: "",
  session_type: "entrenamiento",
  notes: "",
};

function RPESelector({ value, onChange }) {
  return (
    <div className="space-y-2">
      <Label className="text-gray-700">RPE (Esfuerzo Percibido) *</Label>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`py-2.5 rounded-lg text-sm font-bold transition-all border-2 ${
              value === n
                ? "text-white border-transparent scale-105 shadow-md"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
            style={value === n ? { background: RPE_COLORS[n], borderColor: RPE_COLORS[n] } : {}}
          >
            {n}
          </button>
        ))}
      </div>
      {value && (
        <p className="text-sm font-medium" style={{ color: RPE_COLORS[value] }}>
          {value} — {RPE_LABELS[value]}
        </p>
      )}
    </div>
  );
}

export default function TrainingLoadSection({ playerId }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["trainingload", playerId],
    queryFn: () => base44.entities.TrainingLoad.filter({ player_id: playerId }, "-date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TrainingLoad.create({ ...data, player_id: playerId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["trainingload", playerId] }); setDialogOpen(false); setForm(emptyForm); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TrainingLoad.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["trainingload", playerId] }); setDeleteId(null); },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      rpe: Number(form.rpe),
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
    });
  };

  // Weekly load chart data (last 8 weeks)
  const weeklyData = useMemo(() => {
    if (!records.length) return [];
    const now = new Date();
    const weeks = eachWeekOfInterval(
      { start: subWeeks(now, 7), end: now },
      { weekStartsOn: 1 }
    );
    return weeks.map((weekStart) => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekRecords = records.filter((r) => {
        const d = new Date(r.date);
        return d >= weekStart && d <= weekEnd;
      });
      const load = weekRecords.reduce((sum, r) => sum + (r.rpe * (r.duration_minutes || 60)), 0);
      const avgRpe = weekRecords.length > 0
        ? (weekRecords.reduce((s, r) => s + r.rpe, 0) / weekRecords.length).toFixed(1)
        : null;
      return {
        week: format(weekStart, "d MMM", { locale: es }),
        carga: load,
        rpe_medio: avgRpe ? Number(avgRpe) : 0,
        sesiones: weekRecords.length,
      };
    });
  }, [records]);

  // Stats
  const last7 = records.filter(r => new Date(r.date) >= subWeeks(new Date(), 1));
  const avgRpeAll = records.length > 0
    ? (records.reduce((s, r) => s + r.rpe, 0) / records.length).toFixed(1)
    : null;
  const totalLoad = records.reduce((s, r) => s + r.rpe * (r.duration_minutes || 60), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--naranja-pale, #fff7ed)" }}>
            <Zap className="w-5 h-5" style={{ color: "var(--naranja)" }} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">Carga de Entrenamiento (RPE)</h3>
            <p className="text-sm text-gray-500">Registra tu esfuerzo percibido tras cada sesión para monitorizar la carga semanal y evolución de la forma física.</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="text-white shrink-0" style={{ background: "var(--granate)" }}>
            <Plus className="w-4 h-4 mr-2" /> Registrar RPE
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{records.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Sesiones totales</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-bold" style={{ color: avgRpeAll ? RPE_COLORS[Math.round(avgRpeAll)] : "#9ca3af" }}>
            {avgRpeAll ?? "—"}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">RPE medio</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{last7.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Sesiones esta semana</p>
        </div>
      </div>

      {/* Charts */}
      {weeklyData.some(w => w.carga > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4" style={{ color: "var(--granate)" }} />
              <h4 className="font-semibold text-gray-900 text-sm">Carga semanal (RPE × min)</h4>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weeklyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                  formatter={(v) => [`${v} UA`, "Carga"]}
                />
                <Bar dataKey="carga" fill="var(--granate)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4" style={{ color: "var(--naranja)" }} />
              <h4 className="font-semibold text-gray-900 text-sm">RPE medio semanal</h4>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={weeklyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="rpeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--naranja)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--naranja)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                  formatter={(v) => [v, "RPE medio"]}
                />
                <Area type="monotone" dataKey="rpe_medio" stroke="var(--naranja)" fill="url(#rpeGrad)" strokeWidth={2} dot={{ r: 3, fill: "var(--naranja)" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent records */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Cargando...</div>
      ) : records.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
          <Zap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Sin registros de carga todavía</p>
          <p className="text-gray-400 text-sm mt-1">Registra tu RPE tras cada sesión para ver las tendencias</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">Historial de sesiones</p>
          </div>
          <div className="divide-y divide-gray-100">
            {records.slice(0, 20).map((r) => (
              <div key={r.id} className="px-5 py-3 flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ background: RPE_COLORS[r.rpe] || "#9ca3af" }}
                >
                  {r.rpe}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">
                    {new Date(r.date).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}
                    {" · "}<span className="text-gray-500">{SESSION_TYPES.find(t => t.value === r.session_type)?.label || r.session_type}</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    {RPE_LABELS[r.rpe]}{r.duration_minutes ? ` · ${r.duration_minutes} min` : ""}
                    {r.duration_minutes ? ` · Carga: ${r.rpe * r.duration_minutes} UA` : ""}
                  </p>
                  {r.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{r.notes}</p>}
                </div>
                <button onClick={() => setDeleteId(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setForm(emptyForm); } }}>
        <DialogContent className="bg-white border-gray-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Registrar RPE de sesión</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-700">Fecha *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="border-gray-200" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700">Tipo de sesión</Label>
                <Select value={form.session_type} onValueChange={(v) => setForm({ ...form, session_type: v })}>
                  <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SESSION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <RPESelector value={form.rpe} onChange={(v) => setForm({ ...form, rpe: v })} />

            <div className="space-y-2">
              <Label className="text-gray-700">Duración (minutos)</Label>
              <Input type="number" min="1" max="300" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} placeholder="Ej: 90" className="border-gray-200" />
              {form.rpe && form.duration_minutes && (
                <p className="text-xs text-gray-500">
                  Carga estimada: <strong>{form.rpe * Number(form.duration_minutes)} UA</strong>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-gray-700">Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="¿Cómo te has sentido?" className="border-gray-200" rows={2} />
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setForm(emptyForm); }}>Cancelar</Button>
              <Button type="submit" disabled={!form.rpe} className="text-white" style={{ background: "var(--granate)" }}>Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteId)} className="bg-red-600 hover:bg-red-700 text-white">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}