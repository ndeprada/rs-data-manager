import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { playerFullName } from "@/lib/playerName";

const BODY_PARTS = [
  ["tobillo", "Tobillo"], ["rodilla", "Rodilla"], ["muslo", "Muslo"], ["gemelo", "Gemelo"], ["isquiotibial", "Isquio"],
  ["cadera", "Cadera"], ["espalda", "Espalda"], ["hombro", "Hombro"], ["brazo", "Brazo"], ["cabeza", "Cabeza"], ["otro", "Otra"],
];
const TYPES = [
  ["muscular", "Muscular"], ["osea", "Ósea"], ["ligamento", "Ligamento"], ["tendon", "Tendón"], ["contusion", "Contusión"], ["otro", "No sé / otra"],
];
const SEVERITIES = [["leve", "Leve"], ["moderada", "Moderada"], ["grave", "Grave"]];

const Chip = ({ on, onClick, children }) => (
  <button type="button" onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-bold border ${on ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`}
    style={on ? { background: "var(--granate)" } : undefined}>{children}</button>
);

// Alta rápida de lesión desde la pantalla de asistencia (el jugador figura "a parte" o ausente por lesión).
// Crea la lesión y marca al jugador como lesionado, igual que el registro completo de su ficha.
export default function QuickInjuryDialog({ open, onOpenChange, player, date }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [part, setPart] = useState("");
  const [severity, setSeverity] = useState("leve");
  const [type, setType] = useState("otro");
  const [note, setNote] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const inj = await base44.entities.Injury.create({
        player_id: player.id, type, body_part: part, severity,
        injury_date: date || new Date().toISOString().split("T")[0],
        status: "activa", description: note.trim() || undefined,
        reported_by: user?.full_name || user?.email || undefined,
      });
      await base44.entities.Player.update(player.id, { status: "lesionado" });
      return inj;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["injuries_open"] });
      qc.invalidateQueries({ queryKey: ["injuries"] });
      qc.invalidateQueries({ queryKey: ["players"] });
      setPart(""); setSeverity("leve"); setType("otro"); setNote("");
      onOpenChange(false);
    },
  });

  if (!player) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-md">
        <DialogHeader>
          <DialogTitle className="font-black">Registrar lesión</DialogTitle>
          <DialogDescription>{playerFullName(player)} · podrás completar los detalles después en su ficha.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Zona</p>
            <div className="flex flex-wrap gap-1.5">
              {BODY_PARTS.map(([v, l]) => <Chip key={v} on={part === v} onClick={() => setPart(v)}>{l}</Chip>)}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Gravedad</p>
            <div className="flex gap-1.5">
              {SEVERITIES.map(([v, l]) => <Chip key={v} on={severity === v} onClick={() => setSeverity(v)}>{l}</Chip>)}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Tipo</p>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9 border-gray-200"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional): cómo ocurrió, molestias…" className="border-gray-200" />
          {create.isError && <p className="text-xs text-red-600">No se pudo guardar. Inténtalo de nuevo.</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button variant="club" className="flex-1" disabled={!part || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? "Guardando…" : "Registrar lesión"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
