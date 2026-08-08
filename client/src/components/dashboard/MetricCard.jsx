import React, { useState, useEffect } from 'react';

export default function MetricCard({ title, subtitle, count = 0, icon: Icon, delta, deltaPositive = true, colorClass = 'text-accent bg-accent/10 border-accent/20', onClick }) {
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

  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      className={`bg-surface/95 rounded-2xl p-5 border border-border/80 shadow-[0_3px_12px_rgba(20,33,58,0.035)] transition-all duration-200 flex flex-col justify-between text-left w-full
        ${onClick ? 'hover:-translate-y-0.5 hover:border-accent/45 hover:shadow-[0_10px_24px_rgba(20,33,58,0.08)] hover:bg-raised/70 cursor-pointer active:translate-y-0' : 'hover:border-border'}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.11em] text-secondary">{title}</span>
        {Icon && (
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-sm ${colorClass}`}>
            <Icon className="w-4.5 h-4.5" />
          </div>
        )}
      </div>
      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-[2rem] leading-none font-bold text-primary tracking-[-0.04em]">{displayCount}</span>
        {delta && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-0.5 ${
              deltaPositive
                ? 'bg-success/10 text-success border border-success/20'
                : 'bg-danger/10 text-danger border border-danger/20'
            }`}
          >
            <span>{deltaPositive ? '▲' : '▼'}</span>
            <span>{delta}</span>
          </span>
        )}
      </div>
      {subtitle && (
        <div className="mt-2 text-xs text-secondary">{subtitle}</div>
      )}
    </Wrapper>
  );
}
