import React from 'react';

export function SkeletonCard() {
  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700/60 animate-pulse flex flex-col justify-between h-28">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 bg-slate-700 rounded" />
        <div className="h-8 w-8 bg-slate-700 rounded-lg" />
      </div>
      <div className="flex items-baseline justify-between mt-4">
        <div className="h-8 w-16 bg-slate-700 rounded" />
        <div className="h-4 w-12 bg-slate-700 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="w-full bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm animate-pulse">
      <div className="h-11 bg-slate-800/80 border-b border-slate-700 px-6 flex items-center justify-between">
        <div className="h-4 w-28 bg-slate-700 rounded" />
        <div className="h-4 w-36 bg-slate-700 rounded" />
        <div className="h-4 w-24 bg-slate-700 rounded" />
        <div className="h-4 w-20 bg-slate-700 rounded" />
        <div className="h-4 w-28 bg-slate-700 rounded" />
      </div>
      <div className="divide-y divide-slate-700/60">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="h-16 px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-1/4">
              <div className="w-7 h-7 rounded-full bg-slate-700 shrink-0" />
              <div className="h-4 w-32 bg-slate-700 rounded" />
            </div>
            <div className="h-4 w-24 bg-slate-700 rounded w-1/6" />
            <div className="h-6 w-20 bg-slate-700 rounded-full w-1/6" />
            <div className="h-4 w-20 bg-slate-700 rounded w-1/6" />
            <div className="h-4 w-28 bg-slate-700 rounded w-1/6" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Skeleton({ className = 'h-4 w-full bg-slate-700 rounded' }) {
  return <div className={`animate-pulse ${className}`} />;
}
