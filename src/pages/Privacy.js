import React from "react";
import { Link } from "react-router-dom";

const Privacy = () => (
  <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px", fontFamily: "Segoe UI, sans-serif" }}>
    <Link to="/" style={{ color: "#0f766e", textDecoration: "none", fontWeight: 600 }}>&larr; Back to Moova</Link>
    <h1 style={{ marginTop: 24 }}>Privacy Policy</h1>
    <p style={{ color: "#666", marginBottom: 32 }}>Last updated: June 2026</p>

    <h2>Information We Collect</h2>
    <p>When you request a demo or register for Moova, we collect your name, email address, company name, and any additional information you provide in your message.</p>

    <h2>How We Use Your Information</h2>
    <p>We use your information to respond to your demo request, provide access to the Moova platform, send service-related communications, and improve our product.</p>

    <h2>Data Protection</h2>
    <p>We implement industry-standard security measures including encryption of sensitive data at rest and in transit. Your data is stored securely and access is restricted to authorized personnel only.</p>

    <h2>Data Retention</h2>
    <p>We retain your personal data for as long as your account is active or as needed to provide you services. You may request deletion of your data at any time.</p>

    <h2>Third-Party Sharing</h2>
    <p>We do not sell your personal information. We may share data with service providers who assist in operating our platform (e.g., cloud hosting, email delivery) under strict confidentiality agreements.</p>

    <h2>Your Rights</h2>
    <p>You have the right to access, correct, or delete your personal data. Contact us at allielaura83@gmail.com to exercise these rights.</p>

    <h2>Contact</h2>
    <p>If you have questions about this policy, contact us at allielaura83@gmail.com.</p>
  </div>
);

export default Privacy;
