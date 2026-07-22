import React, { useState, useEffect } from 'react';

export default function MetricCard({ title, count = 0, icon: Icon, delta, deltaPositive = true, colorClass = 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' }) {
  const [displayCount, setDisplayCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = Number(count) || 0;
    if (end === 0) {
      setDisplayCount(0);
      return;
    }
    const duration = 600;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(easeProgress * end);
      setDisplayCount(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayCount(end);
      }
    };

    requestAnimationFrame(animate);
  }, [count]);

  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700/60 shadow-sm hover:border-slate-600 transition-all duration-200 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</span>
        {Icon && (
          <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${colorClass}`}>
            <Icon className="w-4.5 h-4.5" />
          </div>
        )}
      </div>
      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-3xl font-bold text-slate-100 tracking-tight">{displayCount}</span>
        {delta && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-0.5 ${
              deltaPositive
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}
          >
            <span>{deltaPositive ? '▲' : '▼'}</span>
            <span>{delta}</span>
          </span>
        )}
      </div>
    </div>
  );
}
