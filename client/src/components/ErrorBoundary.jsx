import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { reportError } from '../utils/monitoring';
import { isChunkLoadError, reloadOnceForNewBuild } from '../utils/chunkReload';
import Button from './ui/Button';

/**
 * What people see instead of a blank page when rendering fails.
 * `fullScreen` for the app-wide boundary; the main-content one sits inside
 * the layout so the sidebar keeps working.
 */
export function ErrorFallback({ error, onReload, onGoHome, fullScreen = false, showDetails = import.meta.env.DEV }) {
  const newBuild = isChunkLoadError(error);
  return (
    <div className={`flex items-center justify-center p-6 ${fullScreen ? 'min-h-screen bg-base' : 'min-h-[60vh]'}`}>
      <div role="alert" className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-sm p-6 sm:p-8 text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-warning/10 border border-warning/20 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-warning" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-semibold text-primary">Something went wrong</h1>
        <p className="mt-2 text-sm text-secondary">
          {newBuild
            ? 'AssetTrack was updated while this page was open. Reload to get the latest version.'
            : 'This page hit an unexpected problem. Reloading usually fixes it; your saved data is safe.'}
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <Button onClick={onReload}>
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Reload
          </Button>
          <Button variant="secondary" onClick={onGoHome}>
            <Home className="w-4 h-4" aria-hidden="true" />
            Go to dashboard
          </Button>
        </div>
        {showDetails && error && (
          <details className="mt-6 text-left">
            <summary className="text-xs font-semibold text-secondary cursor-pointer">Error details (development only)</summary>
            <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-base border border-border p-3 text-[11px] text-primary whitespace-pre-wrap break-words">
              {String(error?.stack || error?.message || error)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

/**
 * Catches render errors below it. Resets when `resetKey` changes (the route),
 * reports to Sentry when enabled, and reloads once by itself when a lazy page
 * file from an older build is gone.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  // A new route clears the error (React's "derive state from props").
  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
    return null;
  }

  componentDidCatch(error, info) {
    if (isChunkLoadError(error) && reloadOnceForNewBuild()) return;
    reportError(error, { componentStack: info?.componentStack });
    if (import.meta.env.DEV) console.error('Render error caught by ErrorBoundary', error);
  }

  reset = () => this.setState({ error: null });

  handleReload = () => window.location.reload();

  handleGoHome = () => {
    this.reset();
    if (this.props.onGoHome) this.props.onGoHome();
    else window.location.assign('/');
  };

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          fullScreen={this.props.fullScreen}
          onReload={this.handleReload}
          onGoHome={this.handleGoHome}
        />
      );
    }
    return this.props.children;
  }
}

/** ErrorBoundary that resets on navigation; must sit inside the router. */
export default function RouteErrorBoundary({ children, fullScreen = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <ErrorBoundary resetKey={location.pathname} fullScreen={fullScreen} onGoHome={() => navigate('/')}>
      {children}
    </ErrorBoundary>
  );
}
