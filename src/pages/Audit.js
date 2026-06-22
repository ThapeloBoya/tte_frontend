import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import API from "../services/api";
import "../styles/Audit.css";

const ACTION_LABELS = {
  created: "Created",
  updated: "Updated",
  deleted: "Deleted",
  pod_uploaded: "POD Uploaded",
  status_updated: "Status Updated",
  approved: "Approved",
  rejected: "Rejected",
  resolved: "Issue Resolved",
  bulk_status: "Bulk Status Update",
  bulk_assign: "Bulk Assign",
  bulk_delete: "Bulk Delete",
};

const ACTION_COLORS = {
  created: "#16a34a",
  updated: "#2563eb",
  deleted: "#dc2626",
  pod_uploaded: "#9333ea",
  status_updated: "#d97706",
  approved: "#16a34a",
  rejected: "#dc2626",
  resolved: "#0891b2",
  bulk_status: "#6b7280",
  bulk_assign: "#6b7280",
  bulk_delete: "#dc2626",
};

function Audit() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityIdFilter, setEntityIdFilter] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { limit: pageSize, skip: page * pageSize };
      if (entityFilter) params.entity = entityFilter;
      if (actionFilter) params.action = actionFilter;
      if (entityIdFilter) params.entityId = entityIdFilter;
      const res = await API.get("/audit-logs", { params });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch audit logs");
    } finally {
      setLoading(false);
    }
  }, [entityFilter, actionFilter, entityIdFilter, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="audit-page">
      <header className="audit-header">
        <div>
          <span className="audit-eyebrow">Audit Trail</span>
          <h1>Audit Logs ({total})</h1>
        </div>
        <div className="audit-user">{user?.name || user?.email}</div>
      </header>

      <div className="audit-filters">
        <select value={entityFilter} onChange={(e) => { setEntityFilter(e.target.value); setPage(0); }}>
          <option value="">All Entities</option>
          <option value="Load">Load</option>
          <option value="Driver">Driver</option>
          <option value="Truck">Truck</option>
          <option value="Customer">Customer</option>
          <option value="User">User</option>
          <option value="Invoice">Invoice</option>
        </select>

        <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}>
          <option value="">All Actions</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Filter by entity ID..."
          value={entityIdFilter}
          onChange={(e) => { setEntityIdFilter(e.target.value); setPage(0); }}
        />

        <button onClick={() => { setEntityFilter(""); setActionFilter(""); setEntityIdFilter(""); setPage(0); }}>
          Clear Filters
        </button>
      </div>

      {error && <div className="audit-error">{error}</div>}

      {loading ? (
        <div className="audit-loading">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="audit-empty">No audit logs found.</div>
      ) : (
        <>
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Entity ID</th>
                  <th>User</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id}>
                    <td className="audit-cell-time">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}
                    </td>
                    <td>
                      <span
                        className="audit-badge"
                        style={{ backgroundColor: ACTION_COLORS[log.action] || "#6b7280" }}
                      >
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td>{log.entity}</td>
                    <td className="audit-cell-id">{log.entityId ? String(log.entityId).slice(0, 12) + "…" : "-"}</td>
                    <td>{log.userName || log.userEmail || "-"}</td>
                    <td className="audit-cell-details">{log.details || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="audit-pagination">
              <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Previous
              </button>
              <span>Page {page + 1} of {totalPages}</span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Audit;
