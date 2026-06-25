import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useFocusTrap from "../hooks/useFocusTrap";
import API from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import "../styles/admin2.css";
import ThemeToggle from "../components/ThemeToggle";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import NotificationBell from "../components/NotificationBell";
import ConnectionStatus from "../components/ConnectionStatus";
import Pagination from "../components/Pagination";
import Alert from "../components/Alert";
import FormField from "../components/FormField";
import { CardSkeleton, TableSkeleton } from "../components/LoadingSkeleton";
import usePolling from "../hooks/usePolling";
import socket from "../services/socket";

const BACKEND_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const PAGE_SIZE = 20;

const normalizeStatus = (status) => (status || "").toLowerCase().trim();

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
  <span className={`admin2-badge ${statusTone[value] || "neutral"}`}>{value || "unknown"}</span>
);

const Admin2Dashboard = () => {
  const { token, user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const authHeaders = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [loads, setLoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activePanel, setActivePanel] = useState("pending");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tablePage, setTablePage] = useState(1);
  const [formMsg, setFormMsg] = useState(null);
  const [reviewLoad, setReviewLoad] = useState(null);
  const [approvalNote, setApprovalNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const modalRef = useFocusTrap(Boolean(reviewLoad));

  const fetchLoads = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const res = await API.get("/admin2/loads", authHeaders);
      setLoads(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch approval loads.");
      console.error("Admin2 fetch error:", err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, token]);

  useEffect(() => {
    fetchLoads();
  }, [fetchLoads]);

  useEffect(() => {
    if (!token) return;

    const handleLoadChange = () => fetchLoads();

    socket.on("loadCreated", handleLoadChange);
    socket.on("loadUpdated", handleLoadChange);
    socket.on("loadDeleted", handleLoadChange);
    socket.on("podUploaded", handleLoadChange);

    return () => {
      socket.off("loadCreated", handleLoadChange);
      socket.off("loadUpdated", handleLoadChange);
      socket.off("loadDeleted", handleLoadChange);
      socket.off("podUploaded", handleLoadChange);
    };
  }, [token, fetchLoads]);

  useEffect(() => {
    setTablePage(1);
  }, [activePanel]);

  usePolling(fetchLoads, 30000, Boolean(token));

  const pending = useMemo(
    () => loads.filter((load) => normalizeStatus(load.status) === "completed" && (load.reviewStatus || "pending") === "pending"),
    [loads]
  );

  const approved = useMemo(() => loads.filter((load) => load.isApproved === true || load.reviewStatus === "approved"), [loads]);
  const rejected = useMemo(() => loads.filter((load) => load.reviewStatus === "rejected" || normalizeStatus(load.status) === "rejected"), [loads]);
  const completed = useMemo(() => loads.filter((load) => normalizeStatus(load.status) === "completed"), [loads]);
  const withPod = useMemo(() => loads.filter((load) => Boolean(load.podUrl)), [loads]);
  const issueLoads = useMemo(() => loads.filter((load) => load.driverIssue?.description), [loads]);

  const metrics = useMemo(
    () => ({
      pending: pending.length,
      approved: approved.length,
      completed: completed.length,
      podReady: withPod.length,
      issues: issueLoads.length,
      rejected: rejected.length,
    }),
    [approved, completed, issueLoads, pending, rejected, withPod]
  );

  const filteredLoads = useCallback(
    (items) => {
      const term = search.toLowerCase();
      if (!term) return items;

      return items.filter((load) =>
        [
          load.ticketNumber,
          load.customer?.name,
          load.driver?.name,
          load.driver?.email,
          load.truck?.registrationNumber,
          load.status,
          load.reviewStatus,
          load.approvalNote,
          load.rejectionNote,
          load.driverIssue?.type,
          load.driverIssue?.description,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      );
    },
    [search]
  );

  const getPODUrl = (podUrl) => (podUrl ? `${BACKEND_URL}${podUrl}` : null);

  const openReview = (load) => {
    setReviewLoad(load);
    setApprovalNote(load.approvalNote || "");
    setRejectionReason(load.rejectionNote || "");
  };

  const handleApprove = async () => {
    if (!reviewLoad) return;

    try {
      await API.put(`/admin2/loads/${reviewLoad._id}/approve`, { note: approvalNote }, authHeaders);
      setReviewLoad(null);
      setApprovalNote("");
      setRejectionReason("");
      await fetchLoads();
    } catch (err) {
      console.error("Approve error:", err.response?.data || err.message);
      setFormMsg({ type: "error", text: "Failed to approve load" });
    }
  };

  const handleReject = async () => {
    if (!reviewLoad) return;
    if (!rejectionReason.trim()) {
      setFormMsg({ type: "error", text: "Rejection reason is required" });
      return;
    }

    try {
      await API.put(`/admin2/loads/${reviewLoad._id}/reject`, { reason: rejectionReason }, authHeaders);
      setReviewLoad(null);
      setApprovalNote("");
      setRejectionReason("");
      await fetchLoads();
    } catch (err) {
      console.error("Reject error:", err.response?.data || err.message);
      setFormMsg({ type: "error", text: err.response?.data?.message || "Failed to reject load" });
    }
  };

  const closeSidebar = () => setSidebarOpen(false);

  const navItems = [
    ["pending", "nav.pending"],
    ["approved", "nav.approved"],
    ["rejected", "nav.rejected"],
    ["issues", "nav.issues"],
    ["all", "nav.all"],
  ];

  const renderLoadTable = (items, emptyText, mode = "review") => {
    const rows = filteredLoads(items);
    const start = (tablePage - 1) * PAGE_SIZE;
    const pageRows = rows.slice(start, start + PAGE_SIZE);

    if (rows.length === 0) {
      return <div className="admin2-empty">{emptyText}</div>;
    }

    return (
      <>
        <div className="admin2-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Customer</th>
                <th>Dist</th>
                <th>ETA</th>
                <th>Driver</th>
                <th>Truck</th>
                <th>Status</th>
                <th>POD</th>
                <th>Issue</th>
                <th>{mode === "review" ? "Action" : "Details"}</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((load) => (
                <tr key={load._id}>
                  <td>{load.ticketNumber || "-"}</td>
                  <td>{load.customer?.name || "-"}</td>
                  <td style={{ fontSize: "0.8rem" }}>{load.routeDistance ? `${load.routeDistance} km` : "-"}</td>
                  <td style={{ fontSize: "0.8rem" }}>{load.routeDuration ? `${load.routeDuration} min` : "-"}</td>
                  <td>{load.driver?.name || load.driver?.email || "-"}</td>
                  <td>{load.truck?.registrationNumber || "-"}</td>
                  <td><Badge value={load.status} /></td>
                  <td>
                    {getPODUrl(load.podUrl) ? (
                      <a href={getPODUrl(load.podUrl)} target="_blank" rel="noreferrer">
                        View POD
                      </a>
                    ) : (
                      "Missing"
                    )}
                  </td>
                  <td>
                    {load.driverIssue?.description ? (
                      <span className="admin2-issue-summary">
                        <Badge value={load.driverIssue.status || "open"} />
                        <small>{load.driverIssue.type}</small>
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    {mode === "review" ? (
                      <button className="btn admin2-action" onClick={() => openReview(load)}>
                        Review
                      </button>
                    ) : load.driverIssue?.description ? (
                      <span className="admin2-issue-desc" title={load.driverIssue.description}>
                        {load.driverIssue.description}
                      </span>
                    ) : (
                      load.rejectionNote || load.approvalNote || "-"
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

  return (
    <div className="admin2-layout">
      <div className="admin2-mobile-bar">
        <button className="admin2-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          ☰
        </button>
        <img src="/logo_white.png" alt="Logo" />
      </div>

      {sidebarOpen && <div className="admin2-overlay" onClick={closeSidebar} />}

      <aside className={`admin2-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="admin2-logo">
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

        <div className="admin2-sidebar-footer">
          <ThemeToggle />
          <LanguageSwitcher />
          <button className="admin2-nav-link" onClick={() => navigate("/change-password")}>
            Change Password
          </button>
          <button className="admin2-logout" onClick={logout}>
            {t("auth.logout")}
          </button>
          <span>Verification Desk</span>
        </div>
      </aside>

      <main className="admin2-main">
        <header className="admin2-topbar">
          <div>
            <span className="admin2-eyebrow">{t("dashboard.loadVerification")}</span>
            <h1>{t("dashboard.loadVerification")}</h1>
            <p>{t("dashboard.welcome")}, {user?.name || "Admin"}</p>
          </div>
          <div className="admin2-topbar-actions">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("common.search")}
            />
            <button className="btn" onClick={fetchLoads}>{loading ? t("common.loading") : t("common.refresh")}</button>
            <ConnectionStatus />
            <NotificationBell />
          </div>
        </header>

        {error && <div className="admin2-alert">{error}</div>}

        <Alert message={formMsg?.text} type={formMsg?.type} onClose={() => setFormMsg(null)} />

        <section className="admin2-kpis">
          <div className="admin2-kpi-card">
            <span>Pending Review</span>
            <strong>{metrics.pending}</strong>
            <small>Completed, not approved</small>
          </div>
          <div className="admin2-kpi-card">
            <span>Approved</span>
            <strong>{metrics.approved}</strong>
            <small>Verified loads</small>
          </div>
          <div className="admin2-kpi-card">
            <span>POD Ready</span>
            <strong>{metrics.podReady}</strong>
            <small>Documents available</small>
          </div>
          <div className="admin2-kpi-card">
            <span>Issues</span>
            <strong>{metrics.issues}</strong>
            <small>Reported by drivers</small>
          </div>
          <div className="admin2-kpi-card">
            <span>Rejected</span>
            <strong>{metrics.rejected}</strong>
            <small>Needs rework</small>
          </div>
        </section>

        {loading && <><CardSkeleton count={3} /><TableSkeleton /></>}

        {!loading && activePanel === "pending" && (
          <section className="admin2-panel">
            <div className="admin2-panel-header">
              <div>
                <span className="admin2-eyebrow">Queue</span>
                <h2>Completed Loads Pending Approval</h2>
              </div>
            </div>
            {renderLoadTable(pending, "No completed loads are awaiting approval.", "review")}
          </section>
        )}

        {!loading && activePanel === "approved" && (
          <section className="admin2-panel">
            <div className="admin2-panel-header">
              <div>
                <span className="admin2-eyebrow">Archive</span>
                <h2>Approved Loads</h2>
              </div>
            </div>
            {renderLoadTable(approved, "No approved loads yet.", "archive")}
          </section>
        )}

        {!loading && activePanel === "issues" && (
          <section className="admin2-panel">
            <div className="admin2-panel-header">
              <div>
                <span className="admin2-eyebrow">Exceptions</span>
                <h2>Driver-Reported Issues</h2>
              </div>
            </div>
            {renderLoadTable(issueLoads, "No driver issues reported.", "archive")}
          </section>
        )}

        {!loading && activePanel === "rejected" && (
          <section className="admin2-panel">
            <div className="admin2-panel-header">
              <div>
                <span className="admin2-eyebrow">Rework</span>
                <h2>Rejected Loads</h2>
              </div>
            </div>
            {renderLoadTable(rejected, "No rejected loads.", "archive")}
          </section>
        )}

        {!loading && activePanel === "all" && (
          <section className="admin2-panel">
            <div className="admin2-panel-header">
              <div>
                <span className="admin2-eyebrow">Ledger</span>
                <h2>All Loads</h2>
              </div>
            </div>
            {renderLoadTable(loads, "No loads found.", "archive")}
          </section>
        )}
      </main>

      {reviewLoad && (
        <div className="admin2-modal-overlay" ref={modalRef} onClick={() => setReviewLoad(null)} role="dialog" aria-modal="true" aria-label="Load review modal">
          <div className="admin2-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin2-modal-header">
              <div>
                <span className="admin2-eyebrow">POD Review</span>
                <h2>{reviewLoad.ticketNumber || "Load Review"}</h2>
              </div>
              <button onClick={() => setReviewLoad(null)} data-close-modal aria-label="Close modal">×</button>
            </div>

            <div className="admin2-review-grid">
              <div>
                <span>Customer</span>
                <strong>{reviewLoad.customer?.name || "-"}</strong>
              </div>
              <div>
                <span>Driver</span>
                <strong>{reviewLoad.driver?.name || reviewLoad.driver?.email || "-"}</strong>
              </div>
              <div>
                <span>Truck</span>
                <strong>{reviewLoad.truck?.registrationNumber || "-"}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{reviewLoad.status || "-"}</strong>
              </div>
            </div>

            {reviewLoad.driverIssue?.description && (
              <div className="admin2-issue-box">
                <strong>{reviewLoad.driverIssue.type || "Issue"}</strong>
                <p>{reviewLoad.driverIssue.description}</p>
              </div>
            )}

            {getPODUrl(reviewLoad.podUrl) ? (
              <a className="btn admin2-pod-button admin2-open" href={getPODUrl(reviewLoad.podUrl)} target="_blank" rel="noreferrer">
                Open POD
              </a>
            ) : (
              <div className="admin2-empty">No POD is attached to this load.</div>
            )}

            <FormField label="Approval Note" name="approvalNote" type="textarea" value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} placeholder="Add verification note..." />
            <FormField label="Rejection Reason" name="rejectionReason" type="textarea" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Required when rejecting this POD/load..." />

            <div className="admin2-modal-actions">
              <button className="btn secondary" onClick={() => setReviewLoad(null)}>Cancel</button>
              <button className="btn danger" onClick={handleReject}>Reject</button>
              <button className="btn" onClick={handleApprove}>Approve Load</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin2Dashboard;
