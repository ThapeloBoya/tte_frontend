import React from "react";
import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import SuperAdmin from "./pages/SuperAdmin";
import Admin1 from "./pages/Admin1";
import Admin2 from "./pages/Admin2";
import Driver from "./pages/Driver";
import Audit from "./pages/Audit";
import NotFound from "./pages/NotFound";
import Track from "./pages/Track";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import MfaSettings from "./pages/MfaSettings";
import ChangePassword from "./pages/ChangePassword";
import OAuthCallback from "./pages/OAuthCallback";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import SkipLink from "./components/SkipLink";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { NotificationProvider, useNotifications } from "./contexts/NotificationContext";
import { AnnounceProvider } from "./components/ScreenReaderAnnouncements";
import Toast from "./components/Toast";

function AppRoutes() {
  const { user } = useAuth();

  return (
    <>
      <SkipLink />
      <div id="main-content" tabIndex={-1}>
        <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/track" element={<Track />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/oauth-callback" element={<OAuthCallback />} />

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
