import React from "react";

const Pagination = ({ page, pages, onPageChange }) => {
  if (pages <= 1) return null;

  const getPages = () => {
    const range = [];
    const delta = 2;
    const start = Math.max(2, page - delta);
    const end = Math.min(pages - 1, page + delta);

    range.push(1);
    if (start > 2) range.push("...");
    for (let i = start; i <= end; i++) range.push(i);
    if (end < pages - 1) range.push("...");
    if (pages > 1) range.push(pages);

    return range;
  };

  return (
    <div className="pagination">
      <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Prev
      </button>
      {getPages().map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="pagination-ellipsis">...</span>
        ) : (
          <button
            key={p}
            className={p === page ? "pagination-active" : ""}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        )
      )}
      <button disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
        Next
      </button>
    </div>
  );
};

export default Pagination;
