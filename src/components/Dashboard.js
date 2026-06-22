// src/components/SuperadminDashboard.js
import React, { useEffect, useState } from "react";
import API from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import io from "socket.io-client";
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

const BACKEND_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const COLORS = ["#FFBB28", "#00C49F", "#0088FE", "#FF8042"];
const socket = io("https://tte-backend-obx2.onrender.com"); // adjust if backend deployed

const SuperadminDashboard = () => {
  const { token, user, logout } = useAuth();
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const [loads, setLoads] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("");

  const fetchLoads = async () => {
    try {
      setLoading(true);
      const res = await API.get("/superadmin/loads", authHeaders);
      setLoads(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err.response?.data || err.message);
      setLoading(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      const res = await API.get("/drivers", authHeaders);
      setDrivers(res.data);
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  };

  const fetchTrucks = async () => {
    try {
      const res = await API.get("/trucks", authHeaders);
      setTrucks(res.data);
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await API.get("/customers", authHeaders);
      setCustomers(res.data);
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  };

  useEffect(() => {
    if (token) {
      fetchLoads();
      fetchDrivers();
      fetchTrucks();
      fetchCustomers();
    }

    socket.on("loadUpdated", () => fetchLoads());
    socket.on("loadAssigned", () => fetchLoads());
    socket.on("podUploaded", () => fetchLoads());

    return () => {
      socket.off("loadUpdated");
      socket.off("loadAssigned");
      socket.off("podUploaded");
    };
  }, [token]);

  const handleApprove = async (loadId) => {
    const note = prompt("Enter approval note (optional):");
    try {
      await API.put(`/superadmin/loads/${loadId}/approve`, { note }, authHeaders);
      fetchLoads();
    } catch (err) {
      console.error("Error approving load:", err.response?.data || err.message);
    }
  };

  if (loading) return <p>Loading...</p>;

  // Filters
  let filteredLoads = [...loads];
  if (statusFilter) filteredLoads = filteredLoads.filter((l) => l.status === statusFilter);
  if (monthFilter)
    filteredLoads = filteredLoads.filter(
      (l) => new Date(l.createdAt).getMonth() + 1 === parseInt(monthFilter)
    );

  if (search) {
    filteredLoads = filteredLoads.filter(
      (l) =>
        l.customer?.name.toLowerCase().includes(search.toLowerCase()) ||
        l.truck?.registrationNumber.toLowerCase().includes(search.toLowerCase()) ||
        l.driver?.name.toLowerCase().includes(search.toLowerCase()) ||
        l.status.toLowerCase().includes(search.toLowerCase())
    );
  }

  if (sortBy === "date") filteredLoads.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  if (sortBy === "priority") filteredLoads.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  if (sortBy === "status") filteredLoads.sort((a, b) => a.status.localeCompare(b.status));

  // Counters
  const counter = {
    waiting: filteredLoads.filter((l) => l.status === "waiting").length,
    inTransit: filteredLoads.filter((l) => l.status === "in transit").length,
    completed: filteredLoads.filter((l) => l.status === "completed").length,
    cancelled: filteredLoads.filter((l) => l.status === "cancelled").length,
  };

  const pieData = [
    { name: "Waiting", value: counter.waiting },
    { name: "In Transit", value: counter.inTransit },
    { name: "Completed", value: counter.completed },
    { name: "Cancelled", value: counter.cancelled },
  ];

  const monthlyCompleted = Array(12)
    .fill(0)
    .map((_, i) => ({
      month: i + 1,
      completed: loads.filter(
        (l) => l.status === "completed" && new Date(l.createdAt).getMonth() === i
      ).length,
    }));

  const completedNotApproved = filteredLoads.filter((l) => l.status === "completed" && !l.isApproved);
  const alreadyApproved = filteredLoads.filter((l) => l.isApproved);

  // CSV / Excel Export
  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredLoads.map(l => ({
      Ticket: l.ticketNumber,
      Customer: l.customer?.name,
      Truck: l.truck?.registrationNumber,
      Driver: l.driver?.name,
      Status: l.status,
      Priority: l.priority,
      POD: l.podUrl || "",
      CreatedAt: new Date(l.createdAt).toLocaleString()
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Loads");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(data, "loads.xlsx");
  };

  return (
    <div>
      <header>
        <span>Welcome, {user?.name}</span>
        <button onClick={logout}>Logout</button>
      </header>

      <h1>Superadmin Dashboard</h1>

      {/* Charts */}
      <section style={{ width: "100%", height: 300, marginBottom: "1rem" }}>
        <ResponsiveContainer>
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
      </section>

      <section style={{ width: "100%", height: 300, marginBottom: "1rem" }}>
        <h2>Completed Loads per Month</h2>
        <ResponsiveContainer>
          <BarChart data={monthlyCompleted}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="completed" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Filters */}
      <section style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder="Search by customer, truck, driver, status"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label style={{ marginLeft: "1rem" }}>
          Status:
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="waiting">Waiting</option>
            <option value="in transit">In Transit</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label style={{ marginLeft: "1rem" }}>
          Month:
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="">All</option>
            {[...Array(12).keys()].map((m) => (
              <option key={m + 1} value={m + 1}>{m + 1}</option>
            ))}
          </select>
        </label>
        <label style={{ marginLeft: "1rem" }}>
          Sort by:
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="">None</option>
            <option value="date">Date</option>
            <option value="priority">Priority</option>
            <option value="status">Status</option>
          </select>
        </label>

        {/* CSV / Excel export buttons */}
        <div style={{ marginTop: "0.5rem" }}>
          <CSVLink data={filteredLoads} filename="loads.csv">
            <button>Export CSV</button>
          </CSVLink>
          <button onClick={exportToExcel} style={{ marginLeft: "0.5rem" }}>Export Excel</button>
        </div>
      </section>
      {/* Completed but not approved */}
      <section>
        <h2>Completed Loads (Pending Approval)</h2>
        {completedNotApproved.length === 0 ? (
          <p>No completed loads pending approval.</p>
        ) : (
          <table border="1">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Customer</th>
                <th>Truck</th>
                <th>Driver</th>
                <th>POD</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {completedNotApproved.map((load) => (
                <tr key={load._id}>
                  <td>{load.ticketNumber}</td>
                  <td>{load.customer?.name}</td>
                  <td>{load.truck?.registrationNumber}</td>
                  <td>{load.driver?.name}</td>
                  <td>
                    {load.podUrl && typeof load.podUrl === "string" && (
                      <a
                        href={`${BACKEND_URL}${load.podUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View POD
                      </a>
                    )}
                  </td>
                  <td>{load.status}</td>
                  
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {/* Placeholder for role-based logs */}
      <section>
        <h2>Role-based Logs</h2>
        <p>Track who updated, approved, or deleted a load. (Coming soon)</p>
      </section>

      {/* Already Approved Loads */}
      <section>
        <h2>Already Approved Loads</h2>
        {alreadyApproved.length === 0 ? (
          <p>No approved loads yet</p>
        ) : (
          <table border="1">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Customer</th>
                <th>Truck</th>
                <th>Driver</th>
                <th>POD</th>
                <th>Status</th>
                <th>Approval Note</th>
              </tr>
            </thead>
            <tbody>
              {alreadyApproved.map((load) => (
                <tr key={load._id}>
                  <td>{load.ticketNumber}</td>
                  <td>{load.customer?.name}</td>
                  <td>{load.truck?.registrationNumber}</td>
                  <td>{load.driver?.name}</td>
                  <td>
                    {load.podUrl && typeof load.podUrl === "string" && (
                      <a
                        href={`${BACKEND_URL}${load.podUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View POD
                      </a>
                    )}
                  </td>
                  <td>{load.status}</td>
                  <td>{load.approvalNote || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Drivers */}
      <section>
        <h2>Drivers</h2>
        {drivers.length === 0 ? (
          <p>No drivers available</p>
        ) : (
          <table border="1">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone no</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver._id}>
                  <td>{driver.name}</td>
                  <td>{driver.email}</td>
                  <td>{driver.phone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Trucks */}
      <section>
        <h2>Trucks</h2>
        {trucks.length === 0 ? (
          <p>No trucks available</p>
        ) : (
          <table border="1">
            <thead>
              <tr>
                <th>Registration</th>
                <th>Model</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {trucks.map((truck) => (
                <tr key={truck._id}>
                  <td>{truck.registrationNumber}</td>
                  <td>{truck.model}</td>
                  <td>{truck.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Customers */}
      <section>
        <h2>Customers</h2>
        {customers.length === 0 ? (
          <p>No customers available</p>
        ) : (
          <table border="1">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone No</th>
                <th>Address</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer._id}>
                  <td>{customer.name}</td>
                  <td>{customer.email}</td>
                  <td>{customer.phone}</td>
                  <td>{customer.address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default SuperadminDashboard;
