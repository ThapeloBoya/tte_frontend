import React from "react";
import { useSocket } from "../contexts/SocketContext";

const ConnectionStatus = () => {
  const { connected } = useSocket();

  return (
    <div
      className="connection-status"
      role="status"
      aria-live="polite"
      aria-label={connected ? "Connected to server" : "Disconnected from server"}
    >
      <span
        className={`connection-dot ${connected ? "connected" : "disconnected"}`}
      />
      <span className="connection-label">
        {connected ? "Live" : "Disconnected"}
      </span>
    </div>
  );
};

export default ConnectionStatus;
