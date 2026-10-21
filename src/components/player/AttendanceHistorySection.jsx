import React from "react";
import { CheckCircle2, XCircle, AlertCircle, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useT, useFormat, msg } from "@/i18n";
import { INJURY_TYPE_LABELS, BODY_PART_LABELS, labelOf } from "@/lib/injuryLabels";

const STATUS_CONFIG = {
  present: { label: msg("Asistió"), icon: CheckCircle2, color: "text-green-600" },
  apart: { label: msg("Trabajo aparté"), icon: AlertCircle, color: "text-blue-600" },
  absent: { label: msg("Ausente"), icon: XCircle, color: "text-red-600" },
};

const ABSENCE_REASON_LABELS = {
  lesion: msg("Lesión"),
  enfermo: msg("Enfermo"),
  clase: msg("Clase"),
  examen: msg("Examen"),
  viaje: msg("Viaje"),
  familiar: msg("Asunto familiar"),
  permiso: msg("Permiso"),
  otro: msg("Otro"),
};

export default function AttendanceHistorySection({ attendance = [], injuries = [] }) {
  // Combine attendance and injuries for detailed history
  const t = useT();
  const { locale } = useFormat();
  const recentAttendance = attendance.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

  const stats = {
    total: attendance.length,
    present: attendance.filter((a) => a.status === "present").length,
    apart: attendance.filter((a) => a.status === "apart").length,
    absent: attendance.filter((a) => a.status === "absent").length,
  };

  const attendancePercentage = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
  const absenceWithLesion = attendance.filter(
    (a) => a.status === "absent" && (a.absence_reason === "lesion" || a.absence_reason === "enfermo")
  ).length;

  const getReasonLabel = (reason) => (ABSENCE_REASON_LABELS[reason] ? t(ABSENCE_REASON_LABELS[reason]) : "—");

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{attendancePercentage}%</p>
          <p className="text-xs text-gray-500 mt-1">{t("Asistencia")}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.present}</p>
          <p className="text-xs text-gray-500 mt-1">{t("Asistencias")}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
          <p className="text-xs text-gray-500 mt-1">{t("Ausencias")}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.apart}</p>
          <p className="text-xs text-gray-500 mt-1">{t("Aparte")}</p>
        </div>
      </div>

      {/* Injuries Summary */}
      {injuries.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <h4 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {t("Lesiones Registradas")}
          </h4>
          <div className="space-y-2">
            {injuries.map((injury) => (
              <div key={injury.id} className="text-sm">
                <p className="font-medium text-orange-900 capitalize">
                  {labelOf(INJURY_TYPE_LABELS, injury.type, t)} - {labelOf(BODY_PART_LABELS, injury.body_part, t)}
                </p>
                <p className="text-xs text-orange-700">
                  {t("Desde")} {format(parseISO(injury.injury_date), "d MMM yyyy", { locale })}
                  {injury.expected_return && ` · ${t("Regreso estimado:")} ${format(parseISO(injury.expected_return), "d MMM yyyy", { locale })}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Attendance */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          {t("Historial de Asistencia (Últimas 10)")}
        </h4>
        <div className="space-y-2">
          {recentAttendance.length === 0 ? (
            <p className="text-sm text-gray-400">{t("Sin registros de asistencia")}</p>
          ) : (
            recentAttendance.map((record) => {
              const config = STATUS_CONFIG[record.status] || {};
              const Icon = config.icon;
              return (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    {Icon && <Icon className={`w-5 h-5 ${config.color}`} />}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{config.label ? t(config.label) : ""}</p>
                      <p className="text-xs text-gray-500">
                        {format(parseISO(record.date), "d MMMM yyyy", { locale })}
                      </p>
                    </div>
                  </div>
                  {record.absence_reason && (
                    <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-700 rounded">
                      {getReasonLabel(record.absence_reason)}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Absence Summary */}
      {absenceWithLesion > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-900">
            <span className="font-semibold">{absenceWithLesion}</span> {t("ausencia(s) por lesión")}
          </p>
        </div>
      )}
    </div>
  );
}