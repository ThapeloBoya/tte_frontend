import React, { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import Track from "./pages/Track";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import OAuthCallback from "./pages/OAuthCallback";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import SkipLink from "./components/SkipLink";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { NotificationProvider, useNotifications } from "./contexts/NotificationContext";
import { AnnounceProvider } from "./components/ScreenReaderAnnouncements";
import Toast from "./components/Toast";

const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));
const Admin1 = lazy(() => import("./pages/Admin1"));
const Admin2 = lazy(() => import("./pages/Admin2"));
const Driver = lazy(() => import("./pages/Driver"));
const Audit = lazy(() => import("./pages/Audit"));
const MfaSettings = lazy(() => import("./pages/MfaSettings"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));

function AppRoutes() {
  const { user } = useAuth();

  return (
    <>
      <SkipLink />
      <div id="main-content" tabIndex={-1}>
        <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading...</div>}>
        <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/track" element={<Track />} />
      <Route path="/track/:ticketNumber" element={<Track />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/oauth-callback" element={<OAuthCallback />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />

      {/* Super Admin */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <SuperAdmin />
          </ProtectedRoute>
        }
      />

      {/* Admin1 */}
      <Route
        path="/admin1"
        element={
          <ProtectedRoute allowedRoles={["admin1", "superadmin"]}>
            <Admin1 />
          </ProtectedRoute>
        }
      />

      {/* Admin2 */}
      <Route
        path="/admin2"
        element={
          <ProtectedRoute allowedRoles={["admin2", "superadmin"]}>
            <Admin2 />
          </ProtectedRoute>
        }
      />

      {/* Driver */}
      <Route
        path="/driver"
        element={
          <ProtectedRoute allowedRoles={["driver"]}>
            {/* Pass email from context */}
            <Driver driverEmail={user?.email} />
          </ProtectedRoute>
        }
      />

      {/* Audit Trail */}
      <Route
        path="/audit"
        element={
          <ProtectedRoute allowedRoles={["admin1", "superadmin"]}>
            <Audit />
          </ProtectedRoute>
        }
      />

      {/* MFA Settings */}
      <Route
        path="/mfa-settings"
        element={
          <ProtectedRoute allowedRoles={["superadmin", "admin1", "admin2", "driver"]}>
            <MfaSettings />
          </ProtectedRoute>
        }
      />

      {/* Change Password */}
      <Route
        path="/change-password"
        element={
          <ProtectedRoute allowedRoles={["superadmin", "admin1", "admin2", "driver"]}>
            <ChangePassword />
          </ProtectedRoute>
        }
      />

      {/* Not Found */}
      <Route path="*" element={<NotFound />} />
    </Routes>
        </Suspense>
      </div>
    </>
  );
}

function AppContent() {
  const { toast, dismissToast } = useNotifications();
  return (
    <ErrorBoundary>
      <AnnounceProvider>
        <AppRoutes />
        <Toast notification={toast} onDismiss={dismissToast} />
      </AnnounceProvider>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
