import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { LogOut, CheckCircle2 } from "lucide-react";
import { CLUB_LOGO_URL } from "@/lib/clubConfig";

// Pantalla para jugadores con acceso aprobado (el área de jugador aún no existe)
export default function PlayerHome() {
  const { user, logout } = useAuth();
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#f5f5f5] p-4"
      style={{ "--granate": "#73000A", "--font-display": "'IBM Plex Sans Condensed', sans-serif" }}
    >
      <div className="w-full max-w-md text-center">
        <img src={CLUB_LOGO_URL} alt="RS Club" className="w-14 h-14 object-contain mx-auto mb-4" />
        <h1 className="text-3xl font-black uppercase tracking-wider mb-6" style={{ color: "var(--granate)", fontFamily: "var(--font-display)" }}>
          RS Manager
        </h1>
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-8">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
          <h2 className="text-xl font-black uppercase mb-2" style={{ fontFamily: "var(--font-display)" }}>
            Hola{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Tu acceso como jugador está aprobado. Tu área personal estará disponible próximamente.
          </p>
          <button
            onClick={() => logout()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm border border-gray-200 text-gray-500 hover:bg-gray-50 font-bold uppercase text-sm tracking-wider"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
