import React, { useState, useMemo } from "react";
import { Suspense } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Shield, CalendarDays, Menu, X,
  FileText, BarChart2, Target, Binoculars, LogOut, ChevronRight, ClipboardList, UserCog,
  UserCheck, Trophy, Calendar, MapPin, Package, BookOpen, Bell, CalendarRange
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { CLUB_LOGO_URL_WHITE } from "@/lib/clubConfig";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { usePendingUsers } from "@/lib/pendingUsers";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { addDays, isWithinInterval, parseISO } from "date-fns";
import { buildLinks } from "@/lib/staffLink";
import { usePlayerMode } from "@/lib/playerMode";
import { useT, msg, LanguageSelector } from "@/i18n";

const MY_TEAM_SUBITEMS = [
  { label: msg("Panel"), path: "/MyTeam", exact: true, icon: LayoutDashboard },
  { label: msg("Plantilla"), path: "/MyTeam/Squad", icon: Users },
  { label: msg("Entrenamientos"), path: "/MyTeam/Attendance", icon: Calendar },
  { label: msg("Partidos"), path: "/MyTeam/Matches", icon: Trophy },
  { label: msg("Desarrollo"), path: "/MyTeam/Development", icon: Target },
  { label: msg("Metodología"), path: "/Methodology", icon: BookOpen },
];

const ROLE_DISPLAY = {
  coordinador_general: msg("Coord. General"),
  coordinador_f7: msg("Coord. F7"),
  coordinador_f11: msg("Coord. F11"),
  entrenador: msg("Entrenador"),
  director: msg("Director"),
  director_deportivo: msg("Dir. Deportivo"),
  entrenador_porteros: msg("Entr. porteros"),
  psicologo: msg("Área psicología"),
  preparador_fisico: msg("Prep. físico"),
  fisioterapeuta: msg("Fisio"),
  admin: msg("Admin"),
};

function SectionLabel({ children }) {
  const t = useT();
  return (
    <p className="px-2.5 pt-3.5 pb-1 text-[9px] font-black uppercase tracking-[0.16em] text-white/45 flex items-center gap-2"
      style={{ fontFamily: "var(--font-display)" }}>
      <span>{typeof children === "string" ? t(children) : children}</span>
      <span className="flex-1 h-px bg-white/12" />
    </p>
  );
}

function NavItem({ item, onClick, badge = 0 }) {
  const t = useT();
  const location = useLocation();
  const active = location.pathname === item.path;
  return (
    <Link to={item.path} onClick={onClick}
      style={active ? { borderLeft: "3px solid var(--naranja)" } : { borderLeft: "3px solid transparent" }}
      className={`group flex items-center gap-2.5 pl-2 pr-2.5 py-1.5 rounded-[6px] transition-all duration-150 nav-label text-[11px]
        ${active
          ? "bg-white text-[color:var(--granate)] shadow-sm"
          : "text-white/75 hover:text-white hover:bg-white/10"
        }`}>
      {item.icon && (
        <item.icon className={`shrink-0 w-3.5 h-3.5 ${active ? "text-[color:var(--granate)]" : "text-white/55 group-hover:text-white/85"}`} />
      )}
      <span className="flex-1 leading-none">{t(item.label)}</span>
      {badge > 0 && <span className="min-w-4 h-4 px-1 rounded-full bg-[#FF6E00] text-white text-[9px] font-black flex items-center justify-center shrink-0" title={t("{n} usuario(s) pendientes de aceptar", { n: badge })}>{badge}</span>}
      
    </Link>
  );
}

