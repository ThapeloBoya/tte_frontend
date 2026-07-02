// src/pages/DriverDashboard.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import "../styles/Admin1.css";
import "../styles/Driver.css";
import { sanitizeInput } from "../utils/sanitize";
import FormField from "../components/FormField";
import { required, validateForm } from "../utils/validation";
import ThemeToggle from "../components/ThemeToggle";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import NotificationBell from "../components/NotificationBell";
import ConnectionStatus from "../components/ConnectionStatus";
import Pagination from "../components/Pagination";
import Alert from "../components/Alert";
import { CardSkeleton } from "../components/LoadingSkeleton";
import usePolling from "../hooks/usePolling";
import socket from "../services/socket";
import SignatureCanvas from "react-signature-canvas";
import ChatDrawer from "../components/ChatDrawer";
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const BACKEND_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const PAGE_SIZE = 20;

const statusTone = {
  waiting: "warning",
  assigned: "warning",
  "in transit": "info",
  completed: "success",
  approved: "success",
  rejected: "danger",
  canceled: "danger",
  open: "danger",
  resolved: "success",
};

const Badge = ({ value }) => (
  <span className={`admin1-badge ${statusTone[value] || "neutral"}`}>{value || "unknown"}</span>
);

const mapLink = (location) =>
  location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}` : null;

const directionsLink = (from, to) => {
  if (!from || !to) return null;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&travelmode=driving`;
};

const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : "-");

const decodePolyline = (encoded) => {
  if (!encoded || typeof encoded !== "string") return [];
  const points = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
};

