import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { LanguageProvider } from '@/i18n';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Login from './pages/Login';
import Layout from './components/Layout';
const Dashboard = lazyPage(() => import('./pages/Dashboard'));
const Teams = lazyPage(() => import('./pages/Teams'));
const Players = lazyPage(() => import('./pages/Players'));
const Calendar = lazyPage(() => import('./pages/Calendar'));
const TeamDetail = lazyPage(() => import('./pages/TeamDetail'));
const PlayerProfile = lazyPage(() => import('./pages/PlayerProfile'));
const Reports = lazyPage(() => import('./pages/Reports'));
const Stats = lazyPage(() => import('./pages/Stats'));
const Tactics = lazyPage(() => import('./pages/Tactics'));
const Attendance = lazyPage(() => import('./pages/Attendance'));
const MatchDetail = lazyPage(() => import('./pages/MatchDetail'));
const Matches = lazyPage(() => import('./pages/Matches'));
const Scouting = lazyPage(() => import('./pages/Scouting.jsx'));
const Coaches = lazyPage(() => import('./pages/Coaches'));
const CoachProfile = lazyPage(() => import('./pages/CoachProfile'));
const MyTeam = lazyPage(() => import('./pages/MyTeam'));
const DataImport = lazyPage(() => import('./pages/DataImport'));
const Squad = lazyPage(() => import('./pages/myteam/Squad'));
const TeamMatches = lazyPage(() => import('./pages/myteam/TeamMatches'));
const TeamAttendance = lazyPage(() => import('./pages/myteam/TeamAttendance'));
const Development = lazyPage(() => import('./pages/myteam/Development'));
import { Navigate } from 'react-router-dom';
const RoleSetup = lazyPage(() => import('./pages/RoleSetup'));
const PendingApproval = lazyPage(() => import('./pages/PendingApproval'));
const PlayerTeam = lazyPage(() => import('./pages/PlayerTeam'));
import { STAFF_FUNCTION_VALUES } from '@/lib/staffRoles';
const Accesos = lazyPage(() => import('./pages/Accesos'));
const Season = lazyPage(() => import('./pages/Season'));
const Fields = lazyPage(() => import('./pages/Fields'));
const CleanDB = lazyPage(() => import('./pages/CleanDB'));
const Material = lazyPage(() => import('./pages/Material'));
const Methodology = lazyPage(() => import('./pages/Methodology'));
const Avisos = lazyPage(() => import('./pages/Avisos'));
const FamilyHome = lazyPage(() => import('./pages/FamilyHome'));
import { TeamAccessProvider } from '@/lib/TeamAccessContext';
import { lazyPage } from '@/lib/lazyPage';
import UpdateNotice from '@/components/common/UpdateNotice';
import AutoFcfSync from '@/components/common/AutoFcfSync';
import { useTeamAccess } from '@/lib/TeamAccessContext';

const STAFF_ROLES = STAFF_FUNCTION_VALUES;

const RootRedirect = () => {
  const { user } = useAuth();
  const appRole = user?.app_role;
  // Dirección y coordinación abren en el panel del club; el resto de personal, en el panel de su equipo.
  if (user?.role === "admin" || ["director", "director_deportivo", "coordinador_general", "coordinador_f7", "coordinador_f11"].includes(appRole)) {
    return <Navigate to="/Dashboard" replace />;
  }
  // Psicología y fisioterapia no trabajan con un equipo: abren en la lista de jugadores
  if (["psicologo", "fisioterapeuta"].includes(appRole)) {
    return <Navigate to="/Players" replace />;
  }
  if (STAFF_ROLES.includes(appRole)) {
    return <Navigate to="/MyTeam" replace />;
  }
  return <Navigate to="/Dashboard" replace />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user, isAuthenticated } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-[var(--granate)] rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      return <Login />;
    }
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  const isAdminUser = user?.role === 'admin';
  const status = user?.access_status;

  // Acceso rechazado o eliminado → pantalla de denegado
  if (user && !isAdminUser && (status === 'rejected' || status === 'deleted')) {
    return <PendingApproval />;
  }

  // Familiar con vínculo aprobado
  if (user && !isAdminUser && user.app_role === 'familiar' && status === 'approved') {
    return <FamilyHome />;
  }

  // Jugador con acceso aprobado
  if (user && !isAdminUser && user.app_role === 'jugador' && status === 'approved') {
    return (
      <TeamAccessProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/PlayerTeam" element={<PlayerTeam />} />
            <Route path="/PlayerProfile" element={<PlayerProfile />} />
            <Route path="/Avisos" element={<Avisos />} />
          </Route>
          <Route path="*" element={<Navigate to="/PlayerTeam" replace />} />
        </Routes>
      </TeamAccessProvider>
    );
  }

  // Usuario sin función aprobada ni solicitud pendiente → elegir jugador / cuerpo técnico
  const hasRole = !!user?.app_role && STAFF_ROLES.includes(user.app_role);
  if (user && !isAdminUser && !hasRole && !user.app_role_pending) {
    return <RoleSetup />;
  }

  // Solicitud pendiente de aprobación → pantalla de espera
  if (user && !isAdminUser && (status === 'pending' || !hasRole)) {
    return <PendingApproval />;
  }

  // Render the main app
  return (
    <TeamAccessProvider>
    <AutoFcfSync />
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route element={<Layout />}>
        <Route path="/Dashboard" element={<Dashboard />} />
        <Route path="/Avisos" element={<Avisos />} />
        <Route path="/Teams" element={<Teams />} />
        <Route path="/Players" element={<Players />} />
        <Route path="/Calendar" element={<Calendar />} />
        <Route path="/TeamDetail" element={<TeamDetail />} />
        <Route path="/PlayerProfile" element={<PlayerProfile />} />
        <Route path="/Reports" element={<Reports />} />
        <Route path="/Stats" element={<Stats />} />
        <Route path="/Tactics" element={<Tactics />} />
        <Route path="/Attendance" element={<Attendance />} />
        <Route path="/MatchDetail" element={<MatchDetail />} />
        <Route path="/Matches" element={<Matches />} />
        <Route path="/Scouting" element={<Scouting />} />
        <Route path="/Coaches" element={<Coaches />} />
        <Route path="/CoachProfile" element={<CoachProfile />} />
        <Route path="/MyTeam" element={<MyTeam />} />
        <Route path="/MyTeam/Squad" element={<Squad />} />
        <Route path="/MyTeam/Matches" element={<TeamMatches />} />
        <Route path="/MyTeam/Attendance" element={<TeamAttendance />} />
        <Route path="/MyTeam/Development" element={<Development />} />
        <Route path="/Accesos" element={<Accesos />} />
        <Route path="/Season" element={<Season />} />
        <Route path="/Fields" element={<Fields />} />
        <Route path="/DataImport" element={<DataImport />} />
        <Route path="/CleanDB" element={<CleanDB />} />
        <Route path="/Material" element={<Material />} />
        <Route path="/Methodology" element={<Methodology />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </TeamAccessProvider>
  );
};


const PageSpinner = () => (
  <div className="flex items-center justify-center py-24">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-[var(--granate)] rounded-full animate-spin"></div>
  </div>
);

function App() {

  return (
    <AuthProvider>
      <LanguageProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <Suspense fallback={<PageSpinner />}>
              <AuthenticatedApp />
            </Suspense>
          </Router>
          <Toaster />
          <UpdateNotice />
        </QueryClientProvider>
      </LanguageProvider>
    </AuthProvider>
  )
}

export default App