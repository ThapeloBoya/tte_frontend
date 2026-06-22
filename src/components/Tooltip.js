import React, { useState } from "react";

const Tooltip = ({ text, children, position = "top" }) => {
  const [visible, setVisible] = useState(false);

  const positions = {
    top: { bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 6 },
    bottom: { top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 6 },
    left: { right: "100%", top: "50%", transform: "translateY(-50%)", marginRight: 6 },
    right: { left: "100%", top: "50%", transform: "translateY(-50%)", marginLeft: 6 },
  };

  const pos = positions[position] || positions.top;

  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "pointer" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      tabIndex={0}
      role="button"
      aria-label={text}
    >
      {children}
      {visible && text && (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            ...pos,
            zIndex: 3000,
            padding: "6px 10px",
            borderRadius: 6,
            background: "#1e293b",
            color: "#fff",
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.4,
            minWidth: 160,
            maxWidth: 280,
            width: "max-content",
            whiteSpace: "normal",
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
            pointerEvents: "none",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
};

export default Tooltip;
