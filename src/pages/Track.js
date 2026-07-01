import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import API from "../services/api";
import "../styles/Track.css";

const BACKEND_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

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

const mapLink = (location) =>
  location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}` : null;

const directionsLink = (from, to) => {
  if (!from || !to) return null;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&travelmode=driving`;
};

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

            <div className="track-route">
              <div className="track-location">
                <span className="track-label">Pickup</span>
                {mapLink(result.pickupLocation) ? (
                  <a href={mapLink(result.pickupLocation)} target="_blank" rel="noopener noreferrer">
                    {result.pickupLocation}
                  </a>
                ) : (
                  <strong>{result.pickupLocation || "—"}</strong>
                )}
              </div>
              <div className="track-arrow">→</div>
              <div className="track-location">
                <span className="track-label">Delivery</span>
                {mapLink(result.deliveryLocation) ? (
                  <a href={mapLink(result.deliveryLocation)} target="_blank" rel="noopener noreferrer">
                    {result.deliveryLocation}
                  </a>
                ) : (
                  <strong>{result.deliveryLocation || "—"}</strong>
                )}
              </div>
            </div>

            {directionsLink(result.pickupLocation, result.deliveryLocation) && (
              <a className="track-route-btn" href={directionsLink(result.pickupLocation, result.deliveryLocation)} target="_blank" rel="noopener noreferrer">
                Open Route in Google Maps
              </a>
            )}

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

            <div className="track-details">
              <div>
                <span className="track-label">Driver</span>
                <strong>{result.driver?.name || "Not assigned"}</strong>
              </div>
              <div>
                <span className="track-label">Truck</span>
                <strong>{result.truck || "Not assigned"}</strong>
              </div>
              <div>
                <span className="track-label">Cargo</span>
                <strong>{result.cargoType || "—"}</strong>
              </div>
              <div>
                <span className="track-label">Priority</span>
                <strong>{result.priority || "normal"}</strong>
              </div>
              <div>
                <span className="track-label">Collection date</span>
                <strong>{formatDateTime(result.collectionDate)}</strong>
              </div>
              <div>
                <span className="track-label">Delivery date</span>
                <strong>{formatDateTime(result.deliveryDate)}</strong>
              </div>
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
