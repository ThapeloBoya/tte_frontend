import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useFocusTrap from "../hooks/useFocusTrap";
import API from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import "../styles/Admin1.css";
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
import ChatDrawer from "../components/ChatDrawer";

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
  const [activePanel, setActivePanel] = useState("pod");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const [formMsg, setFormMsg] = useState(null);

  // POD review
  const [reviewLoad, setReviewLoad] = useState(null);
  const [approvalNote, setApprovalNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  // Issue resolve
  const [resolveLoad, setResolveLoad] = useState(null);
  const [resolveNote, setResolveNote] = useState("");

  const [chatOpen, setChatOpen] = useState(false);
  const modalRef = useFocusTrap(Boolean(reviewLoad || resolveLoad));

  const fetchLoads = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await API.get("/admin2/loads", authHeaders);
      setLoads(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch loads.");
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

  const pendingPod = useMemo(
    () => loads.filter((load) => normalizeStatus(load.status) === "completed" && (load.reviewStatus || "pending") === "pending"),
    [loads]
  );

  const approved = useMemo(
    () => loads.filter((load) => load.isApproved === true || load.reviewStatus === "approved"),
    [loads]
  );

  const rejected = useMemo(
    () => loads.filter((load) => load.reviewStatus === "rejected" || normalizeStatus(load.status) === "rejected"),
    [loads]
  );

  const issueLoads = useMemo(
    () => loads.filter((load) => load.driverIssue?.description && load.driverIssue?.status !== "resolved"),
    [loads]
  );

  const metrics = useMemo(
    () => ({
      pending: pendingPod.length,
      approved: approved.length,
      rejected: rejected.length,
      issues: issueLoads.length,
    }),
    [pendingPod, approved, rejected, issueLoads]
  );

  const getPODUrl = (podUrl) => (podUrl ? `${BACKEND_URL}${podUrl}` : null);

  // POD review handlers
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

  // Issue resolve handler
  const handleResolveIssue = async () => {
    if (!resolveLoad) return;
    try {
      await API.patch(`/loads/${resolveLoad._id}/resolve-issue`, { note: resolveNote }, authHeaders);
      setResolveLoad(null);
      setResolveNote("");
      setFormMsg({ type: "success", text: "Issue resolved successfully" });
      await fetchLoads();
    } catch (err) {
      console.error("Resolve error:", err.response?.data || err.message);
      setFormMsg({ type: "error", text: err.response?.data?.message || "Failed to resolve issue" });
    }
  };

  const handleRejectIssue = async () => {
    if (!resolveLoad) return;
    try {
      await API.patch(`/loads/${resolveLoad._id}/reject-issue`, { reason: resolveNote }, authHeaders);
      setResolveLoad(null);
      setResolveNote("");
      setFormMsg({ type: "success", text: "Issue rejected" });
      await fetchLoads();
    } catch (err) {
      console.error("Reject error:", err.response?.data || err.message);
      setFormMsg({ type: "error", text: err.response?.data?.message || "Failed to reject issue" });
    }
  };

  const closeSidebar = () => setSidebarOpen(false);

  const navItems = [
    ["pod", "POD Queue"],
    ["issues", "Issues"],
    ["history", "History"],
  ];

  const renderLoadTable = (items, emptyText, mode = "review") => {
    const start = (tablePage - 1) * PAGE_SIZE;
    const pageRows = items.slice(start, start + PAGE_SIZE);

    if (items.length === 0) {
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
                <th>Driver</th>
                <th>Truck</th>
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
                  <td>{load.driver?.name || load.driver?.email || "-"}</td>
                  <td>{load.truck?.registrationNumber || "-"}</td>
                  <td>
                    {getPODUrl(load.podUrl) ? (
                      <a href={getPODUrl(load.podUrl)} target="_blank" rel="noreferrer">View POD</a>
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
                      <button className="btn admin2-action" onClick={() => openReview(load)}>Review</button>
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
        <Pagination page={tablePage} pages={Math.ceil(items.length / PAGE_SIZE)} onPageChange={setTablePage} />
      </>
    );
  };

  const renderIssuesTable = (items, emptyText) => {
    const start = (tablePage - 1) * PAGE_SIZE;
    const pageRows = items.slice(start, start + PAGE_SIZE);

    if (items.length === 0) {
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
                <th>Driver</th>
                <th>Truck</th>
                <th>Type</th>
                <th>Description</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((load) => (
                <tr key={load._id}>
                  <td>{load.ticketNumber || "-"}</td>
                  <td>{load.customer?.name || "-"}</td>
                  <td>{load.driver?.name || load.driver?.email || "-"}</td>
                  <td>{load.truck?.registrationNumber || "-"}</td>
                  <td>{load.driverIssue?.type || "-"}</td>
                  <td>
                    <span className="admin2-issue-desc" title={load.driverIssue?.description}>
                      {load.driverIssue?.description || "-"}
                    </span>
                  </td>
                  <td><Badge value={load.driverIssue?.status || "open"} /></td>
                  <td>
                    <button className="btn admin2-action" onClick={() => { setResolveLoad(load); setResolveNote(""); }}>
                      Resolve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={tablePage} pages={Math.ceil(items.length / PAGE_SIZE)} onPageChange={setTablePage} />
      </>
    );
  };

  return (
    <div className="admin2-layout">
      <div className="admin2-mobile-bar">
        <button className="admin2-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>
        <img src="/logo_white.png" alt="Logo" />
      </div>

      {sidebarOpen && <div className="admin2-overlay" onClick={closeSidebar} />}

      <aside className={`admin2-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="admin2-logo">
          <img src="/logo_white.png" alt="FleetFlow" />
        </div>

        <nav>
          {navItems.map(([id, label]) => (
            <button key={id} className={activePanel === id ? "active" : ""} onClick={() => { setActivePanel(id); closeSidebar(); }}>
              {label}
            </button>
          ))}
        </nav>

        <div className="admin2-sidebar-footer">
          <ThemeToggle />
          <LanguageSwitcher />
          <button className="admin2-nav-link" onClick={() => navigate("/change-password")}>Change Password</button>
          <button className="admin2-nav-link" onClick={() => setChatOpen(true)}>Chat</button>
          <button className="admin2-logout" onClick={logout}>{t("auth.logout")}</button>
          <span>Verification Desk</span>
        </div>
      </aside>

      <main className="admin2-main">
        <header className="admin2-topbar">
          <div>
            <span className="admin2-eyebrow">Verification Desk</span>
            <h1>POD Approval</h1>
            <p>{t("dashboard.welcome")}, {user?.name || "Admin"}</p>
          </div>
          <div className="admin2-topbar-actions">
            <button className="btn admin2-action" onClick={fetchLoads}>{loading ? "Loading..." : "Refresh"}</button>
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
            <small>Awaiting POD approval</small>
          </div>
          <div className="admin2-kpi-card">
            <span>Open Issues</span>
            <strong>{metrics.issues}</strong>
            <small>Reported by drivers</small>
          </div>
          <div className="admin2-kpi-card">
            <span>Approved</span>
            <strong>{metrics.approved}</strong>
            <small>Verified loads</small>
          </div>
          <div className="admin2-kpi-card">
            <span>Rejected</span>
            <strong>{metrics.rejected}</strong>
            <small>Needs rework</small>
          </div>
        </section>

        {loading && <><CardSkeleton count={3} /><TableSkeleton /></>}

        {!loading && activePanel === "pod" && (
          <section className="admin2-panel">
            <div className="admin2-panel-header">
              <div>
                <span className="admin2-eyebrow">Queue</span>
                <h2>Loads Pending POD Approval</h2>
              </div>
            </div>
            {renderLoadTable(pendingPod, "No loads awaiting approval.", "review")}
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
            {renderIssuesTable(issueLoads, "No open issues.")}
          </section>
        )}

        {!loading && activePanel === "history" && (
          <section className="admin2-panel">
            <div className="admin2-panel-header">
              <div>
                <span className="admin2-eyebrow">Archive</span>
                <h2>Approved & Rejected Loads</h2>
              </div>
            </div>
            {renderLoadTable([...approved, ...rejected], "No approved or rejected loads yet.", "archive")}
          </section>
        )}
      </main>

      {/* POD Review Modal */}
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
              <div><span>Customer</span><strong>{reviewLoad.customer?.name || "-"}</strong></div>
              <div><span>Driver</span><strong>{reviewLoad.driver?.name || reviewLoad.driver?.email || "-"}</strong></div>
              <div><span>Truck</span><strong>{reviewLoad.truck?.registrationNumber || "-"}</strong></div>
              <div><span>Status</span><strong>{reviewLoad.status || "-"}</strong></div>
            </div>

            {reviewLoad.driverIssue?.description && (
              <div className="admin2-issue-box">
                <strong>{reviewLoad.driverIssue.type || "Issue"}</strong>
                <p>{reviewLoad.driverIssue.description}</p>
              </div>
            )}

            {getPODUrl(reviewLoad.podUrl) ? (
              <a className="btn admin2-pod-button admin2-open" href={getPODUrl(reviewLoad.podUrl)} target="_blank" rel="noreferrer">Open POD</a>
            ) : (
              <div className="admin2-empty">No POD is attached to this load.</div>
            )}

            <FormField label="Approval Note" name="approvalNote" type="textarea" value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} placeholder="Add verification note..." />
            <FormField label="Rejection Reason" name="rejectionReason" type="textarea" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Required when rejecting..." />

            <div className="admin2-modal-actions">
              <button className="btn secondary" onClick={() => setReviewLoad(null)}>Cancel</button>
              <button className="btn danger" onClick={handleReject}>Reject</button>
              <button className="btn" onClick={handleApprove}>Approve Load</button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Issue Modal */}
      {resolveLoad && (
        <div className="admin2-modal-overlay" ref={modalRef} onClick={() => setResolveLoad(null)} role="dialog" aria-modal="true" aria-label="Resolve issue modal">
          <div className="admin2-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin2-modal-header">
              <div>
                <span className="admin2-eyebrow">Issue Resolution</span>
                <h2>{resolveLoad.ticketNumber || "Resolve Issue"}</h2>
              </div>
              <button onClick={() => setResolveLoad(null)} data-close-modal aria-label="Close modal">×</button>
            </div>

            <div className="admin2-review-grid">
              <div><span>Customer</span><strong>{resolveLoad.customer?.name || "-"}</strong></div>
              <div><span>Driver</span><strong>{resolveLoad.driver?.name || resolveLoad.driver?.email || "-"}</strong></div>
              <div><span>Truck</span><strong>{resolveLoad.truck?.registrationNumber || "-"}</strong></div>
              <div><span>Reported</span><strong>{resolveLoad.driverIssue?.reportedAt ? new Date(resolveLoad.driverIssue.reportedAt).toLocaleDateString() : "-"}</strong></div>
            </div>

            <div className="admin2-issue-box">
              <strong>{resolveLoad.driverIssue?.type || "Issue"}</strong>
              <p>{resolveLoad.driverIssue?.description || "No description"}</p>
            </div>

            <FormField label="Resolution Note" name="resolutionNote" type="textarea" value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} placeholder="Describe how the issue was resolved..." />

            <div className="admin2-modal-actions">
              <button className="btn secondary" onClick={() => setResolveLoad(null)}>Cancel</button>
              <button className="btn danger" onClick={handleRejectIssue}>Reject Issue</button>
              <button className="btn" onClick={handleResolveIssue}>Resolve Issue</button>
            </div>
          </div>
        </div>
      )}

      <ChatDrawer isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
};

export default Admin2Dashboard;