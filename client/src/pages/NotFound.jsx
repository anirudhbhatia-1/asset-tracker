import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';

// Shown for unknown addresses inside the signed-in app. Signed-out visitors
// never get here: ProtectedRoute sends them to the login page first.
export default function NotFound() {
  const { pathname } = useLocation();

  return (
    <div className="max-w-xl mx-auto py-12 sm:py-20 text-center">
      <div className="w-14 h-14 mx-auto rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-5">
        <Compass className="w-7 h-7" aria-hidden="true" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent mb-2">Page not found</p>
      <h1 className="text-2xl font-bold text-primary tracking-tight">We couldn't find that page</h1>
      <p className="text-sm text-secondary mt-2 break-words">
        <span className="font-mono text-primary">{pathname}</span> doesn't exist or may have moved.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center justify-center gap-2 min-h-[44px] sm:min-h-[40px] px-4 rounded-lg text-sm font-medium bg-accent hover:bg-accent-hover text-on-accent shadow-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Go to dashboard
      </Link>
    </div>
  );
}
