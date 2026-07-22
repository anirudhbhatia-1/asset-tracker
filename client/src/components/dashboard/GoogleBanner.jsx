import React from 'react';
import { Link } from 'react-router-dom';
import { CloudOff, ArrowRight } from 'lucide-react';

export default function GoogleBanner() {
  return (
    <div className="bg-gradient-to-r from-slate-800 via-slate-800/90 to-slate-800/60 border border-slate-700/80 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-slate-600 transition-colors">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 shadow-inner">
          <span className="text-indigo-400 font-black text-xl tracking-tight">G</span>
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <h4 className="text-sm font-semibold text-slate-100">Google Workspace Sync</h4>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <CloudOff className="w-3 h-3" />
              <span>Not Configured</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Connect domain credentials to automatically import and sync employee directories.
          </p>
        </div>
      </div>

      <Link
        to="/settings"
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-700/70 hover:bg-slate-700 text-indigo-300 hover:text-indigo-200 border border-slate-600/60 transition-colors shadow-sm shrink-0 self-start sm:self-center"
      >
        <span>Configure</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
