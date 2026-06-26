// src/pages/Admin1.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useFocusTrap from "../hooks/useFocusTrap";
import API from "../services/api";
import socket from "../services/socket";
import { useAuth } from "../contexts/AuthContext";
import "../styles/Admin1.css";
import { sanitizeInput } from "../utils/sanitize";
import FormField from "../components/FormField";
import { required, isEmail, isPhone, validateForm } from "../utils/validation";
import ThemeToggle from "../components/ThemeToggle";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import NotificationBell from "../components/NotificationBell";
import ConnectionStatus from "../components/ConnectionStatus";
import Pagination from "../components/Pagination";
import Alert from "../components/Alert";
import useConfirm from "../hooks/useConfirm";
import useUnsavedChanges from "../hooks/useUnsavedChanges";
import usePolling from "../hooks/usePolling";
import { CSVLink } from "react-csv";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import ChatDrawer from "../components/ChatDrawer";

const BACKEND_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const initialCustomerForm = { name: "", email: "", phone: "", address: "" };

const initialTruckForm = {
  registrationNumber: "",
  model: "",
  capacity: "",
  make: "",
  year: "",
  fuelType: "diesel",
  status: "available",
  insuranceExpiry: "",
  mileage: "",
};

const initialLoadForm = {
  collectionDate: "",
  client: "",
  pickupLocation: "",
  deliveryLocation: "",
  driver: "",
  truck: "",
  status: "waiting",
  deliveryDate: "",
  deliveryDay: "",
  weight: "",
  cargoType: "",
  priority: "normal",
  customerRef: "",
  notes: "",
};

const initialDriverForm = {
  _id: "",
  name: "",
  email: "",
  phone: "",
  licenseNumber: "",
  status: "available",
  password: "",
};

const statusTone = {
  waiting: "warning",
  assigned: "warning",
  "in transit": "info",
  completed: "success",
  approved: "success",
  rejected: "danger",
  canceled: "danger",
  available: "success",
  "on-duty": "warning",
  inactive: "danger",
  "in service": "info",
  "under maintenance": "warning",
};

const modalFields = {
  Customer: ["name", "email", "phone", "address"],
  Truck: ["registrationNumber", "model", "capacity", "status", "mileage"],
  Driver: ["name", "email", "phone", "licenseNumber", "status"],
  Load: ["status", "notes", "podUrl"],
};

const getDriverMarkerLocation = (driver) => {
  const coords = driver?.location?.coordinates;

  if (!Array.isArray(coords) || coords.length !== 2) return null;

  const lng = Number(coords[0]);
  const lat = Number(coords[1]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    _id: driver._id || driver.driverId,
    name: driver.name,
    email: driver.email,
    status: driver.status,
    lat,
    lng,
  };
};

const Badge = ({ value }) => {
  const tone = statusTone[value] || "neutral";
  return <span className={`admin1-badge ${tone}`}>{value || "unknown"}</span>;
};

const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : "-");
const PAGE_SIZE = 20;

