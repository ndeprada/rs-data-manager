import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Teams from './pages/Teams';
import Players from './pages/Players';
import Calendar from './pages/Calendar';
import TeamDetail from './pages/TeamDetail';
import PlayerProfile from './pages/PlayerProfile';
import Reports from './pages/Reports';
import Stats from './pages/Stats';
import Tactics from './pages/Tactics';
import Attendance from './pages/Attendance';
import MatchDetail from './pages/MatchDetail';
import Matches from './pages/Matches';
import Scouting from './pages/Scouting.jsx';
import Coaches from './pages/Coaches';
import CoachProfile from './pages/CoachProfile';
import MyTeam from './pages/MyTeam';
import DataImport from './pages/DataImport';
import Squad from './pages/myteam/Squad';
import TeamMatches from './pages/myteam/TeamMatches';
import TeamAttendance from './pages/myteam/TeamAttendance';
import Development from './pages/myteam/Development';
import { Navigate } from 'react-router-dom';
import RoleSetup from './pages/RoleSetup';
import PendingApproval from './pages/PendingApproval';
import Accesos from './pages/Accesos';
import Fields from './pages/Fields';
import CleanDB from './pages/CleanDB';
import Material from './pages/Material';
import Methodology from './pages/Methodology';
import { TeamAccessProvider } from '@/lib/TeamAccessContext';
import { useTeamAccess } from '@/lib/TeamAccessContext';

const STAFF_ROLES = ["coordinador_general", "coordinador_f7", "coordinador_f11", "entrenador", "preparador_fisico", "entrenador_porteros", "psicologo", "fisioterapeuta"];

const RootRedirect = () => {
  const { user } = useAuth();
  const appRole = user?.app_role;
  if (STAFF_ROLES.includes(appRole)) {
    return <Navigate to="/Coaches" replace />;
  }
  return <Navigate to="/Dashboard" replace />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user, isAuthenticated } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
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

  // Usuario sin rol ni solicitud pendiente → onboarding
  const hasRole = user?.app_role && ["coordinador_general","coordinador_f7","coordinador_f11","entrenador"].includes(user.app_role);
  if (isAuthenticated && user && !hasRole && !user.app_role_pending && user.role !== 'admin') {
    return <RoleSetup />;
  }

  // Usuario con solicitud pendiente o rechazada → pantalla de espera
  if (isAuthenticated && user && user.role !== 'admin' &&
      (user.access_status === 'pending' || user.access_status === 'rejected') &&
      !user.app_role) {
    return <PendingApproval />;
  }

  // Render the main app
  return (
    <TeamAccessProvider>
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route element={<Layout />}>
        <Route path="/Dashboard" element={<Dashboard />} />
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


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App