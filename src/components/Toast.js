import React, { useEffect, useRef } from "react";
import "../styles/Toast.css";

const Toast = ({ notification, onDismiss }) => {
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timerRef.current);
  }, [onDismiss]);

  if (!notification) return null;

  return (
    <div className="toast-container" onClick={onDismiss}>
      <div className="toast-icon">🔔</div>
      <div className="toast-body">
        <strong>{notification.title}</strong>
        <p>{notification.message}</p>
      </div>
      <button className="toast-close" onClick={(e) => { e.stopPropagation(); onDismiss(); }}>✕</button>
    </div>
  );
};

export default Toast;
