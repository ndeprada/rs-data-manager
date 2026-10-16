import { sortTeams } from "@/lib/teamOrder";
import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Users, UserRound, ClipboardList, ArrowLeft, Check } from "lucide-react";
import { CLUB_LOGO_URL } from "@/lib/clubConfig";
import { APP_FUNCTIONS, COACH_TEAM_ROLES, functionConfig } from "@/lib/staffRoles";
import { COUNTRIES, PROVINCES, regionOfProvince } from "@/lib/countries";
import TeamRolesEditor from "@/components/access/TeamRolesEditor";
import PlayerPicker from "@/components/avisos/PlayerPicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FONT = { fontFamily: "var(--font-display)" };

function Shell({ children }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#f5f5f5] p-4"
      style={{ "--granate": "#73000A", "--naranja": "#FF6E00", "--font-display": "'IBM Plex Sans Condensed', sans-serif" }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src={CLUB_LOGO_URL} alt="RS Club" className="w-14 h-14 object-contain mx-auto mb-4" />
          <h1 className="text-3xl font-black uppercase tracking-wider" style={{ color: "var(--granate)", ...FONT }}>RS Manager</h1>
        </div>
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}

function LogoutButton({ logout }) {
  return (
    <button
      onClick={() => logout()}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors font-bold uppercase text-sm tracking-wider"
      style={FONT}
    >
      <LogOut className="w-4 h-4" /> Cerrar sesión
    </button>
  );
}

const optionClass = (selected) =>
  `w-full text-left px-4 py-3 rounded-sm border text-sm font-medium transition-colors ${
    selected ? "border-[#73000A] bg-[#fdf2f4] text-[#73000A]" : "border-gray-200 hover:bg-gray-50 text-gray-700"
  }`;

export default function RoleSetup() {
  const { user, logout, refreshUser } = useAuth();
  const [step, setStep] = useState("type"); // type | jugador | staff
  const [fn, setFn] = useState("");
  const [assignments, setAssignments] = useState([{ team_id: "", team_role: "" }]);
  const [moreTeams, setMoreTeams] = useState(false);
  const [playerTeam, setPlayerTeam] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });

  const cfg = functionConfig(fn);
  const showTeams = cfg && (cfg.teams === "required" || (cfg.teams === "optional" && moreTeams));
  const completeAssignments = assignments.filter((a) => a.team_id && a.team_role);
  const teamsOk = !cfg || cfg.teams !== "required" || completeAssignments.length > 0;
  const halfFilled = showTeams && assignments.some((a) => (a.team_id && !a.team_role) || (!a.team_id && a.team_role));

  const submit = async (payload) => {
    setSubmitting(true);
    setError("");
    try {
      await base44.auth.updateMe({ ...payload, phone: phone || undefined, birth_country: country, birth_province: country === "ESP" ? province : "", birth_city: city.trim(), birth_region: country === "ESP" ? regionOfProvince(province) : "", access_status: "pending" });
      await refreshUser();
    } catch {
      setError("No se ha podido enviar la solicitud. Inténtalo de nuevo.");
      setSubmitting(false);
    }
  };

  const submitStaff = () =>
    submit({
      person_type: "cuerpo_tecnico",
      app_role_pending: fn,
      requested_assignments: showTeams ? completeAssignments : [],
    });

  const submitFamily = async ({ player, relationship }) => {
    setSubmitting(true);
    setError("");
    try {
      await base44.auth.updateMe({ person_type: "familiar", app_role_pending: "familiar", phone: phone || undefined, access_status: "pending" });
      await base44.club.requestLink(player.id, relationship);
      await refreshUser();
    } catch {
      setError("No se ha podido enviar la solicitud. Inténtalo de nuevo.");
      setSubmitting(false);
    }
  };

  const submitPlayer = () =>
    submit({
      person_type: "jugador",
      app_role_pending: "jugador",
      requested_team_id: playerTeam || null,
      requested_assignments: [],
    });

  const phoneField = (
    <div className="mb-5">
      <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">Teléfono (opcional)</label>
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2"
      />
    </div>
  );

  if (step === "type") {
    return (
      <Shell>
        <h2 className="text-xl font-black uppercase mb-1" style={{ color: "var(--granate)", ...FONT }}>
          Hola{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}
        </h2>
        <p className="text-gray-500 text-sm mb-4">Para solicitar acceso, dinos de dónde eres y quién eres en el club.</p>
        <div className="mb-4">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">País de nacimiento *</label>
          <Select value={country} onValueChange={(v) => { setCountry(v); setProvince(""); }}>
            <SelectTrigger className="border-gray-300"><SelectValue placeholder="Selecciona tu país" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {COUNTRIES.map((c) => <SelectItem key={c.a3} value={c.a3}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {country === "ESP" && (
            <Select value={province} onValueChange={setProvince}>
              <SelectTrigger className="border-gray-300 mt-2"><SelectValue placeholder="Provincia de nacimiento" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {PROVINCES.map((p) => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {country && (
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ciudad / municipio de nacimiento"
              className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm mt-2 focus:outline-none focus:ring-2" />
          )}
        </div>
        <div className={`space-y-3 mb-6 ${country && city.trim() && (country !== "ESP" || province) ? "" : "opacity-40 pointer-events-none"}`}>
          <button onClick={() => setStep("staff")} className={`${optionClass(false)} flex items-center gap-3`}>
            <ClipboardList className="w-6 h-6 shrink-0" style={{ color: "var(--granate)" }} />
            <span>
              <span className="block font-bold">Cuerpo técnico</span>
              <span className="block text-xs text-gray-400 font-normal">Entrenador, coordinador, preparador, porteros…</span>
            </span>
          </button>
          <button onClick={() => setStep("jugador")} className={`${optionClass(false)} flex items-center gap-3`}>
            <UserRound className="w-6 h-6 shrink-0" style={{ color: "var(--granate)" }} />
            <span>
              <span className="block font-bold">Jugador</span>
              <span className="block text-xs text-gray-400 font-normal">Soy jugador del club</span>
            </span>
          </button>
        </div>
        <button onClick={() => setStep("familiar")} className={`${optionClass(false)} flex items-center gap-3 mb-6`}>
          <Users className="w-6 h-6 shrink-0" style={{ color: "var(--granate)" }} />
          <span>
            <span className="block font-bold">Familiar de un jugador</span>
            <span className="block text-xs text-gray-400 font-normal">Padre, madre, tutor u otro familiar</span>
          </span>
        </button>
        <LogoutButton logout={logout} />
      </Shell>
    );
  }

  const back = (
    <button onClick={() => setStep("type")} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-3">
      <ArrowLeft className="w-3.5 h-3.5" /> Volver
    </button>
  );

  if (step === "familiar") {
    return (
      <Shell>
        {back}
        <h2 className="text-xl font-black uppercase mb-1" style={{ color: "var(--granate)", ...FONT }}>Soy familiar</h2>
        <p className="text-gray-500 text-sm mb-5">Busca al jugador y dinos qué parentesco tienes. El club revisará la solicitud antes de activarla. Luego podrás vincular a más jugadores.</p>
        {phoneField}
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <div className="mb-4"><PlayerPicker onPick={submitFamily} busy={submitting} buttonLabel="Solicitar acceso" /></div>
        <LogoutButton logout={logout} />
      </Shell>
    );
  }

  if (step === "jugador") {
    return (
      <Shell>
        {back}
        <h2 className="text-xl font-black uppercase mb-1" style={{ color: "var(--granate)", ...FONT }}>Soy jugador</h2>
        <p className="text-gray-500 text-sm mb-5">Indica tu equipo para que el club pueda localizarte.</p>
        <div className="mb-5">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">Equipo (opcional)</label>
          <Select value={playerTeam} onValueChange={setPlayerTeam}>
            <SelectTrigger className="border-gray-300"><SelectValue placeholder="Selecciona tu equipo" /></SelectTrigger>
            <SelectContent>
              {sortTeams(teams).map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {phoneField}
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <button
          onClick={submitPlayer}
          disabled={submitting}
          className="w-full py-2.5 rounded-sm text-white font-bold uppercase text-sm tracking-wider disabled:opacity-40 mb-3"
          style={{ background: "var(--granate)", ...FONT }}
        >
          {submitting ? "Enviando..." : "Solicitar acceso"}
        </button>
        <LogoutButton logout={logout} />
      </Shell>
    );
  }

  return (
    <Shell>
      {back}
      <h2 className="text-xl font-black uppercase mb-1" style={{ color: "var(--granate)", ...FONT }}>Cuerpo técnico</h2>
      <p className="text-gray-500 text-sm mb-4">¿Cuál es tu función en el club?</p>

      <div className="space-y-2 mb-5">
        {APP_FUNCTIONS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setFn(f.value);
              setMoreTeams(false);
              if (f.teams === "required" && assignments.length === 0) setAssignments([{ team_id: "", team_role: "" }]);
            }}
            className={optionClass(fn === f.value)}
          >
            <span className="flex items-center justify-between">
              {f.label}
              {fn === f.value && <Check className="w-4 h-4" />}
            </span>
            {f.hint && <span className="block text-xs text-gray-400 font-normal">{f.hint}</span>}
          </button>
        ))}
      </div>

      {cfg?.teams === "required" && (
        <div className="mb-5 p-3 bg-gray-50 rounded-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-3">
            Indica de qué equipo(s) eres entrenador y qué rol tienes en cada uno. Si entrenas más de un equipo, añádelos todos.
          </p>
          <TeamRolesEditor value={assignments} onChange={setAssignments} teams={teams} roleOptions={COACH_TEAM_ROLES} compact />
        </div>
      )}

      {cfg?.teams === "optional" && (
        <div className="mb-5">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={moreTeams} onChange={(e) => setMoreTeams(e.target.checked)} />
            Además trabajo con equipos concretos
          </label>
          {moreTeams && (
            <div className="mt-3 p-3 bg-gray-50 rounded-sm border border-gray-100">
              <TeamRolesEditor value={assignments} onChange={setAssignments} teams={teams} roleOptions={COACH_TEAM_ROLES} compact />
            </div>
          )}
        </div>
      )}

      {phoneField}
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {fn && !teamsOk && <p className="text-xs text-orange-600 mb-3">Añade al menos un equipo con su rol.</p>}
      {halfFilled && <p className="text-xs text-orange-600 mb-3">Completa equipo y rol en cada fila (o quita la fila).</p>}
      <button
        onClick={submitStaff}
        disabled={!fn || !teamsOk || halfFilled || submitting}
        className="w-full py-2.5 rounded-sm text-white font-bold uppercase text-sm tracking-wider disabled:opacity-40 mb-3"
        style={{ background: "var(--granate)", ...FONT }}
      >
        {submitting ? "Enviando..." : "Solicitar acceso"}
      </button>
      <LogoutButton logout={logout} />
    </Shell>
  );
}
