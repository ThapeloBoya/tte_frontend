import React, { useState, useRef, useEffect } from "react";
import { useNotifications } from "../contexts/NotificationContext";
import "../styles/NotificationBell.css";

const NotificationBell = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="notif-bell-wrap" ref={ref}>
      <button className="notif-bell-btn" onClick={() => setOpen(!open)} aria-label="Notifications">
        🔔
        {unreadCount > 0 && <span className="notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <strong>Notifications</strong>
            {unreadCount > 0 && (
              <button className="notif-mark-all" onClick={markAllAsRead}>Mark all read</button>
            )}
          </div>

          <div className="notif-dropdown-body">
            {loading && notifications.length === 0 && (
              <div className="notif-empty">Loading...</div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="notif-empty">No notifications</div>
            )}
            {notifications.slice(0, 30).map((n) => (
              <div
                key={n._id}
                className={`notif-item ${n.read ? "read" : "unread"}`}
                onClick={() => { markAsRead(n._id); setOpen(false); }}
              >
                <div className="notif-item-title">{n.title}</div>
                <div className="notif-item-msg">{n.message}</div>
                <div className="notif-item-time">{new Date(n.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
