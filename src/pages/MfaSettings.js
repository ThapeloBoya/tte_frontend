import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import Alert from "../components/Alert";
import "../styles/MfaSettings.css";

const MfaSettings = () => {

  const navigate = useNavigate();
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [secret, setSecret] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [showRecovery, setShowRecovery] = useState(false);

  useEffect(() => {
    API.get("/auth/mfa/status").then((res) => {
      setMfaEnabled(res.data.mfaEnabled);
    }).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await API.post("/auth/mfa/generate");
      setQrCode(res.data.qrCode);
      setSecret(res.data.secret);
      setShowQr(true);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to generate QR code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEnable = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await API.post("/auth/mfa/verify-enable", { token: verifyCode });
      setMfaEnabled(true);
      setShowQr(false);
      setQrCode(null);
      setSecret("");
      setVerifyCode("");
      setSuccess("MFA has been enabled successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await API.post("/auth/mfa/disable", { password: disablePassword });
      setMfaEnabled(false);
      setShowDisable(false);
      setDisablePassword("");
      setRecoveryCodes(null);
      setSuccess("MFA has been disabled.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to disable MFA");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRecovery = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await API.post("/auth/mfa/generate-recovery");
      setRecoveryCodes(res.data.recoveryCodes);
      setShowRecovery(true);
      setSuccess(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to generate recovery codes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mfa-settings-page">
      <div className="mfa-card">
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        <h2>Multi-Factor Authentication</h2>
        <Alert message={error} type="error" onClose={() => setError("")} />
        <Alert message={success} type="success" onClose={() => setSuccess("")} />

        <div className="mfa-status">
          <strong>Status:</strong>{" "}
          <span className={mfaEnabled ? "status-enabled" : "status-disabled"}>
            {mfaEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        {!mfaEnabled && !showQr && (
          <button onClick={handleGenerate} disabled={loading} className="mfa-btn">
            {loading ? "Generating..." : "Set Up MFA"}
          </button>
        )}

        {showQr && qrCode && (
          <div className="mfa-setup">
            <p>Scan this QR code with your authenticator app (e.g. Google Authenticator, Authy):</p>
            <img src={qrCode} alt="MFA QR Code" className="mfa-qr" />
            <p className="mfa-secret">Or enter this key manually: <code>{secret}</code></p>
            <form onSubmit={handleVerifyEnable}>
              <input
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter 6-digit code"
                maxLength={6}
                required
              />
              <button type="submit" disabled={loading || verifyCode.length < 6} className="mfa-btn">
                {loading ? "Verifying..." : "Enable MFA"}
              </button>
            </form>
          </div>
        )}

        {mfaEnabled && !showDisable && (
          <div className="mfa-actions">
            <button onClick={() => setShowDisable(true)} className="mfa-btn mfa-btn-danger">
              Disable MFA
            </button>
            <button onClick={handleGenerateRecovery} disabled={loading} className="mfa-btn">
              {loading ? "Generating..." : "Generate Recovery Codes"}
            </button>
          </div>
        )}

        {showRecovery && recoveryCodes && (
          <div className="mfa-recovery">
            <p className="recovery-warning">
              ⚠️ Save these codes in a secure place. You will not see them again.
              Each code can only be used once.
            </p>
            <div className="recovery-codes">
              {recoveryCodes.map((code, i) => (
                <code key={i}>{code}</code>
              ))}
            </div>
            <button onClick={() => setShowRecovery(false)} className="mfa-btn">
              I've Saved These Codes
            </button>
          </div>
        )}

        {showDisable && (
          <div className="mfa-disable">
            <p>Enter your password to disable MFA:</p>
            <form onSubmit={handleDisable}>
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Your password"
                required
              />
              <button type="submit" disabled={loading || !disablePassword} className="mfa-btn mfa-btn-danger">
                {loading ? "Disabling..." : "Confirm Disable"}
              </button>
              <button type="button" onClick={() => setShowDisable(false)} className="mfa-btn mfa-btn-cancel">
                Cancel
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default MfaSettings;