import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { resetPassword } from "../services/authService";
import "../styles/Login.css";

const ResetPassword = () => {
  const { token } = useParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) return setError("Passwords do not match.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");

    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || "Reset failed. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <img src="/logo.png" alt="Logo" />
        <h2>Reset Password</h2>
        {done ? (
          <>
            <p className="login-success">Password reset successful! You can now log in.</p>
            <p className="login-footer"><Link to="/login">Go to login</Link></p>
          </>
        ) : (
          <>
            {error && <p className="login-error">{error}</p>}
            <form onSubmit={handleSubmit}>
              <input type="password" placeholder="New password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <input type="password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              <button type="submit" disabled={loading}>{loading ? "Resetting..." : "Reset Password"}</button>
            </form>
            <p className="login-footer"><Link to="/login">Back to login</Link></p>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
