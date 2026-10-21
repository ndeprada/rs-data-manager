import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { playerFullName } from "@/lib/playerName";
import { useT, msg } from "@/i18n";

const BODY_PARTS = [
  ["tobillo", msg("Tobillo")], ["rodilla", msg("Rodilla")], ["muslo", msg("Muslo")], ["gemelo", msg("Gemelo")], ["isquiotibial", msg("Isquio")],
  ["cadera", msg("Cadera")], ["espalda", msg("Espalda")], ["hombro", msg("Hombro")], ["brazo", msg("Brazo")], ["cabeza", msg("Cabeza")], ["otro", msg("Otra")],
];
const TYPES = [
  ["muscular", msg("Muscular")], ["osea", msg("Ósea")], ["ligamento", msg("Ligamento")], ["tendon", msg("Tendón")], ["contusion", msg("Contusión")], ["otro", msg("No sé / otra")],
];
const SEVERITIES = [["leve", msg("Leve")], ["moderada", msg("Moderada")], ["grave", msg("Grave")]];

const Chip = ({ on, onClick, children }) => (
  <button type="button" onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-bold border ${on ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`}
    style={on ? { background: "var(--granate)" } : undefined}>{children}</button>
);

// Alta rápida de lesión desde la pantalla de asistencia (el jugador figura "a parte" o ausente por lesión).
// Crea la lesión y marca al jugador como lesionado, igual que el registro completo de su ficha.
export default function QuickInjuryDialog({ open, onOpenChange, player, date }) {
  const t = useT();
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
          <DialogTitle className="font-black">{t("Registrar lesión")}</DialogTitle>
          <DialogDescription>{t("{playerFullName} · podrás completar los detalles después en su ficha.", { playerFullName: playerFullName(player) })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">{t("Zona")}</p>
            <div className="flex flex-wrap gap-1.5">
              {BODY_PARTS.map(([v, l]) => <Chip key={v} on={part === v} onClick={() => setPart(v)}>{t(l)}</Chip>)}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">{t("Gravedad")}</p>
            <div className="flex gap-1.5">
              {SEVERITIES.map(([v, l]) => <Chip key={v} on={severity === v} onClick={() => setSeverity(v)}>{t(l)}</Chip>)}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">{t("Tipo")}</p>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9 border-gray-200"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{t(l)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Nota (opcional): cómo ocurrió, molestias…")} className="border-gray-200" />
          {create.isError && <p className="text-xs text-red-600">{t("No se pudo guardar. Inténtalo de nuevo.")}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>{t("Cancelar")}</Button>
            <Button variant="club" className="flex-1" disabled={!part || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? t("Guardando…") : t("Registrar lesión")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
