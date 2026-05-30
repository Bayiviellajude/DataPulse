import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import DataSources from '@/pages/DataSources.jsx';
import CoralQueryPage from '@/pages/CoralQueryPage.jsx';
import IncidentsPage from '@/pages/IncidentsPage.jsx';
import InsightsPage from '@/pages/InsightsPage.jsx';
import AgentPage from '@/pages/AgentPage';
import ExecutiveSummaryPage from '@/pages/ExecutiveSummaryPage';
import IncidentTimelinePage from '@/pages/IncidentTimelinePage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import CommunityPage from '@/pages/CommunityPage';
import ProfilePage from '@/pages/ProfilePage';
import SettingsPage from '@/pages/SettingsPage';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

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
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sources" element={<DataSources />} />
        <Route path="/query" element={<CoralQueryPage />} />
        <Route path="/incidents" element={<IncidentsPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/agent" element={<AgentPage />} />
        <Route path="/summary" element={<ExecutiveSummaryPage />} />
        <Route path="/timeline" element={<IncidentTimelinePage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
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
  )
}

export default App