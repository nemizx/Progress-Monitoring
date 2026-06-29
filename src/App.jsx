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
import Analytics from '@/pages/Reports';
// reuse Reports as placeholder for Analytics for now
import BudgetCost from '@/pages/BudgetCost';
import CostControls from '@/pages/CostControls';
import ChangeComms from '@/pages/ChangeComms';
import Notifications from '@/pages/Notifications';
import AdminPanel from '@/pages/AdminPanel';
import LaborTracking from '@/pages/LaborTracking';

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
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/scheduler" element={<ScheduleBuilder />} />
          <Route path="/schedule-monitor" element={<ScheduleMonitor />} />
          <Route path="/wbs" element={<WBSManagement />} />
          <Route path="/progress" element={<SiteProgress />} />
          <Route path="/attendance" element={<LaborTracking />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/budget" element={<BudgetCost />} />
          <Route path="/cost" element={<CostControls />} />
          <Route path="/collaboration" element={<ChangeComms />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/admin" element={<AdminPanel />} />
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