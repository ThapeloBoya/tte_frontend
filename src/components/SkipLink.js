import React from "react";

const SkipLink = () => (
  <a
    href="#main-content"
    style={{
      position: "absolute",
      top: "-100px",
      left: 0,
      zIndex: 10000,
      padding: "10px 16px",
      background: "#0f766e",
      color: "#fff",
      fontSize: 14,
      fontWeight: 700,
      textDecoration: "none",
      borderRadius: "0 0 8px 0",
    }}
    onFocus={(e) => { e.target.style.top = "0"; }}
    onBlur={(e) => { e.target.style.top = "-100px"; }}
  >
    Skip to main content
  </a>
);

export default SkipLink;
