import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const OAuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get("token");
    const name = searchParams.get("name");
    const email = searchParams.get("email");
    const role = searchParams.get("role");

    if (token && name && email && role) {
      const user = { _id: "", name, email, role };
      login(user, token);

      switch (role) {
        case "superadmin": navigate("/dashboard"); break;
        case "admin1": navigate("/admin1"); break;
        case "admin2": navigate("/admin2"); break;
        case "driver": navigate("/driver"); break;
        default: navigate("/");
      }
    } else {
      navigate("/login?error=oauth_failed");
    }
  }, [searchParams, login, navigate]);

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Completing sign in...</h2>
        <p>Please wait while we redirect you.</p>
      </div>
    </div>
  );
};

export default OAuthCallback;