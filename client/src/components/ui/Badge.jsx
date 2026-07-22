import React from 'react';

export default function Badge({ badgeChar, color, title, className = '' }) {
  const char = badgeChar ? badgeChar.charAt(0).toUpperCase() : '?';
  const bgColor = color || '#6366F1';

  return (
    <span
      title={title}
      style={{ backgroundColor: bgColor }}
      className={`w-7 h-7 rounded-full inline-flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-sm ${className}`}
    >
      {char}
    </span>
  );
}
