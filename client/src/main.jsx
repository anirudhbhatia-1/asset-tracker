import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { initMonitoring } from './utils/monitoring'
import { reloadOnceForNewBuild } from './utils/chunkReload'

// Error reporting, only when VITE_SENTRY_DSN is set at build time.
initMonitoring()

// A lazy page file from the previous deploy is gone: reload once for the new
// build instead of failing (guarded against loops in utils/chunkReload).
window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnceForNewBuild()) event.preventDefault()
})

// Google Identity Services uses the public build-time client ID from Vite.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)
