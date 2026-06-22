import React, { createContext, useContext, useState, useCallback } from "react";

const AnnounceContext = createContext(() => {});

export const AnnounceProvider = ({ children }) => {
  const [message, setMessage] = useState("");
  const [key, setKey] = useState(0);

  const announce = useCallback((msg) => {
    setMessage(msg);
    setKey((k) => k + 1);
  }, []);

  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div
        id="sr-announcements"
        aria-live="polite"
        aria-atomic="true"
        style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
      >
        <span key={key}>{message}</span>
      </div>
    </AnnounceContext.Provider>
  );
};

export const useAnnounce = () => useContext(AnnounceContext);
