import React, { useState } from 'react'
import { Building2, Check, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { supabase } from './supabase.js'

function GoogleMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z"/><path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.64-2.42l-3.24-2.53c-.9.6-2.05.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.88A6 6 0 0 1 6.08 12c0-.65.11-1.29.31-1.88V7.51H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.49l3.35-2.61Z"/><path fill="#EA4335" d="M12 5.99c1.47 0 2.78.5 3.82 1.49l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.51l3.35 2.61C7.18 7.75 9.39 5.99 12 5.99Z"/></svg>
}

export default function AuthScreen() {
  const [mode, setMode] = useState('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const redirectTo = window.location.origin

  const signInWithGoogle = async () => {
    setBusy(true)
    setError('')
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (authError) {
      setError(authError.message)
      setBusy(false)
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')

    const result = mode === 'sign-up'
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } })
      : await supabase.auth.signInWithPassword({ email, password })

    if (result.error) setError(result.error.message)
    else if (mode === 'sign-up' && !result.data.session) {
      setMessage('Check your inbox and confirm your email address to finish creating your account.')
    }
    setBusy(false)
  }

  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-brand"><span><Building2 size={25} /></span><div><strong>BTL</strong><small>PORTFOLIO</small></div></div>
        <div className="auth-promise">
          <span className="kicker">PRIVATE PORTFOLIO MODELLING</span>
          <h1>Your BTL portfolio, clearly modelled.</h1>
          <p>Keep property details, cash flow, projections and key dates together in one account.</p>
          <ul><li><Check size={17} /> Property-level cash flow</li><li><Check size={17} /> Scenario projections</li><li><Check size={17} /> Desktop and mobile access</li></ul>
        </div>
        <small className="auth-security-note"><LockKeyhole size={14} /> Sign in to access your saved portfolio.</small>
      </section>

      <section className="auth-form-panel">
        <div className="auth-card">
          <span className="kicker">WELCOME TO BTL PORTFOLIO</span>
          <h2>{mode === 'sign-up' ? 'Create your account' : 'Sign in to your portfolio'}</h2>
          <p>{mode === 'sign-up' ? 'Start with an empty, private portfolio of your own.' : 'Use Google or your email and password.'}</p>

          <button className="google-auth-button" onClick={signInWithGoogle} disabled={busy}><GoogleMark /> Continue with Google</button>
          <div className="auth-divider"><span>or use email</span></div>

          <form onSubmit={submit}>
            <label><span>Email address</span><div><Mail size={17} /><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div></label>
            <label><span>Password</span><div><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
            {error && <p className="auth-message error" role="alert">{error}</p>}
            {message && <p className="auth-message success" role="status">{message}</p>}
            <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'sign-up' ? 'Create account' : 'Sign in'}</button>
          </form>

          <p className="auth-switch">{mode === 'sign-up' ? 'Already have an account?' : 'New to BTL Portfolio?'} <button onClick={() => { setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up'); setError(''); setMessage('') }}>{mode === 'sign-up' ? 'Sign in' : 'Create an account'}</button></p>
        </div>
      </section>
    </main>
  )
}
