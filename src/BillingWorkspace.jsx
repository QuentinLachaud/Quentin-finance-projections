import React, { useEffect, useState } from 'react'
import { Check, Crown, ExternalLink, ShieldCheck, Sparkles, X } from 'lucide-react'
import { PLAN_PRICES } from './billing.js'
import { supabase } from './supabase.js'

export const billingRequest = async (body) => {
  const { data } = await supabase.auth.getSession()
  const response = await fetch('/api/billing', {
    method: body ? 'POST' : 'GET',
    headers: {
      authorization: `Bearer ${data.session?.access_token || ''}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Billing is temporarily unavailable.')
  return payload
}

const proFeatures = ['Unlimited BTL properties', 'Remortgage Simulator and long-range projections', 'Tenant, tax and compliance workspaces', 'Future Pro reporting and integrations']

export default function BillingWorkspace({ entitlement, onRefresh, modal = false, onClose }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPlan, setAdminPlan] = useState('pro')
  const [adminResult, setAdminResult] = useState('')
  const [proAccessEmails, setProAccessEmails] = useState([])
  const [proAccessStatus, setProAccessStatus] = useState('idle')
  const [proAccessError, setProAccessError] = useState('')

  const perform = async (action, values = {}) => {
    setBusy(action + (values.interval || ''))
    setError('')
    try {
      const response = await billingRequest({ action, ...values })
      if (response.url) window.location.assign(response.url)
      return response
    } catch (requestError) {
      setError(requestError.message)
      return null
    } finally {
      setBusy('')
    }
  }

  const loadProAccess = async () => {
    setProAccessStatus('loading')
    setProAccessError('')
    try {
      const result = await billingRequest({ action: 'admin-list-pro-access' })
      setProAccessEmails(Array.isArray(result.emails) ? result.emails : [])
      setProAccessStatus('ready')
    } catch (requestError) {
      setProAccessError(requestError.message)
      setProAccessStatus('error')
    }
  }

  useEffect(() => {
    if (entitlement?.isOwner && !modal) loadProAccess()
  }, [entitlement?.isOwner, modal])

  const setManualPlan = async (event) => {
    event.preventDefault()
    setAdminResult('')
    const result = await perform('admin-set-plan', { email: adminEmail, plan: adminPlan })
    if (result) {
      setAdminResult(`${result.email} now has ${result.plan === 'pro' ? 'Pro' : 'Free'} access.`)
      setAdminEmail('')
      onRefresh?.()
      await loadProAccess()
    }
  }

  const content = <div className={`billing-workspace ${modal ? 'billing-modal' : ''}`}>
    {modal && <button className="billing-modal-close" onClick={onClose} aria-label="Close upgrade window"><X /></button>}
    <section className="billing-intro">
      <span className="billing-mark"><Crown /></span>
      <span className="kicker">{entitlement?.isPro ? 'YOUR PLAN' : 'BTL PORTFOLIO PRO'}</span>
      <h2>{entitlement?.isOwner ? 'Owner access is active' : entitlement?.isPro ? 'Your Pro plan is active' : 'Grow beyond your first BTL'}</h2>
      <p>{entitlement?.isPro ? 'You have unrestricted portfolio access.' : 'Free includes one BTL and the core portfolio calculations. Pro adds unlimited properties and the advanced planning tools.'}</p>
    </section>

    {!entitlement?.isPro && <section className="pricing-grid" aria-label="Pro subscription options">
      <article className="pricing-card">
        <span>Monthly</span><strong>£9.99<small>/month</small></strong><p>Flexible access, billed each month.</p>
        <button className="primary-button" disabled={Boolean(busy)} onClick={() => perform('checkout', { interval: 'monthly' })}>{busy === 'checkoutmonthly' ? 'Opening Stripe…' : `Choose ${PLAN_PRICES.monthly.label}`}</button>
      </article>
      <article className="pricing-card featured">
        <i>Save £40.88 a year</i><span>Annual</span><strong>£79<small>/year</small></strong><p>Equivalent to £6.58 a month.</p>
        <button className="primary-button" disabled={Boolean(busy)} onClick={() => perform('checkout', { interval: 'annual' })}>{busy === 'checkoutannual' ? 'Opening Stripe…' : `Choose ${PLAN_PRICES.annual.label}`}</button>
      </article>
    </section>}

    <section className="billing-features">
      {proFeatures.map((feature) => <div key={feature}><Check size={16} /><span>{feature}</span></div>)}
    </section>

    {entitlement?.isPro && entitlement.hasBillingAccount && !entitlement.isOwner && <button className="secondary-button billing-manage" disabled={Boolean(busy)} onClick={() => perform('portal')}><ExternalLink size={16} /> Manage subscription in Stripe</button>}
    {error && <p className="billing-message error">{error}</p>}

    {entitlement?.isAdmin && !modal && <section className="panel owner-access-panel">
      <header><div><span className="kicker">OWNER ONLY</span><h2>Account access</h2><p>Grant or revoke Pro for an existing signed-up account. This control is never sent to ordinary users.</p></div><ShieldCheck /></header>
      <form onSubmit={setManualPlan}>
        <label><span>Existing account email</span><input type="email" required value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} placeholder="person@example.com" /></label>
        <label><span>Access level</span><select value={adminPlan} onChange={(event) => setAdminPlan(event.target.value)}><option value="pro">Pro</option><option value="free">Free</option></select></label>
        <button className="primary-button" disabled={Boolean(busy)}><Sparkles size={16} /> {busy === 'admin-set-plan' ? 'Updating…' : 'Update access'}</button>
      </form>
      {adminResult && <p className="billing-message success">{adminResult}</p>}
      {entitlement?.isOwner && <div className="owner-pro-access-list">
        <header>
          <span><b>Pro access emails</b><small>{proAccessEmails.length} {proAccessEmails.length === 1 ? 'account' : 'accounts'}</small></span>
          <button type="button" className="text-button" onClick={loadProAccess} disabled={proAccessStatus === 'loading'} aria-label="Refresh Pro access emails">Refresh</button>
        </header>
        {proAccessStatus === 'loading' && <p className="owner-pro-access-state">Loading Pro accounts…</p>}
        {proAccessStatus === 'error' && <p className="owner-pro-access-state error">{proAccessError || 'Could not load Pro accounts.'}</p>}
        {proAccessStatus === 'ready' && proAccessEmails.length === 0 && <p className="owner-pro-access-state">No Pro accounts found.</p>}
        {proAccessStatus === 'ready' && proAccessEmails.length > 0 && <ul>{proAccessEmails.map((email) => <li key={email}>{email}</li>)}</ul>}
      </div>}
    </section>}
  </div>

  return modal ? <div className="billing-modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>{content}</div> : content
}
