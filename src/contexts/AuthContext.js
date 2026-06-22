import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [mfaPending, setMfaPending] = useState(null);

  useEffect(() => {
    const syncAuth = () => {
      const storedUser = localStorage.getItem("user");
      const storedToken = localStorage.getItem("token");
      setUser(storedUser ? JSON.parse(storedUser) : null);
      setToken(storedToken || null);
    };

    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, []);

  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", authToken);
    setMfaPending(null);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setMfaPending(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  const setMfaChallenge = (data) => {
    setMfaPending(data);
  };

  return (
    <AuthContext.Provider value={{ user, token, mfaPending, login, logout, setMfaChallenge }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);