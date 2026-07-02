import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import API from "../services/api";
import "../styles/Track.css";

const statusTone = {
  waiting: "warning",
  "in transit": "info",
  completed: "success",
  canceled: "danger",
};

const StatusBadge = ({ value }) => (
  <span className={`track-badge ${statusTone[value] || "neutral"}`}>{value || "unknown"}</span>
);

const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : "—");

const Track = () => {
  const { ticketNumber: urlTicket } = useParams();
  const [code, setCode] = useState(urlTicket || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [searched, setSearched] = useState(!!urlTicket);

  useEffect(() => {
    if (urlTicket) {
      setCode(urlTicket.toUpperCase());
      doSearch(urlTicket.toUpperCase());
    }
  }, [urlTicket]);

  const doSearch = async (trimmed) => {
    setLoading(true);
    setError("");
    setResult(null);
    setSearched(true);
    try {
      const res = await API.get(`/track/${trimmed}`);
      setResult(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setError("No shipment found with that tracking code.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    doSearch(trimmed);
  };

  const milestoneEntries = [
    { key: "arrivedPickupAt", label: "Arrived at pickup" },
    { key: "loadedAt", label: "Loaded" },
    { key: "arrivedDeliveryAt", label: "Arrived at delivery" },
    { key: "completedAt", label: "Completed" },
  ];

  return (
    <div className="track-page">
      <div className="track-container">
        <div className="track-header">
          <Link to="/"><img src="/logo.png" alt="Logo" className="track-logo" /></Link>
          <h1>Track Your Shipment</h1>
          <p>Enter your tracking code to see the latest status.</p>
        </div>

        <form className="track-form" onSubmit={handleSubmit}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter tracking code (e.g. TICKET-ABC123)"
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? "Searching..." : "Track"}
          </button>
        </form>

        {error && <div className="track-error">{error}</div>}

        {result && (
          <div className="track-result">
            <div className="track-result-header">
              <div>
                <strong className="track-ticket">{result.ticketNumber}</strong>
                {result.customer && <span className="track-customer">for {result.customer}</span>}
              </div>
              <StatusBadge value={result.status} />
            </div>

            <div className="track-timeline">
              <h3>Timeline</h3>
              {milestoneEntries.map(({ key, label }) => {
                const done = Boolean(result.milestones?.[key]);
                return (
                  <div key={key} className={`track-milestone ${done ? "done" : "pending"}`}>
                    <span className="track-milestone-icon">{done ? "✅" : "⏳"}</span>
                    <span className="track-milestone-label">{label}</span>
                    <span className="track-milestone-time">{done ? formatDateTime(result.milestones[key]) : "Pending"}</span>
                  </div>
                );
              })}
            </div>

            {result.status === "completed" && result.isApproved && (
              <p className="track-approved">✓ This shipment has been verified and approved.</p>
            )}
          </div>
        )}

        {searched && !loading && !result && !error && (
          <div className="track-error">No shipment found with that tracking code.</div>
        )}

        <div className="track-footer">
          <Link to="/">← Back to login</Link>
        </div>
      </div>
    </div>
  );
};

export default Track;
