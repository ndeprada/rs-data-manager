import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { CLUB_LOGO_URL } from "@/lib/clubConfig";

export default function Login() {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState(() =>
    new URLSearchParams(window.location.search).get("auth_error") === "google"
      ? "No se pudo iniciar sesión con Google. Inténtalo de nuevo."
      : ""
  );
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await base44.auth.login(email, password);
        window.location.reload();
      } else {
        await base44.auth.register(email, password, fullName);
        setRegistered(true);
      }
    } catch (err) {
      const map = {
        invalid_credentials: "Email o contraseña incorrectos.",
        email_already_registered: "Ya existe una cuenta con ese email.",
        email_and_password_required: "Rellena email y contraseña.",
      };
      setError(map[err.data?.error] || "Ha ocurrido un error. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#f5f5f5] p-4"
      style={{
        "--granate": "#8B1A2B",
        "--naranja": "#E85D04",
        "--font-display": "'Barlow Condensed', sans-serif",
      }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src={CLUB_LOGO_URL} alt="RS Club" className="w-14 h-14 object-contain mx-auto mb-4" />
          <h1
            className="text-3xl font-black uppercase tracking-wider"
            style={{ color: "var(--granate)", fontFamily: "var(--font-display)" }}
          >
            RS Data Manager
          </h1>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-8">
          {!registered && (
            <>
              <button
                type="button"
                onClick={() => base44.auth.loginWithGoogle()}
                className="w-full flex items-center justify-center gap-3 py-2.5 rounded-sm border border-gray-300 text-gray-700 hover:bg-gray-50 font-bold text-sm mb-4"
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
                  <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03z" />
                  <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z" />
                </svg>
                Continuar con Google
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[11px] uppercase tracking-wider text-gray-400">o con email</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            </>
          )}
          {registered ? (
            <div className="text-center">
              <p className="text-gray-600 text-sm mb-4">
                Cuenta creada. Un administrador debe aprobar tu acceso antes de poder entrar.
              </p>
              <button
                onClick={() => {
                  setRegistered(false);
                  setMode("login");
                }}
                className="w-full py-2.5 rounded-sm border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold uppercase text-sm tracking-wider"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Volver al login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    style={{ "--tw-ring-color": "var(--granate)" }}
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  required
                  minLength={6}
                />
              </div>

              {error && <p className="text-red-600 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-sm text-white font-bold uppercase text-sm tracking-wider disabled:opacity-60"
                style={{ background: "var(--granate)", fontFamily: "var(--font-display)" }}
              >
                {loading ? "Un momento..." : mode === "login" ? "Entrar" : "Crear cuenta"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setMode(mode === "login" ? "register" : "login");
                }}
                className="w-full text-center text-xs text-gray-500 hover:text-gray-700 pt-2"
              >
                {mode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
