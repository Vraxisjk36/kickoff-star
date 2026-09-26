import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './career-polish.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// PWA: register the service worker (production only — dev servers serve
// fresh modules and a SW cache just gets in the way of hot reload).
//
// P43 — disabled specifically for the itch.io build. A service worker inside
// itch.io's embed iframe is real risk for little value here: registered at
// the wrong scope it can silently fail, and even fixed, players hitting a
// stale cached version after an update is one of the most common itch.io
// HTML5 bug reports. Offline support barely matters for a quick browser
// playtest. Re-enable this once targeting the real installable PWA / Play
// Store build, where it's worth the complexity.
if (false && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[kickoff-star] service worker registration failed:', err)
    })
  })
}