function MyTeamNav({ onClose, notificationCount }) {
  const t = useT();
  const location = useLocation();
  const [open, setOpen] = useState(location.pathname.startsWith("/MyTeam"));
  const isActive = location.pathname.startsWith("/MyTeam");

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        style={isActive ? { borderLeft: "3px solid var(--naranja)" } : { borderLeft: "3px solid transparent" }}
        className={`group w-full flex items-center gap-2.5 pl-2 pr-2.5 py-1.5 rounded-[6px] transition-all duration-150 nav-label text-[11px] relative
          ${isActive ? "bg-white text-[color:var(--granate)] shadow-sm" : "text-white/75 hover:text-white hover:bg-white/10"}`}>
        <div className="relative">
          <ClipboardList className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-[color:var(--granate)]" : "text-white/55 group-hover:text-white/85"}`} />
          {notificationCount > 0 && (
            <div className="absolute -top-2 -right-2 flex items-center justify-center bg-red-500 text-white text-[8px] font-black rounded-full w-4 h-4 leading-none">
              {notificationCount > 9 ? "9+" : notificationCount}
            </div>
          )}
        </div>
        <span className="flex-1 text-left leading-none">{t("Mi Equipo")}</span>
        <motion.div animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight className="w-3 h-3 opacity-50" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-0.5 ml-3 pl-2.5 border-l border-white/20 space-y-0.5 py-0.5">
              {MY_TEAM_SUBITEMS.map(sub => {
                const active = location.pathname === sub.path;
                return (
                  <Link key={sub.path} to={sub.path} onClick={onClose}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-[6px] text-[10px] transition-all nav-label
                      ${active ? "bg-white/20 text-white" : "text-white/60 hover:text-white hover:bg-white/10"}`}>
                    <sub.icon className={`w-3 h-3 shrink-0 ${active ? "text-[color:var(--naranja)]" : "text-white/40"}`} />
                    {t(sub.label)}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlayerSidebar({ onClose = () => {}, drawer = false }) {
  const t = useT();
  const { user, logout } = useAuth();
  return (
    <div className="flex flex-col h-full" style={{ background: "var(--granate)" }}>
      <div className="px-3 py-4 border-b border-white/10">
        <Link to="/PlayerTeam" onClick={onClose} className="flex items-center gap-2.5">
          <img src={CLUB_LOGO_URL_WHITE} alt="RS Club" className="w-7 h-7 object-contain" />
          <h1 className="font-bold text-xl tracking-wider uppercase leading-none text-white" style={{ fontFamily: "var(--font-display)" }}>RS Manager</h1>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-1.5 space-y-0.5">
        <NavItem item={{ label: msg("Mi equipo"), path: "/PlayerTeam", icon: Users }} onClick={onClose} />
        <NavItem item={{ label: msg("Mi ficha y estadísticas"), path: "/PlayerProfile", icon: UserCheck }} onClick={onClose} />
        <NavItem item={{ label: msg("Avisos"), path: "/Avisos", icon: Bell }} onClick={onClose} />
      </nav>
      <div className="px-2 py-3 border-t border-white/10">
        <div className="flex items-center gap-2 px-1.5 py-1.5">
          <p className="text-white text-[11px] font-bold truncate flex-1" style={{ fontFamily: "var(--font-display)" }}>{user?.full_name?.split(" ")[0]}</p>
          <button onClick={logout} aria-label={t("Salir")} title={t("Cerrar sesión")} className="text-white/60 hover:text-white"><LogOut className="w-4 h-4" /></button>
        </div>
        {!drawer && <LanguageSelector tone="dark" className="px-0.5 pt-1" />}
      </div>
    </div>
  );
}

function Sidebar(props) {
  return usePlayerMode() ? <PlayerSidebar {...props} /> : <StaffSidebar {...props} />;
}

function StaffSidebar({ onClose = () => {}, drawer = false }) {
  const t = useT();
  const { user, logout } = useAuth();
  const { isCoordinator, appRole, selectedTeamId, perms } = useTeamAccess();
  const pendingUsers = usePendingUsers(isCoordinator);
  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list("-date"),
  });

  // Calculate notification count for matches in next 2 days
  const notificationCount = useMemo(() => {
    if (!selectedTeamId) return 0;
    const now = new Date();
    const in2Days = addDays(now, 2);
    return events.filter(e => {
      const isMatchEvent = ["partido_amistoso", "partido_liga", "torneo"].includes(e.type);
      const isSelectedTeam = e.team_id === selectedTeamId;
      const eventDate = parseISO(e.date);
      const isInTimeframe = isWithinInterval(eventDate, { start: now, end: in2Days });
      return isMatchEvent && isSelectedTeam && isInTimeframe;
    }).length;
  }, [events, selectedTeamId]);

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: () => base44.entities.StaffMember.list(),
    enabled: !!user,
  });
  const myStaff = useMemo(() => (user ? buildLinks([user], staffList).get(user.id) : null), [user, staffList]);
  const myStaffId = myStaff?.id;
  const { data: unreadFeedback = [] } = useQuery({
    queryKey: ["coachFeedbackUnread", myStaffId],
    queryFn: () => base44.entities.CoachFeedback.filter({ staff_id: myStaffId, status: "enviado" }),
    enabled: !!myStaffId,
    refetchInterval: 120000,
  });
  const unreadCount = unreadFeedback.filter((f) => !f.read_at).length;
  const myProfilePath = myStaffId ? `/CoachProfile?id=${myStaffId}` : user?.id ? `/CoachProfile?userId=${user.id}` : null;

  const adminNav = [
    { label: msg("Panel"), path: "/Dashboard", icon: LayoutDashboard },
    { label: msg("Calendario"), path: "/Calendar", icon: CalendarDays },
    { label: msg("Equipos"), path: "/Teams", icon: Shield },
    { label: msg("Jugadores"), path: "/Players", icon: Users },
    { label: msg("Personal"), path: "/Coaches", icon: UserCheck },
    { label: msg("Accesos"), path: "/Accesos", icon: UserCog },
    { label: msg("Temporada"), path: "/Season", icon: CalendarRange },
    { label: msg("Campos"), path: "/Fields", icon: MapPin },
  ];

  const toolsNav = [
    { key: "stats", label: msg("Estadísticas"), path: "/Stats", icon: BarChart2 },
    { key: "methodology", label: msg("Metodología"), path: "/Methodology", icon: BookOpen },
    { key: "tactics", label: msg("Táctica"), path: "/Tactics", icon: Target },
    { key: "scouting", label: msg("Scouting"), path: "/Scouting", icon: Binoculars },
    { key: "reports", label: msg("Informes"), path: "/Reports", icon: FileText },
    { key: "material", label: msg("Material"), path: "/Material", icon: Package },
  ].filter((item) => perms.tools.includes(item.key));

  // Quien ve a todos los jugadores sin ser coordinación (porteros, psicología, fisio…) tiene su propio bloque de club
  const clubNav = [
    perms.panel && { label: msg("Panel del club"), path: "/Dashboard", icon: LayoutDashboard },
    perms.allTeams && { label: msg("Jugadores"), path: "/Players", icon: Users },
    perms.canViewCoachProfiles && { label: msg("Personal"), path: "/Coaches", icon: UserCheck },
  ].filter(Boolean);

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--granate)" }}>
      {/* Logo */}
      <div className="px-3 py-4 border-b border-white/10">
        <Link to="/Dashboard" onClick={onClose} className="flex items-center gap-2.5">
          <div className="w-8 h-8 shrink-0 rounded-[6px] flex items-center justify-center" style={{ background: "rgba(255,255,255,0.13)" }}>
            <img src={CLUB_LOGO_URL_WHITE} alt="RS" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <p className="text-white font-black text-sm leading-tight uppercase tracking-wide" style={{ fontFamily: "var(--font-display)" }}>RS Data</p>
            <p className="text-[9px] uppercase tracking-widest leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--naranja)" }}>Manager</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-1.5 space-y-0.5">
        {isCoordinator && (
          <>
            <SectionLabel>{msg("Administración")}</SectionLabel>
            {adminNav.map(item => <NavItem key={item.path} item={item} onClick={onClose} badge={item.path === "/Accesos" ? pendingUsers.length : 0} />)}
          </>
        )}

        {!isCoordinator && clubNav.length > 0 && (
          <>
            <SectionLabel>{msg("Club")}</SectionLabel>
            {clubNav.map(item => <NavItem key={item.path} item={item} onClick={onClose} />)}
          </>
        )}

        {myProfilePath && (
          <>
            <SectionLabel>{msg("Mi perfil")}</SectionLabel>
            <Link to={myProfilePath} onClick={onClose}
              style={{ borderLeft: "3px solid transparent" }}
              className="group flex items-center gap-2.5 pl-2 pr-2.5 py-1.5 rounded-[6px] transition-all duration-150 nav-label text-[11px] text-white/75 hover:text-white hover:bg-white/10">
              <UserCheck className="shrink-0 w-3.5 h-3.5 text-white/55 group-hover:text-white/85" />
              <span className="flex-1 leading-none">{t("Perfil y feedback")}</span>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[8px] font-black rounded-full min-w-4 h-4 px-1 flex items-center justify-center leading-none">{unreadCount}</span>
              )}
            </Link>
          </>
        )}

        <SectionLabel>{msg("Comunicación")}</SectionLabel>
        <NavItem item={{ label: msg("Avisos"), path: "/Avisos", icon: Bell }} onClick={onClose} />
        {user?.player_id && user.role !== "admin" && (
          <NavItem item={{ label: msg("Mi ficha de jugador"), path: `/PlayerProfile?id=${user.player_id}&as=player`, icon: UserCheck }} onClick={onClose} />
        )}

        {perms.myTeam && (
          <>
            <SectionLabel>{msg("Mi Equipo")}</SectionLabel>
            <MyTeamNav onClose={onClose} notificationCount={notificationCount} />
          </>
        )}

        {toolsNav.length > 0 && (
          <>
            <SectionLabel>{msg("Herramientas")}</SectionLabel>
            {toolsNav.map(item => <NavItem key={item.path} item={item} onClick={onClose} />)}
          </>
        )}
      </nav>

      {/* User */}
      <div className="px-2 py-3 border-t border-white/10 space-y-2">
        {user && (
          <div className="flex items-center gap-2 px-1.5 py-1.5 rounded-[6px]" style={{ background: "rgba(255,255,255,0.10)", borderLeft: "3px solid var(--naranja)" }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
              style={{ background: "var(--granate)", fontFamily: "var(--font-display)" }}>
              {user.full_name?.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase() || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-[11px] font-bold truncate leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                {user.full_name?.split(" ")[0]}
              </p>
              <p className="text-white/60 text-[9px] truncate leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                {ROLE_DISPLAY[appRole] ? t(ROLE_DISPLAY[appRole]) : ROLE_DISPLAY[user?.role] ? t(ROLE_DISPLAY[user.role]) : appRole || ""}
              </p>
            </div>
            <button onClick={() => logout()} className="p-1 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors shrink-0" title={t("Cerrar sesión")}>
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        )}
        {!drawer && <LanguageSelector tone="dark" className="px-0.5" />}
      </div>
    </div>
  );
}

export default function Layout() {
  const t = useT();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isCoordinator } = useTeamAccess();
  const pendingUsersCount = usePendingUsers(isCoordinator).length;
  const playerMode = usePlayerMode();

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-gray-900 flex">
      <style>{`
        :root {
          --granate: #73000A; --granate-dark: #36000D; --granate-hover: #36000D;
          --granate-pale: #fdf2f4; --naranja: #FF6E00; --naranja-pale: #fff7ed;
          --font-display: 'IBM Plex Sans Condensed', sans-serif;
          --font-title: 'Racing Sarria', sans-serif;
          --font-body: 'IBM Plex Sans Condensed', sans-serif;
        }
        * { font-family: var(--font-body); }
        h1 { font-family: var(--font-title) !important; font-weight: 800 !important; letter-spacing: 0.04em; color: var(--granate) !important; text-transform: uppercase; font-size: 2rem; line-height: 1.1; }
        h2 { font-family: var(--font-title) !important; font-weight: 700 !important; letter-spacing: 0.04em; color: var(--granate) !important; text-transform: uppercase; }
        h3 { font-family: var(--font-display) !important; font-weight: 600 !important; letter-spacing: 0.03em; color: var(--naranja) !important; text-transform: uppercase; }
        h4,h5,h6 { font-family: var(--font-display) !important; font-weight: 600 !important; letter-spacing: 0.03em; color: var(--naranja) !important; text-transform: uppercase; }
        .font-display { font-family: var(--font-display) !important; letter-spacing: 0.04em; }
        .rs-title { font-family: var(--font-title) !important; font-weight: 700 !important; letter-spacing: 0.04em; color: var(--granate); text-transform: uppercase; }
        .rs-subtitle { font-family: var(--font-display) !important; font-weight: 600 !important; letter-spacing: 0.03em; color: var(--naranja); text-transform: uppercase; }
        .on-dark h1, .on-dark h2, .on-dark h3, .on-dark .rs-title { color: #ffffff !important; }
        h1.on-dark, h2.on-dark, h3.on-dark { color: #ffffff !important; }
        .nav-label { font-family: var(--font-display); font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
        .rs-card { background: white; border: 1px solid #e5e7eb; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        .rs-badge { font-family: var(--font-display); font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; font-size: 0.7rem; }
        [style*="font-display"], [style*="var(--font-display)"] { font-weight: 600 !important; }
        .font-black { font-weight: 600 !important; }
        .font-bold { font-weight: 500 !important; }
        h1 { font-weight: 700 !important; }
        h2 { font-weight: 700 !important; }
        .hover\\:bg-white\\/8:hover { background-color: rgba(255,255,255,0.08); }
      `}</style>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-40 fixed h-full z-30 overflow-hidden">
        <Sidebar />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center shadow-sm" style={{ background: "var(--granate)" }}>
        <div className="flex items-center gap-2">
          <button onClick={() => setMobileOpen(!mobileOpen)} aria-label={t("Menú")} className="relative p-2 -ml-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            {pendingUsersCount > 0 && !mobileOpen && <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#FF6E00] border border-[#73000A]" />}
          </button>
          <Link to={playerMode ? "/PlayerTeam" : "/Dashboard"} onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5">
            <img src={CLUB_LOGO_URL_WHITE} alt="RS Club" className="w-7 h-7 object-contain" />
            <h1 className="font-bold text-xl tracking-wider uppercase leading-none" style={{ fontFamily: "var(--font-display)", color: "#ffffff" }}>RS Manager</h1>
          </Link>
        </div>
        <LanguageSelector tone="dark" className="ml-auto -mr-1.5" />
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-30 bg-black/50"
            onClick={() => setMobileOpen(false)}
          >
            <motion.div
              initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-56 h-full"
              style={{ paddingTop: "56px" }}
              onClick={e => e.stopPropagation()}
            >
              <Sidebar onClose={() => setMobileOpen(false)} drawer />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className="flex-1 lg:ml-40 pt-16 lg:pt-0 bg-[#f5f5f5] min-w-0 overflow-x-clip">
        <div className="p-3 md:p-4 max-w-[1600px] mx-auto w-full min-w-0">
          <Suspense fallback={<div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-4 border-slate-200 border-t-[var(--granate)] rounded-full animate-spin"></div></div>}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}