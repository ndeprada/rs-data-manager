import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { LogOut } from "lucide-react";

const ROLES = [
  { value: "entrenador", label: "Entrenador" },
  { value: "preparador_fisico", label: "Preparador Físico" },
  { value: "entrenador_porteros", label: "Entrenador de Porteros" },
  { value: "psicologo", label: "Psicólogo" },
  { value: "fisioterapeuta", label: "Fisioterapeuta" },
  { value: "coordinador_f7", label: "Coordinador F7" },
  { value: "coordinador_f11", label: "Coordinador F11" },
  { value: "coordinador_general", label: "Coordinador General" },
];

export default function RoleSetup() {
  const { user, logout } = useAuth();
  const [selectedRole, setSelectedRole] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!selectedRole) return;
    setSubmitting(true);
    await base44.auth.updateMe({
      app_role_pending: selectedRole,
      access_status: "pending",
    });
    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] p-4">
        <div className="w-full max-w-md text-center">
          <img src="https://media.base44.com/images/public/69b72e4f23c3602504953d0d/442c01da9_Escudo_Granate.png" alt="RS Club" className="w-14 h-14 object-contain mx-auto mb-6" />
          <h1 className="text-3xl font-black uppercase tracking-wider mb-6" style={{ color: "var(--granate)", fontFamily: "var(--font-display)" }}>RS Data Manager</h1>
          <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-8">
            <p className="text-gray-600 text-sm mb-4">Tu solicitud ha sido enviada. Un administrador revisará tu acceso próximamente.</p>
            <button onClick={() => logout()} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
              <LogOut className="w-4 h-4" /> Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src="https://media.base44.com/images/public/69b72e4f23c3602504953d0d/442c01da9_Escudo_Granate.png" alt="RS Club" className="w-14 h-14 object-contain mx-auto mb-4" />
          <h1 className="text-3xl font-black uppercase tracking-wider" style={{ color: "var(--granate)", fontFamily: "var(--font-display)" }}>RS Data Manager</h1>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-8">
          <h2 className="text-xl font-black uppercase mb-1" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Solicitar acceso</h2>
          <p className="text-gray-500 text-sm mb-6">Selecciona tu rol en el club para solicitar acceso.</p>

          <div className="space-y-2 mb-6">
            {ROLES.map(r => (
              <button
                key={r.value}
                onClick={() => setSelectedRole(r.value)}
                className={`w-full text-left px-4 py-3 rounded-sm border text-sm font-medium transition-colors ${
                  selectedRole === r.value
                    ? "border-[#8B1A2B] bg-[#fdf2f4] text-[#8B1A2B]"
                    : "border-gray-200 hover:bg-gray-50 text-gray-700"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!selectedRole || submitting}
            className="w-full py-2.5 rounded-sm text-white font-bold uppercase text-sm tracking-wider disabled:opacity-40 transition-opacity mb-3"
            style={{ background: "var(--granate)", fontFamily: "var(--font-display)" }}
          >
            {submitting ? "Enviando..." : "Solicitar acceso"}
          </button>

          <button onClick={() => logout()} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}