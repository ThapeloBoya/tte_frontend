import API from "./api";

export const login = async (email, password) => {
  const res = await API.post("/auth/login", { email, password });
  return res.data;
};

export const register = async (name, email, password, role) => {
  const res = await API.post("/auth/register", { name, email, password, role });
  return res.data;
};

export const forgotPassword = async (email) => {
  const res = await API.post("/auth/forgot-password", { email });
  return res.data;
};

export const resetPassword = async (token, password) => {
  const res = await API.post(`/auth/reset-password/${token}`, { password });
  return res.data;
};

export const changePassword = async (currentPassword, newPassword) => {
  const res = await API.post("/auth/change-password", { currentPassword, newPassword });
  return res.data;
};
