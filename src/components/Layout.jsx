import React, { useState, useMemo } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Shield, CalendarDays, Menu, X,
  FileText, BarChart2, Target, Binoculars, LogOut,
  ChevronDown, ChevronRight, ClipboardList, UserCog,
  UserCheck, Layers, Trophy, Calendar, MapPin, Package, BookOpen
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { CLUB_LOGO_URL_WHITE } from "@/lib/clubConfig";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { addDays, isWithinInterval, parseISO } from "date-fns";

const MY_TEAM_SUBITEMS = [
  { label: "Panel", path: "/MyTeam", exact: true, icon: LayoutDashboard },
  { label: "Plantilla", path: "/MyTeam/Squad", icon: Users },
  { label: "Entrenamientos", path: "/MyTeam/Attendance", icon: Calendar },
  { label: "Partidos", path: "/MyTeam/Matches", icon: Trophy },
  { label: "Desarrollo", path: "/MyTeam/Development", icon: Target },
  { label: "Metodología", path: "/Methodology", icon: BookOpen },
];

const ROLE_DISPLAY = {
  coordinador_general: "Coord. General",
  coordinador_f7: "Coord. F7",
  coordinador_f11: "Coord. F11",
  entrenador: "Entrenador",
  admin: "Admin",
};

function SectionLabel({ children }) {
  return (
    <p className="px-2 pt-3 pb-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-white/25"
      style={{ fontFamily: "var(--font-display)" }}>
      {children}
    </p>
  );
}

