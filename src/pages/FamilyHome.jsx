import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Clock, UserRound } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { CLUB_LOGO_URL } from "@/lib/clubConfig";
import PushToggle from "@/components/avisos/PushToggle";
import Inbox from "@/components/avisos/Inbox";
import PlayerPicker, { relLabel } from "@/components/avisos/PlayerPicker";
import { useT, LanguageSelector } from "@/i18n";

// Área de familiares: sus hijos vinculados y los avisos del club. (Perfil y estadísticas: siguiente fase.)
export default function FamilyHome() {
  const t = useT();
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: links = [] } = useQuery({ queryKey: ["myLinks"], queryFn: () => base44.club.myLinks() });

  const request = async ({ player, relationship }) => {
    setBusy(true);
    try { await base44.club.requestLink(player.id, relationship); setAdding(false); qc.invalidateQueries({ queryKey: ["myLinks"] }); } catch { /* nada */ }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] p-4" style={{ "--granate": "#73000A", "--font-display": "'IBM Plex Sans Condensed', sans-serif" }}>
      <div className="w-full max-w-md mx-auto space-y-4">
        <div className="flex justify-end"><LanguageSelector variant="names" /></div>
        <div className="text-center">
          <img src={CLUB_LOGO_URL} alt={t("RS Club")} className="w-12 h-12 object-contain mx-auto mb-2" />
          <h1 className="text-2xl font-black uppercase tracking-wider" style={{ color: "var(--granate)", fontFamily: "var(--font-display)" }}>{t("RS Manager")}</h1>
          <p className="text-gray-500 text-sm">{t("Hola")}{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}</p>
        </div>

        <PushToggle />

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{t("Mis jugadores")}</p>
          <div className="space-y-2">
            {links.map((l) => (
              <div key={l.id} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
                <UserRound className="w-5 h-5 text-gray-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{l.player?.name}</p>
                  <p className="text-[11px] text-gray-400">{l.player?.team}{l.player?.birth_year ? ` · ${l.player.birth_year}` : ""} · {t(relLabel(l.relationship))}</p>
                </div>
                {l.status === "pending"
                  ? <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 rounded-full px-2 py-1"><Clock className="w-3 h-3" />{t("Pendiente")}</span>
                  : <span className="text-[10px] font-bold text-green-600 bg-green-50 rounded-full px-2 py-1">{t("Vinculado")}</span>}
              </div>
            ))}
          </div>
          {adding ? (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mt-2">
              <PlayerPicker onPick={request} busy={busy} />
              <button onClick={() => setAdding(false)} className="w-full text-xs text-gray-400 mt-2">{t("Cancelar")}</button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="w-full mt-2 py-2 rounded-full border border-gray-200 bg-white text-xs font-bold text-gray-500">{t("+ Vincular otro jugador")}</button>
          )}
          <p className="text-[11px] text-gray-400 mt-2">{t("El club revisa cada vinculación antes de activarla. Pronto podrás ver aquí el perfil, las evaluaciones y las estadísticas de tus hijos.")}</p>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{t("Avisos")}</p>
          <Inbox />
        </div>

        <button onClick={() => logout()} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full border border-gray-200 text-gray-500 bg-white text-xs font-bold uppercase tracking-wider">
          <LogOut className="w-4 h-4" /> {t("Cerrar sesión")}
        </button>
      </div>
    </div>
  );
}
