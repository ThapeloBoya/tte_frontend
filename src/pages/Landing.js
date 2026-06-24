import React, { useState } from "react";

import "../styles/Landing.css";

const features = [
  { title: "Load Management", desc: "Full lifecycle tracking from waiting to completed with bulk operations and real-time updates." },
  { title: "Real-Time Tracking", desc: "Live GPS tracking of drivers and shipments with instant status changes via WebSockets." },
  { title: "Proof of Delivery", desc: "Auto-generated PDF PODs with line items, signatures, and company branding." },
  { title: "Multi-Factor Auth", desc: "TOTP-based MFA with recovery codes to keep your data secure." },
  { title: "Audit Trail", desc: "Every action logged immutably for full compliance and accountability." },
  { title: "Driver Self-Service", desc: "Drivers view assigned loads, update milestones, report issues, and upload PODs from their dashboard." },
];

const stats = [
  { value: "10,000+", label: "Loads Delivered" },
  { value: "99.9%", label: "Uptime" },
  { value: "500+", label: "Active Drivers" },
  { value: "24/7", label: "Support" },
];

const steps = [
  { step: 1, title: "Register Your Account", desc: "Sign up in under 2 minutes. Your Super Admin can then invite your team and assign roles." },
  { step: 2, title: "Deploy Your Fleet", desc: "Add trucks, onboard drivers, and manage customers — all from a single dashboard." },
  { step: 3, title: "Start Moving Freight", desc: "Create loads, assign drivers, track in real time, and auto-generate proof of delivery." },
];

const faqs = [
  {
    q: "What roles are available in Moova?",
    a: "Moova has four roles: Driver (self-service load management), Admin1 (full operational control), Admin2 (limited view and approval), and Super Admin (complete system access including user management).",
  },
  {
    q: "What can drivers do in Moova?",
    a: "Drivers can view their assigned loads, update milestones (arrived at pickup, loaded, arrived at delivery, completed), report issues, and upload proof of delivery documents from their dashboard.",
  },
  {
    q: "How does the proof of delivery work?",
    a: "Moova auto-generates a branded PDF document for every load. It includes the ticket number, customer info, delivery addresses, itemized table, and signature fields. The PDF is saved to the load record and can be accessed anytime.",
  },
  {
    q: "Is multi-factor authentication available?",
    a: "Yes. Moova supports TOTP-based MFA with recovery codes. Users can enable it from their account settings for an extra layer of security.",
  },
  {
    q: "Can I track my shipments in real time?",
    a: "Absolutely. Moova uses WebSocket connections to provide live status updates. You can see exactly where a load is and what stage it's in — from waiting to completed.",
  },
  {
    q: "What kind of reports are available?",
    a: "Moova provides reporting across loads, invoices, fuel expenses, and maintenance. Data can be exported to CSV, and dashboards include interactive charts for quick operational insights.",
  },
  {
    q: "How secure is my data?",
    a: "Moova uses field-level encryption for sensitive data, bcrypt with 12 salt rounds for passwords, JWT tokens for sessions, rate limiting, input sanitization, and a full immutable audit trail for compliance.",
  },
  {
    q: "Can I get SMS or WhatsApp notifications?",
    a: "Yes. Moova integrates with Twilio to send SMS and WhatsApp notifications to drivers, in addition to email alerts via SMTP.",
  },
];

