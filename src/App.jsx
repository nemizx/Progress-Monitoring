import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Projects from '@/pages/Projects';
import ScheduleBuilder from '@/pages/ScheduleBuilder';
import ScheduleMonitor from '@/pages/ScheduleMonitor';
import WBSManagement from '@/pages/WBSManagement';
import SiteProgress from '@/pages/SiteProgress';
import Reports from '@/pages/Reports';
import LabourProductivity from '@/pages/LabourProductivity';
import BudgetCost from '@/pages/BudgetCost';
import CostControls from '@/pages/CostControls';
import ChangeComms from '@/pages/ChangeComms';
import Notifications from '@/pages/Notifications';
import AdminPanel from '@/pages/AdminPanel';
import LaborTracking from '@/pages/LaborTracking';
import TechnicalStaff from '@/pages/TechnicalStaff';
import Contractors from '@/pages/Contractors';
import ModuleRouteGuard from '@/components/ModuleRouteGuard';

const PUBLIC_AUTH_PATHS = new Set(['/login', '/register', '/forgot-password', '/reset-password']);

const AuthenticatedApp = () => {
  const location = useLocation();
  const isPublicAuthRoute = PUBLIC_AUTH_PATHS.has(location.pathname);
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground">Loading Planedge_Monitors...</p>
        </div>
      </div>
    );
  }

  if (authError && !isPublicAuthRoute) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<ModuleRouteGuard moduleId="dashboard"><Dashboard /></ModuleRouteGuard>} />
          <Route path="/projects" element={<ModuleRouteGuard moduleId="project_master"><Projects /></ModuleRouteGuard>} />
          <Route path="/scheduler" element={<ModuleRouteGuard moduleId="wbs_management"><ScheduleBuilder /></ModuleRouteGuard>} />
          <Route path="/schedule-monitor" element={<ModuleRouteGuard moduleId="schedule_monitor"><ScheduleMonitor /></ModuleRouteGuard>} />
          <Route path="/wbs" element={<ModuleRouteGuard moduleId="wbs_management"><WBSManagement /></ModuleRouteGuard>} />
          <Route path="/progress" element={<SiteProgress />} />
          <Route path="/attendance" element={<ModuleRouteGuard moduleId="labour_details"><LaborTracking /></ModuleRouteGuard>} />
          <Route path="/technical-staff" element={<ModuleRouteGuard moduleId="technical_staff"><TechnicalStaff /></ModuleRouteGuard>} />
          <Route path="/contractors" element={<ModuleRouteGuard moduleId="contractor_master"><Contractors /></ModuleRouteGuard>} />
          <Route path="/reports" element={<ModuleRouteGuard moduleId="dpr_reports"><Reports /></ModuleRouteGuard>} />
          <Route path="/analytics/labour-productivity" element={<ModuleRouteGuard moduleId="labour_productivity"><LabourProductivity /></ModuleRouteGuard>} />
          <Route path="/budget" element={<ModuleRouteGuard moduleId="budget"><BudgetCost /></ModuleRouteGuard>} />
          <Route path="/cost" element={<ModuleRouteGuard moduleId="cost_controls"><CostControls /></ModuleRouteGuard>} />
          <Route path="/collaboration" element={<ModuleRouteGuard moduleId="collaboration"><ChangeComms /></ModuleRouteGuard>} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/admin" element={<ModuleRouteGuard moduleId="admin_panel"><AdminPanel /></ModuleRouteGuard>} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
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
  );
}

export default App;