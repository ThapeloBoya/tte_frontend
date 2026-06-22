import axios from "axios";

// Use live backend URL from environment variable or fallback to localhost
const API = axios.create({
  baseURL: `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api`,
});

// Add JWT token automatically to requests
API.interceptors.request.use(
  (config) => {
    try {
      const storedToken = localStorage.getItem("token");
      if (storedToken && storedToken !== "undefined") {
        config.headers.Authorization = `Bearer ${storedToken}`;
      }
    } catch (err) {
      console.warn("Failed to read token from localStorage", err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default API;