const DriverDashboard = () => {
  const { token, user, logout } = useAuth();
  const { t } = useTranslation();
  const driverEmail = user?.email;

  const navigate = useNavigate();
  const authHeaders = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [loads, setLoads] = useState([]);
  const [activePanel, setActivePanel] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [driverLocation, setDriverLocation] = useState(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formMsg, setFormMsg] = useState(null);
  const [issueForm, setIssueForm] = useState({ loadId: "", type: "delay", description: "" });
  const [profileForm, setProfileForm] = useState({ name: "", phone: "", licenseNumber: "" });
  const [profileErrors, setProfileErrors] = useState({});
  const [profileTouched, setProfileTouched] = useState({});
  const [issueErrors, setIssueErrors] = useState({});
  const [issueTouched, setIssueTouched] = useState({});
  const [tablePage, setTablePage] = useState(1);
  const [geofenceStatus, setGeofenceStatus] = useState(null);
  const [geofenceLoadId, setGeofenceLoadId] = useState(null);
  const [geofenceLoading, setGeofenceLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Camera state
  const [cameraLoadId, setCameraLoadId] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Signature state
  const [signatureLoadId, setSignatureLoadId] = useState(null);
  const [showSignature, setShowSignature] = useState(false);
  const sigRef = useRef(null);

  // Duty status
  const [dutyStatus, setDutyStatus] = useState("available");

  // Truck info
  const [truckInfo, setTruckInfo] = useState(null);
  const [truckAlerts, setTruckAlerts] = useState([]);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [notifUnread, setNotifUnread] = useState(0);

  // Fuel form
  const [fuelForm, setFuelForm] = useState({ liters: "", costPerLiter: "", vendor: "", notes: "" });

  // Documents
  const [documents, setDocuments] = useState([]);

  // Guided delivery workflow
  const [deliveryWizard, setDeliveryWizard] = useState({ loadId: null, step: "stops" });

  const fetchDriverProfile = useCallback(async () => {
    if (!token) return;

    try {
      const res = await API.get("/drivers/profile", authHeaders);
      setProfileForm({
        name: res.data.name || "",
        phone: res.data.phone || "",
        licenseNumber: res.data.licenseNumber || "",
      });
      setDutyStatus(res.data.status || "available");
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  }, [authHeaders, token]);

  const fetchTruckInfo = useCallback(async () => {
    if (!token) return;
    try {
      const res = await API.get("/drivers/my-truck", authHeaders);
      setTruckInfo(res.data.truck);
      setTruckAlerts(res.data.alerts || []);
    } catch (err) {
      console.error("Failed to fetch truck info:", err.response?.data || err.message);
    }
  }, [authHeaders, token]);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await API.get("/notifications", authHeaders);
      setNotifications(res.data.notifications || []);
      setNotifUnread(res.data.unread || 0);
    } catch (err) {
      console.error("Failed to fetch notifications:", err.response?.data || err.message);
    }
  }, [authHeaders, token]);

  const fetchDocuments = useCallback(async () => {
    if (!token) return;
    try {
      const res = await API.get("/drivers/my-documents", authHeaders);
      setDocuments(res.data.documents || []);
    } catch (err) {
      console.error("Failed to fetch documents:", err.response?.data || err.message);
    }
  }, [authHeaders, token]);

  const fetchData = useCallback(async () => {
    if (!driverEmail || !token) return;

    setLoading(true);
    setError("");

    try {
      const loadsRes = await API.get("/driver-loads/driver", authHeaders);
      setLoads(loadsRes.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch driver data.");
      console.error("Fetch error:", err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, driverEmail, token]);

  const saveDriverLocation = useCallback(
    async (lat, lng) => {
      try {
        await API.patch(
          "/drivers/location",
          {
            location: {
              type: "Point",
              coordinates: [lng, lat],
            },
          },
          authHeaders
        );
      } catch (err) {
        console.error("Failed to save driver location:", err.response?.data || err.message);
      }
    },
    [authHeaders]
  );

  useEffect(() => {
    fetchDriverProfile();
    fetchData();
    fetchTruckInfo();
    fetchNotifications();
    fetchDocuments();
  }, [fetchData, fetchDriverProfile, fetchTruckInfo, fetchNotifications, fetchDocuments]);

  useEffect(() => {
    if (!token) return;

    const handleLoadChange = () => fetchData();

    socket.on("loadCreated", handleLoadChange);
    socket.on("loadUpdated", handleLoadChange);
    socket.on("loadDeleted", handleLoadChange);
    socket.on("podUploaded", handleLoadChange);
    socket.on("notification", () => fetchNotifications());

    return () => {
      socket.off("loadCreated", handleLoadChange);
      socket.off("loadUpdated", handleLoadChange);
      socket.off("loadDeleted", handleLoadChange);
      socket.off("podUploaded", handleLoadChange);
      socket.off("notification", fetchNotifications);
    };
  }, [token, fetchData, fetchNotifications]);

  useEffect(() => {
    setTablePage(1);
  }, [activePanel]);

  usePolling(fetchData, 30000, Boolean(token));

  useEffect(() => {
    if (!navigator.geolocation || !token) {
      if (!navigator.geolocation) setLocationPermissionDenied(true);
      return;
    }

    const ping = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setDriverLocation({ lat: latitude, lng: longitude });
          saveDriverLocation(latitude, longitude);
        },
        (err) => {
          console.warn("Location unavailable:", err.message || err);
          setLocationPermissionDenied(true);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    };

    ping();
    const intervalId = setInterval(ping, 60000);
    return () => clearInterval(intervalId);
  }, [saveDriverLocation, token]);

  const waitingLoads = useMemo(() => loads.filter((load) => ["waiting", "assigned"].includes(load.status)), [loads]);
  const inTransitLoads = useMemo(() => loads.filter((load) => load.status === "in transit"), [loads]);
  const completedLoads = useMemo(() => loads.filter((load) => ["completed", "approved", "rejected"].includes(load.status)), [loads]);

  const metrics = useMemo(
    () => ({
      assigned: waitingLoads.length,
      inTransit: inTransitLoads.length,
      completed: completedLoads.length,
      podReady: completedLoads.filter((load) => load.podUrl).length,
      totalPackages: loads.reduce((sum, l) => sum + (Number(l.packages) || 0), 0),
    }),
    [completedLoads, inTransitLoads, loads, waitingLoads]
  );

  const latestLoad = useMemo(() => inTransitLoads[0] || waitingLoads[0] || completedLoads[0], [
    completedLoads,
    inTransitLoads,
    waitingLoads,
  ]);

  const filterLoads = useCallback(
    (items) => {
      const term = search.toLowerCase();
      if (!term) return items;

      return items.filter((load) =>
        [
          load.customer?.name,
          load.pickupLocation,
          load.deliveryLocation,
          load.truck?.registrationNumber,
          load.cargoType,
          load.status,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      );
    },
    [search]
  );

  const updateStatus = async (loadId, status) => {
    try {
      await API.patch(`/driver-loads/${loadId}`, { status }, authHeaders);
      await fetchData();
    } catch (err) {
      console.error("Status update failed:", err.response?.data || err.message);
      setFormMsg({ type: "error", text: "Failed to update status" });
    }
  };

  const handleGeneratePOD = async (loadId) => {
    try {
      const res = await API.post(`/driver-loads/${loadId}/generate-pod`, {}, authHeaders);
      setLoads((prev) =>
        prev.map((load) => (load._id === loadId ? { ...load, podUrl: res.data.podUrl } : load))
      );
      setFormMsg({ type: "success", text: "POD generated successfully. Open it from Completed Loads." });
    } catch (err) {
      console.error("Error generating POD:", err.response?.data || err.message);
      setFormMsg({ type: "error", text: "Failed to generate POD" });
    }
  };

  const updateMilestone = async (load, milestoneKey, nextStatus) => {
    try {
      const body = { milestones: { [milestoneKey]: new Date().toISOString() } };
      if (nextStatus && nextStatus !== load.status) body.status = nextStatus;
      await API.patch(`/driver-loads/${load._id}`, body, authHeaders);
      await fetchData();
    } catch (err) {
      console.error("Milestone update failed:", err.response?.data || err.message, err);
      setFormMsg({ type: "error", text: "Failed to update trip milestone" });
    }
  };

  const handlePODUpload = async (loadId, file) => {
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("pod", file);

      const res = await API.post(`/driver-loads/${loadId}/pod`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setLoads((prev) => prev.map((load) => (load._id === loadId ? res.data.load : load)));
    } catch (err) {
      console.error("POD upload failed:", err.response?.data || err.message);
      setFormMsg({ type: "error", text: "Failed to upload POD" });
    }
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    const { errors: issErrors, isValid: issIsValid } = validateForm({
      loadId: { value: issueForm.loadId, rules: [required], label: "Load" },
      description: { value: issueForm.description, rules: [required], label: "Description" },
    });
    setIssueErrors(issErrors);
    setIssueTouched({ loadId: true, description: true });
    if (!issIsValid) return;

    try {
      await API.patch(
        `/driver-loads/${issueForm.loadId}`,
        {
          driverIssue: {
            type: sanitizeInput(issueForm.type),
            description: sanitizeInput(issueForm.description),
            status: "open",
            reportedAt: new Date().toISOString(),
          },
        },
        authHeaders
      );

      setIssueForm({ loadId: "", type: "delay", description: "" });
      await fetchData();
      setFormMsg({ type: "success", text: "Issue reported to dispatch" });
    } catch (err) {
      console.error("Issue report failed:", err.response?.data || err.message);
      setFormMsg({ type: "error", text: "Failed to report issue" });
    }
  };

  const handleGeofenceCheck = async (loadId) => {
    if (!navigator.geolocation) {
      setFormMsg({ type: "error", text: "Geolocation not available" });
      return;
    }
    setGeofenceLoadId(loadId);
    setGeofenceLoading(true);
    setGeofenceStatus(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await API.post("/routes/geofence/check", {
            loadId,
            currentLat: pos.coords.latitude,
            currentLng: pos.coords.longitude,
          }, authHeaders);
          setGeofenceStatus(res.data);
        } catch (err) {
          setFormMsg({ type: "error", text: err.response?.data?.message || "Geofence check failed" });
        } finally {
          setGeofenceLoading(false);
        }
      },
      () => {
        setFormMsg({ type: "error", text: "Could not get your location. Check permissions." });
        setGeofenceLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const startCamera = async (loadId) => {
    setCameraLoadId(loadId);
    setCapturedImage(null);
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      setFormMsg({ type: "error", text: "Camera access denied. Check permissions." });
      setShowCamera(false);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      setCapturedImage(blob);
    }, "image/jpeg", 0.85);
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    setCameraStream(null);
    setCapturedImage(null);
    setCameraLoadId(null);
    setShowCamera(false);
  };

  const uploadCapturedPhoto = async () => {
    if (!capturedImage || !cameraLoadId) return;
    try {
      const formData = new FormData();
      formData.append("photo", capturedImage, `photo-${cameraLoadId}.jpg`);
      await API.post(`/driver-loads/${cameraLoadId}/photo`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });
      setFormMsg({ type: "success", text: "Delivery photo saved" });
      stopCamera();
      fetchData();
    } catch (err) {
      console.error("Photo upload failed:", err.response?.data || err.message);
      setFormMsg({ type: "error", text: "Failed to upload photo" });
    }
  };

  const openSignature = (loadId) => {
    setSignatureLoadId(loadId);
    setShowSignature(true);
  };

  const clearSignature = () => {
    if (sigRef.current) sigRef.current.clear();
  };

  const saveSignature = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setFormMsg({ type: "error", text: "Please sign before saving" });
      return;
    }
    if (!signatureLoadId) return;
    try {
      const blob = await new Promise(resolve => sigRef.current.getCanvas().toBlob(resolve, "image/png"));
      const formData = new FormData();
      formData.append("signature", blob, `signature-${signatureLoadId}.png`);
      await API.post(`/driver-loads/${signatureLoadId}/signature`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });
      setFormMsg({ type: "success", text: "Signature saved" });
      setShowSignature(false);
      setSignatureLoadId(null);
      fetchData();
    } catch (err) {
      console.error("Signature save failed:", err.response?.data || err.message);
      setFormMsg({ type: "error", text: "Failed to save signature" });
    }
  };

  const updateDutyStatus = async (status) => {
    try {
      await API.patch("/drivers/duty-status", { status }, authHeaders);
      setDutyStatus(status);
      setFormMsg({ type: "success", text: `Status set to ${status}` });
    } catch (err) {
      setFormMsg({ type: "error", text: "Failed to update duty status" });
    }
  };

  const handleStopAction = async (loadId, stopIndex, action) => {
    try {
      await API.patch(`/driver-loads/${loadId}/stops/${stopIndex}`, { action }, authHeaders);
      await fetchData();
      setFormMsg({ type: "success", text: `Stop ${action === "arrive" ? "arrival" : "departure"} recorded` });
    } catch (err) {
      setFormMsg({ type: "error", text: "Failed to update stop" });
    }
  };

  const handleDeliveryCheckoff = async (loadId, deliveryIndex) => {
    try {
      await API.patch(`/driver-loads/${loadId}/deliveries/${deliveryIndex}`, {}, authHeaders);
      await fetchData();
      setFormMsg({ type: "success", text: "Delivery item marked as delivered" });
    } catch (err) {
      setFormMsg({ type: "error", text: "Failed to update delivery" });
    }
  };

  const handleFuelSubmit = async (e) => {
    e.preventDefault();
    if (!fuelForm.liters || !fuelForm.costPerLiter) {
      setFormMsg({ type: "error", text: "Liters and cost per liter are required" });
      return;
    }
    try {
      await API.post("/driver-loads/fuel", fuelForm, authHeaders);
      setFuelForm({ liters: "", costPerLiter: "", vendor: "", notes: "" });
      setFormMsg({ type: "success", text: "Fuel logged successfully" });
    } catch (err) {
      setFormMsg({ type: "error", text: err.response?.data?.message || "Failed to log fuel" });
    }
  };

  const markNotifRead = async (id) => {
    try {
      await API.patch(`/notifications/${id}/read`, {}, authHeaders);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
      setNotifUnread((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification read");
    }
  };

  const startDeliveryWizard = (loadId) => {
    setDeliveryWizard({ loadId, step: "stops" });
    setActivePanel("delivery");
  };

  const navItems = [
    ["overview", "nav.overview", "📊"],
    ["assigned", "Assigned", "📋"],
    ["active", "status.inTransit", "🚚"],
    ["delivery", "Delivery", "📦"],
    ["completed", "status.completed", "✅"],
    ["fuel", "Fuel", "⛽"],
    ["issues", "nav.issues", "⚠️"],
    ["notifications", "Alerts", "🔔"],
    ["profile", "nav.profile", "👤"],
  ];

  const closeSidebar = () => setSidebarOpen(false);

  const renderLoadTable = (items, emptyText, actionRenderer, showPod = false) => {
    const rows = filterLoads(items);
    const start = (tablePage - 1) * PAGE_SIZE;
    const pageRows = rows.slice(start, start + PAGE_SIZE);

    if (rows.length === 0) {
      return <div className="admin1-empty">{emptyText}</div>;
    }

    return (
      <>
        <div className="admin1-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Pickup</th>
                <th>Delivery</th>
                <th>Dist</th>
                <th>ETA</th>
                <th>Contact</th>
                <th>Truck</th>
                <th>Status</th>
                <th>Pkgs</th>
                {showPod && <th>POD</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((load) => (
                <tr key={load._id}>
                  <td>{load.customer?.name || "Unassigned"}</td>
                  <td>
                    {mapLink(load.pickupLocation) ? (
                      <a href={mapLink(load.pickupLocation)} target="_blank" rel="noopener noreferrer">
                        {load.pickupLocation}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    {mapLink(load.deliveryLocation) ? (
                      <a href={mapLink(load.deliveryLocation)} target="_blank" rel="noopener noreferrer">
                        {load.deliveryLocation}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td style={{ fontSize: "0.8rem" }}>{load.routeDistance ? `${load.routeDistance} km` : "-"}</td>
                  <td style={{ fontSize: "0.8rem" }}>{load.routeDuration ? `${load.routeDuration} min` : "-"}</td>
                  <td>{load.customer?.phone || load.customer?.email || "-"}</td>
                  <td>{load.truck?.registrationNumber || "No truck"}</td>
                  <td>
                    <Badge value={load.status} />
                  </td>
                  <td style={{ textAlign: "center" }}>{load.packages ?? "-"}</td>
                  {showPod && (
                    <td>{load.podUrl ? <span className="driver-ready">Ready</span> : "Not generated"}</td>
                  )}
                  <td>
                    {actionRenderer(load)}
                    {directionsLink(load.pickupLocation, load.deliveryLocation) && (
                      <button className="admin1-btn-sm" onClick={() => window.open(directionsLink(load.pickupLocation, load.deliveryLocation), "_blank")}>
                        Route
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={tablePage}
          pages={Math.ceil(rows.length / PAGE_SIZE)}
          onPageChange={setTablePage}
        />
      </>
    );
  };

  if (!driverEmail || !token) {
    return <CardSkeleton count={2} />;
  }

  return (
    <div className="admin1-layout">
      <div className="admin1-mobile-bar">
        <button className="admin1-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          ☰
        </button>
        <img src="/logo_white.png" alt="Logo" />
      </div>

      {sidebarOpen && <div className="admin1-overlay" onClick={closeSidebar} />}

      <aside className={`admin1-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="admin1-logo">
          <img src="/logo_white.png" alt="FleetFlow" />
        </div>

        <nav>
          {navItems.map(([id, labelKey, icon]) => (
            <button
              key={id}
              className={activePanel === id ? "active" : ""}
              onClick={() => {
                setActivePanel(id);
                closeSidebar();
              }}
            >
              <span className="admin1-nav-icon">{icon}</span>
              {t(labelKey)}
            </button>
          ))}
        </nav>

        <div className="admin1-sidebar-footer">
          <ThemeToggle />
          <LanguageSwitcher />
          <button className="admin1-nav-link" onClick={() => navigate("/mfa-settings")}>
            MFA Settings
          </button>
          <button className="admin1-nav-link" onClick={() => navigate("/change-password")}>
            Change Password
          </button>
          <button className="admin1-nav-link" onClick={() => setChatOpen(true)}>
            Chat
          </button>
          <button className="admin1-logout" onClick={logout}>
            {t("auth.logout")}
          </button>
          <span>Driver Workspace</span>
        </div>
      </aside>

      <main className="admin1-main">
        <header className="admin1-topbar">
          <div>
            <span className="admin1-eyebrow">{t("driver.profile")}</span>
            <h1>{t("dashboard.welcome")}, {user?.name || "Driver"}</h1>
          </div>
          <div className="admin1-topbar-actions">
            <input
              value={search}
              onChange={(e) => setSearch(sanitizeInput(e.target.value))}
              placeholder={t("common.search")}
            />
            <button className="btn" onClick={fetchData}>{loading ? t("common.loading") : t("common.refresh")}</button>
            <ConnectionStatus />
            <NotificationBell />
          </div>
        </header>

        {error && <div className="admin1-alert">{error}</div>}

        <Alert message={formMsg?.text} type={formMsg?.type} onClose={() => setFormMsg(null)} />

        <section className="admin1-kpis">
          <div className="admin1-kpi-card">
            <span>Assigned</span>
            <strong>{metrics.assigned}</strong>
            <small>Ready to start</small>
          </div>
          <div className="admin1-kpi-card">
            <span>In Transit</span>
            <strong>{metrics.inTransit}</strong>
            <small>Active trips</small>
          </div>
          <div className="admin1-kpi-card">
            <span>Completed</span>
            <strong>{metrics.completed}</strong>
            <small>{metrics.podReady} POD ready</small>
          </div>
          <div className="admin1-kpi-card">
            <span>Packages</span>
            <strong>{metrics.totalPackages}</strong>
            <small>Total across loads</small>
          </div>
          <div className="admin1-kpi-card">
            <span>Location</span>
            <strong>{locationPermissionDenied ? "Off" : driverLocation ? "Live" : "Wait"}</strong>
            <small>{driverLocation ? "Tracking enabled" : "Awaiting GPS"}</small>
          </div>
        </section>

        {activePanel === "overview" && (
          <>
            <section className="driver-grid two">
              <div className="admin1-panel driver-trip-card">
                <div className="admin1-panel-header">
                  <div>
                    <span className="admin1-eyebrow">Current Focus</span>
                    <h2>{latestLoad ? "Next Trip" : "No Active Work"}</h2>
                  </div>
                  {latestLoad && <Badge value={latestLoad.status} />}
                </div>

                {latestLoad ? (
                  <div className="driver-route">
                    <div>
                      <span>Pickup</span>
                      <strong>
                        {mapLink(latestLoad.pickupLocation) ? (
                          <a href={mapLink(latestLoad.pickupLocation)} target="_blank" rel="noopener noreferrer">
                            {latestLoad.pickupLocation}
                          </a>
                        ) : (
                          "-"
                        )}
                      </strong>
                    </div>
                    <div>
                      <span>Delivery</span>
                      <strong>
                        {mapLink(latestLoad.deliveryLocation) ? (
                          <a href={mapLink(latestLoad.deliveryLocation)} target="_blank" rel="noopener noreferrer">
                            {latestLoad.deliveryLocation}
                          </a>
                        ) : (
                          "-"
                        )}
                      </strong>
                    </div>
                    <div>
                      <span>Customer</span>
                      <strong>{latestLoad.customer?.name || "Unassigned"}</strong>
                    </div>
                    <div>
                      <span>Contact</span>
                      <strong>{latestLoad.customer?.phone || latestLoad.customer?.email || "-"}</strong>
                    </div>
                    <div>
                      <span>Truck</span>
                      <strong>{latestLoad.truck?.registrationNumber || "No truck"}</strong>
                    </div>
                    <div>
                      <span>Ticket</span>
                      <strong>{latestLoad.ticketNumber || "-"}</strong>
                    </div>
                    <div>
                      <span>Distance</span>
                      <strong>{latestLoad.routeDistance ? `${latestLoad.routeDistance} km` : "-"}</strong>
                    </div>
                    <div>
                      <span>ETA</span>
                      <strong>{latestLoad.routeDuration ? `${latestLoad.routeDuration} min` : "-"}</strong>
                    </div>
                    <div>
                      <span>Packages</span>
                      <strong>{latestLoad.packages ?? "-"}</strong>
                    </div>
                    {directionsLink(latestLoad.pickupLocation, latestLoad.deliveryLocation) && (
                      <button className="btn" style={{ marginTop: "0.5rem" }} onClick={() => window.open(directionsLink(latestLoad.pickupLocation, latestLoad.deliveryLocation), "_blank")}>
                        Navigate
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="admin1-empty">You do not have any loads yet.</div>
                )}
              </div>

              <div className="admin1-panel">
                <div className="admin1-panel-header">
                  <div>
                    <span className="admin1-eyebrow">Status</span>
                    <h2>Trip Summary</h2>
                  </div>
                </div>
                <div className="driver-status-list">
                  <div>
                    <Badge value="waiting" />
                    <strong>{metrics.assigned}</strong>
                  </div>
                  <div>
                    <Badge value="in transit" />
                    <strong>{metrics.inTransit}</strong>
                  </div>
                  <div>
                    <Badge value="completed" />
                    <strong>{metrics.completed}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="admin1-panel">
              <div className="admin1-panel-header">
                <div>
                  <span className="admin1-eyebrow">Assigned Work</span>
                  <h2>Loads To Start</h2>
                </div>
                <button className="btn" onClick={() => setActivePanel("assigned")}>View Assigned</button>
              </div>
              {renderLoadTable(waitingLoads, "No assigned loads.", (load) => (
                <button className="btn admin1-action" onClick={() => { if (window.confirm("Start this trip?")) updateStatus(load._id, "in transit"); }}>
                  Start Trip
                </button>
              ))}
            </section>
          </>
        )}

        {activePanel === "assigned" && (
          <section className="admin1-panel">
            <div className="admin1-panel-header">
              <div>
                <span className="admin1-eyebrow">Dispatch</span>
                <h2>Assigned Loads</h2>
              </div>
            </div>
            {renderLoadTable(waitingLoads, "No assigned loads.", (load) => (
              <button className="btn admin1-action" onClick={() => { if (window.confirm("Start this trip?")) updateStatus(load._id, "in transit"); }}>
                Start Trip
              </button>
            ))}
          </section>
        )}

        {activePanel === "active" && (
          <section className="admin1-panel">
            <div className="admin1-panel-header">
              <div>
                <span className="admin1-eyebrow">On Road</span>
                <h2>In Transit</h2>
              </div>
            </div>
            {filterLoads(inTransitLoads).length === 0 ? (
              <div className="admin1-empty">No loads in transit.</div>
            ) : (
              <div className="driver-trip-list">
                {filterLoads(inTransitLoads).map((load) => (
                  <div className="driver-trip-panel" key={load._id}>
                    <div className="admin1-panel-header">
                      <div>
                        <span className="admin1-eyebrow">{load.customer?.name || "Customer"}</span>
                        <h2>{load.pickupLocation} to {load.deliveryLocation}</h2>
                      </div>
                      <Badge value={load.status} />
                    </div>

                    <div className="driver-route">
                      <div>
                        <span>Pickup</span>
                        <strong>
                          <a href={mapLink(load.pickupLocation) || "#"} target="_blank" rel="noopener noreferrer">
                            Open Pickup Map
                          </a>
                        </strong>
                      </div>
                      <div>
                        <span>Delivery</span>
                        <strong>
                          <a href={mapLink(load.deliveryLocation) || "#"} target="_blank" rel="noopener noreferrer">
                            Open Delivery Map
                          </a>
                        </strong>
                      </div>
                      <div>
                        <span>Customer Contact</span>
                        <strong>{load.customer?.phone || load.customer?.email || "-"}</strong>
                      </div>
                      <div>
                        <span>Truck</span>
                        <strong>{load.truck?.registrationNumber || "No truck"}</strong>
                      </div>
                      <div>
                        <span>Distance</span>
                        <strong>{load.routeDistance ? `${load.routeDistance} km` : "-"}</strong>
                      </div>
                      <div>
                        <span>ETA</span>
                      <strong>{load.routeDuration ? `${load.routeDuration} min` : "-"}</strong>
                    </div>
                    <div>
                      <span>Packages</span>
                      <strong>{load.packages ?? "-"}</strong>
                    </div>
                  </div>

                    {directionsLink(load.pickupLocation, load.deliveryLocation) && (
                      <button className="btn" style={{ margin: "0.5rem 0" }} onClick={() => window.open(directionsLink(load.pickupLocation, load.deliveryLocation), "_blank")}>
                        Navigate
                      </button>
                    )}

                    <div className="driver-milestones">
                      <button disabled={Boolean(load.milestones?.arrivedPickupAt)} onClick={() => updateMilestone(load, "arrivedPickupAt", "in transit")}>
                        Arrived Pickup
                      </button>
                      <button disabled={Boolean(load.milestones?.loadedAt)} onClick={() => updateMilestone(load, "loadedAt", "in transit")}>
                        Loaded
                      </button>
                      <button disabled={Boolean(load.milestones?.arrivedDeliveryAt)} onClick={() => updateMilestone(load, "arrivedDeliveryAt", "in transit")}>
                        Arrived Delivery
                      </button>
                      <button className="success" onClick={() => { if (window.confirm("Complete this trip?")) updateMilestone(load, "completedAt", "completed"); }}>
                        Complete Trip
                      </button>
                    </div>

                    <div className="driver-milestone-list">
                      <span>Pickup: {formatDateTime(load.milestones?.arrivedPickupAt)}</span>
                      <span>Loaded: {formatDateTime(load.milestones?.loadedAt)}</span>
                      <span>Delivery: {formatDateTime(load.milestones?.arrivedDeliveryAt)}</span>
                      <span>Complete: {formatDateTime(load.milestones?.completedAt)}</span>
                    </div>

                    <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                      <button className="admin1-btn-sm" onClick={() => handleGeofenceCheck(load._id)} disabled={geofenceLoading && geofenceLoadId === load._id}>
                        {geofenceLoading && geofenceLoadId === load._id ? "Checking..." : "Check Geofence"}
                      </button>
                      {geofenceStatus && geofenceStatus.loadId === load._id && geofenceStatus.geofences.map((gf, i) => (
                        <span key={i} className={`admin1-badge ${gf.withinGeofence ? "success" : "neutral"}`} style={{ fontSize: "0.7rem" }}>
                          {gf.type}: {gf.distanceKm}km {gf.withinGeofence ? "✓" : ""}
                        </span>
                      ))}
                    </div>

                    {/* Stops */}
                    {load.stops && load.stops.length > 0 && (
                      <div style={{ marginTop: "1rem" }}>
                        <h4 style={{ margin: "0 0 8px", fontSize: 14, color: "#475569" }}>Route Stops</h4>
                        <div style={{ display: "grid", gap: 6 }}>
                          {load.stops.sort((a, b) => a.sequence - b.sequence).map((stop, si) => (
                            <div key={si} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 6, background: "#f8fafc", border: "1px solid #f0f1f3", fontSize: 13 }}>
                              <div>
                                <strong style={{ textTransform: "capitalize" }}>{stop.type}</strong>
                                <span style={{ marginLeft: 8, color: "#64748b" }}>{stop.location}</span>
                                {stop.arrivedAt && <span style={{ marginLeft: 8, color: "#16a34a", fontSize: 11 }}>Arrived {formatDateTime(stop.arrivedAt)}</span>}
                              </div>
                              <div style={{ display: "flex", gap: 4 }}>
                                {!stop.arrivedAt && <button className="admin1-btn-sm" onClick={() => handleStopAction(load._id, si, "arrive")}>Arrive</button>}
                                {stop.arrivedAt && !stop.departedAt && <button className="admin1-btn-sm" onClick={() => handleStopAction(load._id, si, "depart")}>Depart</button>}
                                {stop.arrivedAt && <span className="admin1-badge success" style={{ fontSize: 10 }}>✓</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Deliveries */}
                    {load.deliveries && load.deliveries.length > 0 && (
                      <div style={{ marginTop: "1rem" }}>
                        <h4 style={{ margin: "0 0 8px", fontSize: 14, color: "#475569" }}>Delivery Items</h4>
                        <div style={{ display: "grid", gap: 6 }}>
                          {load.deliveries.map((item, di) => (
                            <div key={di} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 6, background: "#f8fafc", border: "1px solid #f0f1f3", fontSize: 13 }}>
                              <span>
                                {item.deliveryNumber && <strong>{item.deliveryNumber}</strong>}
                                {item.amount && <span> — {item.amount} units</span>}
                                {item.weight && <span> — {item.weight} kg</span>}
                              </span>
                              {item.status === "delivered" ? (
                                <span className="admin1-badge success" style={{ fontSize: 10 }}>Delivered</span>
                              ) : (
                                <button className="admin1-btn-sm" onClick={() => handleDeliveryCheckoff(load._id, di)}>Mark Delivered</button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Route Map */}
                    {load.routePolyline && (
                      <div style={{ marginTop: "1rem", height: 200, borderRadius: 8, overflow: "hidden" }}>
                        <MapContainer center={[load.pickupLat || 0, load.pickupLng || 0]} zoom={10} style={{ height: 200, width: "100%" }} key={load._id} dragging={false} scrollWheelZoom={false} touchZoom={false} doubleClickZoom={false}>
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                          {load.routePolyline && <Polyline positions={decodePolyline(load.routePolyline)} color="#6366f1" weight={3} />}
                          {load.pickupLat && load.pickupLng && <Marker position={[load.pickupLat, load.pickupLng]}><Popup>Pickup</Popup></Marker>}
                          {load.deliveryLat && load.deliveryLng && <Marker position={[load.deliveryLat, load.deliveryLng]}><Popup>Delivery</Popup></Marker>}
                        </MapContainer>
                      </div>
                    )}

                    <button className="btn" style={{ marginTop: "0.75rem" }} onClick={() => startDeliveryWizard(load._id)}>
                      Start Delivery Workflow
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activePanel === "delivery" && (
          <section className="driver-grid two">
            <div className="admin1-panel">
              <div className="admin1-panel-header">
                <div>
                  <span className="admin1-eyebrow">Guided Workflow</span>
                  <h2>Delivery Steps</h2>
                </div>
              </div>
              {deliveryWizard.loadId ? (
                (() => {
                  const load = loads.find((l) => l._id === deliveryWizard.loadId);
                  if (!load) return <div className="admin1-empty">Load not found</div>;
                  const step = deliveryWizard.step;
                  return (
                    <div className="driver-issue-form">
                      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                        {["stops", "deliveries", "photo", "signature", "complete"].map((s) => (
                          <button key={s} className={`admin1-btn-sm ${step === s ? "admin1-badge info" : ""}`} onClick={() => setDeliveryWizard((p) => ({ ...p, step: s }))} style={step === s ? { color: "#fff", background: "#6366f1", border: "none" } : {}}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </button>
                        ))}
                      </div>

                      {step === "stops" && (
                        <>
                          <h4 style={{ margin: "0 0 8px" }}>Route Stops</h4>
                          {load.stops && load.stops.length > 0 ? (
                            <div style={{ display: "grid", gap: 6 }}>
                              {load.stops.sort((a, b) => a.sequence - b.sequence).map((stop, si) => (
                                <div key={si} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 6, background: "#f8fafc", border: "1px solid #f0f1f3", fontSize: 13 }}>
                                  <div>
                                    <strong style={{ textTransform: "capitalize" }}>{stop.type}</strong>
                                    <span style={{ marginLeft: 8, color: "#64748b" }}>{stop.location}</span>
                                  </div>
                                  <div>
                                    {!stop.arrivedAt && <button className="admin1-btn-sm" onClick={() => handleStopAction(load._id, si, "arrive")}>Arrive</button>}
                                    {stop.arrivedAt && !stop.departedAt && <button className="admin1-btn-sm" onClick={() => handleStopAction(load._id, si, "depart")}>Depart</button>}
                                    {stop.arrivedAt && <span className="admin1-badge success" style={{ fontSize: 10 }}>✓ {formatDateTime(stop.arrivedAt)}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="admin1-empty">No stops for this load</div>
                          )}
                          <button className="btn" style={{ marginTop: 8 }} onClick={() => setDeliveryWizard((p) => ({ ...p, step: "deliveries" }))}>Next: Deliveries →</button>
                        </>
                      )}

                      {step === "deliveries" && (
                        <>
                          <h4 style={{ margin: "0 0 8px" }}>Delivery Items</h4>
                          {load.deliveries && load.deliveries.length > 0 ? (
                            <div style={{ display: "grid", gap: 6 }}>
                              {load.deliveries.map((item, di) => (
                                <div key={di} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 6, background: "#f8fafc", border: "1px solid #f0f1f3", fontSize: 13 }}>
                                  <span>
                                    {item.deliveryNumber && <strong>{item.deliveryNumber}</strong>}
                                    {item.amount && <span> — {item.amount} units</span>}
                                    {item.weight && <span> — {item.weight} kg</span>}
                                  </span>
                                  {item.status === "delivered" ? (
                                    <span className="admin1-badge success" style={{ fontSize: 10 }}>✓</span>
                                  ) : (
                                    <button className="admin1-btn-sm" onClick={() => handleDeliveryCheckoff(load._id, di)}>Deliver</button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="admin1-empty">No delivery items for this load</div>
                          )}
                          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <button className="btn" onClick={() => setDeliveryWizard((p) => ({ ...p, step: "stops" }))}>← Back</button>
                            <button className="btn" onClick={() => setDeliveryWizard((p) => ({ ...p, step: "photo" }))}>Next: Photo →</button>
                          </div>
                        </>
                      )}

                      {step === "photo" && (
                        <>
                          <h4 style={{ margin: "0 0 8px" }}>Delivery Photo</h4>
                          <div className="admin1-empty" style={{ padding: 20 }}>
                            <p style={{ margin: "0 0 12px" }}>Take a photo of the delivered items</p>
                            <button className="btn" onClick={() => startCamera(load._id)}>📷 Open Camera</button>
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <button className="btn" onClick={() => setDeliveryWizard((p) => ({ ...p, step: "deliveries" }))}>← Back</button>
                            <button className="btn" onClick={() => setDeliveryWizard((p) => ({ ...p, step: "signature" }))}>Next: Signature →</button>
                          </div>
                        </>
                      )}

                      {step === "signature" && (
                        <>
                          <h4 style={{ margin: "0 0 8px" }}>Customer Signature</h4>
                          <div className="admin1-empty" style={{ padding: 20 }}>
                            <p style={{ margin: "0 0 12px" }}>Get customer signature for delivery</p>
                            {load.signatureUrl ? (
                              <span className="admin1-badge success">✓ Signed</span>
                            ) : (
                              <button className="btn" onClick={() => openSignature(load._id)}>✍️ Open Signature Pad</button>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <button className="btn" onClick={() => setDeliveryWizard((p) => ({ ...p, step: "photo" }))}>← Back</button>
                            <button className="btn" onClick={() => setDeliveryWizard((p) => ({ ...p, step: "complete" }))}>Next: Complete →</button>
                          </div>
                        </>
                      )}

                      {step === "complete" && (
                        <>
                          <h4 style={{ margin: "0 0 8px" }}>Complete Delivery</h4>
                          <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 6, background: "#f8fafc" }}>
                              <span>Stops checked</span>
                              <strong>{load.stops ? load.stops.filter((s) => s.arrivedAt).length : 0}/{load.stops?.length || 0}</strong>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 6, background: "#f8fafc" }}>
                              <span>Items delivered</span>
                              <strong>{load.deliveries ? load.deliveries.filter((d) => d.status === "delivered").length : 0}/{load.deliveries?.length || 0}</strong>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 6, background: "#f8fafc" }}>
                              <span>Photo taken</span>
                              <strong>{load.capturedPhotoUrl ? "✓" : "✗"}</strong>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 6, background: "#f8fafc" }}>
                              <span>Signature</span>
                              <strong>{load.signatureUrl ? "✓" : "✗"}</strong>
                            </div>
                          </div>
                          <button className="btn success" style={{ background: "#16a34a" }} onClick={() => { if (window.confirm("Complete this trip?")) { updateMilestone(load, "completedAt", "completed"); setDeliveryWizard({ loadId: null, step: "stops" }); } }}>
                            ✓ Complete & Submit
                          </button>
                          <button className="btn" style={{ marginTop: 8, background: "#64748b" }} onClick={() => setDeliveryWizard((p) => ({ ...p, step: "signature" }))}>← Back</button>
                        </>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="driver-issue-form">
                  <p style={{ margin: "0 0 12px", color: "#64748b" }}>Select an in-transit load to start the delivery workflow.</p>
                  <select className="admin1-select" value={deliveryWizard.loadId || ""} onChange={(e) => setDeliveryWizard({ loadId: e.target.value, step: "stops" })}>
                    <option value="">Select a load...</option>
                    {inTransitLoads.map((load) => (
                      <option key={load._id} value={load._id}>{load.customer?.name} — {load.pickupLocation} to {load.deliveryLocation}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="admin1-panel">
              <div className="admin1-panel-header">
                <div>
                  <span className="admin1-eyebrow">Progress</span>
                  <h2>Completion Status</h2>
                </div>
              </div>
              {deliveryWizard.loadId ? (
                (() => {
                  const load = loads.find((l) => l._id === deliveryWizard.loadId);
                  if (!load) return <div className="admin1-empty">Load not found</div>;
                  return (
                    <div className="driver-status-list">
                      <div><span>Stops</span><strong>{load.stops ? load.stops.filter((s) => s.arrivedAt).length : 0}/{load.stops?.length || 0}</strong></div>
                      <div><span>Deliveries</span><strong>{load.deliveries ? load.deliveries.filter((d) => d.status === "delivered").length : 0}/{load.deliveries?.length || 0}</strong></div>
                      <div><span>Photo</span><strong>{load.capturedPhotoUrl ? "✓" : "—"}</strong></div>
                      <div><span>Signature</span><strong>{load.signatureUrl ? "✓" : "—"}</strong></div>
                    </div>
                  );
                })()
              ) : (
                <div className="admin1-empty">Select a load to begin</div>
              )}
            </div>
          </section>
        )}

        {activePanel === "completed" && (
          <section className="admin1-panel">
            <div className="admin1-panel-header">
              <div>
                <span className="admin1-eyebrow">Records</span>
                <h2>Completed Loads</h2>
              </div>
            </div>
            {renderLoadTable(
              completedLoads,
              "No completed loads.",
              (load) =>
                load.podUrl && load.status !== "rejected" ? (
                  <a className="btn driver-link-button" href={`${BACKEND_URL}${load.podUrl}`} target="_blank" rel="noopener noreferrer">
                    View POD
                  </a>
                ) : (
                  <div className="admin1-action-group">
                    <label className="btn driver-upload">
                      Upload POD
                      <input type="file" accept=".pdf,image/*" onChange={(e) => handlePODUpload(load._id, e.target.files?.[0])} />
                    </label>
                    <button className="btn admin1-action" onClick={() => handleGeneratePOD(load._id)}>
                      Generate POD
                    </button>
                    <button className="btn admin1-action" style={{ background: "#2563eb" }} onClick={() => startCamera(load._id)}>
                      Take Photo
                    </button>
                    {load.signatureUrl ? (
                      <span className="btn admin1-action" style={{ background: "#6b7280", opacity: 0.5, cursor: "not-allowed" }}>
                        Signed ✓
                      </span>
                    ) : (
                      <button className="btn admin1-action" style={{ background: "#7c3aed" }} onClick={() => openSignature(load._id)}>
                        Sign
                      </button>
                    )}
                  </div>
                ),
              true
            )}
          </section>
        )}

        {activePanel === "issues" && (
          <section className="driver-grid two">
            <div className="admin1-panel">
              <div className="admin1-panel-header">
                <div>
                  <span className="admin1-eyebrow">Dispatch Alert</span>
                  <h2>Report Issue</h2>
                </div>
              </div>
              <form className="driver-issue-form" onSubmit={handleIssueSubmit}>
                <FormField label="Load" name="loadId" type="select" value={issueForm.loadId} onChange={(e) => setIssueForm({ ...issueForm, loadId: e.target.value })} onBlur={() => setIssueTouched({ ...issueTouched, loadId: true })} error={issueErrors.loadId} touched={issueTouched.loadId} required>
                  <option value="">Select load</option>
                  {[...inTransitLoads, ...waitingLoads].map((load) => (
                    <option key={load._id} value={load._id}>
                      {load.customer?.name || "Customer"} - {load.pickupLocation} to {load.deliveryLocation}
                    </option>
                  ))}
                </FormField>
                <FormField label="Type" name="type" type="select" value={issueForm.type} onChange={(e) => setIssueForm({ ...issueForm, type: e.target.value })} onBlur={() => setIssueTouched({ ...issueTouched, type: true })} error={issueErrors.type} touched={issueTouched.type}>
                  <option value="delay">Delay</option>
                  <option value="breakdown">Breakdown</option>
                  <option value="accident">Accident</option>
                  <option value="wrong address">Wrong Address</option>
                  <option value="rejected delivery">Rejected Delivery</option>
                  <option value="paperwork">Missing Paperwork</option>
                  <option value="other">Other</option>
                </FormField>
                <FormField label="Description" name="description" type="textarea" value={issueForm.description} onChange={(e) => setIssueForm({ ...issueForm, description: sanitizeInput(e.target.value) })} onBlur={() => setIssueTouched({ ...issueTouched, description: true })} error={issueErrors.description} touched={issueTouched.description} required helpKey="notes" />
                <button type="submit" className="btn">Report Issue</button>
              </form>
            </div>

            <div className="admin1-panel">
              <div className="admin1-panel-header">
                <div>
                  <span className="admin1-eyebrow">Open Items</span>
                  <h2>Reported Issues</h2>
                </div>
              </div>
              <div className="driver-issue-list">
                {loads.filter((load) => load.driverIssue?.description).length === 0 ? (
                  <div className="admin1-empty">No issues reported.</div>
                ) : (
                  loads
                    .filter((load) => load.driverIssue?.description)
                    .map((load) => (
                      <div className="driver-issue-card" key={load._id}>
                        <div>
                          <strong>{load.driverIssue.type}</strong>
                          <Badge value={load.driverIssue.status} />
                        </div>
                        <p>{load.driverIssue.description}</p>
                        <span>{load.customer?.name || "Customer"} - {formatDateTime(load.driverIssue.reportedAt)}</span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </section>
        )}

        {activePanel === "fuel" && (
          <section className="driver-grid two">
            <div className="admin1-panel">
              <div className="admin1-panel-header">
                <div>
                  <span className="admin1-eyebrow">Expenses</span>
                  <h2>Log Fuel</h2>
                </div>
              </div>
              <form className="driver-issue-form" onSubmit={handleFuelSubmit}>
                <FormField label="Liters" name="liters" type="number" value={fuelForm.liters} onChange={(e) => setFuelForm({ ...fuelForm, liters: e.target.value })} required />
                <FormField label="Cost Per Liter" name="costPerLiter" type="number" value={fuelForm.costPerLiter} onChange={(e) => setFuelForm({ ...fuelForm, costPerLiter: e.target.value })} required />
                <FormField label="Vendor" name="vendor" value={fuelForm.vendor} onChange={(e) => setFuelForm({ ...fuelForm, vendor: e.target.value })} />
                <FormField label="Notes" name="notes" type="textarea" value={fuelForm.notes} onChange={(e) => setFuelForm({ ...fuelForm, notes: e.target.value })} />
                <button type="submit" className="btn">Log Fuel</button>
              </form>
            </div>
            <div className="admin1-panel">
              <div className="admin1-panel-header">
                <div>
                  <span className="admin1-eyebrow">Truck</span>
                  <h2>Assigned Truck</h2>
                </div>
              </div>
              {truckInfo ? (
                <div className="driver-status-list">
                  <div><span>Model</span><strong>{truckInfo.make} {truckInfo.model} ({truckInfo.year || "—"})</strong></div>
                  <div><span>Reg</span><strong>{truckInfo.registrationNumber}</strong></div>
                  <div><span>Fuel Type</span><strong style={{ textTransform: "capitalize" }}>{truckInfo.fuelType}</strong></div>
                  <div><span>Mileage</span><strong>{truckInfo.mileage ? `${truckInfo.mileage.toLocaleString()} km` : "—"}</strong></div>
                  {truckInfo.nextServiceDate && <div><span>Next Service</span><strong>{new Date(truckInfo.nextServiceDate).toLocaleDateString()}</strong></div>}
                  {truckInfo.insuranceExpiry && <div><span>Insurance</span><strong>{new Date(truckInfo.insuranceExpiry).toLocaleDateString()}</strong></div>}
                </div>
              ) : (
                <div className="admin1-empty">No truck assigned</div>
              )}
              {truckAlerts.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {truckAlerts.map((a, i) => (
                    <div key={i} className={`admin1-alert`} style={a.type === "danger" ? { background: "#fef2f2", borderColor: "#fecaca", color: "#dc2626" } : a.type === "warning" ? { background: "#fffbeb", borderColor: "#fde68a", color: "#d97706" } : { background: "#eff6ff", borderColor: "#bfdbfe", color: "#2563eb" }}>
                      {a.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {activePanel === "notifications" && (
          <section className="admin1-panel">
            <div className="admin1-panel-header">
              <div>
                <span className="admin1-eyebrow">Updates</span>
                <h2>Notifications {notifUnread > 0 && <span className="admin1-badge danger" style={{ marginLeft: 8 }}>{notifUnread} new</span>}</h2>
              </div>
              {notifUnread > 0 && <button className="btn" onClick={async () => { try { await API.patch("/notifications/read-all", {}, authHeaders); setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))); setNotifUnread(0); } catch (e) { console.error(e); } }}>Mark All Read</button>}
            </div>
            {notifications.length === 0 ? (
              <div className="admin1-empty">No notifications yet</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {notifications.map((n) => (
                  <div key={n._id} onClick={() => !n.read && markNotifRead(n._id)} style={{ cursor: !n.read ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 8, background: n.read ? "#fafbfc" : "#eef2ff", border: `1px solid ${n.read ? "#f0f1f3" : "#c7d2fe"}`, gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: 13, color: "#0f172a", display: "block" }}>{n.title}</strong>
                      <span style={{ fontSize: 12, color: "#64748b" }}>{n.message}</span>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{formatDateTime(n.createdAt)}</div>
                    </div>
                    {!n.read && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1", flexShrink: 0 }} />}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Mobile Bottom Navigation */}
        <nav className="driver-bottom-nav">
          {navItems.map(([id, labelKey]) => (
            <button
              key={id}
              className={activePanel === id ? "active" : ""}
              onClick={() => setActivePanel(id)}
            >
              <span className="nav-icon">
                {id === "overview" && "📊"}
                {id === "assigned" && "📋"}
                {id === "active" && "🚚"}
                {id === "delivery" && "📦"}
                {id === "completed" && "✅"}
                {id === "fuel" && "⛽"}
                {id === "issues" && "⚠️"}
                {id === "notifications" && "🔔"}
                {id === "profile" && "👤"}
              </span>
              {t(labelKey)}
            </button>
          ))}
        </nav>

        {/* Camera Modal */}
        {showCamera && (
          <div className="driver-camera-modal">
            {!capturedImage ? (
              <>
                <video ref={videoRef} autoPlay playsInline muted />
                <canvas ref={canvasRef} style={{ display: "none" }} />
                <div className="driver-camera-actions">
                  <button className="capture" onClick={capturePhoto}>Capture</button>
                  <button className="close-cam" onClick={stopCamera}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <img src={URL.createObjectURL(capturedImage)} alt="Captured" style={{ maxWidth: "100%", maxHeight: "60vh", borderRadius: 12 }} />
                <div className="driver-camera-actions">
                  <button className="confirm" onClick={uploadCapturedPhoto}>Use as POD</button>
                  <button className="retake" onClick={() => setCapturedImage(null)}>Retake</button>
                  <button className="close-cam" onClick={stopCamera}>Cancel</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Signature Modal */}
        {showSignature && (
          <div className="driver-signature-modal" onClick={() => { setShowSignature(false); setSignatureLoadId(null); }}>
            <div className="sig-container" onClick={(e) => e.stopPropagation()}>
              <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Sign POD</h3>
              <SignatureCanvas
                ref={sigRef}
                penColor="black"
                canvasProps={{ style: { width: "100%", height: 200, border: "2px dashed #cbd5e1", borderRadius: 8 } }}
              />
              <div className="driver-signature-actions">
                <button className="clear-sig" onClick={clearSignature}>Clear</button>
                <button className="btn save-sig" onClick={saveSignature}>Save as POD</button>
                <button className="close-sig" onClick={() => { setShowSignature(false); setSignatureLoadId(null); }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {activePanel === "profile" && (
          <div style={{ display: "grid", gap: 20 }}>
            <section className="driver-grid two">
              <div className="admin1-panel">
                <div className="admin1-panel-header">
                  <div>
                    <span className="admin1-eyebrow">Account</span>
                    <h2>Driver Profile</h2>
                  </div>
                </div>
                <form className="driver-issue-form" onSubmit={async (e) => {
                  e.preventDefault();
                  const { errors: profErrors, isValid: profIsValid } = validateForm({
                    name: { value: profileForm.name, rules: [required], label: "Name" },
                  });
                  setProfileErrors(profErrors);
                  setProfileTouched({ name: true });
                  if (!profIsValid) return;
                  try {
                    await API.patch("/drivers/profile", profileForm, authHeaders);
                    setProfileErrors({});
                    setProfileTouched({});
                    setFormMsg({ type: "success", text: "Profile updated successfully" });
                  } catch (err) {
                    setFormMsg({ type: "error", text: err.response?.data?.message || "Failed to update profile" });
                  }
                }}>
                  <FormField label="Name" name="name" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} onBlur={() => setProfileTouched({ ...profileTouched, name: true })} error={profileErrors.name} touched={profileTouched.name} required />
                  <FormField label="Email" name="email" value={user?.email || ""} disabled />
                  <FormField label="Phone" name="phone" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} onBlur={() => setProfileTouched({ ...profileTouched, phone: true })} error={profileErrors.phone} touched={profileTouched.phone} helpKey="phone" />
                  <FormField label="License Number" name="licenseNumber" value={profileForm.licenseNumber} onChange={(e) => setProfileForm({ ...profileForm, licenseNumber: e.target.value })} onBlur={() => setProfileTouched({ ...profileTouched, licenseNumber: true })} error={profileErrors.licenseNumber} touched={profileTouched.licenseNumber} helpKey="license" />
                  <button type="submit" className="btn">Save Changes</button>
                </form>

                {/* Duty Status */}
                <div style={{ marginTop: 20 }}>
                  <span className="admin1-eyebrow">Duty Status</span>
                  <h3 style={{ margin: "4px 0 10px", fontSize: 15, fontWeight: 600 }}>Current: <span style={{ textTransform: "capitalize" }}>{dutyStatus}</span></h3>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {["available", "on-duty", "inactive"].map((s) => (
                      <button key={s} className={`admin1-btn-sm ${dutyStatus === s ? "admin1-badge info" : ""}`} onClick={() => updateDutyStatus(s)} style={dutyStatus === s ? { background: "#6366f1", color: "#fff", border: "none" } : {}}>
                        {s === "on-duty" ? "On Duty" : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="admin1-panel">
                <div className="admin1-panel-header">
                  <div>
                    <span className="admin1-eyebrow">GPS</span>
                    <h2>Location Tracking</h2>
                  </div>
                  <Badge value={locationPermissionDenied ? "canceled" : driverLocation ? "completed" : "waiting"} />
                </div>
                <div className="driver-location-card">
                  <span>{locationPermissionDenied ? "Permission denied or unavailable" : "Current device position"}</span>
                  <strong>
                    {driverLocation
                      ? `${driverLocation.lat.toFixed(5)}, ${driverLocation.lng.toFixed(5)}`
                      : "Waiting for GPS"}
                  </strong>
                </div>
              </div>
            </section>

            {/* Truck Info */}
            <section className="admin1-panel">
              <div className="admin1-panel-header">
                <div>
                  <span className="admin1-eyebrow">Vehicle</span>
                  <h2>Assigned Truck</h2>
                </div>
              </div>
              {truckInfo ? (
                <div className="driver-status-list">
                  <div><span>Model</span><strong>{truckInfo.make} {truckInfo.model} ({truckInfo.year || "—"})</strong></div>
                  <div><span>Registration</span><strong>{truckInfo.registrationNumber}</strong></div>
                  <div><span>Fuel Type</span><strong style={{ textTransform: "capitalize" }}>{truckInfo.fuelType}</strong></div>
                  <div><span>Capacity</span><strong>{truckInfo.capacity ? `${truckInfo.capacity} kg` : "—"}</strong></div>
                  <div><span>Mileage</span><strong>{truckInfo.mileage ? `${truckInfo.mileage.toLocaleString()} km` : "—"}</strong></div>
                  <div><span>Insurance</span><strong>{truckInfo.insuranceExpiry ? new Date(truckInfo.insuranceExpiry).toLocaleDateString() : "—"}</strong></div>
                  <div><span>Next Service</span><strong>{truckInfo.nextServiceDate ? new Date(truckInfo.nextServiceDate).toLocaleDateString() : "—"}</strong></div>
                </div>
              ) : (
                <div className="admin1-empty">No truck assigned</div>
              )}
              {truckAlerts.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {truckAlerts.map((a, i) => (
                    <div key={i} className="admin1-alert" style={a.type === "danger" ? { background: "#fef2f2", borderColor: "#fecaca", color: "#dc2626" } : a.type === "warning" ? { background: "#fffbeb", borderColor: "#fde68a", color: "#d97706" } : { background: "#eff6ff", borderColor: "#bfdbfe", color: "#2563eb" }}>
                      {a.message}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Documents */}
            <section className="admin1-panel">
              <div className="admin1-panel-header">
                <div>
                  <span className="admin1-eyebrow">Records</span>
                  <h2>My Documents</h2>
                </div>
              </div>
              {documents.length === 0 ? (
                <div className="admin1-empty">No documents found</div>
              ) : (
                <div className="driver-issue-list">
                  {documents.map((doc) => (
                    <div key={doc._id} className="driver-issue-card">
                      <div>
                        <strong>{doc.title}</strong>
                        <span className={`admin1-badge ${doc.status === "active" ? "success" : doc.status === "expiring" ? "warning" : "neutral"}`}>{doc.status}</span>
                      </div>
                      <span style={{ fontSize: 12, color: "#64748b" }}>Type: {doc.type}</span>
                      {doc.expiryDate && <span style={{ fontSize: 12, color: "#64748b" }}>Expires: {new Date(doc.expiryDate).toLocaleDateString()}</span>}
                      {doc.fileUrl && <a className="btn driver-link-button" href={doc.fileUrl} target="_blank" rel="noopener noreferrer" style={{ justifySelf: "start", fontSize: 12, padding: "4px 10px" }}>View</a>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <ChatDrawer isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
};

export default DriverDashboard;
