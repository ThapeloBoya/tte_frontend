import React from "react";
import { Link } from "react-router-dom";

const Terms = () => (
  <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px", fontFamily: "Segoe UI, sans-serif" }}>
    <Link to="/" style={{ color: "#0f766e", textDecoration: "none", fontWeight: 600 }}>&larr; Back to Moova</Link>
    <h1 style={{ marginTop: 24 }}>Terms of Service</h1>
    <p style={{ color: "#666", marginBottom: 32 }}>Last updated: June 2026</p>

    <h2>Acceptance of Terms</h2>
    <p>By accessing or using Moova, you agree to be bound by these Terms of Service. If you do not agree, do not use the platform.</p>

    <h2>Description of Service</h2>
    <p>Moova provides a transport management platform including load management, real-time tracking, proof of delivery, and related features.</p>

    <h2>User Accounts</h2>
    <p>You are responsible for maintaining the confidentiality of your login credentials and for all activities under your account. You must notify us immediately of any unauthorized use.</p>

    <h2>Acceptable Use</h2>
    <p>You agree not to misuse the platform, including attempting to access data not intended for you, disrupting service, or using the platform for unlawful purposes.</p>

    <h2>Data Ownership</h2>
    <p>You retain ownership of the data you enter into the platform. We claim no intellectual property rights over your data.</p>

    <h2>Limitation of Liability</h2>
    <p>Moova is provided "as is" without warranties of any kind. We are not liable for damages arising from use of the platform, including loss of data or business interruption.</p>

    <h2>Termination</h2>
    <p>We reserve the right to suspend or terminate accounts for violations of these terms or for extended inactivity.</p>

    <h2>Changes</h2>
    <p>We may update these terms at any time. Continued use after changes constitutes acceptance of the new terms.</p>

    <h2>Contact</h2>
    <p>For questions about these terms, contact us at allielaura83@gmail.com.</p>
  </div>
);

export default Terms;
