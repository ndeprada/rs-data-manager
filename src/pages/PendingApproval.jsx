import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Clock, XCircle, LogOut } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { FUNCTION_LABELS, teamRoleLabel } from "@/lib/staffRoles";
import { useT, LanguageSelector } from "@/i18n";

export default function PendingApproval() {
  const t = useT();
  const { user, logout } = useAuth();
  const isRejected = user?.access_status === "rejected" || user?.access_status === "deleted";
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list(), enabled: !isRejected });
  const teamName = (id) => teams.find((t) => t.id === id)?.name || "—";
  const requested = user?.requested_assignments || [];

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] p-4">
      <style>{`
        .rs-font { font-family: 'IBM Plex Sans Condensed', sans-serif; }
        .rs-body { font-family: 'IBM Plex Sans Condensed', sans-serif; }
      `}</style>

      <div className="w-full max-w-md text-center">
        <div className="flex justify-end mb-2"><LanguageSelector variant="names" /></div>
        <img
          src="https://media.base44.com/images/public/69b72e4f23c3602504953d0d/442c01da9_Escudo_Granate.png"
          alt={t("RS Club")} className="w-14 h-14 object-contain mx-auto mb-6"
        />
        <h1 className="rs-font text-3xl font-black uppercase tracking-wider text-[#73000A] mb-2">
          {t("RS Manager")}
        </h1>

        <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-8 mt-6">
          {isRejected ? (
            <>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-red-50">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="rs-font text-2xl font-black uppercase text-gray-900 mb-2">{t("Acceso Denegado")}</h2>
              <p className="rs-body text-gray-500 text-sm mb-2">
                {t("Tu solicitud de acceso ha sido rechazada por el administrador.")}
              </p>
              {user?.rejection_reason && (
                <p className="rs-body text-sm text-red-600 bg-red-50 rounded px-3 py-2 mb-4">
                  {t("Motivo:")} {user.rejection_reason}
                </p>
              )}
              <p className="rs-body text-xs text-gray-400 mb-6">
                {t("Contacta con el administrador del club si crees que es un error.")}
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "var(--granate-pale, #fdf2f4)" }}>
                <Clock className="w-8 h-8" style={{ color: "var(--granate, #73000A)" }} />
              </div>
              <h2 className="rs-font text-2xl font-black uppercase text-gray-900 mb-2">{t("Pendiente de aprobación")}</h2>
              <p className="rs-body text-gray-500 text-sm mb-4">
                {t("Tu solicitud de acceso está siendo revisada por el administrador del club. Recibirás acceso una vez aprobada.")}
              </p>
              <div className="bg-gray-50 rounded-sm px-4 py-3 text-left text-xs space-y-1 mb-6">
                <p className="rs-body text-gray-400 uppercase tracking-widest rs-font font-bold text-[10px]">{t("Tu solicitud")}</p>
                <p className="rs-body text-gray-700">
                  <span className="font-semibold">{t("Función solicitada:")}</span> {FUNCTION_LABELS[user?.app_role_pending] ? t(FUNCTION_LABELS[user.app_role_pending]) : user?.app_role_pending || "—"}
                </p>
                {requested.map((a, i) => (
                  <p key={i} className="rs-body text-gray-700">
                    <span className="font-semibold">{teamName(a.team_id)}:</span> {t(teamRoleLabel(a.team_role))}
                  </p>
                ))}
                {user?.requested_team_id && (
                  <p className="rs-body text-gray-700">
                    <span className="font-semibold">{t("Equipo:")}</span> {teamName(user.requested_team_id)}
                  </p>
                )}
              </div>
            </>
          )}

          <button
            onClick={() => logout()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors rs-font font-bold uppercase text-sm tracking-wider"
          >
            <LogOut className="w-4 h-4" /> {t("Cerrar sesión")}
          </button>
        </div>
      </div>
    </div>
  );
}