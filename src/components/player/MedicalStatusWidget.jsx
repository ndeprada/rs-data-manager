import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { HeartPulse, Activity, CheckCircle } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { es } from "date-fns/locale";

const TYPE_LABELS = { muscular: "Muscular", osea: "Ósea", ligamento: "Ligamento", tendon: "Tendón", contusion: "Contusión", otro: "Otro" };
const PART_LABELS = { tobillo: "Tobillo", rodilla: "Rodilla", muslo: "Muslo", gemelo: "Gemelo", isquiotibial: "Isquiotibial", cadera: "Cadera", espalda: "Espalda", hombro: "Hombro", brazo: "Brazo", cabeza: "Cabeza", otro: "Otro" };

export default function MedicalStatusWidget({ playerId }) {
  const { data: injuries = [] } = useQuery({
    queryKey: ["injuries", playerId],
    queryFn: () => base44.entities.Injury.filter({ player_id: playerId }, "-injury_date"),
  });

  const active = injuries.filter(i => i.status !== "alta");

  if (active.length === 0) return null;

  return (
    <div className="bg-white border border-orange-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <HeartPulse className="w-4 h-4 text-red-500" />
        <span className="text-xs font-bold uppercase tracking-wider text-red-600">Estado Médico</span>
        <span className="ml-auto inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold text-white bg-red-500">{active.length}</span>
      </div>
      <div className="space-y-3">
        {active.map(inj => {
          const days = inj.injury_date ? differenceInDays(new Date(), new Date(inj.injury_date)) : null;
          const phases = inj.recovery_phases || [];
          const completedPhases = phases.filter(p => p.status === "completada").length;
          const currentPhase = phases.find(p => p.status === "en_curso");
          const isRecovery = inj.status === "recuperacion";

          return (
            <div key={inj.id} className={`rounded-lg p-3 border ${isRecovery ? "bg-orange-50 border-orange-200" : "bg-red-50 border-red-200"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-800">
                    {TYPE_LABELS[inj.type]} — {PART_LABELS[inj.body_part]}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
                    {days !== null && (
                      <span className={`font-semibold ${isRecovery ? "text-orange-600" : "text-red-600"}`}>
                        {days} días de baja
                      </span>
                    )}
                    {inj.expected_return && (
                      <span>Regreso: {format(new Date(inj.expected_return), "d MMM", { locale: es })}</span>
                    )}
                  </div>

                  {/* Diagnosis */}
                  {inj.diagnosis && (
                    <p className="text-xs text-gray-600 mt-1.5 line-clamp-2">
                      <span className="font-semibold">Dx:</span> {inj.diagnosis}
                    </p>
                  )}

                  {/* Current phase */}
                  {currentPhase && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Activity className="w-3 h-3 text-orange-500" />
                      <span className="text-xs text-orange-700 font-medium">{currentPhase.phase_name}</span>
                    </div>
                  )}

                  {/* Progress bar for phases */}
                  {phases.length > 0 && (
                    <div className="mt-2">
                      <div className="flex gap-0.5">
                        {phases.map((p, i) => (
                          <div key={i} className={`flex-1 h-1 rounded-full ${p.status === "completada" ? "bg-green-400" : p.status === "en_curso" ? "bg-orange-400" : "bg-gray-200"}`} />
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">{completedPhases}/{phases.length} fases completadas</p>
                    </div>
                  )}
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${isRecovery ? "bg-orange-100 text-orange-700 border-orange-300" : "bg-red-100 text-red-700 border-red-300"}`}>
                  {inj.status === "recuperacion" ? "Recup." : "Activa"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}