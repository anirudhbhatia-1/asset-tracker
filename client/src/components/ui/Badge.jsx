import React from 'react';
import { readableTextColor, resolveColor } from '../../utils/color';

export default function Badge({ badgeChar, color, title, className = '' }) {
  const char = badgeChar ? badgeChar.charAt(0).toUpperCase() : '?';
  // Category colours may be hex or a name ("Teal"); text is black or white
  // by the fill's luminance so the letter stays readable on light colours.
  const bgColor = resolveColor(color);
  const textColor = readableTextColor(bgColor);

  return (
    <span
      title={title}
      style={{ backgroundColor: bgColor, color: textColor }}
      className={`w-7 h-7 rounded-full inline-flex items-center justify-center font-bold text-xs shrink-0 shadow-sm ring-1 ring-black/10 dark:ring-white/15 ${className}`}
    >
      {char}
    </span>
  );
}
