import React from 'react'
import { CloudOff } from 'lucide-react'

// Notify the boot screen when a child crashes. Otherwise its fixed, high-z-index
// animation hides this error indefinitely and the user cannot retry.
export default class PortfolioCrashBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Portfolio render failed', error, info?.componentStack)
    this.props.onError?.(error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <div className="app-status-screen" role="alert">
      <CloudOff size={32} />
      <h1>We couldn’t display your portfolio</h1>
      <p>Your portfolio data has not been deleted. The page encountered an unexpected error.</p>
      <details><summary>Technical details</summary><code>{String(this.state.error.message || this.state.error)}</code></details>
      <button className="primary-button" type="button" onClick={() => window.location.reload()}>Try again</button>
    </div>
  }
}
