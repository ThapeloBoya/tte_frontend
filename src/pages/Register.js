import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../services/api";
import { sanitizeInput } from "../utils/sanitize";
import "../styles/Login.css";

const Register = () => {
  const [form, setForm] = useState({ name: "", email: "", phone: "", licenseNumber: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: sanitizeInput(e.target.value) });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) return setError("Passwords do not match.");
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");

    setLoading(true);
    try {
      const res = await API.post("/auth/register", {
        name: form.name,
        email: form.email,
        password: form.password,
        role: "driver",
      });

      const user = { _id: res.data._id, name: res.data.name, email: res.data.email, role: res.data.role };
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("token", res.data.token);

      navigate("/driver");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <img src="/logo.png" alt="Logo" />
        <h2>Driver Registration</h2>
        {error && <p className="login-error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <input name="name" placeholder="Full name" value={form.name} onChange={handleChange} required />
          <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required />
          <input name="phone" placeholder="Phone number" value={form.phone} onChange={handleChange} />
          <input name="licenseNumber" placeholder="License number" value={form.licenseNumber} onChange={handleChange} />
          <input name="password" type="password" placeholder="Password (min 6 chars)" value={form.password} onChange={handleChange} required />
          <input name="confirm" type="password" placeholder="Confirm password" value={form.confirm} onChange={handleChange} required />
          <button type="submit" disabled={loading}>{loading ? "Registering..." : "Register"}</button>
        </form>
        <p className="login-footer">
          Already have an account? <Link to="/">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
