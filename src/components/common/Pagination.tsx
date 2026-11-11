import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemName?: string;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 15, 25, 50],
  itemName,
  className = '',
}) => {
  const { language, _t } = useApp();
  const isRtl = language === 'ar' || (typeof document !== 'undefined' && document.documentElement.dir === 'rtl');

  if (totalPages <= 1 && totalItems <= pageSize) {
    return null;
  }

  const safePage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  // Generate page numbers with ellipses
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      const leftBoundary = Math.max(2, safePage - 1);
      const rightBoundary = Math.min(totalPages - 1, safePage + 1);

      if (leftBoundary > 2) {
        pages.push('...');
      }

      for (let i = leftBoundary; i <= rightBoundary; i++) {
        pages.push(i);
      }

      if (rightBoundary < totalPages - 1) {
        pages.push('...');
      }

      pages.push(totalPages);
    }
    return pages;
  };

  const handlePrev = () => {
    if (safePage > 1) {
      onPageChange(safePage - 1);
    }
  };

  const handleNext = () => {
    if (safePage < totalPages) {
      onPageChange(safePage + 1);
    }
  };

  const handleFirst = () => {
    if (safePage > 1) {
      onPageChange(1);
    }
  };

  const handleLast = () => {
    if (safePage < totalPages) {
      onPageChange(totalPages);
    }
  };

  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;
  const FirstIcon = isRtl ? ChevronsRight : ChevronsLeft;
  const LastIcon = isRtl ? ChevronsLeft : ChevronsRight;

  const defaultItemName = _t('عنصر', 'items', 'Einträge');
  const labelItem = itemName || defaultItemName;

  return (
    <div
      className={`bg-surface border border-surface-border rounded-xl p-2.5 sm:p-3 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4 shadow-2xs transition-all ${className}`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Left side: Results Count & Page Size Selector */}
      <div className="flex items-center justify-between w-full sm:w-auto gap-3 text-xs">
        <div className="text-text-muted font-bold text-[11px] sm:text-xs">
          {_t('عرض', 'Showing', 'Zeige')}{' '}
          <span className="font-mono text-text-main font-black">{startItem} - {endItem}</span>{' '}
          {_t('من إجمالي', 'of', 'von')}{' '}
          <span className="font-mono text-text-main font-black">{totalItems}</span>{' '}
          {labelItem}
        </div>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
            <span className="text-text-muted font-bold hidden xs:inline">
              {_t('لكل صفحة:', 'Per page:', 'Pro Seite:')}
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                onPageSizeChange(newSize);
                onPageChange(1);
              }}
              className="bg-surface-hover hover:bg-surface border border-surface-border rounded-lg px-2 py-1 text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-colors"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right side: Page Navigation Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 w-full sm:w-auto justify-center sm:justify-end">
        {/* First Page */}
        <button
          type="button"
          onClick={handleFirst}
          disabled={safePage <= 1}
          className="w-8 h-8 rounded-lg flex items-center justify-center border border-surface-border bg-surface hover:bg-surface-hover text-text-muted hover:text-text-main disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer active:scale-95"
          title={_t('الصفحة الأولى', 'First Page', 'Erste Seite')}
          aria-label={_t('الصفحة الأولى', 'First Page', 'Erste Seite')}
        >
          <FirstIcon className="w-4 h-4" />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={safePage <= 1}
          className="w-8 h-8 rounded-lg flex items-center justify-center border border-surface-border bg-surface hover:bg-surface-hover text-text-muted hover:text-text-main disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer active:scale-95"
          title={_t('الصفحة السابقة', 'Previous Page', 'Vorherige Seite')}
          aria-label={_t('الصفحة السابقة', 'Previous Page', 'Vorherige Seite')}
        >
          <PrevIcon className="w-4 h-4" />
        </button>

        {/* Page Number Chips */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-6 text-center text-text-muted font-mono font-bold text-xs select-none"
                >
                  …
                </span>
              );
            }

            const pageNum = p as number;
            const isCurrent = pageNum === safePage;

            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={`min-w-8 h-8 px-2 rounded-lg text-xs font-mono font-black transition-all cursor-pointer active:scale-95 ${
                  isCurrent
                    ? 'bg-primary text-white border border-primary shadow-xs'
                    : 'bg-surface hover:bg-surface-hover text-text-main border border-surface-border'
                }`}
                aria-current={isCurrent ? 'page' : undefined}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          onClick={handleNext}
          disabled={safePage >= totalPages}
          className="w-8 h-8 rounded-lg flex items-center justify-center border border-surface-border bg-surface hover:bg-surface-hover text-text-muted hover:text-text-main disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer active:scale-95"
          title={_t('الصفحة التالية', 'Next Page', 'Nächste Seite')}
          aria-label={_t('الصفحة التالية', 'Next Page', 'Nächste Seite')}
        >
          <NextIcon className="w-4 h-4" />
        </button>

        {/* Last Page */}
        <button
          type="button"
          onClick={handleLast}
          disabled={safePage >= totalPages}
          className="w-8 h-8 rounded-lg flex items-center justify-center border border-surface-border bg-surface hover:bg-surface-hover text-text-muted hover:text-text-main disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer active:scale-95"
          title={_t('الصفحة الأخيرة', 'Last Page', 'Letzte Seite')}
          aria-label={_t('الصفحة الأخيرة', 'Last Page', 'Letzte Seite')}
        >
          <LastIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
