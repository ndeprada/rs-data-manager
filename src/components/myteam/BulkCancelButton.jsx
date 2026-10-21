import React, { useState } from "react";
import { Ban } from "lucide-react";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import BulkCancelDialog from "@/components/myteam/BulkCancelDialog";

// Botón «Cancelar varios días»: coordinación y entrenadores (los demás roles no gestionan el calendario de un equipo)
export default function BulkCancelButton({ teamId }) {
  const { isCoordinator, coachTeamIds } = useTeamAccess();
  const [open, setOpen] = useState(false);
  if (!isCoordinator && !(coachTeamIds || []).length) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Cancelar los entrenos de varios días (festivo, lluvia…)"
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-gray-200 bg-white text-xs font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900">
        <Ban className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Cancelar varios días</span>
      </button>
      <BulkCancelDialog open={open} onOpenChange={setOpen} defaultTeamId={teamId} />
    </>
  );
}
