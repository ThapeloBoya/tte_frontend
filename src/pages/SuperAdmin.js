import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import "../styles/SuperAdmin.css";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { CSVLink } from "react-csv";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import ThemeToggle from "../components/ThemeToggle";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import NotificationBell from "../components/NotificationBell";
import Pagination from "../components/Pagination";
import Alert from "../components/Alert";
import ConnectionStatus from "../components/ConnectionStatus";
import { CardSkeleton, TableSkeleton } from "../components/LoadingSkeleton";
import useConfirm from "../hooks/useConfirm";
import usePolling from "../hooks/usePolling";
import socket from "../services/socket";
import ChatDrawer from "../components/ChatDrawer";

const BACKEND_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const COLORS = ["#FFBB28", "#00C49F", "#0088FE", "#FF8042"];
const PAGE_SIZE = 20;

const statusTone = {
  waiting: "warning",
  "in transit": "info",
  completed: "success",
  canceled: "danger",
  cancelled: "danger",
  "under maintenance": "warning",
  available: "success",
  "on-duty": "info",
  inactive: "danger",
  "in service": "info",
  active: "success",
  superadmin: "danger",
  admin1: "warning",
  admin2: "info",
  driver: "neutral",
};

const Badge = ({ value }) => (
  <span className={`super-badge ${statusTone[value] || "neutral"}`}>{value || "unknown"}</span>
);