const Landing = () => {
  const [openFaq, setOpenFaq] = useState(null);
  const [demoForm, setDemoForm] = useState({ name: "", email: "", company: "", message: "" });
  const [demoSent, setDemoSent] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const handleDemoChange = (e) => {
    setDemoForm({ ...demoForm, [e.target.name]: e.target.value });
  };

  const handleDemoSubmit = async (e) => {
    e.preventDefault();
    setDemoLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demoForm),
      });
      if (!res.ok) throw new Error("Failed");
      setDemoSent(true);
    } catch {
      alert("Something went wrong. Please try again or email us directly.");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="landing">
      <nav className="landing-nav" role="navigation" aria-label="Main navigation">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <img src="/logo.png" alt="Moova" />
            <span>Moova</span>
          </div>
          <button className="landing-nav-toggle" onClick={() => setNavOpen(!navOpen)} aria-label="Toggle navigation menu">
            {navOpen ? "\u2715" : "\u2630"}
          </button>
          <div className={`landing-nav-links ${navOpen ? "mobile-open" : ""}`}>
            <a href="#features" onClick={() => setNavOpen(false)}>Features</a>
            <a href="#how-it-works" onClick={() => setNavOpen(false)}>How It Works</a>
            <a href="#faq" onClick={() => setNavOpen(false)}>FAQ</a>
            <a href="https://wa.link/yio7h9" target="_blank" rel="noopener noreferrer" onClick={() => setNavOpen(false)}>Contact</a>
          </div>
          <div className={`landing-nav-cta ${navOpen ? "mobile-open" : ""}`}>
            <a href="#demo" className="landing-btn landing-btn-primary" onClick={() => setNavOpen(false)}>Request a Demo</a>
            <a href="https://wa.link/yio7h9" className="landing-btn landing-btn-outline" target="_blank" rel="noopener noreferrer" onClick={() => setNavOpen(false)}>Contact Us</a>
          </div>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-bg" />
        <div className="landing-hero-content">
          <h1>Enterprise Transport Management, Simplified</h1>
          <p>Moova gives you full control over your fleet, loads, drivers, and deliveries — all in one platform with real-time visibility.</p>
          <div className="landing-hero-cta">
            <a href="#demo" className="landing-btn landing-btn-primary landing-btn-lg">Request a Demo</a>
            <a href="https://wa.link/yio7h9" className="landing-btn landing-btn-outline landing-btn-lg" target="_blank" rel="noopener noreferrer">Contact Us</a>
          </div>
        </div>
      </section>

      <section className="landing-stats-bar">
        {stats.map((s, i) => (
          <div key={i} className="landing-stat">
            <span className="landing-stat-value">{s.value}</span>
            <span className="landing-stat-label">{s.label}</span>
          </div>
        ))}
      </section>

      <section id="features" className="landing-section">
        <h2>Everything You Need to Move Freight</h2>
        <p className="landing-section-sub">From load creation to proof of delivery — manage your entire operation from one dashboard.</p>
        <div className="landing-features">
          {features.map((f, i) => (
            <div key={i} className="landing-feature-card">
              <div className="landing-feature-icon">{i + 1}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="landing-section">
        <h2>How It Works</h2>
        <p className="landing-section-sub">Get up and running in minutes.</p>
        <div className="landing-steps">
          {steps.map((s, i) => (
            <div key={i} className="landing-step">
              <div className="landing-step-number">{s.step}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="landing-section landing-section-alt">
        <h2>Frequently Asked Questions</h2>
        <p className="landing-section-sub">Quick answers to common questions about Moova.</p>
        <div className="landing-faq">
          {faqs.map((item, i) => (
            <div key={i} className={`landing-faq-item ${openFaq === i ? "open" : ""}`}>
              <button className="landing-faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i} aria-label={item.q}>
                <span>{item.q}</span>
                <span className="landing-faq-arrow">{openFaq === i ? "\u2212" : "+"}</span>
              </button>
              <div className="landing-faq-answer">
                <p>{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="demo" className="landing-section landing-demo">
        <h2>See Moova in Action</h2>
        <p className="landing-section-sub">Book a personalized walkthrough with our team. We'll show you how Moova fits your operation.</p>
        {demoSent ? (
          <div className="landing-demo-success">
            <h3>Thank you!</h3>
            <p>We've received your request and will be in touch within 24 hours to schedule your demo.</p>
            <button className="landing-btn landing-btn-outline" onClick={() => { setDemoSent(false); setDemoForm({ name: "", email: "", company: "", message: "" }); }} style={{ marginTop: 20 }}>
              Send Another Request
            </button>
          </div>
        ) : (
          <form className="landing-demo-form" onSubmit={handleDemoSubmit}>
            <input name="name" placeholder="Full Name" required value={demoForm.name} onChange={handleDemoChange} />
            <input name="email" type="email" placeholder="Work Email" required value={demoForm.email} onChange={handleDemoChange} />
            <input name="company" placeholder="Company Name" required value={demoForm.company} onChange={handleDemoChange} />
            <textarea name="message" placeholder="Tell us about your operation (optional)" rows={4} value={demoForm.message} onChange={handleDemoChange} />
            <button type="submit" className="landing-btn landing-btn-primary landing-btn-lg" disabled={demoLoading}>
              {demoLoading ? "Sending..." : "Request a Demo"}
            </button>
          </form>
        )}
      </section>

      <section className="landing-cta">
        <h2>Ready to Streamline Your Transport Operations?</h2>
        <p>Join thousands of businesses using Moova to manage their fleet and deliveries.</p>
        <a href="#demo" className="landing-btn landing-btn-primary landing-btn-lg">Request a Demo</a>
      </section>

      <footer id="contact" className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <img src="/logo.png" alt="Moova logo" />
            <p>Enterprise transport management made simple.</p>
          </div>
          <div className="landing-footer-links">
            <h4>Product</h4>
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
          </div>
          <div className="landing-footer-links">
            <h4>Support</h4>
            <a href="#faq">FAQ</a>
            <a href="#demo">Request a Demo</a>
            <a href="/forgot-password">Forgot Password?</a>
            <a href="https://wa.link/yio7h9" target="_blank" rel="noopener noreferrer">Contact Us</a>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <p>&copy; {new Date().getFullYear()} Moova. All rights reserved.</p>
          <a href="/privacy" className="landing-footer-bottom-link">Privacy Policy</a>
          <a href="/terms" className="landing-footer-bottom-link">Terms of Service</a>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
