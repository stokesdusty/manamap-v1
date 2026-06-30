import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { StoresPage } from './pages/StoresPage';
import { ClaimStorePage } from './pages/ClaimStorePage';
import { StoreDashboardPage } from './pages/StoreDashboardPage';
import { OfferFormPage } from './pages/OfferFormPage';
import { ModerationPage } from './pages/ModerationPage';
import { StoreSubmissionsPage } from './pages/StoreSubmissionsPage';
import { StoreClaimsPage } from './pages/StoreClaimsPage';
import { BroadcastPage } from './pages/BroadcastPage';
import { EventsPage } from './pages/EventsPage';
import { RedeemPage } from './pages/RedeemPage';
import { SupportPage } from './pages/SupportPage';

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 60_000 } },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  return role === 'ADMIN' ? <>{children}</> : <Navigate to="/stores" replace />;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/stores" replace /> : <LoginPage />}
      />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/stores" replace />} />
        <Route path="/stores" element={<StoresPage />} />
        <Route path="/stores/claim" element={<ClaimStorePage />} />
        <Route path="/stores/:storeId" element={<StoreDashboardPage />} />
        <Route path="/stores/:storeId/offers/new" element={<OfferFormPage />} />
        <Route path="/stores/:storeId/offers/:offerId/edit" element={<OfferFormPage />} />
        <Route path="/stores/:storeId/events" element={<EventsPage />} />
        <Route path="/stores/:storeId/broadcast" element={<BroadcastPage />} />
        <Route path="/stores/:storeId/redeem" element={<RedeemPage />} />
        <Route
          path="/moderation"
          element={
            <RequireAdmin>
              <ModerationPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/stores/submissions"
          element={
            <RequireAdmin>
              <StoreSubmissionsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/stores/claims"
          element={
            <RequireAdmin>
              <StoreClaimsPage />
            </RequireAdmin>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/stores" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
