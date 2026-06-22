import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Inter, sans-serif",
      background: "#f5f7fa",
      color: "#1a1a2e",
    }}>
      <h1 style={{ fontSize: "6rem", margin: 0, color: "#e74c3c" }}>404</h1>
      <h2 style={{ margin: "0 0 0.5rem" }}>Page Not Found</h2>
      <p style={{ color: "#666", marginBottom: "2rem" }}>
        The page you're looking for doesn't exist.
      </p>
      <Link
        to="/"
        style={{
          padding: "0.75rem 2rem",
          background: "#1a1a2e",
          color: "#fff",
          textDecoration: "none",
          borderRadius: "6px",
          fontWeight: 600,
        }}
      >
        Go Home
      </Link>
    </div>
  );
}
