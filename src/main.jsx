import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import './theme.css'

const touchZoomMedia = typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  ? window.matchMedia('(hover: none) and (pointer: coarse)')
  : null

if (touchZoomMedia?.matches) {
  const preventGestureZoom = (event) => event.preventDefault()
  const preventMultiTouchZoom = (event) => {
    if (event.touches?.length > 1) event.preventDefault()
  }

  document.addEventListener('gesturestart', preventGestureZoom, { passive: false })
  document.addEventListener('gesturechange', preventGestureZoom, { passive: false })
  document.addEventListener('gestureend', preventGestureZoom, { passive: false })
  document.addEventListener('touchmove', preventMultiTouchZoom, { passive: false })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
