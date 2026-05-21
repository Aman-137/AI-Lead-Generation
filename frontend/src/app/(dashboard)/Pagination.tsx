"use client";

import { useMemo } from "react";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  perPage?: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalItems, perPage = 10, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(totalItems / perPage);

  const pages = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

    const items: (number | "...")[] = [1];

    if (currentPage > 3) items.push("...");

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) items.push(i);

    if (currentPage < totalPages - 2) items.push("...");

    items.push(totalPages);
    return items;
  }, [currentPage, totalPages]);

  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * perPage + 1;
  const endItem = Math.min(currentPage * perPage, totalItems);

  return (
    <div className="flex items-center justify-between px-2 pt-5 pb-1">
      <p className="text-xs text-gray-400">
        Showing <span className="font-semibold text-gray-600">{startItem}–{endItem}</span> of <span className="font-semibold text-gray-600">{totalItems}</span>
      </p>

      <div className="flex items-center gap-1">
        {/* Prev */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Page numbers */}
        {pages.map((page, i) =>
          page === "..." ? (
            <span key={`dots-${i}`} className="w-9 h-9 flex items-center justify-center text-xs text-gray-400">
              ···
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all ${
                page === currentPage
                  ? "text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
              style={page === currentPage ? { background: '#2f276c', boxShadow: '0 4px 12px rgba(47, 39, 108, 0.3)' } : undefined}
            >
              {page}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
