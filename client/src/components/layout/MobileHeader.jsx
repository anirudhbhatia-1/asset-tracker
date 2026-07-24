import React from 'react';
import { Menu, ShieldCheck } from 'lucide-react';

export default function MobileHeader({ onOpenSidebar }) {
  return (
    <div className="md:hidden h-16 bg-surface border-b border-border flex items-center justify-between px-4 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <span className="font-bold text-lg tracking-tight text-primary flex items-center gap-1.5">
          AssetTrack
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse inline-block" />
        </span>
      </div>
      <button
        onClick={onOpenSidebar}
        className="p-2 -mr-2 rounded-lg text-secondary hover:text-white hover:bg-raised transition-colors"
      >
        <Menu className="w-6 h-6" />
      </button>
    </div>
  );
}