const SuperAdmin = () => {
  const { token, user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const authHeaders = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const { confirm, ConfirmDialog } = useConfirm();

  const [loads, setLoads] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formMsg, setFormMsg] = useState(null);
  const [activePanel, setActivePanel] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState("asc");
  const [loadPage, setLoadPage] = useState(1);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [multiStatus, setMultiStatus] = useState([]);
  const [users, setUsers] = useState([]);
  const [createUserForm, setCreateUserForm] = useState({ name: "", email: "", password: "", role: "driver" });
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const toggleStatusFilter = (status) => {
    setMultiStatus((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkDriver, setBulkDriver] = useState("");

  // Audit log state
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");
  const [logsFilter, setLogsFilter] = useState({ entity: "", action: "" });
  const [logsSkip, setLogsSkip] = useState(0);
  const logsFilterRef = useRef(logsFilter);
  useEffect(() => { logsFilterRef.current = logsFilter; }, [logsFilter]);
  const logsSkipRef = useRef(logsSkip);
  useEffect(() => { logsSkipRef.current = logsSkip; }, [logsSkip]);
  const LOGS_PAGE_SIZE = 50;

  // Invoice state
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoiceStats, setInvoiceStats] = useState(null);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("");

  const fetchLoads = useCallback(async () => {
    if (!token) return;
    try {
      const res = await API.get("/superadmin/loads", authHeaders);
      setLoads(res.data);
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  }, [authHeaders, token]);

  const fetchDrivers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await API.get("/drivers", authHeaders);
      setDrivers(res.data);
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  }, [authHeaders, token]);

  const fetchTrucks = useCallback(async () => {
    if (!token) return;
    try {
      const res = await API.get("/trucks", authHeaders);
      setTrucks(res.data);
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  }, [authHeaders, token]);

  const fetchCustomers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await API.get("/customers", authHeaders);
      setCustomers(res.data);
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  }, [authHeaders, token]);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await API.get("/users", authHeaders);
      setUsers(res.data);
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  }, [authHeaders, token]);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      await Promise.all([fetchLoads(), fetchDrivers(), fetchTrucks(), fetchCustomers()]);
    } catch (err) {
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [token, fetchLoads, fetchDrivers, fetchTrucks, fetchCustomers]);

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

  const fetchInvoiceStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await API.get("/invoices/stats", authHeaders);
      setInvoiceStats(res.data);
    } catch (err) {
      // silent
    }
  }, [token, authHeaders]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!token) return;

    const handleLoadChange = () => fetchLoads();
    const handleDriverChange = () => fetchDrivers();
    const handleTruckChange = () => fetchTrucks();
    const handleCustomerChange = () => fetchCustomers();

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
  }, [token, fetchLoads, fetchDrivers, fetchTrucks, fetchCustomers]);

  // Maintenance state
  const [maintenanceRecords, setMaintenanceRecords] = useState([]);
  const [maintenanceUpcoming, setMaintenanceUpcoming] = useState(null);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceFilter, setMaintenanceFilter] = useState({ truck: "", status: "" });

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

  // Fuel state
  const [fuelRecords, setFuelRecords] = useState([]);
  const [fuelStats, setFuelStats] = useState(null);
  const [fuelLoading, setFuelLoading] = useState(false);

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

  const metrics = useMemo(() => {
    const countStatus = (status) => loads.filter((l) => l.status === status).length;
    const countDriverStatus = (s) => drivers.filter((d) => d.status === s).length;
    const countTruckStatus = (s) => trucks.filter((t) => t.status === s).length;

    return {
      totalLoads: loads.length,
      waiting: countStatus("waiting"),
      inTransit: countStatus("in transit"),
      completed: countStatus("completed"),
      pendingApproval: loads.filter((l) => l.status === "completed" && !l.isApproved).length,
      activeDrivers: countDriverStatus("on-duty"),
      availableTrucks: countTruckStatus("available"),
    };
  }, [drivers, loads, trucks]);

  const filteredLoads = useMemo(() => {
    let items = [...loads];

    if (statusFilter) items = items.filter((l) => l.status === statusFilter);
    if (multiStatus.length > 0) items = items.filter((l) => multiStatus.includes(l.status));
    if (monthFilter) {
      items = items.filter(
        (l) => new Date(l.createdAt).getMonth() + 1 === parseInt(monthFilter)
      );
    }
    if (dateRange.start) {
      items = items.filter((l) => new Date(l.createdAt) >= new Date(dateRange.start));
    }
    if (dateRange.end) {
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59, 999);
      items = items.filter((l) => new Date(l.createdAt) <= end);
    }
    if (search) {
      const term = search.toLowerCase();
      items = items.filter(
        (l) =>
          l.ticketNumber?.toLowerCase().includes(term) ||
          l.customer?.name?.toLowerCase().includes(term) ||
          l.truck?.registrationNumber?.toLowerCase().includes(term) ||
          l.driver?.name?.toLowerCase().includes(term) ||
          l.status?.toLowerCase().includes(term)
      );
    }
    const dir = sortDir === "desc" ? -1 : 1;
    if (sortBy === "date") items.sort((a, b) => dir * (new Date(a.createdAt) - new Date(b.createdAt)));
    if (sortBy === "priority")
      items.sort((a, b) => dir * (b.priority || "normal").localeCompare(a.priority || "normal"));
    if (sortBy === "status") items.sort((a, b) => dir * a.status.localeCompare(b.status));

    return items;
  }, [loads, search, sortBy, sortDir, statusFilter, monthFilter, dateRange, multiStatus]);

  const paginatedLoads = useMemo(() => {
    const start = (loadPage - 1) * PAGE_SIZE;
    return filteredLoads.slice(start, start + PAGE_SIZE);
  }, [filteredLoads, loadPage]);

  useEffect(() => {
    setLoadPage(1);
  }, [search, statusFilter, monthFilter, sortBy]);

  usePolling(fetchAll, 30000, Boolean(token));
  usePolling(fetchInvoiceStats, 60000, activePanel === "invoices" && Boolean(token));

  const filteredDrivers = useMemo(() => {
    const term = search.toLowerCase();
    if (!term) return drivers;
    return drivers.filter(
      (d) =>
        d.name?.toLowerCase().includes(term) ||
        d.email?.toLowerCase().includes(term) ||
        d.phone?.toLowerCase().includes(term)
    );
  }, [drivers, search]);

  const filteredTrucks = useMemo(() => {
    const term = search.toLowerCase();
    if (!term) return trucks;
    return trucks.filter(
      (t) =>
        t.registrationNumber?.toLowerCase().includes(term) ||
        t.model?.toLowerCase().includes(term) ||
        t.status?.toLowerCase().includes(term)
    );
  }, [trucks, search]);

  const pieData = [
    { name: "Waiting", value: metrics.waiting },
    { name: "In Transit", value: metrics.inTransit },
    { name: "Completed", value: metrics.completed },
  ];

  const monthlyCompleted = Array(12)
    .fill(0)
    .map((_, i) => ({
      month: i + 1,
      completed: loads.filter(
        (l) => l.status === "completed" && new Date(l.createdAt).getMonth() === i
      ).length,
    }));

  const exportToExcel = (data, filename, sheetName) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, `${filename}.xlsx`);
  };

  const handleExportDrivers = () => {
    exportToExcel(
      drivers.map((d) => ({
        Name: d.name,
        Email: d.email,
        Phone: d.phone || "",
        License: d.licenseNumber || "",
        Status: d.status,
        "Last Updated": d.lastUpdated ? new Date(d.lastUpdated).toLocaleString() : "",
      })),
      "drivers",
      "Drivers"
    );
  };

  const handleExportTrucks = () => {
    exportToExcel(
      trucks.map((t) => ({
        Registration: t.registrationNumber,
        Make: t.make || "",
        Model: t.model || "",
        Year: t.year || "",
        Capacity: t.capacity || "",
        Status: t.status,
        "Insurance Expiry": t.insuranceExpiry ? new Date(t.insuranceExpiry).toLocaleDateString() : "",
      })),
      "trucks",
      "Trucks"
    );
  };

  const handleExportCustomers = () => {
    exportToExcel(
      customers.map((c) => ({
        Name: c.name,
        Email: c.email || "",
        Phone: c.phone || "",
        Address: c.address || "",
      })),
      "customers",
      "Customers"
    );
  };

  const handleExportUtilization = () => {
    const active = drivers.filter((d) => d.status === "on-duty").length;
    const available = drivers.filter((d) => d.status === "available").length;
    const inactive = drivers.filter((d) => d.status === "inactive").length;
    const truckActive = trucks.filter((t) => t.status === "in service" || t.status === "on-duty").length;
    const truckAvailable = trucks.filter((t) => t.status === "available").length;
    const truckMaintenance = trucks.filter((t) => t.status === "under maintenance").length;
    const loadsByStatus = ["waiting", "in transit", "completed", "cancelled"].map((s) => ({
      Status: s,
      Count: loads.filter((l) => l.status === s).length,
    }));

    exportToExcel(
      [
        { Metric: "Active Drivers", Value: active },
        { Metric: "Available Drivers", Value: available },
        { Metric: "Inactive Drivers", Value: inactive },
        { Metric: "Active Trucks", Value: truckActive },
        { Metric: "Available Trucks", Value: truckAvailable },
        { Metric: "Trucks in Maintenance", Value: truckMaintenance },
        ...loadsByStatus.map((l) => ({ Metric: `Loads ${l.Status}`, Value: l.Count })),
      ],
      "utilization-report",
      "Utilization"
    );
  };

  const handleBulkStatus = async () => {
    if (!bulkStatus || selectedIds.length === 0) return;
    try {
      await API.post("/loads/bulk/status", { ids: selectedIds, status: bulkStatus }, authHeaders);
      setFormMsg({ type: "success", text: `Updated ${selectedIds.length} loads to ${bulkStatus}` });
      setSelectedIds([]);
      setBulkStatus("");
      fetchLoads();
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
      fetchLoads();
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
      fetchLoads();
    } catch (err) {
      setFormMsg({ type: "error", text: err.response?.data?.message || "Bulk delete failed" });
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

  const fetchLogs = useCallback(async (append = false) => {
    if (!token) return;
    setLogsLoading(true);
    setLogsError("");
    try {
      const filter = logsFilterRef.current;
      const skip = logsSkipRef.current;
      const params = new URLSearchParams();
      if (filter.entity) params.set("entity", filter.entity);
      if (filter.action) params.set("action", filter.action);
      params.set("limit", LOGS_PAGE_SIZE);
      params.set("skip", append ? skip : 0);

      const res = await API.get(`/audit-logs?${params}`, authHeaders);
      if (append) {
        setLogs((prev) => [...prev, ...res.data.logs]);
      } else {
        setLogs(res.data.logs);
      }
      setLogsTotal(res.data.total);
      setLogsSkip(append ? skip + LOGS_PAGE_SIZE : LOGS_PAGE_SIZE);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to load audit logs.";
      setLogsError(msg);
      console.error("Audit log fetch error:", err);
    } finally {
      setLogsLoading(false);
    }
  }, [token, authHeaders, LOGS_PAGE_SIZE]);

  useEffect(() => {
    if (activePanel === "logs") {
      setLogsSkip(0);
      fetchLogs(false);
    }
    if (activePanel === "users") {
      fetchUsers();
    }
    if (activePanel === "maintenance") {
      fetchMaintenance();
      fetchMaintenanceUpcoming();
    }
    if (activePanel === "fuel") {
      fetchFuel();
      fetchFuelStats();
    }
    if (activePanel === "invoices") {
      fetchInvoices();
      fetchInvoiceStats();
    }
  }, [activePanel, fetchLogs, fetchUsers, fetchMaintenance, fetchMaintenanceUpcoming, fetchFuel, fetchFuelStats, fetchInvoices, fetchInvoiceStats]);

  const closeSidebar = () => setSidebarOpen(false);

  const navItems = [
    ["overview", "nav.overview"],
    ["loads", "nav.loads"],
    ["drivers", "nav.drivers"],
    ["fleet", "nav.fleet"],
    ["customers", "nav.customers"],
    ["logs", "Activity Log"],
    ["users", "Users"],
    ["maintenance", "nav.maintenance"],
    ["fuel", "nav.fuel"],
    ["invoices", "nav.invoices"],
  ];

  if (!token) return <p style={{ padding: 20 }}>{t("common.loading")}</p>;

  return (
    <div className="super-layout">
      <div className="super-mobile-bar">
        <button className="super-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          ☰
        </button>
        <img src="/logo_white.png" alt="Moova" />
      </div>

      {sidebarOpen && <div className="super-overlay" onClick={closeSidebar} />}

      <aside className={`super-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="super-logo">
          <img src="/logo_white.png" alt="Moova" />
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

        <div className="super-sidebar-footer">
          <ThemeToggle />
          <LanguageSwitcher />
          <button className="super-nav-link" onClick={() => navigate("/audit")}>
            Audit Trail
          </button>
          <button className="super-nav-link" onClick={() => navigate("/mfa-settings")}>
            MFA Settings
          </button>
          <button className="super-nav-link" onClick={() => navigate("/change-password")}>
            Change Password
          </button>
          <button className="super-nav-link" onClick={() => setChatOpen(true)}>
            Chat
          </button>
          <button className="super-logout" onClick={logout}>
            {t("auth.logout")}
          </button>
          <span>Super Admin</span>
        </div>
      </aside>

      <main className="super-main">
        <header className="super-topbar">
          <div>
            <span className="super-eyebrow">{t("dashboard.systemOverview")}</span>
            <h1>{t("dashboard.systemOverview")}</h1>
            <p>{t("dashboard.welcome")}, {user?.name || "Admin"}</p>
          </div>
          <div className="super-topbar-actions">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("common.search")}
            />
            <button onClick={fetchAll}>{loading ? t("common.loading") : t("common.refresh")}</button>
            <ConnectionStatus />
            <NotificationBell />
          </div>
        </header>

        {error && <div className="super-alert">{error}</div>}

        <Alert message={formMsg?.text} type={formMsg?.type} onClose={() => setFormMsg(null)} />

        {loading && activePanel === "overview" && (
          <><CardSkeleton /><TableSkeleton /></>
        )}

        <section className="super-kpis">
          <div className="super-kpi-card">
            <span>Total Loads</span>
            <strong>{metrics.totalLoads}</strong>
            <small>{metrics.inTransit} in transit</small>
          </div>
          <div className="super-kpi-card">
            <span>In Transit</span>
            <strong>{metrics.inTransit}</strong>
            <small>Active deliveries</small>
          </div>
          <div className="super-kpi-card">
            <span>Completed</span>
            <strong>{metrics.completed}</strong>
            <small>Delivered loads</small>
          </div>
          <div className="super-kpi-card">
            <span>Pending Approval</span>
            <strong>{metrics.pendingApproval}</strong>
            <small>Awaiting verification</small>
          </div>
          <div className="super-kpi-card">
            <span>Drivers / Trucks</span>
            <strong>{metrics.activeDrivers}/{metrics.availableTrucks}</strong>
            <small>On duty / Available</small>
          </div>
        </section>

        {activePanel === "overview" && (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
              <button className="super-btn-sm" onClick={handleExportUtilization}>Export Utilization Report</button>
            </div>
            <section className="super-grid-two">
              <div className="super-chart-box">
                <h3>Load Status Distribution</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="super-chart-box">
                <h3>Completed Loads per Month</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthlyCompleted}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="completed" fill="#0f766e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="super-panel">
              <div className="super-panel-header">
                <div>
                  <span className="super-eyebrow">Queue</span>
                  <h2>Pending Approval</h2>
                </div>
                <button onClick={() => setActivePanel("loads")}>View All Loads</button>
              </div>
              {loads.filter((l) => l.status === "completed" && !l.isApproved).length === 0 ? (
                <div className="super-empty">No completed loads pending approval.</div>
              ) : (
                <div className="super-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Ticket</th>
                        <th>Customer</th>
                        <th>Driver</th>
                        <th>Truck</th>
                        <th>POD</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loads
                        .filter((l) => l.status === "completed" && !l.isApproved)
                        .slice(0, 10)
                        .map((load) => (
                          <tr key={load._id}>
                            <td>{load.ticketNumber || "-"}</td>
                            <td>{load.customer?.name || "-"}</td>
                            <td>{load.driver?.name || load.driver?.email || "-"}</td>
                            <td>{load.truck?.registrationNumber || "-"}</td>
                            <td>
                              {load.podUrl ? (
                                <a href={`${BACKEND_URL}${load.podUrl}`} target="_blank" rel="noreferrer">
                                  View POD
                                </a>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td><Badge value={load.status} /></td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="super-panel">
              <div className="super-panel-header">
                <div>
                  <span className="super-eyebrow">At a Glance</span>
                  <h2>Entity Summary</h2>
                </div>
              </div>
              <div className="super-status-list">
                <div>
                  <Badge value="on-duty" />
                  <strong>{metrics.activeDrivers}</strong> drivers on duty
                </div>
                <div>
                  <Badge value="available" />
                  <strong>{metrics.availableTrucks}</strong> trucks available
                </div>
                <div>
                  <Badge value="waiting" />
                  <strong>{metrics.waiting}</strong> loads waiting for dispatch
                </div>
              </div>
            </section>
          </>
        )}

        {activePanel === "loads" && (
          <section className="super-panel">
            <div className="super-panel-header">
              <div>
                <span className="super-eyebrow">Ledger</span>
                <h2>All Loads</h2>
              </div>
            </div>

            <div className="super-filters">
              <div className="super-filter-group">
                <label>
                  Date From:
                  <input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} />
                </label>
                <label>
                  Date To:
                  <input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} />
                </label>
              </div>
              <label>
                Status:
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">All</option>
                  <option value="waiting">Waiting</option>
                  <option value="in transit">In Transit</option>
                  <option value="completed">Completed</option>
                  <option value="canceled">Canceled</option>
                </select>
              </label>
              {["waiting", "in transit", "completed", "canceled"].map((s) => (
                <label key={s} className="super-filter-chip">
                  <input type="checkbox" checked={multiStatus.includes(s)} onChange={() => toggleStatusFilter(s)} />
                  {s}
                </label>
              ))}
              <label>
                Month:
                <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
                  <option value="">All</option>
                  {[...Array(12).keys()].map((m) => (
                    <option key={m + 1} value={m + 1}>{m + 1}</option>
                  ))}
                </select>
              </label>
              <label>
                Sort:
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="">None</option>
                  <option value="date">Date</option>
                  <option value="priority">Priority</option>
                  <option value="status">Status</option>
                </select>
              </label>
              <button className="super-btn-sm" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
                {sortDir === "asc" ? "↑" : "↓"}
              </button>
              <div className="super-export-btns">
                <CSVLink data={filteredLoads} filename="loads.csv">
                  <button>Export CSV</button>
                </CSVLink>
                <button onClick={() => exportToExcel(
                  filteredLoads.map((l) => ({
                    Ticket: l.ticketNumber,
                    Customer: l.customer?.name,
                    Truck: l.truck?.registrationNumber,
                    Driver: l.driver?.name,
                    Status: l.status,
                    Priority: l.priority,
                    POD: l.podUrl || "",
                    CreatedAt: new Date(l.createdAt).toLocaleString(),
                  })),
                  "loads",
                  "Loads"
                )}>Export Excel</button>
              </div>
            </div>

            <div className="super-bulk-toolbar" style={{ display: selectedIds.length > 0 ? "flex" : "none", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0", flexWrap: "wrap" }}>
              <span>{selectedIds.length} selected</span>
              <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} aria-label="Bulk status">
                <option value="">Set status...</option>
                <option value="waiting">Waiting</option>
                <option value="in transit">In Transit</option>
                <option value="completed">Completed</option>
                <option value="canceled">Canceled</option>
              </select>
              <button className="super-btn-sm" onClick={handleBulkStatus} disabled={!bulkStatus}>Update Status</button>
              <select value={bulkDriver} onChange={(e) => setBulkDriver(e.target.value)} aria-label="Bulk assign driver">
                <option value="">Assign driver...</option>
                {drivers.filter((d) => d.status === "on-duty" || d.status === "available").map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
              <button className="super-btn-sm" onClick={handleBulkAssign} disabled={!bulkDriver}>Assign</button>
              <button className="super-btn-sm super-btn-danger" onClick={handleBulkDelete}>Delete</button>
            </div>

            {filteredLoads.length === 0 ? (
              <div className="super-empty">No loads found.</div>
            ) : (
              <div className="super-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th><input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.length === paginatedLoads.length && paginatedLoads.length > 0} aria-label="Select all" /></th>
                      <th>Ticket</th>
                      <th>Customer</th>
                      <th>Driver</th>
                      <th>Truck</th>
                      <th>Pickup</th>
                      <th>Delivery</th>
                      <th>Dist</th>
                      <th>ETA</th>
                      <th>Status</th>
                      <th>POD</th>
                      <th>Approved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLoads.map((load) => (
                      <tr key={load._id} className={selectedIds.includes(load._id) ? "super-row-selected" : ""}>
                        <td><input type="checkbox" checked={selectedIds.includes(load._id)} onChange={() => toggleSelect(load._id)} aria-label={`Select load ${load.ticketNumber || load._id}`} /></td>
                        <td>{load.ticketNumber || "-"}</td>
                        <td>{load.customer?.name || "-"}</td>
                        <td>{load.driver?.name || load.driver?.email || "-"}</td>
                        <td>{load.truck?.registrationNumber || "-"}</td>
                        <td style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {load.pickupLocation || "-"}
                        </td>
                        <td style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {load.deliveryLocation || "-"}
                        </td>
                        <td style={{ fontSize: "0.8rem" }}>{load.routeDistance ? `${load.routeDistance} km` : "-"}</td>
                        <td style={{ fontSize: "0.8rem" }}>{load.routeDuration ? `${load.routeDuration} min` : "-"}</td>
                        <td><Badge value={load.status} /></td>
                        <td>
                          {load.podUrl ? (
                            <a href={`${BACKEND_URL}${load.podUrl}`} target="_blank" rel="noreferrer">
                              View
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>{load.isApproved ? <Badge value="completed" /> : <Badge value="waiting" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination
              page={loadPage}
              pages={Math.ceil(filteredLoads.length / PAGE_SIZE)}
              onPageChange={setLoadPage}
            />
          </section>
        )}

        {activePanel === "drivers" && (
          <section className="super-panel">
            <div className="super-panel-header">
              <div>
                <span className="super-eyebrow">People</span>
                <h2>Drivers ({drivers.length})</h2>
              </div>
              <div className="super-export-btns">
                {drivers.length > 0 && <button onClick={handleExportDrivers}>Export Excel</button>}
              </div>
            </div>
            {filteredDrivers.length === 0 ? (
              <div className="super-empty">No drivers found.</div>
            ) : (
              <div className="super-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>License</th>
                      <th>Status</th>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activePanel === "fleet" && (
          <section className="super-panel">
            <div className="super-panel-header">
              <div>
                <span className="super-eyebrow">Assets</span>
                <h2>Fleet ({trucks.length})</h2>
              </div>
              <div className="super-export-btns">
                {trucks.length > 0 && <button onClick={handleExportTrucks}>Export Excel</button>}
              </div>
            </div>
            {filteredTrucks.length === 0 ? (
              <div className="super-empty">No trucks found.</div>
            ) : (
              <div className="super-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Reg No</th>
                      <th>Model</th>
                      <th>Make</th>
                      <th>Capacity</th>
                      <th>Status</th>
                      <th>Mileage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrucks.map((truck) => (
                      <tr key={truck._id}>
                        <td>{truck.registrationNumber}</td>
                        <td>{truck.model}</td>
                        <td>{truck.make || "-"}</td>
                        <td>{truck.capacity || "-"}</td>
                        <td><Badge value={truck.status} /></td>
                        <td>{truck.mileage || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activePanel === "customers" && (
          <section className="super-panel">
            <div className="super-panel-header">
              <div>
                <span className="super-eyebrow">Accounts</span>
                <h2>Customers ({customers.length})</h2>
              </div>
              <div className="super-export-btns">
                {customers.length > 0 && <button onClick={handleExportCustomers}>Export Excel</button>}
              </div>
            </div>
            {customers.length === 0 ? (
              <div className="super-empty">No customers found.</div>
            ) : (
              <div className="super-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => (
                      <tr key={customer._id}>
                        <td>{customer.name}</td>
                        <td>{customer.email}</td>
                        <td>{customer.phone || "-"}</td>
                        <td>{customer.address || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activePanel === "logs" && (
          <section className="super-panel">
            <div className="super-panel-header">
              <div>
                <span className="super-eyebrow">History</span>
                <h2>Activity Log ({logsTotal})</h2>
              </div>
            </div>

            <div className="super-filters">
              <label>
                Entity:
                <select value={logsFilter.entity} onChange={(e) => setLogsFilter({ ...logsFilter, entity: e.target.value })}>
                  <option value="">All</option>
                  <option value="Load">Load</option>
                  <option value="Driver">Driver</option>
                  <option value="Truck">Truck</option>
                  <option value="Customer">Customer</option>
                  <option value="User">User</option>
                </select>
              </label>
              <label>
                Action:
                <select value={logsFilter.action} onChange={(e) => setLogsFilter({ ...logsFilter, action: e.target.value })}>
                  <option value="">All</option>
                  <option value="created">Created</option>
                  <option value="updated">Updated</option>
                  <option value="deleted">Deleted</option>
                  <option value="approved">Approved</option>
                  <option value="resolved">Resolved</option>
                  <option value="pod_uploaded">POD Uploaded</option>
                  <option value="pod_generated">POD Generated</option>
                  <option value="status_updated">Status Updated</option>
                  <option value="login">Login</option>
                  <option value="register">Register</option>
                  <option value="forgot_password">Forgot Password</option>
                  <option value="reset_password">Reset Password</option>
                </select>
              </label>
              <button onClick={() => { setLogsSkip(0); fetchLogs(false); }} disabled={logsLoading}>
                {logsLoading ? "Loading..." : "Search"}
              </button>
            </div>

            {logsError && (
              <div className="super-alert">
                {logsError}
                <button onClick={() => { setLogsSkip(0); fetchLogs(false); }} style={{ marginLeft: "0.75rem", padding: "0.2rem 0.5rem", fontSize: "0.8rem" }}>
                  Retry
                </button>
              </div>
            )}

            {logs.length === 0 && !logsLoading && !logsError ? (
              <div className="super-empty">No activity logged yet.</div>
            ) : logs.length > 0 ? (
              <div className="super-table-wrap">
                <table className="super-audit-table">
                  <thead>
                    <tr>
                      <th>Date/Time</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log._id}>
                        <td className="super-audit-date">{new Date(log.createdAt).toLocaleString()}</td>
                        <td>{log.userName}<br /><small>{log.userEmail}</small></td>
                        <td><span className={`super-log-action ${log.action}`}>{log.action.replace(/_/g, " ")}</span></td>
                        <td>{log.entity}</td>
                        <td className="super-audit-detail">{log.details || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {logs.length < logsTotal && (
              <div className="super-audit-load-more">
                <button onClick={() => fetchLogs(true)} disabled={logsLoading}>
                  {logsLoading ? "Loading..." : `Load More (${logs.length} of ${logsTotal})`}
                </button>
              </div>
            )}
          </section>
        )}
        {activePanel === "invoices" && (
          <>
            <section className="super-panel">
              <div className="super-panel-header">
                <div>
                  <span className="super-eyebrow">Billing</span>
                  <h2>Invoices ({invoices.length})</h2>
                </div>
              </div>

              {invoiceStats && (
                <div className="super-kpis" style={{ marginBottom: "1rem" }}>
                  <div className="super-kpi-card">
                    <span>Total Invoiced</span>
                    <strong>R{(invoiceStats.totalInvoiced || 0).toLocaleString()}</strong>
                  </div>
                  <div className="super-kpi-card">
                    <span>Total Paid</span>
                    <strong>R{(invoiceStats.totalPaid || 0).toLocaleString()}</strong>
                  </div>
                  <div className="super-kpi-card">
                    <span>Outstanding</span>
                    <strong style={{ color: "#e74c3c" }}>R{(invoiceStats.totalOutstanding || 0).toLocaleString()}</strong>
                  </div>
                </div>
              )}

              <div className="super-filters">
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
                <div className="super-empty">No invoices found.</div>
              ) : (
                <div className="super-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Customer</th>
                        <th>Load</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Issued</th>
                        <th>Due</th>
                        <th>Paid</th>
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
                            <span className={`super-badge ${
                              inv.status === "paid" ? "success" :
                              inv.status === "overdue" ? "danger" :
                              inv.status === "cancelled" ? "danger" :
                              inv.status === "sent" ? "info" : "warning"
                            }`}>{inv.status}</span>
                          </td>
                          <td>{inv.issuedDate ? new Date(inv.issuedDate).toLocaleDateString() : "-"}</td>
                          <td style={{ color: inv.status !== "paid" && new Date(inv.dueDate) < new Date() ? "#e74c3c" : "inherit" }}>
                            {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "-"}
                          </td>
                          <td>{inv.paidDate ? new Date(inv.paidDate).toLocaleDateString() : "-"}</td>
                          <td>
                            {inv.status === "sent" && inv.paymentUrl && (
                              <a href={inv.paymentUrl} target="_blank" rel="noopener noreferrer" style={{ background:"#003366", color:"#fff", textDecoration:"none", padding:"2px 8px", borderRadius:4, fontSize:11 }}>Pay Now</a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

          </>
        )}

        {activePanel === "maintenance" && (
          <>
            <section className="super-panel">
              <div className="super-panel-header">
                <div>
                  <span className="super-eyebrow">Fleet Care</span>
                  <h2>Maintenance ({maintenanceRecords.length})</h2>
                </div>
              </div>

              {maintenanceUpcoming && (
                <div className="super-kpis" style={{ marginBottom: "1rem" }}>
                  <div className="super-kpi-card">
                    <span>Overdue</span>
                    <strong style={{ color: "#e74c3c" }}>{maintenanceUpcoming.overdue?.length || 0}</strong>
                  </div>
                  <div className="super-kpi-card">
                    <span>Upcoming (14d)</span>
                    <strong style={{ color: "#d97706" }}>{maintenanceUpcoming.upcoming?.length || 0}</strong>
                  </div>
                  <div className="super-kpi-card">
                    <span>Total Cost</span>
                    <strong>R{(maintenanceUpcoming.totalMaintenanceCost || 0).toLocaleString()}</strong>
                  </div>
                </div>
              )}

              <div className="super-filters">
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
                <div className="super-empty">No maintenance records found.</div>
              ) : (
                <div className="super-table-wrap">
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
                            <span className={`super-badge ${
                              rec.status === "completed" ? "success" :
                              rec.status === "overdue" ? "danger" :
                              rec.status === "in progress" ? "info" :
                              rec.status === "cancelled" ? "danger" : "warning"
                            }`}>{rec.status}</span>
                          </td>
                          <td>
                            {rec.status !== "completed" && (
                              <button className="super-btn-sm super-btn-danger" onClick={async () => {
                                  const ok = await confirm("Delete this maintenance record?", "Delete Maintenance", "Delete", "Cancel", "danger");
                                  if (!ok) return;
                                  try {
                                    await API.delete(`/maintenance/${rec._id}`, authHeaders);
                                    fetchMaintenance(); fetchMaintenanceUpcoming();
                                  } catch (e) { setFormMsg({ type: "error", text: e.response?.data?.message || "Failed" }); }
                                }}>×</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

          </>
        )}

        {activePanel === "fuel" && (
          <section className="super-panel">
            <div className="super-panel-header">
              <div>
                <span className="super-eyebrow">Fuel Management</span>
                <h2>Fuel Records ({fuelRecords.length})</h2>
              </div>
            </div>

            {fuelStats && (
              <div className="super-kpis" style={{ marginBottom: "1rem" }}>
                <div className="super-kpi-card">
                  <span>Total Fuel Cost</span>
                  <strong>R{(fuelStats.totalCost || 0).toLocaleString()}</strong>
                </div>
                <div className="super-kpi-card">
                  <span>Total Liters</span>
                  <strong>{(fuelStats.totalLiters || 0).toLocaleString()} L</strong>
                </div>
                <div className="super-kpi-card">
                  <span>Avg Cost / Liter</span>
                  <strong>R{(fuelStats.avgCostPerLiter || 0).toFixed(2)}</strong>
                </div>
                <div className="super-kpi-card">
                  <span>Total Entries</span>
                  <strong>{fuelStats.totalEntries || 0}</strong>
                </div>
              </div>
            )}

            {fuelRecords.length === 0 && !fuelLoading ? (
              <div className="super-empty">No fuel records found.</div>
            ) : (
              <div className="super-table-wrap">
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
                          <button className="super-btn-sm super-btn-danger" onClick={() => handleDeleteFuel(rec._id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activePanel === "users" && (
          <section className="super-panel">
            <div className="super-panel-header">
              <div>
                <span className="super-eyebrow">Administration</span>
                <h2>Users ({users.length})</h2>
              </div>
              <div className="super-export-btns">
                <button onClick={() => setShowCreateUser(!showCreateUser)}>
                  {showCreateUser ? "Cancel" : "Create User"}
                </button>
              </div>
            </div>

            {showCreateUser && (
              <div className="super-card" style={{ marginBottom: 24, padding: 24 }}>
                <h3 style={{ margin: "0 0 16px" }}>New User</h3>
                <div className="super-form-row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <input placeholder="Full Name" value={createUserForm.name} onChange={(e) => setCreateUserForm({ ...createUserForm, name: e.target.value })} />
                  <input placeholder="Email" type="email" value={createUserForm.email} onChange={(e) => setCreateUserForm({ ...createUserForm, email: e.target.value })} />
                  <input placeholder="Password" type="password" value={createUserForm.password} onChange={(e) => setCreateUserForm({ ...createUserForm, password: e.target.value })} />
                  <select value={createUserForm.role} onChange={(e) => setCreateUserForm({ ...createUserForm, role: e.target.value })}>
                    <option value="driver">Driver</option>
                    <option value="admin2">Admin2</option>
                    <option value="admin1">Admin1</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                  <button className="super-btn-sm super-btn-primary" onClick={async () => {
                    try {
                      await API.post("/users", createUserForm, authHeaders);
                      setCreateUserForm({ name: "", email: "", password: "", role: "driver" });
                      setShowCreateUser(false);
                      fetchUsers();
                    } catch (err) {
                      alert(err.response?.data?.message || "Failed to create user");
                    }
                  }}>Save</button>
                </div>
              </div>
            )}

            {users.length === 0 ? (
              <div className="super-empty">No users found.</div>
            ) : (
              <div className="super-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u._id}>
                        <td>{u.name}</td>
                        <td>{u.email}</td>
                        <td><Badge value={u.role} /></td>
                        <td><Badge value={u.isActive !== false ? "active" : "inactive"} /></td>
                        <td>
                          <select
                            value={u.role}
                            style={{ marginRight: 8 }}
                            onChange={async (e) => {
                              try {
                                await API.put(`/users/${u._id}`, { role: e.target.value }, authHeaders);
                                fetchUsers();
                              } catch (err) {
                                alert(err.response?.data?.message || "Failed to update role");
                              }
                            }}
                          >
                            <option value="driver">Driver</option>
                            <option value="admin2">Admin2</option>
                            <option value="admin1">Admin1</option>
                            <option value="superadmin">Super Admin</option>
                          </select>
                          {u.isActive !== false ? (
                            <button className="super-btn-sm super-btn-danger" onClick={async () => {
                              if (!window.confirm(`Deactivate ${u.name}?`)) return;
                              try {
                                await API.delete(`/users/${u._id}`, authHeaders);
                                fetchUsers();
                              } catch (err) {
                                alert("Failed to deactivate user");
                              }
                            }}>Deactivate</button>
                          ) : (
                            <button className="super-btn-sm super-btn-primary" onClick={async () => {
                              try {
                                await API.put(`/users/${u._id}`, { isActive: true }, authHeaders);
                                fetchUsers();
                              } catch (err) {
                                alert("Failed to activate user");
                              }
                            }}>Activate</button>
                          )}
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
      <ConfirmDialog />
      <ChatDrawer isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
};

export default SuperAdmin;
