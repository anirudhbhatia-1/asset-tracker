import React, { useState, useEffect, useRef } from 'react';
import Pill from '../ui/Pill';

const prefersReducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export default function MetricCard({ title, subtitle, count = 0, icon: Icon, delta, deltaPositive = true, colorClass = 'text-accent bg-accent/10 border-accent/20', onClick }) {
  const target = Number(count) || 0;
  // Starts at the real value (no count-up from 0 on every visit); only a
  // later change animates, from the value shown before.
  const [displayCount, setDisplayCount] = useState(target);
  const shownRef = useRef(target);

  useEffect(() => {
    const from = shownRef.current;
    if (from === target) return undefined;
    if (prefersReducedMotion() || document.hidden) {
      shownRef.current = target;
      setDisplayCount(target);
      return undefined;
    }
    const duration = 600;
    const startTime = performance.now();
    let frame;

    const animate = (currentTime) => {
      const progress = Math.min((currentTime - startTime) / duration, 1);
      // easeOutQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      const current = progress < 1 ? Math.round(from + (target - from) * easeProgress) : target;
      shownRef.current = current;
      setDisplayCount(current);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      className={`bg-surface/95 rounded-xl p-5 border border-border/80 shadow-[0_3px_12px_rgba(20,33,58,0.035)] transition duration-200 flex flex-col justify-between text-left w-full
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
        <span className="text-[2rem] leading-none font-bold text-primary tracking-[-0.04em] tabular-nums">{displayCount}</span>
        {delta && (
          <Pill tone={deltaPositive ? 'success' : 'danger'} size="md">
            <span className="inline-flex items-center gap-0.5">
              <span>{deltaPositive ? '▲' : '▼'}</span>
              <span>{delta}</span>
            </span>
          </Pill>
        )}
      </div>
      {subtitle && (
        <div className="mt-2 text-xs text-secondary">{subtitle}</div>
      )}
    </Wrapper>
  );
}
