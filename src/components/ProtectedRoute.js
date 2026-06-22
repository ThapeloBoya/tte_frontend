import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const ProtectedRoute = ({ allowedRoles, children }) => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/" />; // Not logged in
  if (!allowedRoles.includes(user.role)) return <Navigate to="/" />; // Role not allowed

  return children;
};

export default ProtectedRoute;
