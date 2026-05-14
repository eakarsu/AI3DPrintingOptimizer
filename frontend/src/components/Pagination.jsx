import React from 'react';

export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const delta = 2;
  for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
    pages.push(i);
  }

  return (
    <div className="pagination">
      <button
        className="pagination-btn"
        onClick={() => onPageChange(1)}
        disabled={page === 1}
      >
        «
      </button>
      <button
        className="pagination-btn"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
      >
        ‹
      </button>

      {pages[0] > 1 && <span className="pagination-ellipsis">…</span>}

      {pages.map((p) => (
        <button
          key={p}
          className={`pagination-btn ${p === page ? 'active' : ''}`}
          onClick={() => onPageChange(p)}
        >
          {p}
        </button>
      ))}

      {pages[pages.length - 1] < totalPages && <span className="pagination-ellipsis">…</span>}

      <button
        className="pagination-btn"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
      >
        ›
      </button>
      <button
        className="pagination-btn"
        onClick={() => onPageChange(totalPages)}
        disabled={page === totalPages}
      >
        »
      </button>
    </div>
  );
}