const Admin1 = () => {
  const { token, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const authHeaders = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const { confirm, ConfirmDialog } = useConfirm();

  const [customers, setCustomers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loads, setLoads] = useState([]);
  const [driverLocations, setDriverLocations] = useState([]);
  const [activePanel, setActivePanel] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customerForm, setCustomerForm] = useState(initialCustomerForm);
  const [truckForm, setTruckForm] = useState(initialTruckForm);
  const [loadForm, setLoadForm] = useState(initialLoadForm);
  const [driverForm, setDriverForm] = useState(initialDriverForm);
  // Form validation state
  const [customerErrors, setCustomerErrors] = useState({});
  const [customerTouched, setCustomerTouched] = useState({});
  const [truckErrors, setTruckErrors] = useState({});
  const [truckTouched, setTruckTouched] = useState({});
  const [driverErrors, setDriverErrors] = useState({});
  const [driverTouched, setDriverTouched] = useState({});
  const [loadErrors, setLoadErrors] = useState({});
  const [loadTouched, setLoadTouched] = useState({});

  const [modalOpen, setModalOpen] = useState(false);
  const [modalEntity, setModalEntity] = useState("");
  const [modalData, setModalData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formMsg, setFormMsg] = useState(null);
  const [resolveLoad, setResolveLoad] = useState(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [loadPage, setLoadPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loadDateRange, setLoadDateRange] = useState({ start: "", end: "" });
  const [loadMultiStatus, setLoadMultiStatus] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkDriver, setBulkDriver] = useState("");

  // Invoice state
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoiceStats, setInvoiceStats] = useState(null);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("");
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showMarkPaid, setShowMarkPaid] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState({
    customer: "", load: "", driver: "", dueDate: "",
    taxPercent: 0, discount: 0, notes: "",
    lineItems: [{ description: "", quantity: 1, rate: 0, amount: 0 }],
  });
  const markerRefs = useRef({});

  // Route planning state
  const [routeLoadId, setRouteLoadId] = useState("");
  const [routeCoords, setRouteCoords] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showAllRoutes, setShowAllRoutes] = useState(false);
  const [geocodeQuery, setGeocodeQuery] = useState("");
  const [geocodeResult, setGeocodeResult] = useState(null);

  // Maintenance state
  const [maintenanceRecords, setMaintenanceRecords] = useState([]);
  const [maintenanceUpcoming, setMaintenanceUpcoming] = useState(null);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceFilter, setMaintenanceFilter] = useState({ truck: "", status: "" });
  const [showCreateMaintenance, setShowCreateMaintenance] = useState(false);
  const [showCompleteMaintenance, setShowCompleteMaintenance] = useState(null);
  const [maintenanceForm, setMaintenanceForm] = useState({
    truck: "", serviceType: "oil change", description: "",
    scheduledDate: "", scheduledMileage: "", cost: "", vendor: "", notes: "",
  });

  // Fuel state
  const [fuelRecords, setFuelRecords] = useState([]);
  const [fuelStats, setFuelStats] = useState(null);
  const [fuelLoading, setFuelLoading] = useState(false);
  const [fuelForm, setFuelForm] = useState({
    truck: "", date: "", liters: "", costPerLiter: "", mileage: "", vendor: "", fuelType: "diesel", notes: "",
  });

  // Document state
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [docForm, setDocForm] = useState({ title: "", type: "other", entityType: "general", entityId: "", fileUrl: "", issueDate: "", expiryDate: "", notes: "" });
  const [docFilter, setDocFilter] = useState({ type: "", entityType: "", status: "", expiring: false });
  const [showCreateDoc, setShowCreateDoc] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const editModalRef = useFocusTrap(modalOpen);
  const resolveModalRef = useFocusTrap(Boolean(resolveLoad));
  const maintCreateRef = useFocusTrap(showCreateMaintenance);
  const maintCompleteRef = useFocusTrap(Boolean(showCompleteMaintenance));
  const invoiceCreateRef = useFocusTrap(showCreateInvoice);
  const invoicePaidRef = useFocusTrap(Boolean(showMarkPaid));
  const docCreateRef = useFocusTrap(showCreateDoc);

  const isFormDirty = useMemo(() =>
    JSON.stringify(customerForm) !== JSON.stringify(initialCustomerForm) ||
    JSON.stringify(truckForm) !== JSON.stringify(initialTruckForm) ||
    JSON.stringify(loadForm) !== JSON.stringify(initialLoadForm) ||
    driverForm._id !== "" ||
    fuelForm.truck !== "" ||
    maintenanceForm.truck !== "",
    [customerForm, truckForm, loadForm, driverForm, fuelForm, maintenanceForm]
  );

  useUnsavedChanges(isFormDirty);

  // Reports state
  const [profitData, setProfitData] = useState(null);
  const [profitLoading, setProfitLoading] = useState(false);
  const [profitDateRange, setProfitDateRange] = useState({ start: "", end: "" });
  const [scorecardDriver, setScorecardDriver] = useState("");
  const [scorecardData, setScorecardData] = useState(null);
  const [scorecardLoading, setScorecardLoading] = useState(false);

  const fetchFuel = useCallback(async () => {
    if (!token) return;
    setFuelLoading(true);
    try {
      const res = await API.get("/fuel?limit=100", authHeaders);
      setFuelRecords(res.data.records);
    } catch (err) {
      console.error(err);
    } finally {
      setFuelLoading(false);
    }
  }, [token, authHeaders]);

  const fetchFuelStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await API.get("/fuel/stats", authHeaders);
      setFuelStats(res.data);
    } catch (err) {
      // silent
    }
  }, [token, authHeaders]);

  const handleCreateFuel = async (e) => {
    e.preventDefault();
    try {
      await API.post("/fuel", fuelForm, authHeaders);
      setFuelForm({ truck: "", date: "", liters: "", costPerLiter: "", mileage: "", vendor: "", fuelType: "diesel", notes: "" });
      fetchFuel(); fetchFuelStats();
    } catch (err) {
      setFormMsg({ type: "error", text: err.response?.data?.message || "Failed to create fuel record" });
    }
  };

  const handleDeleteFuel = async (id) => {
    const ok = await confirm("Delete this fuel record?", "Delete Fuel Record", "Delete", "Cancel", "danger");
    if (!ok) return;
    try {
      await API.delete(`/fuel/${id}`, authHeaders);
      setFormMsg({ type: "success", text: "Fuel record deleted" });
      fetchFuel(); fetchFuelStats();
    } catch (err) {
      setFormMsg({ type: "error", text: err.response?.data?.message || "Failed to delete fuel record" });
    }
  };

  const fetchMaintenance = useCallback(async () => {
    if (!token) return;
    setMaintenanceLoading(true);
    try {
      let url = "/maintenance?limit=100";
      if (maintenanceFilter.truck) url += `&truck=${maintenanceFilter.truck}`;
      if (maintenanceFilter.status) url += `&status=${maintenanceFilter.status}`;
      const res = await API.get(url, authHeaders);
      setMaintenanceRecords(res.data.records);
    } catch (err) {
      console.error(err);
    } finally {
      setMaintenanceLoading(false);
    }
  }, [token, authHeaders, maintenanceFilter]);

  const fetchMaintenanceUpcoming = useCallback(async () => {
    if (!token) return;
    try {
      const res = await API.get("/maintenance/upcoming", authHeaders);
      setMaintenanceUpcoming(res.data);
    } catch (err) {
      // silent
    }
  }, [token, authHeaders]);

  const fetchLoadRoute = useCallback(async (loadId) => {
    if (!loadId || !token) return;
    setRouteLoading(true);
    setRouteInfo(null);
    setRouteCoords(null);
    try {
      const res = await API.get(`/routes/load/${loadId}`, authHeaders);
      if (res.data.needsGeocode) {
        setRouteInfo({ needsGeocode: true, ...res.data });
      } else {
        setRouteCoords(res.data.polyline);
        setRouteInfo({ distance: res.data.distance, duration: res.data.duration });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRouteLoading(false);
    }
  }, [token, authHeaders]);

  const handleCalculateRoute = useCallback(async () => {
    const load = loads.find((l) => l._id === routeLoadId);
    if (!load || !token) return;
    setRouteLoading(true);
    setRouteInfo(null);
    setRouteCoords(null);

    const geocodeAddress = async (address) => {
      try {
        const res = await API.get(`/routes/geocode?q=${encodeURIComponent(address)}`, authHeaders);
        if (!res.data.lat) return null;
        return res.data;
      } catch (e) {
        if (e.response?.status === 404) return null;
        throw e;
      }
    };

    try {
      const [fromGeo, toGeo] = await Promise.all([
        geocodeAddress(load.pickupLocation),
        geocodeAddress(load.deliveryLocation),
      ]);

      if (!fromGeo || !toGeo) {
        const failed = [];
        if (!fromGeo) failed.push(`"${load.pickupLocation}"`);
        if (!toGeo) failed.push(`"${load.deliveryLocation}"`);
        setRouteInfo({ error: `Could not find location: ${failed.join(", ")}. Try a simpler address.` });
        setRouteLoading(false);
        return;
      }

      const calcRes = await API.post("/routes/calculate", {
        fromLat: fromGeo.lat, fromLng: fromGeo.lng,
        toLat: toGeo.lat, toLng: toGeo.lng,
        loadId: load._id,
      }, authHeaders);

      setRouteCoords(calcRes.data.coordinates);
      setRouteInfo({
        straightLineKm: calcRes.data.straightLineKm,
        roadDistanceKm: calcRes.data.roadDistanceKm,
        durationMin: calcRes.data.durationMin,
      });
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || err.message || "Route calculation failed";
      setRouteInfo({ error: msg });
    } finally {
      setRouteLoading(false);
    }
  }, [routeLoadId, loads, token, authHeaders]);

  const handleGeocode = useCallback(async () => {
    if (!geocodeQuery) return;
    try {
      const res = await API.get(`/routes/geocode?q=${encodeURIComponent(geocodeQuery)}`, authHeaders);
      setGeocodeResult(res.data);
    } catch (err) {
      console.error(err);
      setGeocodeResult(err.response?.status === 404
        ? { error: "Location not found. Try a simpler address." }
        : { error: err.response?.data?.message || "Geocode failed" }
      );
    }
  }, [geocodeQuery, authHeaders]);

  const fetchData = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const [custRes, truckRes, driverRes, loadRes] = await Promise.all([
        API.get("/customers", authHeaders),
        API.get("/trucks", authHeaders),
        API.get("/drivers", authHeaders),
        API.get("/loads", authHeaders),
      ]);

      setCustomers(custRes.data);
      setTrucks(truckRes.data);
      setDrivers(driverRes.data);
      setLoads(loadRes.data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load dashboard data.");
      console.error(err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const locations = drivers.map(getDriverMarkerLocation).filter(Boolean);
    setDriverLocations(locations);
  }, [drivers]);

  useEffect(() => {
    if (!token) return;

    const handleDriverLocationUpdate = (updatedDriver) => {
      const markerLocation = getDriverMarkerLocation(updatedDriver);
      if (!markerLocation?._id) return;

      setDriverLocations((prev) => {
        const exists = prev.some((driver) => driver._id === markerLocation._id);
        if (!exists) return [...prev, markerLocation];

        return prev.map((driver) =>
          driver._id === markerLocation._id
            ? {
                ...driver,
                ...markerLocation,
                name: markerLocation.name || driver.name,
                email: markerLocation.email || driver.email,
                status: markerLocation.status || driver.status,
              }
            : driver
        );
      });

      setDrivers((prev) =>
        prev.map((driver) =>
          driver._id === markerLocation._id
            ? {
                ...driver,
                name: updatedDriver.name || driver.name,
                status: updatedDriver.status || driver.status,
                location: updatedDriver.location || driver.location,
              }
            : driver
        )
      );
    };

    socket.on("driverLocationUpdate", handleDriverLocationUpdate);

    return () => {
      socket.off("driverLocationUpdate", handleDriverLocationUpdate);
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const handleLoadChange = () => fetchData();
    const handleDriverChange = () => fetchData();
    const handleTruckChange = () => fetchData();
    const handleCustomerChange = () => fetchData();

    socket.on("loadCreated", handleLoadChange);
    socket.on("loadUpdated", handleLoadChange);
    socket.on("loadDeleted", handleLoadChange);
    socket.on("podUploaded", handleLoadChange);
    socket.on("driverCreated", handleDriverChange);
    socket.on("driverUpdated", handleDriverChange);
    socket.on("driverDeleted", handleDriverChange);
    socket.on("truckCreated", handleTruckChange);
    socket.on("truckUpdated", handleTruckChange);
    socket.on("truckDeleted", handleTruckChange);
    socket.on("customerCreated", handleCustomerChange);
    socket.on("customerUpdated", handleCustomerChange);
    socket.on("customerDeleted", handleCustomerChange);

    return () => {
      socket.off("loadCreated", handleLoadChange);
      socket.off("loadUpdated", handleLoadChange);
      socket.off("loadDeleted", handleLoadChange);
      socket.off("podUploaded", handleLoadChange);
      socket.off("driverCreated", handleDriverChange);
      socket.off("driverUpdated", handleDriverChange);
      socket.off("driverDeleted", handleDriverChange);
      socket.off("truckCreated", handleTruckChange);
      socket.off("truckUpdated", handleTruckChange);
      socket.off("truckDeleted", handleTruckChange);
      socket.off("customerCreated", handleCustomerChange);
      socket.off("customerUpdated", handleCustomerChange);
      socket.off("customerDeleted", handleCustomerChange);
    };
  }, [token, fetchData]);

  usePolling(fetchData, 30000, Boolean(token));

  const fetchInvoices = useCallback(async () => {
    if (!token) return;
    setInvoicesLoading(true);
    try {
      let url = "/invoices?limit=100";
      if (invoiceStatusFilter) url += `&status=${invoiceStatusFilter}`;
      const res = await API.get(url, authHeaders);
      setInvoices(res.data.invoices);
    } catch (err) {
      console.error(err.response?.data || err.message);
    } finally {
      setInvoicesLoading(false);
    }
  }, [token, authHeaders, invoiceStatusFilter]);

  const fetchDocuments = useCallback(async () => {
    if (!token) return;
    setDocumentsLoading(true);
    try {
      let url = "/documents?limit=100";
      if (docFilter.type) url += `&type=${docFilter.type}`;
      if (docFilter.entityType) url += `&entityType=${docFilter.entityType}`;
      if (docFilter.status) url += `&status=${docFilter.status}`;
      if (docFilter.expiring) url += "&expiring=true";
      const res = await API.get(url, authHeaders);
      setDocuments(res.data.documents);
    } catch (err) {
      console.error(err);
    } finally {
      setDocumentsLoading(false);
    }
  }, [token, authHeaders, docFilter]);

  const fetchInvoiceStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await API.get("/invoices/stats", authHeaders);
      setInvoiceStats(res.data);
    } catch (err) {
      // silent
    }
  }, [token, authHeaders]);

  usePolling(fetchInvoices, 60000, activePanel === "invoices" && Boolean(token));
  usePolling(fetchFuel, 60000, activePanel === "fuel" && Boolean(token));
  usePolling(fetchMaintenance, 60000, activePanel === "maintenance" && Boolean(token));

  const metrics = useMemo(() => {
    const countLoads = (status) => loads.filter((load) => load.status === status).length;
    const countDrivers = (status) => drivers.filter((driver) => driver.status === status).length;
    const countTrucks = (status) => trucks.filter((truck) => truck.status === status).length;

    return {
      totalLoads: loads.length,
      waitingLoads: countLoads("waiting") + countLoads("assigned"),
      inTransitLoads: countLoads("in transit"),
      completedLoads: countLoads("completed"),
      activeDrivers: countDrivers("on-duty"),
      availableDrivers: countDrivers("available"),
      availableTrucks: countTrucks("available"),
      maintenanceTrucks: countTrucks("under maintenance"),
      openIssues: loads.filter((load) => load.driverIssue?.status === "open").length,
    };
  }, [drivers, loads, trucks]);

  const filteredLoads = useMemo(() => {
    const term = search.toLowerCase();
    let items = loads.filter((load) =>
      [
        load.customer?.name,
        load.driver?.name,
        load.truck?.registrationNumber,
        load.pickupLocation,
        load.deliveryLocation,
        load.status,
        load.ticketNumber,
        load.customerRef,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );

    if (loadMultiStatus.length > 0) {
      items = items.filter((l) => loadMultiStatus.includes(l.status));
    }
    if (loadDateRange.start) {
      items = items.filter((l) => new Date(l.createdAt) >= new Date(loadDateRange.start));
    }
    if (loadDateRange.end) {
      const end = new Date(loadDateRange.end);
      end.setHours(23, 59, 59, 999);
      items = items.filter((l) => new Date(l.createdAt) <= end);
    }

    return items;
  }, [loads, search, loadMultiStatus, loadDateRange]);

  const paginatedLoads = useMemo(() => {
    const start = (loadPage - 1) * PAGE_SIZE;
    return filteredLoads.slice(start, start + PAGE_SIZE);
  }, [filteredLoads, loadPage]);

  const dispatchLoads = useMemo(() => {
    return loads.filter((l) => ["waiting", "assigned", "in transit"].includes(l.status));
  }, [loads]);

  useEffect(() => {
    setLoadPage(1);
  }, [search]);

  useEffect(() => {
    if (activePanel === "fuel") {
      fetchFuel();
      fetchFuelStats();
    }
    if (activePanel === "documents") {
      fetchDocuments();
    }
  }, [activePanel, fetchFuel, fetchFuelStats, fetchDocuments]);

  const filteredDrivers = useMemo(() => {
    const term = search.toLowerCase();
    return drivers.filter((driver) =>
      [driver.name, driver.email, driver.phone, driver.licenseNumber, driver.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [drivers, search]);

  const filteredTrucks = useMemo(() => {
    const term = search.toLowerCase();
    return trucks.filter((truck) =>
      [truck.registrationNumber, truck.model, truck.make, truck.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [search, trucks]);

  const filteredCustomers = useMemo(() => {
    const term = search.toLowerCase();
    return customers.filter((customer) =>
      [customer.name, customer.email, customer.phone, customer.address]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [customers, search]);

  const recentLoads = useMemo(
    () =>
      [...loads]
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
        .slice(0, 6),
    [loads]
  );

  const createClusterCustomIcon = (cluster) => {
    const statuses = cluster.getAllChildMarkers().map((marker) => marker.options.driverStatus);
    const count = cluster.getChildCount();
    const inactive = statuses.filter((status) => status === "inactive").length;
    const onDuty = statuses.filter((status) => status === "on-duty").length;
    const available = statuses.filter((status) => status === "available").length;
    let color = "green";

    if (inactive > available && inactive > onDuty) {
      color = "red";
    } else if (onDuty >= available) {
      color = "orange";
    }

    return L.divIcon({
      html: `<div class="admin1-cluster admin1-cluster-${color}">${count}</div>`,
      className: "admin1-cluster-wrap",
      iconSize: L.point(40, 40),
    });
  };

  const closeSidebar = () => setSidebarOpen(false);

  const issueLoads = useMemo(
    () => loads.filter((load) => load.driverIssue?.status === "open"),
    [loads]
  );

  const handleResolveIssue = async () => {
    if (!resolveLoad) return;

    try {
      await API.patch(`/loads/${resolveLoad._id}/resolve-issue`, { note: resolutionNote }, authHeaders);
      setResolveLoad(null);
      setResolutionNote("");
      await fetchData();
    } catch (err) {
      console.error("Resolve issue error:", err.response?.data || err.message);
      setFormMsg({ type: "error", text: "Failed to resolve issue" });
    }
  };

  const navItems = [
    ["overview", "nav.overview"],
    ["loads", "nav.loads"],
    ["drivers", "nav.drivers"],
    ["fleet", "nav.fleet"],
    ["customers", "nav.customers"],
    ["invoices", "nav.invoices"],
    ["maintenance", "nav.maintenance"],
    ["fuel", "nav.fuel"],
    ["documents", "nav.documents"],
    ["issues", "nav.issues"],
    ["dispatch", "nav.dispatch"],
    ["map", "nav.map"],
    ["reports", "nav.reports"],
  ];

  const openEditModal = (entityType, data) => {
    const cleaned = Object.fromEntries(
      Object.entries(data || {}).map(([key, value]) => {
        if (value && typeof value === "object") return [key, ""];
        return [key, value ?? ""];
      })
    );

    setModalEntity(entityType);
    setModalData(cleaned);
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const id = modalData._id;
      const urls = {
        Customer: `/customers/${id}`,
        Truck: `/trucks/${id}`,
        Driver: `/drivers/${id}`,
        Load: `/loads/${id}`,
      };

      await API.put(urls[modalEntity], modalData, authHeaders);
      setModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error(err.response?.data || err.message);
      setFormMsg({ type: "error", text: `Error updating ${modalEntity}` });
    }
  };

  const handleDelete = async (entityType, id) => {
    const ok = await confirm(`Delete this ${entityType.toLowerCase()}?`, `Delete ${entityType}`, "Delete", "Cancel", "danger");
    if (!ok) return;

    try {
      const urls = {
        Customer: `/customers/${id}`,
        Truck: `/trucks/${id}`,
        Driver: `/drivers/${id}`,
        Load: `/loads/${id}`,
      };

      await API.delete(urls[entityType], authHeaders);
      await fetchData();
    } catch (err) {
      console.error(err.response?.data || err.message);
      setFormMsg({ type: "error", text: `Error deleting ${entityType}` });
    }
  };

  const handleBulkStatus = async () => {
    if (!bulkStatus || selectedIds.length === 0) return;
    try {
      await API.post("/loads/bulk/status", { ids: selectedIds, status: bulkStatus }, authHeaders);
      setFormMsg({ type: "success", text: `Updated ${selectedIds.length} loads to ${bulkStatus}` });
      setSelectedIds([]);
      setBulkStatus("");
      fetchData();
    } catch (err) {
      setFormMsg({ type: "error", text: err.response?.data?.message || "Bulk status update failed" });
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkDriver || selectedIds.length === 0) return;
    try {
      await API.post("/loads/bulk/assign", { ids: selectedIds, driverId: bulkDriver }, authHeaders);
      setFormMsg({ type: "success", text: `Assigned ${selectedIds.length} loads to driver` });
      setSelectedIds([]);
      setBulkDriver("");
      fetchData();
    } catch (err) {
      setFormMsg({ type: "error", text: err.response?.data?.message || "Bulk assign failed" });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const ok = await confirm(`Delete ${selectedIds.length} loads?`, "Bulk Delete", "Delete", "Cancel", "danger");
    if (!ok) return;
    try {
      await API.post("/loads/bulk/delete", { ids: selectedIds }, authHeaders);
      setFormMsg({ type: "success", text: `Deleted ${selectedIds.length} loads` });
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      setFormMsg({ type: "error", text: err.response?.data?.message || "Bulk delete failed" });
    }
  };

  const handleQuickStatus = async (loadId, status) => {
    try {
      await API.put(`/loads/${loadId}`, { status }, authHeaders);
      setFormMsg({ type: "success", text: `Load updated to ${status}` });
      fetchData();
    } catch (err) {
      setFormMsg({ type: "error", text: err.response?.data?.message || "Status update failed" });
    }
  };

  const handleQuickAssign = async (loadId, driverId) => {
    if (!driverId) return;
    try {
      await API.put(`/loads/${loadId}`, { driver: driverId }, authHeaders);
      setFormMsg({ type: "success", text: "Driver assigned" });
      fetchData();
    } catch (err) {
      setFormMsg({ type: "error", text: err.response?.data?.message || "Assign failed" });
    }
  };

  const exportToExcel = (data, filename, sheetName) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, `${filename}.xlsx`);
  };

  const handleGeneratePOD = async (loadId) => {
    try {
      await API.post(`/loads/${loadId}/generate-pod`, {}, authHeaders);
      setFormMsg({ type: "success", text: "POD generated successfully" });
      fetchData();
    } catch (err) {
      setFormMsg({ type: "error", text: err.response?.data?.message || "Failed to generate POD" });
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedLoads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedLoads.map((l) => l._id));
    }
  };

  const handleCustomerSubmit = async (e) => {
    e.preventDefault();
    const { errors: custErrors, isValid: custIsValid } = validateForm({
      name: { value: customerForm.name, rules: [required], label: "Name" },
      email: { value: customerForm.email, rules: [required, isEmail], label: "Email" },
      phone: { value: customerForm.phone, rules: [required, isPhone], label: "Phone" },
      address: { value: customerForm.address, rules: [required], label: "Address" },
    });
    setCustomerErrors(custErrors);
    setCustomerTouched({ name: true, email: true, phone: true, address: true });
    if (!custIsValid) return;
    try {
      await API.post("/customers", customerForm, authHeaders);
      setCustomerForm(initialCustomerForm);
      setCustomerErrors({});
      setCustomerTouched({});
      await fetchData();
    } catch (err) {
      console.error(err.response?.data || err.message);
      setFormMsg({ type: "error", text: "Error adding customer" });
    }
  };

  const handleTruckSubmit = async (e) => {
    e.preventDefault();
    const { errors: trkErrors, isValid: trkIsValid } = validateForm({
      registrationNumber: { value: truckForm.registrationNumber, rules: [required], label: "Registration Number" },
      model: { value: truckForm.model, rules: [required], label: "Model" },
      capacity: { value: truckForm.capacity, rules: [required], label: "Capacity" },
    });
    setTruckErrors(trkErrors);
    setTruckTouched({ registrationNumber: true, model: true, capacity: true, make: true, year: true, mileage: true });
    if (!trkIsValid) return;
    try {
      await API.post(
        "/trucks",
        {
          ...truckForm,
          capacity: truckForm.capacity ? Number(truckForm.capacity) : undefined,
          year: truckForm.year ? Number(truckForm.year) : undefined,
          insuranceExpiry: truckForm.insuranceExpiry ? new Date(truckForm.insuranceExpiry) : undefined,
        },
        authHeaders
      );
      setTruckForm(initialTruckForm);
      setTruckErrors({});
      setTruckTouched({});
      await fetchData();
    } catch (err) {
      console.error(err.response?.data || err.message);
      setFormMsg({ type: "error", text: "Error adding truck" });
    }
  };

  const handleLoadSubmit = async (e) => {
    e.preventDefault();
    const { errors: ldErrors, isValid: ldIsValid } = validateForm({
      pickupLocation: { value: loadForm.pickupLocation, rules: [required], label: "Pickup Location" },
      deliveryLocation: { value: loadForm.deliveryLocation, rules: [required], label: "Delivery Location" },
    });
    setLoadErrors(ldErrors);
    setLoadTouched({ pickupLocation: true, deliveryLocation: true });
    if (!ldIsValid) return;
    try {
      await API.post(
        "/loads",
        {
          customer: loadForm.client,
          driver: loadForm.driver || undefined,
          truck: loadForm.truck || undefined,
          collectionDate: loadForm.collectionDate ? new Date(loadForm.collectionDate) : undefined,
          deliveryDate: loadForm.deliveryDate ? new Date(loadForm.deliveryDate) : undefined,
          pickupLocation: loadForm.pickupLocation,
          deliveryLocation: loadForm.deliveryLocation,
          deliveryDay: loadForm.deliveryDay,
          cargoType: loadForm.cargoType,
          priority: loadForm.priority,
          customerRef: loadForm.customerRef,
          notes: loadForm.notes,
          status: loadForm.status,
          weight: loadForm.weight ? Number(loadForm.weight) : undefined,
        },
        authHeaders
      );
      setLoadForm(initialLoadForm);
      setLoadErrors({});
      setLoadTouched({});
      await fetchData();
    } catch (err) {
      console.error(err.response?.data || err.message);
      setFormMsg({ type: "error", text: "Error creating load" });
    }
  };

  const handleDriverSubmit = async (e) => {
    e.preventDefault();
    const driverRules = {
      name: { value: driverForm.name, rules: [required], label: "Name" },
      email: { value: driverForm.email, rules: [required, isEmail], label: "Email" },
    };
    if (!driverForm._id) {
      driverRules.password = { value: driverForm.password, rules: [required], label: "Password" };
    }
    const { errors: drvErrors, isValid: drvIsValid } = validateForm(driverRules);
    setDriverErrors(drvErrors);
    const touchedAll = { name: true, email: true, phone: true, licenseNumber: true };
    if (!driverForm._id) touchedAll.password = true;
    setDriverTouched(touchedAll);
    if (!drvIsValid) return;

    try {
      const payload = {
        name: driverForm.name.trim(),
        email: driverForm.email.trim(),
        phone: driverForm.phone.trim(),
        licenseNumber: driverForm.licenseNumber.trim(),
        status: driverForm.status,
      };

      if (!driverForm._id && driverForm.password) {
        payload.password = driverForm.password.trim();
      }

      if (driverForm._id) {
        await API.put(`/drivers/${driverForm._id}`, payload, authHeaders);
      } else {
        await API.post("/drivers", payload, authHeaders);
      }

      setDriverForm(initialDriverForm);
      setDriverErrors({});
      setDriverTouched({});
      await fetchData();
    } catch (err) {
      console.error(err.response?.data || err.message);
      setFormMsg({ type: "error", text: err.response?.data?.message || "Error saving driver" });
    }
  };
//-------------------->
  const handleDriverSelect = (e) => {
    const selectedId = e.target.value;
    const selectedDriver = drivers.find((driver) => driver._id === selectedId);

    if (!selectedDriver) {
      setDriverForm(initialDriverForm);
      return;
    }

    setDriverForm({
      _id: selectedDriver._id,
      name: selectedDriver.name || "",
      email: selectedDriver.email || "",
      phone: selectedDriver.phone || "",
      licenseNumber: selectedDriver.licenseNumber || "",
      status: selectedDriver.status || "available",
      password: "",
    });
  };

  const renderMap = () => {
    const filteredLoadsWithCoords = loads.filter((l) => l.pickupLat && l.deliveryLat);

    return (
    <div className="admin1-map-shell">
      <MapContainer center={[-26.2041, 28.0473]} zoom={6} className="admin1-map">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <MarkerClusterGroup iconCreateFunction={createClusterCustomIcon}>
          {driverLocations
            .filter((driver) => Number.isFinite(driver.lat) && Number.isFinite(driver.lng))
            .map((driver) => (
              <Marker
                key={driver._id}
                position={[driver.lat, driver.lng]}
                eventHandlers={{
                  add: (e) => {
                    markerRefs.current[driver._id] = e.target;
                  },
                }}
                driverStatus={driver.status}
              >
                <Popup>
                  <strong>{driver.name || "Driver"}</strong>
                  <br />
                  {driver.email || "No email"}
                  <br />
                  Status: {driver.status || "unknown"}
                </Popup>
              </Marker>
            ))}
        </MarkerClusterGroup>

        {showAllRoutes && filteredLoadsWithCoords.map((l) => (
          <Polyline
            key={l._id}
            positions={[[l.pickupLat, l.pickupLng], [l.deliveryLat, l.deliveryLng]]}
            color="#94a3b8"
            weight={2}
            dashArray="5 5"
          />
        ))}

        {routeCoords && routeCoords.length > 1 && (
          <Polyline positions={routeCoords} color="#2563eb" weight={4} />
        )}

        {routeCoords && routeCoords.length > 1 && (
          <>
            <Marker position={routeCoords[0]} icon={L.divIcon({ className: "route-marker-pickup", html: "<div style='background:#10b981;width:12px;height:12px;border-radius:50%;border:2px solid #fff'></div>", iconSize: [12, 12] })}>
              <Popup>Pickup: {loads.find((l) => l._id === routeLoadId)?.pickupLocation || "Start"}</Popup>
            </Marker>
            <Marker position={routeCoords[routeCoords.length - 1]} icon={L.divIcon({ className: "route-marker-delivery", html: "<div style='background:#ef4444;width:12px;height:12px;border-radius:50%;border:2px solid #fff'></div>", iconSize: [12, 12] })}>
              <Popup>Delivery: {loads.find((l) => l._id === routeLoadId)?.deliveryLocation || "End"}</Popup>
            </Marker>
          </>
        )}

        {!routeCoords && routeLoadId && loads.find((l) => l._id === routeLoadId)?.pickupLat && (
          <>
            <Polyline
              positions={[[loads.find((l) => l._id === routeLoadId).pickupLat, loads.find((l) => l._id === routeLoadId).pickupLng],
                          [loads.find((l) => l._id === routeLoadId).deliveryLat, loads.find((l) => l._id === routeLoadId).deliveryLng]]}
              color="#f59e0b" weight={3} dashArray="8 4"
            />
            <Marker position={[loads.find((l) => l._id === routeLoadId).pickupLat, loads.find((l) => l._id === routeLoadId).pickupLng]}
              icon={L.divIcon({ className: "route-marker-pickup", html: "<div style='background:#10b981;width:12px;height:12px;border-radius:50%;border:2px solid #fff'></div>", iconSize: [12, 12] })}>
              <Popup>Pickup: {loads.find((l) => l._id === routeLoadId)?.pickupLocation}</Popup>
            </Marker>
            <Marker position={[loads.find((l) => l._id === routeLoadId).deliveryLat, loads.find((l) => l._id === routeLoadId).deliveryLng]}
              icon={L.divIcon({ className: "route-marker-delivery", html: "<div style='background:#ef4444;width:12px;height:12px;border-radius:50%;border:2px solid #fff'></div>", iconSize: [12, 12] })}>
              <Popup>Delivery: {loads.find((l) => l._id === routeLoadId)?.deliveryLocation}</Popup>
            </Marker>
          </>
        )}
      </MapContainer>
    </div>
    );
  };

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
          {navItems.map(([id, labelKey]) => (
            <button
              key={id}
              className={activePanel === id ? "active" : ""}
              onClick={() => {
                setActivePanel(id);
                closeSidebar();
              }}
            >
              {t(labelKey)}
            </button>
          ))}
        </nav>

        <div className="admin1-sidebar-footer">
          <ThemeToggle />
          <LanguageSwitcher />
          <button className="admin1-nav-link" onClick={() => navigate("/audit")}>
            Audit Trail
          </button>
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
          <span>FleetFlow Admin</span>
        </div>
      </aside>

      <main className="admin1-main">
        <header className="admin1-topbar">
          <div>
            <span className="admin1-eyebrow">{t("dashboard.operationsControl")}</span>
            <h1>{t("dashboard.operationsControl")}</h1>
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
            <span>{t("dashboard.totalLoads")}</span>
            <strong>{metrics.totalLoads}</strong>
            <small>{metrics.inTransitLoads} {t("status.inTransit")}</small>
          </div>
          <div className="admin1-kpi-card">
            <span>{t("dashboard.waiting")}</span>
            <strong>{metrics.waitingLoads}</strong>
            <small>{t("dashboard.dispatch")}</small>
          </div>
          <div className="admin1-kpi-card">
            <span>{t("dashboard.available")}</span>
            <strong>{metrics.availableDrivers}</strong>
            <small>{metrics.activeDrivers} {t("driver.onDuty")}</small>
          </div>
          <div className="admin1-kpi-card">
            <span>{t("dashboard.fleetReady")}</span>
            <strong>{metrics.availableTrucks}</strong>
            <small>{metrics.maintenanceTrucks} {t("status.underMaintenance")}</small>
          </div>
          <div className="admin1-kpi-card">
            <span>{t("dashboard.openIssues")}</span>
            <strong>{metrics.openIssues}</strong>
            <small>{t("dashboard.reportedByDrivers")}</small>
          </div>
        </section>

        {activePanel === "overview" && (
          <>
            <section className="admin1-grid two">
              <div className="admin1-panel">
                <div className="admin1-panel-header">
                  <div>
                    <span className="admin1-eyebrow">Live Tracking</span>
                    <h2>Driver Locations</h2>
                  </div>
                  <button className="btn" onClick={() => setActivePanel("map")}>Open Map</button>
                </div>
                {renderMap()}
              </div>

              <div className="admin1-panel">
                <div className="admin1-panel-header">
                  <div>
                    <span className="admin1-eyebrow">Workload</span>
                    <h2>Load Status</h2>
                  </div>
                </div>
                <div className="admin1-status-list">
                  <div>
                    <Badge value="waiting" />
                    <strong>{metrics.waitingLoads}</strong>
                  </div>
                  <div>
                    <Badge value="in transit" />
                    <strong>{metrics.inTransitLoads}</strong>
                  </div>
                  <div>
                    <Badge value="completed" />
                    <strong>{metrics.completedLoads}</strong>
                  </div>
                  <div>
                    <Badge value="under maintenance" />
                    <strong>{metrics.maintenanceTrucks}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="admin1-panel">
              <div className="admin1-panel-header">
                <div>
                  <span className="admin1-eyebrow">Recent Activity</span>
                  <h2>Latest Loads</h2>
                </div>
                <button className="btn" onClick={() => setActivePanel("loads")}>Manage Loads</button>
              </div>
              <div className="admin1-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ticket#</th>
                      <th>Customer</th>
                      <th>Route</th>
                      <th>Driver</th>
                      <th>Truck</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLoads.map((load) => (
                      <tr key={load._id}>
                        <td>{load.ticketNumber || "-"}</td>
                        <td>{load.customer?.name || "Unassigned"}</td>
                        <td>{load.pickupLocation} → {load.deliveryLocation}</td>
                        <td>{load.driver?.name || "Unassigned"}</td>
                        <td>{load.truck?.registrationNumber || "No truck"}</td>
                        <td><Badge value={load.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {activePanel === "loads" && (
          <section className="admin1-panel">
            <div className="admin1-panel-header">
              <div>
                <span className="admin1-eyebrow">Dispatch</span>
                <h2>Create Load</h2>
              </div>
            </div>
            <div style={{ padding: "10px 12px", marginBottom: 14, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }}>
              <span style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>Filter Loads</span>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                <label style={{ fontSize: "0.8rem" }}>
                  Date From:
                  <input type="date" value={loadDateRange.start} onChange={(e) => setLoadDateRange({ ...loadDateRange, start: e.target.value })} style={{ marginLeft: 4 }} />
                </label>
                <label style={{ fontSize: "0.8rem" }}>
                  Date To:
                  <input type="date" value={loadDateRange.end} onChange={(e) => setLoadDateRange({ ...loadDateRange, end: e.target.value })} style={{ marginLeft: 4 }} />
                </label>
                {["waiting", "assigned", "in transit", "completed", "approved", "rejected", "canceled"].map((s) => (
                  <label key={s} style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 4 }}>
                    <input type="checkbox" checked={loadMultiStatus.includes(s)} onChange={() => setLoadMultiStatus((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])} />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <form className="admin1-form" onSubmit={handleLoadSubmit}>
              <FormField label="Collection Date" name="collectionDate" type="date" value={loadForm.collectionDate} onChange={(e) => setLoadForm({ ...loadForm, collectionDate: e.target.value })} onBlur={() => setLoadTouched({ ...loadTouched, collectionDate: true })} error={loadErrors.collectionDate} touched={loadTouched.collectionDate} />
              <FormField label="Customer" name="client" type="select" value={loadForm.client} onChange={(e) => setLoadForm({ ...loadForm, client: e.target.value })} onBlur={() => setLoadTouched({ ...loadTouched, client: true })} error={loadErrors.client} touched={loadTouched.client} required>
                <option value="">Customer</option>
                {customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.name}</option>)}
              </FormField>
              <FormField label="Pickup Location" name="pickupLocation" value={loadForm.pickupLocation} onChange={(e) => setLoadForm({ ...loadForm, pickupLocation: sanitizeInput(e.target.value) })} onBlur={() => setLoadTouched({ ...loadTouched, pickupLocation: true })} error={loadErrors.pickupLocation} touched={loadTouched.pickupLocation} required helpKey="address" />
              <FormField label="Delivery Location" name="deliveryLocation" value={loadForm.deliveryLocation} onChange={(e) => setLoadForm({ ...loadForm, deliveryLocation: sanitizeInput(e.target.value) })} onBlur={() => setLoadTouched({ ...loadTouched, deliveryLocation: true })} error={loadErrors.deliveryLocation} touched={loadTouched.deliveryLocation} required helpKey="address" />
              <FormField label="Driver" name="driver" type="select" value={loadForm.driver} onChange={(e) => setLoadForm({ ...loadForm, driver: e.target.value })} onBlur={() => setLoadTouched({ ...loadTouched, driver: true })} error={loadErrors.driver} touched={loadTouched.driver}>
                <option value="">Assign driver</option>
                {drivers.map((driver) => <option key={driver._id} value={driver._id}>{driver.name} ({driver.email})</option>)}
              </FormField>
              <FormField label="Truck" name="truck" type="select" value={loadForm.truck} onChange={(e) => setLoadForm({ ...loadForm, truck: e.target.value })} onBlur={() => setLoadTouched({ ...loadTouched, truck: true })} error={loadErrors.truck} touched={loadTouched.truck}>
                <option value="">Assign truck</option>
                {trucks.map((truck) => <option key={truck._id} value={truck._id}>{truck.registrationNumber}</option>)}
              </FormField>
              <FormField label="Status" name="status" type="select" value={loadForm.status} onChange={(e) => setLoadForm({ ...loadForm, status: e.target.value })} onBlur={() => setLoadTouched({ ...loadTouched, status: true })} error={loadErrors.status} touched={loadTouched.status}>
                <option value="waiting">Waiting</option>
                <option value="assigned">Assigned</option>
                <option value="in transit">In Transit</option>
                <option value="completed">Completed</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="canceled">Canceled</option>
              </FormField>
              <FormField label="Delivery Date" name="deliveryDate" type="date" value={loadForm.deliveryDate} onChange={(e) => setLoadForm({ ...loadForm, deliveryDate: e.target.value })} onBlur={() => setLoadTouched({ ...loadTouched, deliveryDate: true })} error={loadErrors.deliveryDate} touched={loadTouched.deliveryDate} />
              <FormField label="Cargo Type" name="cargoType" value={loadForm.cargoType} onChange={(e) => setLoadForm({ ...loadForm, cargoType: sanitizeInput(e.target.value) })} onBlur={() => setLoadTouched({ ...loadTouched, cargoType: true })} error={loadErrors.cargoType} touched={loadTouched.cargoType} helpKey="cargo" />
              <FormField label="Weight" name="weight" type="number" value={loadForm.weight} onChange={(e) => setLoadForm({ ...loadForm, weight: sanitizeInput(e.target.value) })} onBlur={() => setLoadTouched({ ...loadTouched, weight: true })} error={loadErrors.weight} touched={loadTouched.weight} helpKey="capacity" />
              <FormField label="Customer Ref" name="customerRef" value={loadForm.customerRef} onChange={(e) => setLoadForm({ ...loadForm, customerRef: sanitizeInput(e.target.value) })} onBlur={() => setLoadTouched({ ...loadTouched, customerRef: true })} error={loadErrors.customerRef} touched={loadTouched.customerRef} helpKey="customerRef" />
              <button type="submit" className="btn create-load">Create Load</button>
            </form>

            <div className="admin1-bulk-toolbar" style={{ display: selectedIds.length > 0 ? "flex" : "none", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0", flexWrap: "wrap" }}>
              <span>{selectedIds.length} selected</span>
              <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} aria-label="Bulk status">
                <option value="">Set status...</option>
                <option value="waiting">Waiting</option>
                <option value="assigned">Assigned</option>
                <option value="in transit">In Transit</option>
                <option value="completed">Completed</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="canceled">Canceled</option>
              </select>
              <button className="admin1-action" onClick={handleBulkStatus} disabled={!bulkStatus}>Update Status</button>
              <select value={bulkDriver} onChange={(e) => setBulkDriver(e.target.value)} aria-label="Bulk assign driver">
                <option value="">Assign driver...</option>
                {drivers.filter((d) => d.status === "on-duty" || d.status === "available").map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
              <button className="admin1-action" onClick={handleBulkAssign} disabled={!bulkDriver}>Assign</button>
              <button className="admin1-action danger" onClick={handleBulkDelete}>Delete</button>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", margin: "0.5rem 0", flexWrap: "wrap" }}>
              <CSVLink data={filteredLoads.map((l) => ({ Ticket: l.ticketNumber, Customer: l.customer?.name, Pickup: l.pickupLocation, Delivery: l.deliveryLocation, Driver: l.driver?.name, Truck: l.truck?.registrationNumber, Status: l.status, "Route km": l.routeDistance, ETA: l.routeDuration, "Customer Ref": l.customerRef }))} filename="loads.csv">
                <button className="admin1-action">Export CSV</button>
              </CSVLink>
              <button className="admin1-action" onClick={() => exportToExcel(filteredLoads.map((l) => ({ Ticket: l.ticketNumber, Customer: l.customer?.name, Pickup: l.pickupLocation, Delivery: l.deliveryLocation, Driver: l.driver?.name, Truck: l.truck?.registrationNumber, Status: l.status, "Route km": l.routeDistance, ETA: l.routeDuration, "Customer Ref": l.customerRef })), "loads", "Loads")}>
                Export Excel
              </button>
            </div>

            <div className="admin1-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th><input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.length === paginatedLoads.length && paginatedLoads.length > 0} aria-label="Select all" /></th>
                    <th>Ticket#</th>
                    <th>Customer Ref</th>
                    <th>Customer</th>
                    <th>Pickup</th>
                    <th>Delivery</th>
                    <th>Dist</th>
                    <th>ETA</th>
                    <th>Driver</th>
                    <th>Truck</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLoads.map((load) => (
                    <tr key={load._id} className={selectedIds.includes(load._id) ? "admin1-row-selected" : ""}>
                      <td><input type="checkbox" checked={selectedIds.includes(load._id)} onChange={() => toggleSelect(load._id)} aria-label={`Select load ${load.customer?.name || load._id}`} /></td>
                      <td>{load.ticketNumber || "-"}</td>
                      <td>{load.customerRef || "-"}</td>
                      <td>{load.customer?.name || "Unassigned"}</td>
                      <td>{load.pickupLocation}</td>
                      <td>{load.deliveryLocation}</td>
                      <td style={{ fontSize: "0.8rem" }}>{load.routeDistance ? `${load.routeDistance} km` : "-"}</td>
                      <td style={{ fontSize: "0.8rem" }}>{load.routeDuration ? `${load.routeDuration} min` : "-"}</td>
                      <td>{load.driver?.name || "Unassigned"}</td>
                      <td>{load.truck?.registrationNumber || "No truck"}</td>
                      <td><Badge value={load.status} /></td>
                      <td>
                        <button className="admin1-action" onClick={() => openEditModal("Load", load)}>Edit</button>
                        <button className="admin1-action danger" onClick={() => handleDelete("Load", load._id)}>Delete</button>
                        {!load.podUrl && load.status === "completed" && (
                          <button className="admin1-action" onClick={() => handleGeneratePOD(load._id)}>Gen POD</button>
                        )}
                        {load.podUrl && (
                          <a href={`${BACKEND_URL}${load.podUrl}`} target="_blank" rel="noopener noreferrer" className="admin1-action" style={{ textDecoration: "none", display: "inline-block" }}>POD</a>
                        )}
                        {load.ticketNumber && (
                          <button className="admin1-action" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/track/${load.ticketNumber}`); setFormMsg({ type: "success", text: "Tracking link copied!" }); }}>
                            Share
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={loadPage}
              pages={Math.ceil(filteredLoads.length / PAGE_SIZE)}
              onPageChange={setLoadPage}
            />
          </section>
        )}

        {activePanel === "drivers" && (
          <section className="admin1-panel">
            <div className="admin1-panel-header">
              <div>
                <span className="admin1-eyebrow">People</span>
                <h2>Drivers</h2>
              </div>
            </div>
            <select className="admin1-select" value={driverForm._id} onChange={handleDriverSelect}>
              <option value="">Register new driver</option>
              {drivers.map((driver) => <option key={driver._id} value={driver._id}>{driver.email}</option>)}
            </select>
            <form className="admin1-form" onSubmit={handleDriverSubmit}>
              <FormField label="Name" name="name" value={driverForm.name} onChange={(e) => setDriverForm({ ...driverForm, name: sanitizeInput(e.target.value) })} onBlur={() => setDriverTouched({ ...driverTouched, name: true })} error={driverErrors.name} touched={driverTouched.name} required />
              <FormField label="Email" name="email" type="email" value={driverForm.email} onChange={(e) => setDriverForm({ ...driverForm, email: sanitizeInput(e.target.value) })} onBlur={() => setDriverTouched({ ...driverTouched, email: true })} error={driverErrors.email} touched={driverTouched.email} required helpKey="email" />
              {!driverForm._id && <FormField label="Password" name="password" type="password" value={driverForm.password} onChange={(e) => setDriverForm({ ...driverForm, password: sanitizeInput(e.target.value) })} onBlur={() => setDriverTouched({ ...driverTouched, password: true })} error={driverErrors.password} touched={driverTouched.password} required helpKey="password" />}
              <FormField label="Phone" name="phone" value={driverForm.phone} onChange={(e) => setDriverForm({ ...driverForm, phone: sanitizeInput(e.target.value) })} onBlur={() => setDriverTouched({ ...driverTouched, phone: true })} error={driverErrors.phone} touched={driverTouched.phone} helpKey="phone" />
              <FormField label="License Number" name="licenseNumber" value={driverForm.licenseNumber} onChange={(e) => setDriverForm({ ...driverForm, licenseNumber: sanitizeInput(e.target.value) })} onBlur={() => setDriverTouched({ ...driverTouched, licenseNumber: true })} error={driverErrors.licenseNumber} touched={driverTouched.licenseNumber} helpKey="license" />
              <FormField label="Status" name="status" type="select" value={driverForm.status} onChange={(e) => setDriverForm({ ...driverForm, status: e.target.value })} onBlur={() => setDriverTouched({ ...driverTouched, status: true })} error={driverErrors.status} touched={driverTouched.status}>
                <option value="available">Available</option>
                <option value="on-duty">On Duty</option>
                <option value="inactive">Inactive</option>
              </FormField>
              <button type="submit" className="btn">{driverForm._id ? "Update Driver" : "Register Driver"}</button>
            </form>

            <div className="admin1-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>License</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDrivers.map((driver) => (
                    <tr key={driver._id}>
                      <td>{driver.name}</td>
                      <td>{driver.email}</td>
                      <td>{driver.phone || "-"}</td>
                      <td>{driver.licenseNumber || "-"}</td>
                      <td><Badge value={driver.status} /></td>
                      <td>
                        <button className="admin1-action" onClick={() => openEditModal("Driver", driver)}>Edit</button>
                        <button className="admin1-action danger" onClick={() => handleDelete("Driver", driver._id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activePanel === "fleet" && (
          <section className="admin1-panel">
            <div className="admin1-panel-header">
              <div>
                <span className="admin1-eyebrow">Assets</span>
                <h2>Fleet</h2>
              </div>
            </div>
            <form className="admin1-form" onSubmit={handleTruckSubmit}>
              <FormField label="Registration Number" name="registrationNumber" value={truckForm.registrationNumber} onChange={(e) => setTruckForm({ ...truckForm, registrationNumber: sanitizeInput(e.target.value) })} onBlur={() => setTruckTouched({ ...truckTouched, registrationNumber: true })} error={truckErrors.registrationNumber} touched={truckTouched.registrationNumber} required helpKey="registration" />
              <FormField label="Model" name="model" value={truckForm.model} onChange={(e) => setTruckForm({ ...truckForm, model: sanitizeInput(e.target.value) })} onBlur={() => setTruckTouched({ ...truckTouched, model: true })} error={truckErrors.model} touched={truckTouched.model} required />
              <FormField label="Capacity" name="capacity" type="number" value={truckForm.capacity} onChange={(e) => setTruckForm({ ...truckForm, capacity: sanitizeInput(e.target.value) })} onBlur={() => setTruckTouched({ ...truckTouched, capacity: true })} error={truckErrors.capacity} touched={truckTouched.capacity} required helpKey="capacity" />
              <FormField label="Make" name="make" value={truckForm.make} onChange={(e) => setTruckForm({ ...truckForm, make: sanitizeInput(e.target.value) })} onBlur={() => setTruckTouched({ ...truckTouched, make: true })} error={truckErrors.make} touched={truckTouched.make} />
              <FormField label="Year" name="year" type="number" value={truckForm.year} onChange={(e) => setTruckForm({ ...truckForm, year: sanitizeInput(e.target.value) })} onBlur={() => setTruckTouched({ ...truckTouched, year: true })} error={truckErrors.year} touched={truckTouched.year} />
              <FormField label="Fuel Type" name="fuelType" type="select" value={truckForm.fuelType} onChange={(e) => setTruckForm({ ...truckForm, fuelType: e.target.value })} onBlur={() => setTruckTouched({ ...truckTouched, fuelType: true })} error={truckErrors.fuelType} touched={truckTouched.fuelType}>
                <option value="diesel">Diesel</option>
                <option value="petrol">Petrol</option>
                <option value="electric">Electric</option>
                <option value="hybrid">Hybrid</option>
              </FormField>
              <FormField label="Status" name="status" type="select" value={truckForm.status} onChange={(e) => setTruckForm({ ...truckForm, status: e.target.value })} onBlur={() => setTruckTouched({ ...truckTouched, status: true })} error={truckErrors.status} touched={truckTouched.status}>
                <option value="available">Available</option>
                <option value="in service">In Service</option>
                <option value="under maintenance">Under Maintenance</option>
              </FormField>
              <FormField label="Insurance Expiry" name="insuranceExpiry" type="date" value={truckForm.insuranceExpiry} onChange={(e) => setTruckForm({ ...truckForm, insuranceExpiry: e.target.value })} onBlur={() => setTruckTouched({ ...truckTouched, insuranceExpiry: true })} error={truckErrors.insuranceExpiry} touched={truckTouched.insuranceExpiry} />
              <FormField label="Mileage" name="mileage" type="number" value={truckForm.mileage} onChange={(e) => setTruckForm({ ...truckForm, mileage: sanitizeInput(e.target.value) })} onBlur={() => setTruckTouched({ ...truckTouched, mileage: true })} error={truckErrors.mileage} touched={truckTouched.mileage} />
              <button type="submit" className="btn">Add Truck</button>
            </form>

            <div className="admin1-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Reg No</th>
                    <th>Model</th>
                    <th>Capacity</th>
                    <th>Status</th>
                    <th>Mileage</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrucks.map((truck) => (
                    <tr key={truck._id}>
                      <td>{truck.registrationNumber}</td>
                      <td>{truck.model}</td>
                      <td>{truck.capacity || "-"}</td>
                      <td><Badge value={truck.status} /></td>
                      <td>{truck.mileage || "-"}</td>
                      <td>
                        <button className="admin1-action" onClick={() => openEditModal("Truck", truck)}>Edit</button>
                        <button className="admin1-action danger" onClick={() => handleDelete("Truck", truck._id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activePanel === "customers" && (
          <section className="admin1-panel">
            <div className="admin1-panel-header">
              <div>
                <span className="admin1-eyebrow">Accounts</span>
                <h2>Customers</h2>
              </div>
            </div>
            <form className="admin1-form" onSubmit={handleCustomerSubmit}>
              <FormField label="Name" name="name" value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: sanitizeInput(e.target.value) })} onBlur={() => setCustomerTouched({ ...customerTouched, name: true })} error={customerErrors.name} touched={customerTouched.name} required />
              <FormField label="Email" name="email" type="email" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: sanitizeInput(e.target.value) })} onBlur={() => setCustomerTouched({ ...customerTouched, email: true })} error={customerErrors.email} touched={customerTouched.email} required helpKey="email" />
              <FormField label="Phone" name="phone" value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: sanitizeInput(e.target.value) })} onBlur={() => setCustomerTouched({ ...customerTouched, phone: true })} error={customerErrors.phone} touched={customerTouched.phone} required helpKey="phone" />
              <FormField label="Address" name="address" value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: sanitizeInput(e.target.value) })} onBlur={() => setCustomerTouched({ ...customerTouched, address: true })} error={customerErrors.address} touched={customerTouched.address} required helpKey="address" />
              <button type="submit" className="btn">Add Customer</button>
            </form>

            <div className="admin1-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Address</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr key={customer._id}>
                      <td>{customer.name}</td>
                      <td>{customer.email}</td>
                      <td>{customer.phone}</td>
                      <td>{customer.address}</td>
                      <td>
                        <button className="admin1-action" onClick={() => openEditModal("Customer", customer)}>Edit</button>
                        <button className="admin1-action danger" onClick={() => handleDelete("Customer", customer._id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activePanel === "issues" && (
          <section className="admin1-panel">
            <div className="admin1-panel-header">
              <div>
                <span className="admin1-eyebrow">Exceptions</span>
                <h2>Driver-Reported Issues ({issueLoads.length})</h2>
              </div>
            </div>
            {issueLoads.length === 0 ? (
              <div className="admin1-empty">No open issues reported by drivers.</div>
            ) : (
              <div className="admin1-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Customer</th>
                      <th>Driver</th>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Truck</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issueLoads.map((load) => (
                      <tr key={load._id}>
                        <td>{load.ticketNumber || "-"}</td>
                        <td>{load.customer?.name || "-"}</td>
                        <td>{load.driver?.name || load.driver?.email || "-"}</td>
                        <td><Badge value={load.driverIssue.type} /></td>
                        <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {load.driverIssue.description}
                        </td>
                        <td>{load.truck?.registrationNumber || "-"}</td>
                        <td>
                          <button className="admin1-action" onClick={() => { setResolveLoad(load); setResolutionNote(""); }}>
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activePanel === "dispatch" && (
          <section className="admin1-panel">
            <div className="admin1-panel-header">
              <div>
                <span className="admin1-eyebrow">{t("dashboard.dispatch")}</span>
                <h2>{t("nav.dispatch")} Board</h2>
              </div>
            </div>

            <div className="admin1-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ticket#</th>
                    <th>Customer</th>
                    <th>Route</th>
                    <th>Driver</th>
                    <th>Truck</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatchLoads.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="admin1-empty">No active loads to dispatch.</td>
                    </tr>
                  ) : (
                    dispatchLoads.map((load) => (
                      <tr key={load._id}>
                        <td>{load.ticketNumber || "-"}</td>
                        <td>{load.customer?.name || "Unassigned"}</td>
                        <td style={{ fontSize: "0.8rem" }}>
                          {load.pickupLocation} → {load.deliveryLocation}
                        </td>
                        <td>{load.driver?.name || "Unassigned"}</td>
                        <td>{load.truck?.registrationNumber || "-"}</td>
                        <td><Badge value={load.status} /></td>
                        <td>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                            {load.status === "waiting" && (
                              <button className="admin1-action" onClick={() => handleQuickStatus(load._id, "assigned")}>
                                Assign
                              </button>
                            )}
                            {(load.status === "waiting" || load.status === "assigned") && (
                              <button className="admin1-action" onClick={() => handleQuickStatus(load._id, "in transit")}>
                                In Transit
                              </button>
                            )}
                            {load.status === "in transit" && (
                              <button className="admin1-action" onClick={() => handleQuickStatus(load._id, "completed")}>
                                Complete
                              </button>
                            )}
                            <select
                              value=""
                              onChange={(e) => { if (e.target.value) handleQuickAssign(load._id, e.target.value); e.target.value = ""; }}
                              style={{ fontSize: "0.75rem", maxWidth: 110 }}
                              aria-label="Assign driver"
                            >
                              <option value="">Driver...</option>
                              {drivers.filter((d) => d.status === "on-duty" || d.status === "available").map((d) => (
                                <option key={d._id} value={d._id}>{d.name}</option>
                              ))}
                            </select>
                            <button className="admin1-action" onClick={() => setActivePanel("map")}>
                              View on Map
                            </button>
                            {load.podUrl && (
                              <a href={`${BACKEND_URL}${load.podUrl}`} target="_blank" rel="noopener noreferrer" className="admin1-action" style={{ textDecoration: "none" }}>POD</a>
                            )}
                            {load.ticketNumber && (
                              <button className="admin1-action" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/track/${load.ticketNumber}`); setFormMsg({ type: "success", text: "Tracking link copied!" }); }}>
                                Share
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activePanel === "map" && (
          <section className="admin1-panel">
            <div className="admin1-panel-header">
              <div>
                <span className="admin1-eyebrow">Tracking</span>
                <h2>Live Driver Map &amp; Route Planning</h2>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button onClick={() => setShowAllRoutes(!showAllRoutes)}>
                  {showAllRoutes ? "Hide Routes" : "Show All Routes"}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 300 }}>
                {renderMap()}
              </div>

              <div style={{ width: 320, background: "#fff", borderRadius: 8, padding: "1rem", border: "1px solid #e2e8f0" }}>
                <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Route Planning</h3>

                <label style={{ fontWeight: 600, fontSize: "0.875rem" }}>Select Load</label>
                <select value={routeLoadId} onChange={(e) => { setRouteLoadId(e.target.value); setRouteCoords(null); setRouteInfo(null); }} style={{ width: "100%", padding: "0.4rem", marginBottom: "0.75rem" }}>
                  <option value="">Choose a load...</option>
                  {loads.filter((l) => l.pickupLocation && l.deliveryLocation).map((l) => (
                    <option key={l._id} value={l._id}>{l.ticketNumber} — {l.pickupLocation} → {l.deliveryLocation}</option>
                  ))}
                </select>

                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <button onClick={handleCalculateRoute} disabled={!routeLoadId || routeLoading} style={{ flex: 1 }}>
                    {routeLoading ? "Calculating..." : "Calculate Route"}
                  </button>
                  <button onClick={() => fetchLoadRoute(routeLoadId)} disabled={!routeLoadId || routeLoading} title="Refresh saved route">
                    ↻
                  </button>
                </div>

                {routeInfo && (
                  <div style={{ background: "#f8fafc", borderRadius: 6, padding: "0.75rem", marginBottom: "0.75rem", fontSize: "0.875rem" }}>
                    {routeInfo.error ? (
                      <p style={{ color: "#e74c3c" }}>{routeInfo.error}</p>
                    ) : routeInfo.needsGeocode ? (
                      <p style={{ color: "#d97706" }}>Addresses need geocoding. Click "Calculate Route" to resolve.</p>
                    ) : (
                      <>
                        {routeInfo.roadDistanceKm && (
                          <p style={{ margin: "0 0 0.25rem" }}><strong>Road:</strong> {routeInfo.roadDistanceKm} km</p>
                        )}
                        <p style={{ margin: "0 0 0.25rem" }}><strong>Straight:</strong> {routeInfo.straightLineKm || routeInfo.distance} km</p>
                        <p style={{ margin: 0 }}><strong>ETA:</strong> {routeInfo.durationMin || routeInfo.duration} min @ 60 km/h</p>
                      </>
                    )}
                  </div>
                )}

                <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "0.75rem 0" }} />

                <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.875rem" }}>Geocode Address</h3>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input value={geocodeQuery} onChange={(e) => setGeocodeQuery(e.target.value)} placeholder="e.g. Johannesburg, SA" style={{ flex: 1 }} />
                  <button onClick={handleGeocode}>Search</button>
                </div>
                {geocodeResult && (
                  <div style={{ fontSize: "0.8rem", marginTop: "0.5rem", padding: "0.5rem", borderRadius: 4, background: geocodeResult.error ? "#fef2f2" : "#f0fdf4" }}>
                    {geocodeResult.error ? (
                      <span style={{ color: "#b91c1c" }}>{geocodeResult.error}</span>
                    ) : (
                      <><strong>{geocodeResult.displayName}</strong><br />Lat: {geocodeResult.lat}, Lng: {geocodeResult.lng}</>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {activePanel === "maintenance" && (
          <>
            <section className="admin1-panel">
              <div className="admin1-panel-header">
                <div>
                  <span className="admin1-eyebrow">Fleet Care</span>
                  <h2>Maintenance ({maintenanceRecords.length})</h2>
                </div>
                <button onClick={() => { fetchMaintenanceUpcoming(); fetchMaintenance(); setShowCreateMaintenance(true); }}>
                  + Schedule Service
                </button>
              </div>

              {maintenanceUpcoming && (
                <div className="admin1-kpis" style={{ marginBottom: "1rem" }}>
                  <div className="admin1-kpi-card">
                    <span>Overdue</span>
                    <strong style={{ color: "#e74c3c" }}>{maintenanceUpcoming.overdue?.length || 0}</strong>
                  </div>
                  <div className="admin1-kpi-card">
                    <span>Upcoming (14d)</span>
                    <strong style={{ color: "#d97706" }}>{maintenanceUpcoming.upcoming?.length || 0}</strong>
                  </div>
                  <div className="admin1-kpi-card">
                    <span>Total Cost</span>
                    <strong>R{(maintenanceUpcoming.totalMaintenanceCost || 0).toLocaleString()}</strong>
                  </div>
                </div>
              )}

              <div className="admin1-filters">
                <label>
                  Truck:
                  <select value={maintenanceFilter.truck} onChange={(e) => setMaintenanceFilter({ ...maintenanceFilter, truck: e.target.value })}>
                    <option value="">All</option>
                    {trucks.map((t) => <option key={t._id} value={t._id}>{t.registrationNumber}</option>)}
                  </select>
                </label>
                <label>
                  Status:
                  <select value={maintenanceFilter.status} onChange={(e) => setMaintenanceFilter({ ...maintenanceFilter, status: e.target.value })}>
                    <option value="">All</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="in progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="overdue">Overdue</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
                <button onClick={() => { fetchMaintenanceUpcoming(); fetchMaintenance(); }}>
                  {maintenanceLoading ? "Loading..." : "Refresh"}
                </button>
              </div>

              {maintenanceRecords.length === 0 && !maintenanceLoading ? (
                <div className="admin1-empty">No maintenance records found.</div>
              ) : (
                <div className="admin1-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Truck</th>
                        <th>Service</th>
                        <th>Scheduled</th>
                        <th>Completed</th>
                        <th>Cost</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {maintenanceRecords.map((rec) => (
                        <tr key={rec._id}>
                          <td>{rec.truck?.registrationNumber || "-"}</td>
                          <td>{rec.serviceType}</td>
                          <td>{rec.scheduledDate ? new Date(rec.scheduledDate).toLocaleDateString() : "-"}</td>
                          <td>{rec.completedDate ? new Date(rec.completedDate).toLocaleDateString() : "-"}</td>
                          <td>R{(rec.cost || 0).toLocaleString()}</td>
                          <td>
                            <span className={`admin1-badge ${
                              rec.status === "completed" ? "success" :
                              rec.status === "overdue" ? "danger" :
                              rec.status === "in progress" ? "info" :
                              rec.status === "cancelled" ? "danger" : "warning"
                            }`}>{rec.status}</span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "0.25rem" }}>
                              {rec.status !== "completed" && rec.status !== "cancelled" && (
                                <button className="admin1-btn-sm" onClick={() => setShowCompleteMaintenance(rec)}>Complete</button>
                              )}
                              {rec.status !== "completed" && (
                                <button className="admin1-btn-sm admin1-btn-danger" onClick={async () => {
                                  const ok = await confirm("Delete this maintenance record?", "Delete Maintenance", "Delete", "Cancel", "danger");
                                  if (!ok) return;
                                  try {
                                    await API.delete(`/maintenance/${rec._id}`, authHeaders);
                                    fetchMaintenance(); fetchMaintenanceUpcoming();
                                  } catch (e) { setFormMsg({ type: "error", text: e.response?.data?.message || "Failed" }); }
                                }}>×</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Schedule Maintenance Modal */}
            {showCreateMaintenance && (
              <div className="admin1-modal-overlay" ref={maintCreateRef} onClick={() => setShowCreateMaintenance(false)} role="dialog" aria-modal="true" aria-label="Schedule maintenance modal">
                <div className="admin1-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
                  <div className="admin1-modal-header">
                    <h2>Schedule Maintenance</h2>
                    <button className="admin1-modal-close" onClick={() => setShowCreateMaintenance(false)} data-close-modal>×</button>
                  </div>
                  <div className="admin1-modal-body">
                    <label>Truck *</label>
                    <select value={maintenanceForm.truck} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, truck: e.target.value })}>
                      <option value="">Select truck</option>
                      {trucks.map((t) => <option key={t._id} value={t._id}>{t.registrationNumber} — {t.model}</option>)}
                    </select>

                    <label>Service Type *</label>
                    <select value={maintenanceForm.serviceType} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, serviceType: e.target.value })}>
                      <option value="oil change">Oil Change</option>
                      <option value="tire rotation">Tire Rotation</option>
                      <option value="brake service">Brake Service</option>
                      <option value="engine service">Engine Service</option>
                      <option value="transmission">Transmission</option>
                      <option value="inspection">Inspection</option>
                      <option value="registration">Registration</option>
                      <option value="insurance">Insurance</option>
                      <option value="other">Other</option>
                    </select>

                    <label>Description</label>
                    <textarea rows={2} value={maintenanceForm.description} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })} />

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <label>Scheduled Date<input type="date" value={maintenanceForm.scheduledDate} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, scheduledDate: e.target.value })} /></label>
                      <label>Scheduled Mileage<input type="number" value={maintenanceForm.scheduledMileage} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, scheduledMileage: e.target.value })} placeholder="km" /></label>
                    </div>

                    <label>Vendor</label>
                    <input value={maintenanceForm.vendor} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, vendor: e.target.value })} placeholder="Service provider" />

                    <label>Estimated Cost</label>
                    <input type="number" value={maintenanceForm.cost} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })} placeholder="0" />

                    <label>Notes</label>
                    <textarea rows={2} value={maintenanceForm.notes} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, notes: e.target.value })} />

                    <div className="admin1-modal-actions">
                      <button className="secondary" onClick={() => setShowCreateMaintenance(false)}>Cancel</button>
                      <button onClick={async () => {
                        if (!maintenanceForm.truck) return setFormMsg({ type: "error", text: "Truck is required" });
                        try {
                          await API.post("/maintenance", maintenanceForm, authHeaders);
                          setShowCreateMaintenance(false);
                          setMaintenanceForm({ truck: "", serviceType: "oil change", description: "", scheduledDate: "", scheduledMileage: "", cost: "", vendor: "", notes: "" });
                          fetchMaintenance(); fetchMaintenanceUpcoming();
                        } catch (e) { setFormMsg({ type: "error", text: e.response?.data?.message || "Failed" }); }
                      }}>Schedule</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Complete Maintenance Modal */}
            {showCompleteMaintenance && (
              <div className="admin1-modal-overlay" ref={maintCompleteRef} onClick={() => setShowCompleteMaintenance(null)} role="dialog" aria-modal="true" aria-label="Complete service modal">
                <div className="admin1-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "450px" }}>
                  <div className="admin1-modal-header">
                    <h2>Complete Service</h2>
                    <button className="admin1-modal-close" onClick={() => setShowCompleteMaintenance(null)} data-close-modal>×</button>
                  </div>
                  <div className="admin1-modal-body">
                    <p>Truck: <strong>{showCompleteMaintenance.truck?.registrationNumber || "-"}</strong></p>
                    <p>Service: <strong>{showCompleteMaintenance.serviceType}</strong></p>

                    <label>Final Cost</label>
                    <input id="completeCost" type="number" defaultValue={showCompleteMaintenance.cost || 0} />

                    <label>Completed Mileage</label>
                    <input id="completeMileage" type="number" placeholder="km" />

                    <label>Vendor</label>
                    <input id="completeVendor" defaultValue={showCompleteMaintenance.vendor || ""} />

                    <label>Notes</label>
                    <textarea id="completeNotes" rows={2} defaultValue={showCompleteMaintenance.notes || ""} />

                    <div className="admin1-modal-actions">
                      <button className="secondary" onClick={() => setShowCompleteMaintenance(null)}>Cancel</button>
                      <button onClick={async () => {
                        try {
                          await API.patch(`/maintenance/${showCompleteMaintenance._id}/complete`, {
                            cost: document.getElementById("completeCost").value,
                            completedMileage: document.getElementById("completeMileage").value,
                            vendor: document.getElementById("completeVendor").value,
                            notes: document.getElementById("completeNotes").value,
                          }, authHeaders);
                          setShowCompleteMaintenance(null);
                          fetchMaintenance(); fetchMaintenanceUpcoming();
                        } catch (e) { setFormMsg({ type: "error", text: e.response?.data?.message || "Failed" }); }
                      }}>Mark Completed</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activePanel === "invoices" && (
          <>
            <section className="admin1-panel">
              <div className="admin1-panel-header">
                <div>
                  <span className="admin1-eyebrow">Billing</span>
                  <h2>Invoices ({invoices.length})</h2>
                </div>
                <button onClick={() => { fetchData(); fetchInvoiceStats(); fetchInvoices(); setShowCreateInvoice(true); }}>
                  + New Invoice
                </button>
              </div>

              {invoiceStats && (
                <div className="admin1-kpis" style={{ marginBottom: "1rem" }}>
                  <div className="admin1-kpi-card">
                    <span>Total Invoiced</span>
                    <strong>R{(invoiceStats.totalInvoiced || 0).toLocaleString()}</strong>
                  </div>
                  <div className="admin1-kpi-card">
                    <span>Total Paid</span>
                    <strong>R{(invoiceStats.totalPaid || 0).toLocaleString()}</strong>
                  </div>
                  <div className="admin1-kpi-card">
                    <span>Outstanding</span>
                    <strong style={{ color: "#e74c3c" }}>R{(invoiceStats.totalOutstanding || 0).toLocaleString()}</strong>
                  </div>
                </div>
              )}

              <div className="admin1-filters">
                <label>
                  Status:
                  <select value={invoiceStatusFilter} onChange={(e) => setInvoiceStatusFilter(e.target.value)}>
                    <option value="">All</option>
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
                <button onClick={() => { fetchInvoiceStats(); fetchInvoices(); }}>
                  {invoicesLoading ? "Loading..." : "Refresh"}
                </button>
              </div>

              {invoices.length === 0 && !invoicesLoading ? (
                <div className="admin1-empty">No invoices found.</div>
              ) : (
                <div className="admin1-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Customer</th>
                        <th>Load</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Due</th>
                        <th>Paid</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv._id}>
                          <td><strong>{inv.invoiceNumber}</strong></td>
                          <td>{inv.customer?.name || "-"}</td>
                          <td>{inv.load?.ticketNumber || "-"}</td>
                          <td>R{(inv.total || 0).toLocaleString()}</td>
                          <td>
                            <span className={`admin1-badge ${
                              inv.status === "paid" ? "success" :
                              inv.status === "overdue" ? "danger" :
                              inv.status === "cancelled" ? "danger" :
                              inv.status === "sent" ? "info" : "warning"
                            }`}>{inv.status}</span>
                          </td>
                          <td style={{ color: inv.status !== "paid" && new Date(inv.dueDate) < new Date() ? "#e74c3c" : "inherit" }}>
                            {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "-"}
                          </td>
                          <td>{inv.paidDate ? new Date(inv.paidDate).toLocaleDateString() : "-"}</td>
                          <td>
                            <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                              {inv.status !== "paid" && inv.status !== "cancelled" && (
                                <button className="admin1-btn-sm" onClick={() => setShowMarkPaid(inv)}>Pay</button>
                              )}
                              {inv.status === "sent" && inv.paymentUrl && (
                                <a href={inv.paymentUrl} target="_blank" rel="noopener noreferrer" className="admin1-btn-sm" style={{ background: "#003366", color: "#fff", textDecoration: "none", padding: "4px 8px", borderRadius: 4, fontSize: 12 }}>Pay Now</a>
                              )}
                              {inv.status !== "paid" && inv.status !== "cancelled" && (
                                <button className="admin1-btn-sm admin1-btn-danger" onClick={async () => {
                                  const ok = await confirm(`Cancel invoice ${inv.invoiceNumber}?`, "Cancel Invoice", "Cancel Invoice", "Keep", "danger");
                                  if (!ok) return;
                                  try {
                                    await API.patch(`/invoices/${inv._id}/cancel`, {}, authHeaders);
                                    fetchInvoices(); fetchInvoiceStats();
                                  } catch (e) { setFormMsg({ type: "error", text: e.response?.data?.message || "Failed" }); }
                                }}>X</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Create Invoice Modal */}
            {showCreateInvoice && (
              <div className="admin1-modal-overlay" ref={invoiceCreateRef} onClick={() => setShowCreateInvoice(false)} role="dialog" aria-modal="true" aria-label="Create invoice modal">
                <div className="admin1-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
                  <div className="admin1-modal-header">
                    <h2>Create Invoice</h2>
                    <button className="admin1-modal-close" onClick={() => setShowCreateInvoice(false)} data-close-modal>×</button>
                  </div>
                  <div className="admin1-modal-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
                    <label>Customer *</label>
                    <select value={invoiceForm.customer} onChange={(e) => setInvoiceForm({ ...invoiceForm, customer: e.target.value })}>
                      <option value="">Select customer</option>
                      {customers.map((c) => <option key={c._id} value={c._id}>{c.name} ({c.email})</option>)}
                    </select>

                    <label>Load (optional)</label>
                    <select value={invoiceForm.load} onChange={(e) => {
                      const loadId = e.target.value;
                      setInvoiceForm({ ...invoiceForm, load: loadId });
                      if (loadId) {
                        const load = loads.find(l => l._id === loadId);
                        if (load) {
                          setInvoiceForm(prev => ({
                            ...prev, load: loadId,
                            customer: load.customer?._id || prev.customer,
                            driver: load.driver?._id || prev.driver,
                            lineItems: [{ description: `Transport: ${load.pickupLocation || ""} → ${load.deliveryLocation || ""}`, quantity: 1, rate: 500, amount: 500 }],
                          }));
                        }
                      }
                    }}>
                      <option value="">No load (standalone)</option>
                      {(() => {
                        const invoicedLoadIds = new Set(
                          invoices.filter(inv => inv.load && typeof inv.load === "object").map(inv => inv.load._id)
                        );
                        return loads.filter(l => !invoicedLoadIds.has(l._id));
                      })().map((l) => (
                        <option key={l._id} value={l._id}>{l.ticketNumber} — {l.customer?.name || "unknown"}</option>
                      ))}
                    </select>

                    <label>Driver (optional)</label>
                    <select value={invoiceForm.driver} onChange={(e) => setInvoiceForm({ ...invoiceForm, driver: e.target.value })}>
                      <option value="">No driver</option>
                      {drivers.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                    </select>

                    <label>Due Date *</label>
                    <input type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} />

                    <label>Line Items</label>
                    {invoiceForm.lineItems.map((item, idx) => (
                      <div key={idx} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
                        <input style={{ flex: 2 }} placeholder="Description" value={item.description}
                          onChange={(e) => {
                            const items = [...invoiceForm.lineItems];
                            items[idx] = { ...items[idx], description: e.target.value };
                            setInvoiceForm({ ...invoiceForm, lineItems: items });
                          }} />
                        <input style={{ width: 60 }} type="number" placeholder="Qty" value={item.quantity}
                          onChange={(e) => {
                            const items = [...invoiceForm.lineItems];
                            items[idx] = { ...items[idx], quantity: Number(e.target.value), amount: Number(e.target.value) * item.rate };
                            setInvoiceForm({ ...invoiceForm, lineItems: items });
                          }} />
                        <input style={{ width: 80 }} type="number" placeholder="Rate" value={item.rate}
                          onChange={(e) => {
                            const items = [...invoiceForm.lineItems];
                            items[idx] = { ...items[idx], rate: Number(e.target.value), amount: item.quantity * Number(e.target.value) };
                            setInvoiceForm({ ...invoiceForm, lineItems: items });
                          }} />
                        <span>R{(item.quantity * item.rate).toFixed(2)}</span>
                        {idx === invoiceForm.lineItems.length - 1 && (
                          <button onClick={() => setInvoiceForm({ ...invoiceForm, lineItems: [...invoiceForm.lineItems, { description: "", quantity: 1, rate: 0, amount: 0 }] })}>+</button>
                        )}
                        {invoiceForm.lineItems.length > 1 && (
                          <button onClick={() => {
                            const items = invoiceForm.lineItems.filter((_, i) => i !== idx);
                            setInvoiceForm({ ...invoiceForm, lineItems: items });
                          }}>−</button>
                        )}
                      </div>
                    ))}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.5rem" }}>
                      <label>Tax %<input type="number" value={invoiceForm.taxPercent} onChange={(e) => setInvoiceForm({ ...invoiceForm, taxPercent: Number(e.target.value) })} /></label>
                      <label>Discount<input type="number" value={invoiceForm.discount} onChange={(e) => setInvoiceForm({ ...invoiceForm, discount: Number(e.target.value) })} /></label>
                    </div>

                    <label>Notes</label>
                    <textarea rows={2} value={invoiceForm.notes} onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} />

                    <div className="admin1-modal-actions">
                      <button className="secondary" onClick={() => setShowCreateInvoice(false)}>Cancel</button>
                      <button onClick={async () => {
                        if (!invoiceForm.customer) return setFormMsg({ type: "error", text: "Customer is required" });
                        if (!invoiceForm.dueDate) return setFormMsg({ type: "error", text: "Due date is required" });
                        try {
                          await API.post("/invoices", invoiceForm, authHeaders);
                          setShowCreateInvoice(false);
                          setFormMsg({ type: "success", text: "Invoice created" });
                          setInvoiceForm({
                            customer: "", load: "", driver: "", dueDate: "",
                            taxPercent: 0, discount: 0, notes: "",
                            lineItems: [{ description: "", quantity: 1, rate: 0, amount: 0 }],
                          });
                          fetchInvoices(); fetchInvoiceStats();
                        } catch (e) { setFormMsg({ type: "error", text: e.response?.data?.message || "Failed" }); }
                      }}>Create Invoice</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Mark as Paid Modal */}
            {showMarkPaid && (
              <div className="admin1-modal-overlay" ref={invoicePaidRef} onClick={() => setShowMarkPaid(null)} role="dialog" aria-modal="true" aria-label="Mark invoice paid modal">
                <div className="admin1-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "450px" }}>
                  <div className="admin1-modal-header">
                    <h2>Mark Invoice Paid</h2>
                    <button className="admin1-modal-close" onClick={() => setShowMarkPaid(null)} data-close-modal>×</button>
                  </div>
                  <div className="admin1-modal-body">
                    <p>Invoice: <strong>{showMarkPaid.invoiceNumber}</strong></p>
                    <p>Amount: <strong>R{(showMarkPaid.total || 0).toLocaleString()}</strong></p>
                    <label>Payment Method</label>
                    <select id="paymentMethod">
                      <option value="">Select...</option>
                      <option value="bank transfer">Bank Transfer</option>
                      <option value="credit card">Credit Card</option>
                      <option value="cash">Cash</option>
                      <option value="check">Check</option>
                    </select>
                    <label>Reference</label>
                    <input id="paymentReference" placeholder="e.g. TRANS-001" />
                    <label>Paid Date</label>
                    <input id="paidDate" type="date" defaultValue={new Date().toISOString().split("T")[0]} />
                    <div className="admin1-modal-actions">
                      <button className="secondary" onClick={() => setShowMarkPaid(null)}>Cancel</button>
                      <button onClick={async () => {
                        try {
                          await API.patch(`/invoices/${showMarkPaid._id}/paid`, {
                            paymentMethod: document.getElementById("paymentMethod").value,
                            paymentReference: document.getElementById("paymentReference").value,
                            paidDate: document.getElementById("paidDate").value,
                          }, authHeaders);
                          setShowMarkPaid(null);
                          fetchInvoices(); fetchInvoiceStats();
                        } catch (e) { setFormMsg({ type: "error", text: e.response?.data?.message || "Failed" }); }
                      }}>Confirm Payment</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activePanel === "documents" && (
          <section className="admin1-panel">
            <div className="admin1-panel-header">
              <div>
                <span className="admin1-eyebrow">Records</span>
                <h2>Documents ({documents.length})</h2>
              </div>
              <button onClick={() => { fetchDocuments(); setShowCreateDoc(true); }}>+ New Document</button>
            </div>

            <div className="admin1-filters">
              <label>
                Type:
                <select value={docFilter.type} onChange={(e) => setDocFilter({ ...docFilter, type: e.target.value })}>
                  <option value="">All</option>
                  <option value="insurance">Insurance</option>
                  <option value="contract">Contract</option>
                  <option value="license">License</option>
                  <option value="registration">Registration</option>
                  <option value="permit">Permit</option>
                  <option value="inspection">Inspection</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                Entity:
                <select value={docFilter.entityType} onChange={(e) => setDocFilter({ ...docFilter, entityType: e.target.value })}>
                  <option value="">All</option>
                  <option value="truck">Truck</option>
                  <option value="driver">Driver</option>
                  <option value="customer">Customer</option>
                  <option value="load">Load</option>
                  <option value="general">General</option>
                </select>
              </label>
              <label>
                Status:
                <select value={docFilter.status} onChange={(e) => setDocFilter({ ...docFilter, status: e.target.value })}>
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="expiring">Expiring</option>
                  <option value="expired">Expired</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label>
                <input type="checkbox" checked={docFilter.expiring} onChange={(e) => setDocFilter({ ...docFilter, expiring: e.target.checked })} />
                Expiring soon (30d)
              </label>
              <button onClick={() => fetchDocuments()}>{documentsLoading ? "Loading..." : "Refresh"}</button>
            </div>

            {documents.length === 0 && !documentsLoading ? (
              <div className="admin1-empty">No documents found.</div>
            ) : (
              <div className="admin1-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Type</th>
                      <th>Entity</th>
                      <th>Issue Date</th>
                      <th>Expiry Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => {
                      const isExpired = doc.expiryDate && new Date(doc.expiryDate) < new Date();
                      const isExpiring = doc.expiryDate && !isExpired && new Date(doc.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                      return (
                        <tr key={doc._id} style={isExpired ? { background: "#fef2f2" } : isExpiring ? { background: "#fffbeb" } : {}}>
                          <td><strong>{doc.title}</strong></td>
                          <td><span className="admin1-badge neutral">{doc.type}</span></td>
                          <td>{doc.entityType}{doc.entityId ? ` (${doc.entityId.slice(-6)})` : ""}</td>
                          <td>{doc.issueDate ? new Date(doc.issueDate).toLocaleDateString() : "-"}</td>
                          <td style={{ color: isExpired ? "#dc2626" : isExpiring ? "#d97706" : "inherit", fontWeight: isExpired || isExpiring ? 700 : 400 }}>
                            {doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : "-"}
                          </td>
                          <td>
                            <span className={`admin1-badge ${doc.status === "active" ? "success" : doc.status === "expired" ? "danger" : doc.status === "expiring" ? "warning" : "neutral"}`}>
                              {doc.status}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "0.25rem" }}>
                              <button className="admin1-btn-sm admin1-btn-danger" onClick={async () => {
                                  const ok = await confirm(`Delete "${doc.title}"?`, "Delete Document", "Delete", "Cancel", "danger");
                                  if (!ok) return;
                                  try {
                                    await API.delete(`/documents/${doc._id}`, authHeaders);
                                    fetchDocuments();
                                  } catch (e) { setFormMsg({ type: "error", text: e.response?.data?.message || "Failed" }); }
                                }}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Create Document Modal */}
            {showCreateDoc && (
              <div className="admin1-modal-overlay" ref={docCreateRef} onClick={() => setShowCreateDoc(false)} role="dialog" aria-modal="true" aria-label="New document modal">
                <div className="admin1-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
                  <div className="admin1-modal-header">
                    <h2>New Document</h2>
                    <button className="admin1-modal-close" onClick={() => setShowCreateDoc(false)} data-close-modal>×</button>
                  </div>
                  <div className="admin1-modal-body">
                    <label>Title *</label>
                    <input value={docForm.title} onChange={(e) => setDocForm({ ...docForm, title: e.target.value })} placeholder="Document title" />
                    <label>Type *</label>
                    <select value={docForm.type} onChange={(e) => setDocForm({ ...docForm, type: e.target.value })}>
                      <option value="insurance">Insurance</option>
                      <option value="contract">Contract</option>
                      <option value="license">License</option>
                      <option value="registration">Registration</option>
                      <option value="permit">Permit</option>
                      <option value="inspection">Inspection</option>
                      <option value="other">Other</option>
                    </select>
                    <label>Entity Type</label>
                    <select value={docForm.entityType} onChange={(e) => setDocForm({ ...docForm, entityType: e.target.value })}>
                      <option value="general">General</option>
                      <option value="truck">Truck</option>
                      <option value="driver">Driver</option>
                      <option value="customer">Customer</option>
                      <option value="load">Load</option>
                    </select>
                    <label>File URL</label>
                    <input value={docForm.fileUrl} onChange={(e) => setDocForm({ ...docForm, fileUrl: e.target.value })} placeholder="https://..." />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <label>Issue Date<input type="date" value={docForm.issueDate} onChange={(e) => setDocForm({ ...docForm, issueDate: e.target.value })} /></label>
                      <label>Expiry Date<input type="date" value={docForm.expiryDate} onChange={(e) => setDocForm({ ...docForm, expiryDate: e.target.value })} /></label>
                    </div>
                    <label>Notes</label>
                    <textarea rows={2} value={docForm.notes} onChange={(e) => setDocForm({ ...docForm, notes: e.target.value })} />
                    <div className="admin1-modal-actions">
                      <button className="secondary" onClick={() => setShowCreateDoc(false)}>Cancel</button>
                      <button onClick={async () => {
                        if (!docForm.title) return setFormMsg({ type: "error", text: "Title is required" });
                        try {
                          await API.post("/documents", docForm, authHeaders);
                          setShowCreateDoc(false);
                          setDocForm({ title: "", type: "other", entityType: "general", entityId: "", fileUrl: "", issueDate: "", expiryDate: "", notes: "" });
                          fetchDocuments();
                        } catch (e) { setFormMsg({ type: "error", text: e.response?.data?.message || "Failed" }); }
                      }}>Create</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {activePanel === "reports" && (
          <>
            <section className="admin1-panel">
              <div className="admin1-panel-header">
                <div>
                  <span className="admin1-eyebrow">Financial</span>
                  <h2>Profitability Report</h2>
                </div>
              </div>

              <div className="admin1-filters">
                <label>
                  Start:
                  <input type="date" value={profitDateRange.start} onChange={(e) => setProfitDateRange({ ...profitDateRange, start: e.target.value })} />
                </label>
                <label>
                  End:
                  <input type="date" value={profitDateRange.end} onChange={(e) => setProfitDateRange({ ...profitDateRange, end: e.target.value })} />
                </label>
                <button onClick={async () => {
                  setProfitLoading(true);
                  try {
                    const params = new URLSearchParams();
                    if (profitDateRange.start) params.set("startDate", profitDateRange.start);
                    if (profitDateRange.end) params.set("endDate", profitDateRange.end);
                    const res = await API.get(`/reports/profitability?${params}`, authHeaders);
                    setProfitData(res.data);
                  } catch (err) {
                    setFormMsg({ type: "error", text: err.response?.data?.message || "Failed to load report" });
                  } finally {
                    setProfitLoading(false);
                  }
                }} disabled={profitLoading}>
                  {profitLoading ? "Loading..." : "Generate"}
                </button>
              </div>

              {profitData && (
                <>
                  <div className="admin1-kpis" style={{ marginBottom: "1rem" }}>
                    <div className="admin1-kpi-card">
                      <span>Revenue</span>
                      <strong style={{ color: "#16a34a" }}>R{(profitData.summary.totalRevenue || 0).toLocaleString()}</strong>
                    </div>
                    <div className="admin1-kpi-card">
                      <span>Fuel Cost</span>
                      <strong style={{ color: "#d97706" }}>R{(profitData.summary.totalFuelCost || 0).toLocaleString()}</strong>
                    </div>
                    <div className="admin1-kpi-card">
                      <span>Maintenance Cost</span>
                      <strong style={{ color: "#d97706" }}>R{(profitData.summary.totalMaintenanceCost || 0).toLocaleString()}</strong>
                    </div>
                    <div className="admin1-kpi-card">
                      <span>Profit</span>
                      <strong style={{ color: profitData.summary.profit >= 0 ? "#16a34a" : "#dc2626" }}>
                        R{(profitData.summary.profit || 0).toLocaleString()}
                      </strong>
                    </div>
                    <div className="admin1-kpi-card">
                      <span>Margin</span>
                      <strong>{profitData.summary.margin || 0}%</strong>
                    </div>
                  </div>

                  {profitData.byGroup.length > 0 && (
                    <div className="admin1-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Truck</th>
                            <th>Revenue</th>
                            <th>Fuel Cost</th>
                            <th>Maint Cost</th>
                            <th>Total Cost</th>
                            <th>Profit</th>
                            <th>Margin</th>
                            <th>Loads</th>
                            <th>Distance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profitData.byGroup.map((row) => (
                            <tr key={row._id}>
                              <td><strong>{row.name}</strong></td>
                              <td>R{(row.totalRevenue || 0).toLocaleString()}</td>
                              <td>R{(row.totalFuelCost || 0).toLocaleString()}</td>
                              <td>R{(row.totalMaintenanceCost || 0).toLocaleString()}</td>
                              <td>R{(row.totalCosts || 0).toLocaleString()}</td>
                              <td style={{ color: row.profit >= 0 ? "#16a34a" : "#dc2626", fontWeight: 700 }}>
                                R{(row.profit || 0).toLocaleString()}
                              </td>
                              <td>{row.margin}%</td>
                              <td>{row.totalLoads}</td>
                              <td>{row.totalDistance ? `${Math.round(row.totalDistance)} km` : "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="admin1-panel">
              <div className="admin1-panel-header">
                <div>
                  <span className="admin1-eyebrow">Performance</span>
                  <h2>Driver Scorecard</h2>
                </div>
              </div>

              <div className="admin1-filters">
                <label>
                  Driver:
                  <select value={scorecardDriver} onChange={(e) => setScorecardDriver(e.target.value)}>
                    <option value="">Select driver...</option>
                    {drivers.map((d) => <option key={d._id} value={d._id}>{d.name} ({d.email})</option>)}
                  </select>
                </label>
                <button onClick={async () => {
                  if (!scorecardDriver) return;
                  setScorecardLoading(true);
                  try {
                    const params = new URLSearchParams();
                    if (profitDateRange.start) params.set("startDate", profitDateRange.start);
                    if (profitDateRange.end) params.set("endDate", profitDateRange.end);
                    const res = await API.get(`/reports/driver-scorecard/${scorecardDriver}?${params}`, authHeaders);
                    setScorecardData(res.data);
                  } catch (err) {
                    setFormMsg({ type: "error", text: err.response?.data?.message || "Failed to load scorecard" });
                  } finally {
                    setScorecardLoading(false);
                  }
                }} disabled={!scorecardDriver || scorecardLoading}>
                  {scorecardLoading ? "Loading..." : "View Scorecard"}
                </button>
              </div>

              {scorecardData && (
                <>
                  <div className="admin1-kpis" style={{ marginBottom: "1rem" }}>
                    <div className="admin1-kpi-card">
                      <span>On-Time</span>
                      <strong style={{ color: "#16a34a" }}>{scorecardData.summary.onTimePercent || "N/A"}%</strong>
                      <small>{scorecardData.summary.onTimeCount}/{scorecardData.summary.totalCompleted} on time</small>
                    </div>
                    <div className="admin1-kpi-card">
                      <span>Total Loads</span>
                      <strong>{scorecardData.summary.totalLoads}</strong>
                      <small>{scorecardData.summary.totalCompleted} completed</small>
                    </div>
                    <div className="admin1-kpi-card">
                      <span>Issues</span>
                      <strong style={{ color: scorecardData.summary.openIssues > 0 ? "#dc2626" : "#16a34a" }}>
                        {scorecardData.summary.totalIssues}
                      </strong>
                      <small>{scorecardData.summary.openIssues} open</small>
                    </div>
                    <div className="admin1-kpi-card">
                      <span>Fuel Efficiency</span>
                      <strong>{scorecardData.summary.fuelEfficiency || "N/A"}</strong>
                      <small>{scorecardData.summary.totalDistance} km total</small>
                    </div>
                  </div>

                  <div className="admin1-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Ticket</th>
                          <th>Customer</th>
                          <th>Route</th>
                          <th>Status</th>
                          <th>Distance</th>
                          <th>Completed</th>
                          <th>On Time</th>
                          <th>Issues</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scorecardData.recentLoads.map((load) => (
                          <tr key={load._id}>
                            <td>{load.ticketNumber || "-"}</td>
                            <td>{load.customer || "-"}</td>
                            <td style={{ fontSize: "0.8rem" }}>{load.pickupLocation} → {load.deliveryLocation}</td>
                            <td><span className={`admin1-badge ${load.status === "completed" ? "success" : load.status === "canceled" ? "danger" : "warning"}`}>{load.status}</span></td>
                            <td>{load.distance ? `${load.distance} km` : "-"}</td>
                            <td>{load.completedAt ? new Date(load.completedAt).toLocaleDateString() : "-"}</td>
                            <td style={{ color: load.completedAt && load.deliveryDate && new Date(load.completedAt) <= new Date(load.deliveryDate) ? "#16a34a" : load.completedAt ? "#dc2626" : "inherit", fontWeight: 700 }}>
                              {load.completedAt && load.deliveryDate
                                ? (new Date(load.completedAt) <= new Date(load.deliveryDate) ? "✓" : "✗")
                                : "-"}
                            </td>
                            <td>
                              {load.driverIssue ? (
                                <span className="admin1-badge danger">{load.driverIssue.type}</span>
                              ) : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </>
        )}

        {activePanel === "fuel" && (
          <section className="admin1-panel">
            <div className="admin1-panel-header">
              <div>
                <span className="admin1-eyebrow">Fuel Management</span>
                <h2>Fuel Records ({fuelRecords.length})</h2>
              </div>
            </div>

            <form className="admin1-form" onSubmit={handleCreateFuel}>
              <select value={fuelForm.truck} onChange={(e) => setFuelForm({ ...fuelForm, truck: e.target.value })} required>
                <option value="">Select truck</option>
                {trucks.map((t) => <option key={t._id} value={t._id}>{t.registrationNumber} — {t.model}</option>)}
              </select>
              <input type="date" value={fuelForm.date} onChange={(e) => setFuelForm({ ...fuelForm, date: e.target.value })} />
              <input type="number" step="0.01" placeholder="Liters *" value={fuelForm.liters} onChange={(e) => setFuelForm({ ...fuelForm, liters: e.target.value })} required />
              <input type="number" step="0.01" placeholder="Cost per liter *" value={fuelForm.costPerLiter} onChange={(e) => setFuelForm({ ...fuelForm, costPerLiter: e.target.value })} required />
              <input type="number" placeholder="Mileage (km)" value={fuelForm.mileage} onChange={(e) => setFuelForm({ ...fuelForm, mileage: e.target.value })} />
              <input placeholder="Vendor" value={fuelForm.vendor} onChange={(e) => setFuelForm({ ...fuelForm, vendor: e.target.value })} />
              <select value={fuelForm.fuelType} onChange={(e) => setFuelForm({ ...fuelForm, fuelType: e.target.value })}>
                <option value="diesel">Diesel</option>
                <option value="petrol">Petrol</option>
                <option value="electric">Electric</option>
                <option value="hybrid">Hybrid</option>
              </select>
              <button type="submit" className="btn">Record Fuel</button>
            </form>

            {fuelStats && (
              <div className="admin1-kpis" style={{ marginBottom: "1rem" }}>
                <div className="admin1-kpi-card">
                  <span>Total Fuel Cost</span>
                  <strong>R{(fuelStats.totalCost || 0).toLocaleString()}</strong>
                </div>
                <div className="admin1-kpi-card">
                  <span>Total Liters</span>
                  <strong>{(fuelStats.totalLiters || 0).toLocaleString()} L</strong>
                </div>
                <div className="admin1-kpi-card">
                  <span>Avg Cost / Liter</span>
                  <strong>R{(fuelStats.avgCostPerLiter || 0).toFixed(2)}</strong>
                </div>
                <div className="admin1-kpi-card">
                  <span>Total Entries</span>
                  <strong>{fuelStats.totalEntries || 0}</strong>
                </div>
              </div>
            )}

            {fuelRecords.length === 0 && !fuelLoading ? (
              <div className="admin1-empty">No fuel records found.</div>
            ) : (
              <div className="admin1-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Truck</th>
                      <th>Liters</th>
                      <th>Cost/L</th>
                      <th>Total</th>
                      <th>Mileage</th>
                      <th>Vendor</th>
                      <th>Fuel Type</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fuelRecords.map((rec) => (
                      <tr key={rec._id}>
                        <td>{rec.date ? new Date(rec.date).toLocaleDateString() : "-"}</td>
                        <td>{rec.truck?.registrationNumber || "-"}</td>
                        <td>{rec.liters} L</td>
                        <td>R{(rec.costPerLiter || 0).toFixed(2)}</td>
                        <td>R{(rec.totalCost || 0).toLocaleString()}</td>
                        <td>{rec.mileage ? `${rec.mileage} km` : "-"}</td>
                        <td>{rec.vendor || "-"}</td>
                        <td>{rec.fuelType || "diesel"}</td>
                        <td>
                          <button className="admin1-btn-sm admin1-btn-danger" onClick={() => handleDeleteFuel(rec._id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>

      {modalOpen && (
        <div className="admin1-modal-overlay" ref={editModalRef} onClick={() => setModalOpen(false)} role="dialog" aria-modal="true" aria-label="Edit modal">
          <div className="admin1-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin1-modal-header">
              <h2>Edit {modalEntity}</h2>
              <button onClick={() => setModalOpen(false)} data-close-modal aria-label="Close modal">×</button>
            </div>

            <div className="admin1-modal-fields">
              {(modalFields[modalEntity] || []).map((field) => (
                <label key={field}>
                  <span>{field}</span>
                  <input
                    value={modalData[field] || ""}
                    onChange={(e) => setModalData({ ...modalData, [field]: sanitizeInput(e.target.value) })}
                  />
                </label>
              ))}
            </div>

            <div className="admin1-modal-actions">
              <button className="secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button onClick={handleSave}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog />
      {resolveLoad && (
        <div className="admin1-modal-overlay" ref={resolveModalRef} onClick={() => setResolveLoad(null)} role="dialog" aria-modal="true" aria-label="Resolve issue modal">
          <div className="admin1-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin1-modal-header">
              <div>
                <span className="admin1-eyebrow">Resolve Issue</span>
                <h2>{resolveLoad.ticketNumber || "Issue Review"}</h2>
              </div>
              <button onClick={() => setResolveLoad(null)} data-close-modal aria-label="Close modal">×</button>
            </div>

            <div className="admin1-resolve-grid">
              <div>
                <span>Customer</span>
                <strong>{resolveLoad.customer?.name || "-"}</strong>
              </div>
              <div>
                <span>Driver</span>
                <strong>{resolveLoad.driver?.name || resolveLoad.driver?.email || "-"}</strong>
              </div>
              <div>
                <span>Truck</span>
                <strong>{resolveLoad.truck?.registrationNumber || "-"}</strong>
              </div>
              <div>
                <span>Reported</span>
                <strong>{formatDateTime(resolveLoad.driverIssue.reportedAt)}</strong>
              </div>
            </div>

            <div className="admin1-issue-box">
              <strong>{resolveLoad.driverIssue.type || "Issue"}</strong>
              <p>{resolveLoad.driverIssue.description}</p>
            </div>

            <label className="admin1-resolve-note">
              <span>Resolution Note</span>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Describe how this issue was resolved..."
              />
            </label>

            <div className="admin1-modal-actions">
              <button className="secondary" onClick={() => setResolveLoad(null)}>Cancel</button>
              <button onClick={handleResolveIssue}>Resolve Issue</button>
            </div>
          </div>
        </div>
      )}

      <ChatDrawer isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
};

export default Admin1;
