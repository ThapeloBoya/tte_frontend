import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import API from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import "../styles/Login.css";
import Alert from "../components/Alert";

const BACKEND_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showMfa, setShowMfa] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, mfaPending, setMfaChallenge } = useAuth();

  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (oauthError === "oauth_failed") {
      setError("OAuth login failed. Please try again.");
    }
  }, [searchParams]);

  const redirectAfterLogin = (userData) => {
    switch (userData.role) {
      case "superadmin": navigate("/dashboard"); break;
      case "admin1": navigate("/admin1"); break;
      case "admin2": navigate("/admin2"); break;
      case "driver": navigate("/driver"); break;
      default: navigate("/");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await API.post("/auth/login", { email, password });

      if (res.data.mfaRequired) {
        setMfaChallenge({
          mfaSessionToken: res.data.mfaSessionToken,
          email: res.data.email,
          name: res.data.name,
        });
        setShowMfa(true);
        setLoading(false);
        return;
      }

      const user = {
        _id: res.data._id,
        name: res.data.name,
        email: res.data.email,
        role: res.data.role,
      };
      const token = res.data.token;

      if (!user || !token) throw new Error("Invalid login response");
      login(user, token);
      redirectAfterLogin(user);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    if (!mfaPending) return;
    setLoading(true);
    setError("");

    try {
      const res = await API.post("/auth/mfa/verify-challenge", {
        mfaSessionToken: mfaPending.mfaSessionToken,
        token: mfaCode,
      });

      const user = {
        _id: res.data._id,
        name: res.data.name,
        email: res.data.email,
        role: res.data.role,
      };
      const token = res.data.token;

      if (!user || !token) throw new Error("Invalid MFA response");
      login(user, token);
      redirectAfterLogin(user);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverySubmit = async (e) => {
    e.preventDefault();
    if (!mfaPending) return;
    setLoading(true);
    setError("");

    try {
      const res = await API.post("/auth/mfa/verify-recovery", {
        mfaSessionToken: mfaPending.mfaSessionToken,
        recoveryCode: recoveryCode,
      });

      const user = {
        _id: res.data._id,
        name: res.data.name,
        email: res.data.email,
        role: res.data.role,
      };
      const token = res.data.token;

      if (!user || !token) throw new Error("Invalid MFA response");
      login(user, token);
      redirectAfterLogin(user);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelMfa = () => {
    setShowMfa(false);
    setMfaCode("");
    setRecoveryCode("");
    setUseRecovery(false);
    setMfaChallenge(null);
    setError("");
  };

  if (showMfa) {
    return (
      <div className="login-container">
        <div className="login-card">
          <img src="/logo.png" alt="Logo" />
          <h2>Two-Factor Authentication</h2>
          {!useRecovery ? (
            <>
              <p className="mfa-hint">Enter the 6-digit code from your authenticator app.</p>
              <Alert message={error} type="error" onClose={() => setError("")} />
              <form onSubmit={handleMfaSubmit}>
                <input
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  required
                  autoFocus
                />
                <button type="submit" disabled={loading || mfaCode.length < 6}>
                  {loading ? "Verifying..." : "Verify"}
                </button>
              </form>
              <p className="mfa-hint mfa-recovery-link">
                <button className="link-button" onClick={() => { setUseRecovery(true); setError(""); }}>
                  Use a recovery code instead
                </button>
              </p>
            </>
          ) : (
            <>
              <p className="mfa-hint">Enter one of your recovery codes.</p>
              <Alert message={error} type="error" onClose={() => setError("")} />
              <form onSubmit={handleRecoverySubmit}>
                <input
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 8))}
                  placeholder="XXXXXXXX"
                  maxLength={8}
                  required
                  autoFocus
                />
                <button type="submit" disabled={loading || recoveryCode.length < 8}>
                  {loading ? "Verifying..." : "Verify Recovery Code"}
                </button>
              </form>
              <p className="mfa-hint mfa-recovery-link">
                <button className="link-button" onClick={() => { setUseRecovery(false); setError(""); }}>
                  Use authenticator app instead
                </button>
              </p>
            </>
          )}
          <div className="login-links">
            <button className="link-button" onClick={handleCancelMfa}>← Back to login</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <img src="/logo.png" alt="Logo" />
        <h2>Login</h2>
        <Alert message={error} type="error" onClose={() => setError("")} />
        <form onSubmit={handleSubmit}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" required />
          <button type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign In"}</button>
        </form>
        {/*
        <div className="oauth-buttons">
          <a href={`${BACKEND_URL}/api/auth/google`} className="oauth-btn google-btn">
            Sign in with Google
          </a>
          <a href={`${BACKEND_URL}/api/auth/microsoft`} className="oauth-btn microsoft-btn">
            Sign in with Microsoft
          </a>
        </div>
        */}
        <div className="login-links">
          <Link to="/forgot-password">Forgot Password?</Link>
          <Link to="/register">Register</Link>
        </div>
        <p className="login-footer"><Link to="/track">Track a Shipment</Link></p>
      </div>
    </div>
  );
};

export default Login;