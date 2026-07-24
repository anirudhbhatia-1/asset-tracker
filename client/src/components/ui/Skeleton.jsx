import React from 'react';

export function SkeletonCard() {
  return (
    <div className="bg-surface rounded-xl p-5 border border-border/60 animate-pulse flex flex-col justify-between h-28">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 bg-raised rounded" />
        <div className="h-8 w-8 bg-raised rounded-lg" />
      </div>
      <div className="flex items-baseline justify-between mt-4">
        <div className="h-8 w-16 bg-raised rounded" />
        <div className="h-4 w-12 bg-raised rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="w-full bg-surface rounded-xl border border-border overflow-hidden shadow-sm animate-pulse">
      <div className="h-11 bg-surface/80 border-b border-border px-6 flex items-center justify-between">
        <div className="h-4 w-28 bg-raised rounded" />
        <div className="h-4 w-36 bg-raised rounded" />
        <div className="h-4 w-24 bg-raised rounded" />
        <div className="h-4 w-20 bg-raised rounded" />
        <div className="h-4 w-28 bg-raised rounded" />
      </div>
      <div className="divide-y divide-border/60">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="h-16 px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-1/4">
              <div className="w-7 h-7 rounded-full bg-raised shrink-0" />
              <div className="h-4 w-32 bg-raised rounded" />
            </div>
            <div className="h-4 w-24 bg-raised rounded w-1/6" />
            <div className="h-6 w-20 bg-raised rounded-full w-1/6" />
            <div className="h-4 w-20 bg-raised rounded w-1/6" />
            <div className="h-4 w-28 bg-raised rounded w-1/6" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Skeleton({ className = 'h-4 w-full bg-raised rounded' }) {
  return <div className={`animate-pulse ${className}`} />;
}
