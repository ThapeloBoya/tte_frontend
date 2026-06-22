import React, { useEffect } from "react";

const Alert = ({ message, type, onClose }) => {
  useEffect(() => {
    if (!message || !onClose) return;
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className={`alert alert-${type || "error"}`}>
      <span>{message}</span>
      {onClose && <button className="alert-close" onClick={onClose}>&times;</button>}
    </div>
  );
};

export default Alert;
