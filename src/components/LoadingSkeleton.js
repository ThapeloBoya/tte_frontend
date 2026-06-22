import React from "react";

const Skeleton = ({ width, height, borderRadius }) => (
  <div
    className="skeleton-pulse"
    style={{
      width: width || "100%",
      height: height || "1rem",
      borderRadius: borderRadius || "4px",
    }}
  />
);

export const TableSkeleton = ({ rows = 5, cols = 6 }) => (
  <div style={{ padding: "1rem 0" }}>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem", alignItems: "center" }}>
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} width={`${100 / cols}%`} height="1.2rem" />
        ))}
      </div>
    ))}
  </div>
);

export const CardSkeleton = ({ count = 4 }) => (
  <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} style={{ flex: 1, padding: "1rem", border: "1px solid #eee", borderRadius: "8px" }}>
        <Skeleton width="60%" height="0.8rem" />
        <Skeleton width="40%" height="1.5rem" />
        <Skeleton width="50%" height="0.7rem" />
      </div>
    ))}
  </div>
);

export default Skeleton;
