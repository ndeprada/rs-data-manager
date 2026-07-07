import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { FileText, AlertCircle } from "lucide-react";

const LOAD_LABELS = {
  muy_baja: { label: "Muy Baja", color: "#10b981" },
  baja: { label: "Baja", color: "#3b82f6" },
  moderada: { label: "Moderada", color: "#f59e0b" },
  alta: { label: "Alta", color: "#ef4444" },
  muy_alta: { label: "Muy Alta", color: "#991b1b" },
};

export default function SessionReportPanel({ eventId }) {
  const { data: reports = [] } = useQuery({
    queryKey: ["sessionReports", eventId],
    queryFn: () =>
      base44.entities.SessionReport.filter({ event_id: eventId }, "-created_date", 10),
    enabled: !!eventId,
  });

  const report = reports?.[0];

  if (!report) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-blue-900 text-sm">Sin informe de sesión</p>
          <p className="text-xs text-blue-700 mt-0.5">Añade un informe técnico al finalizar la sesión</p>
        </div>
      </div>
    );
  }

  const loadInfo = LOAD_LABELS[report.physical_load] || LOAD_LABELS.moderada;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
        <FileText className="w-4 h-4 text-gray-600" />
        <h3 className="font-semibold text-sm text-gray-900">Informe de Sesión</h3>
        <span className="text-xs text-gray-500 ml-auto">
          {format(new Date(report.created_date), "d MMM", { locale: es })}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Carga Física */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Carga Física
          </p>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ background: loadInfo.color }}
            />
            <span className="font-medium text-sm text-gray-900">{loadInfo.label}</span>
          </div>
        </div>

        {/* Objetivos */}
        {report.session_objectives && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Objetivos
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-line">
              {report.session_objectives}
            </p>
          </div>
        )}

        {/* Notas Tácticas */}
        {report.tactical_notes && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Notas Tácticas
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-line">
              {report.tactical_notes}
            </p>
          </div>
        )}

        {/* Observaciones */}
        {report.observations && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Observaciones
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-line">
              {report.observations}
            </p>
          </div>
        )}

        {/* Entrenador */}
        {report.coach_name && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Reportado por: <span className="font-medium text-gray-700">{report.coach_name}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}