function NavItem({ item, onClick }) {
  const location = useLocation();
  const active = location.pathname === item.path;
  return (
    <Link to={item.path} onClick={onClick}
      className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-all duration-150 nav-label text-[11px]
        ${active
          ? "bg-white/18 text-white shadow-sm"
          : "text-white/55 hover:text-white hover:bg-white/10"
        }`}>
      {item.icon && (
        <item.icon className={`shrink-0 w-3.5 h-3.5 ${active ? "text-white" : "text-white/45 group-hover:text-white/75"}`} />
      )}
      <span className="flex-1 leading-none">{item.label}</span>
      {active && <div className="w-1 h-1 rounded-full bg-white/50 shrink-0" />}
    </Link>
  );
}

function MyTeamNav({ onClose, notificationCount }) {
  const location = useLocation();
  const [open, setOpen] = useState(location.pathname.startsWith("/MyTeam"));
  const isActive = location.pathname.startsWith("/MyTeam");

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`group w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-all duration-150 nav-label text-[11px] relative
          ${isActive ? "bg-white/18 text-white shadow-sm" : "text-white/55 hover:text-white hover:bg-white/10"}`}>
        <div className="relative">
          <ClipboardList className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "text-white/45 group-hover:text-white/75"}`} />
          {notificationCount > 0 && (
            <div className="absolute -top-2 -right-2 flex items-center justify-center bg-red-500 text-white text-[8px] font-black rounded-full w-4 h-4 leading-none">
              {notificationCount > 9 ? "9+" : notificationCount}
            </div>
          )}
        </div>
        <span className="flex-1 text-left leading-none">Mi Equipo</span>
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
            <div className="mt-0.5 ml-3 pl-2.5 border-l border-white/10 space-y-0.5 py-0.5">
              {MY_TEAM_SUBITEMS.map(sub => {
                const active = location.pathname === sub.path;
                return (
                  <Link key={sub.path} to={sub.path} onClick={onClose}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] transition-all nav-label
                      ${active ? "bg-white/15 text-white" : "text-white/40 hover:text-white/75 hover:bg-white/8"}`}>
                    <sub.icon className={`w-3 h-3 shrink-0 ${active ? "text-white/80" : "text-white/25"}`} />
                    {sub.label}
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

function Sidebar({ onClose = () => {} }) {
  const { user, logout } = useAuth();
  const { isCoordinator, appRole, selectedTeamId } = useTeamAccess();
  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list("-date", 500),
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

  const adminNav = [
    { label: "Panel", path: "/Dashboard", icon: LayoutDashboard },
    { label: "Calendario", path: "/Calendar", icon: CalendarDays },
    { label: "Equipos", path: "/Teams", icon: Shield },
    { label: "Jugadores", path: "/Players", icon: Users },
    { label: "Personal", path: "/Coaches", icon: UserCheck },
    { label: "Accesos", path: "/Accesos", icon: UserCog },
    { label: "Campos", path: "/Fields", icon: MapPin },
  ];

  const toolsNav = [
    { label: "Estadísticas", path: "/Stats", icon: BarChart2 },
    { label: "Metodología", path: "/Methodology", icon: BookOpen },
    { label: "Táctica", path: "/Tactics", icon: Target },
    { label: "Scouting", path: "/Scouting", icon: Binoculars },
    { label: "Informes", path: "/Reports", icon: FileText },
    { label: "Material", path: "/Material", icon: Package },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--granate)" }}>
      {/* Logo */}
      <div className="px-3 py-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 shrink-0 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.13)" }}>
            <img src={CLUB_LOGO_URL_WHITE} alt="RS" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <p className="text-white font-black text-sm leading-tight uppercase tracking-wide" style={{ fontFamily: "var(--font-display)" }}>RS Data</p>
            <p className="text-[9px] uppercase tracking-widest leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--naranja)" }}>Manager</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-1.5 space-y-0.5">
        {isCoordinator && (
          <>
            <SectionLabel>Administración</SectionLabel>
            {adminNav.map(item => <NavItem key={item.path} item={item} onClick={onClose} />)}
          </>
        )}

        <SectionLabel>Mi Equipo</SectionLabel>
        <MyTeamNav onClose={onClose} notificationCount={notificationCount} />

        <SectionLabel>Herramientas</SectionLabel>
        {toolsNav.map(item => <NavItem key={item.path} item={item} onClick={onClose} />)}
      </nav>

      {/* User */}
      <div className="px-2 py-3 border-t border-white/10 space-y-2">
        {user && (
          <div className="flex items-center gap-2 px-1.5 py-1.5 rounded-xl" style={{ background: "rgba(255,255,255,0.07)" }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
              style={{ background: "var(--granate)", fontFamily: "var(--font-display)" }}>
              {user.full_name?.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase() || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-[11px] font-bold truncate leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                {user.full_name?.split(" ")[0]}
              </p>
              <p className="text-white/40 text-[9px] truncate leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                {ROLE_DISPLAY[appRole] || ROLE_DISPLAY[user?.role] || appRole || ""}
              </p>
            </div>
            <button onClick={() => logout()} className="p-1 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors shrink-0" title="Cerrar sesión">
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-gray-900 flex">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,500;0,600;0,700;0,800;1,600&family=IBM+Plex+Sans+Condensed:wght@400;500;600;700&display=swap');
        :root {
          --granate: #8B1A2B; --granate-dark: #6d1120; --granate-hover: #6d1120;
          --granate-pale: #fdf2f4; --naranja: #E85D04; --naranja-pale: #fff7ed;
          --font-display: 'Barlow Condensed', sans-serif;
          --font-body: 'IBM Plex Sans Condensed', sans-serif;
        }
        * { font-family: var(--font-body); }
        h1 { font-family: var(--font-display) !important; font-weight: 800 !important; letter-spacing: 0.04em; color: var(--granate) !important; text-transform: uppercase; font-size: 2rem; line-height: 1.1; }
        h2 { font-family: var(--font-display) !important; font-weight: 700 !important; letter-spacing: 0.04em; color: var(--granate) !important; text-transform: uppercase; }
        h3 { font-family: var(--font-display) !important; font-weight: 600 !important; letter-spacing: 0.03em; color: var(--naranja) !important; text-transform: uppercase; }
        h4,h5,h6 { font-family: var(--font-display) !important; font-weight: 600 !important; letter-spacing: 0.03em; color: var(--naranja) !important; text-transform: uppercase; }
        .font-display { font-family: var(--font-display) !important; letter-spacing: 0.04em; }
        .rs-title { font-family: var(--font-display) !important; font-weight: 700 !important; letter-spacing: 0.04em; color: var(--granate); text-transform: uppercase; }
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
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center justify-between shadow-sm" style={{ background: "var(--granate)" }}>
        <div className="flex items-center gap-3">
          <img src={CLUB_LOGO_URL_WHITE} alt="RS Club" className="w-7 h-7 object-contain" />
          <h1 className="font-bold text-xl tracking-wider uppercase leading-none" style={{ fontFamily: "var(--font-display)", color: "#ffffff" }}>RS Data Manager</h1>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
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
              <Sidebar onClose={() => setMobileOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className="flex-1 lg:ml-40 pt-16 lg:pt-0 bg-[#f5f5f5] min-w-0 overflow-x-hidden">
        <div className="p-3 md:p-4 max-w-[1600px] mx-auto w-full min-w-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}