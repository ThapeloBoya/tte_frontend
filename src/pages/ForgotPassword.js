import React, { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../services/authService";
import "../styles/Login.css";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <img src="/logo.png" alt="Logo" />
        <h2>Forgot Password</h2>
        {sent ? (
          <>
            <p className="login-success">If that email exists, a reset link has been sent.</p>
            <p className="login-footer"><Link to="/">Back to login</Link></p>
          </>
        ) : (
          <>
            {error && <p className="login-error">{error}</p>}
            <form onSubmit={handleSubmit}>
              <input type="email" placeholder="Your email address" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <button type="submit" disabled={loading}>{loading ? "Sending..." : "Send Reset Link"}</button>
            </form>
            <p className="login-footer"><Link to="/">Back to login</Link></p>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
