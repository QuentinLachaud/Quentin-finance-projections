import React, { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Building2,
  ChevronDown,
  ChevronUp,
  Link2,
  LoaderCircle,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  acquisitionCosts,
  acquisitionJurisdictions,
  createAcquisition,
  prependAcquisition,
} from './acquisition.js'
import { currency } from './calculations.js'
import { supabase } from './supabase.js'

const numericValue = (value) => value === '' ? '' : Number(value)

const listingRequest = async (url) => {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  const response = await fetch('/api/property-listing', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ url }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'The listing could not be imported.')
  return body
}

function Field({ label, prefix, suffix, children, className = '' }) {
  return <label className={`acquisition-field ${className}`}>
    <span>{label}</span>
    <div>
      {prefix && <b>{prefix}</b>}
      {children}
      {suffix && <b>{suffix}</b>}
    </div>
  </label>
}

export function AcquisitionCard({
  acquisition,
  expanded,
  onToggle,
  onUpdate,
  onRemove,
}) {
  const costs = useMemo(() => acquisitionCosts(acquisition), [acquisition])
  const isScotland = acquisition.jurisdiction === 'scotland'
  const sourceLabel = acquisition.sourceProvider || (acquisition.sourceUrl ? 'Listing' : 'Manual entry')
  const grossYieldLabel = costs.grossYield ? `${(costs.grossYield * 100).toFixed(2)}%` : '—'
  const propertyMeta = [
    acquisition.postcode,
    acquisition.propertyType,
    acquisition.bedrooms !== '' && acquisition.bedrooms != null ? `${acquisition.bedrooms} bed` : '',
    acquisition.areaSqm !== '' && acquisition.areaSqm != null ? `${Number(acquisition.areaSqm).toFixed(Number(acquisition.areaSqm) % 1 ? 1 : 0)} m²` : '',
    acquisition.epc ? `EPC ${acquisition.epc}` : '',
  ].filter(Boolean)

  const set = (key) => (event) => {
    const value = event?.target?.type === 'checkbox'
      ? event.target.checked
      : event?.target?.value
    onUpdate(acquisition.id, key, value)
  }

  return <article className={`panel acquisition-card ${expanded ? 'expanded' : 'collapsed'}`}>
    <header className="acquisition-card-header">
      <button
        type="button"
        className="acquisition-card-disclosure"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <div className="acquisition-card-title">
          <span className="kicker">POTENTIAL ACQUISITION · {sourceLabel.toUpperCase()}</span>
          <h2>{acquisition.address || 'Untitled property'}</h2>
          <p>{propertyMeta.join(' · ') || 'Enter or import the property details below.'}</p>
        </div>

        <div className="acquisition-collapsed-metrics" aria-label="Acquisition summary">
          <div>
            <span>Price</span>
            <b>{costs.price ? currency(costs.price) : '—'}</b>
          </div>
          <div>
            <span>Rent / mo</span>
            <b>{Number(acquisition.expectedMonthlyRent || 0) ? currency(acquisition.expectedMonthlyRent) : '—'}</b>
          </div>
          <div className="yield">
            <span>Gross yield</span>
            <b>{grossYieldLabel}</b>
          </div>
          <div>
            <span>Cash to deploy</span>
            <b>{costs.price ? currency(costs.cashRequired) : '—'}</b>
          </div>
        </div>

        <span className="acquisition-disclosure-chevron" aria-hidden="true">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>

      <div className="acquisition-card-actions">
        {acquisition.sourceUrl && <a
          href={acquisition.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="secondary-button small"
        >
          Listing <ArrowUpRight size={14} />
        </a>}
        <button
          type="button"
          className="icon-button acquisition-remove"
          aria-label="Remove acquisition"
          onClick={() => onRemove(acquisition.id)}
        >
          <Trash2 size={17} />
        </button>
      </div>
    </header>

    <div className="acquisition-card-body-shell" aria-hidden={!expanded}>
      <div className="acquisition-card-body-inner">
        <div className="acquisition-card-layout">
          <div className="acquisition-inputs">
            <section className="acquisition-input-section">
              <header><span>Property</span></header>
              <div className="acquisition-fields-grid">
                <Field label="Purchase price" prefix="£">
                  <input aria-label="Purchase price" type="number" min="0" step="1000" value={acquisition.purchasePrice} onChange={set('purchasePrice')} />
                </Field>
                <Field label="Expected rent / month" prefix="£">
                  <input aria-label="Expected rent per month" type="number" min="0" step="50" value={acquisition.expectedMonthlyRent} onChange={set('expectedMonthlyRent')} />
                </Field>
                <Field label="Bedrooms">
                  <input aria-label="Bedrooms" type="number" min="0" step="1" value={acquisition.bedrooms} onChange={set('bedrooms')} />
                </Field>
                <Field label="Area" suffix="m²">
                  <input aria-label="Area in square metres" type="number" min="0" step="0.1" value={acquisition.areaSqm} onChange={set('areaSqm')} />
                </Field>
                <label className="acquisition-text-field acquisition-property-type">
                  <span>Property type</span>
                  <input aria-label="Property type" type="text" placeholder="Flat, terraced house…" value={acquisition.propertyType} onChange={set('propertyType')} />
                </label>
                <Field label="EPC">
                  <input aria-label="EPC" type="text" maxLength="2" value={acquisition.epc} onChange={(event) => onUpdate(acquisition.id, 'epc', event.target.value.toUpperCase())} />
                </Field>
                <label className="acquisition-text-field acquisition-address">
                  <span>Address</span>
                  <input aria-label="Address" type="text" value={acquisition.address} onChange={set('address')} />
                </label>
                <label className="acquisition-text-field acquisition-postcode">
                  <span>Postcode</span>
                  <input aria-label="Postcode" type="text" value={acquisition.postcode} onChange={(event) => onUpdate(acquisition.id, 'postcode', event.target.value.toUpperCase())} />
                </label>
              </div>
            </section>

            <section className="acquisition-input-section">
              <header><span>Funding & purchase costs</span></header>
              <div className="acquisition-fields-grid">
                <label className="acquisition-text-field acquisition-regime">
                  <span>Purchase tax regime</span>
                  <select value={acquisition.jurisdiction} onChange={set('jurisdiction')}>
                    {acquisitionJurisdictions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
                  </select>
                </label>
                <Field label="LTV" suffix="%">
                  <input aria-label="LTV" type="number" min="0" max="100" step="1" value={acquisition.ltv} onChange={set('ltv')} />
                </Field>
                {isScotland && <Field label="ADS" suffix="%">
                  <input aria-label="Additional Dwelling Supplement rate" type="number" min="0" max="100" step="0.1" value={acquisition.adsRate} onChange={set('adsRate')} />
                </Field>}
                <Field label="Solicitor / legal fees" prefix="£">
                  <input aria-label="Solicitor and legal fees" type="number" min="0" step="50" value={acquisition.legalFees} onChange={set('legalFees')} />
                </Field>
                <Field label="Mortgage product fee" prefix="£">
                  <input aria-label="Mortgage product fee" type="number" min="0" step="50" value={acquisition.mortgageFee} onChange={set('mortgageFee')} />
                </Field>
                <label className="acquisition-fee-switch">
                  <span><b>Add mortgage fee to loan</b><small>Turn off if the fee is paid from cash at completion.</small></span>
                  <input type="checkbox" checked={Boolean(acquisition.mortgageFeeAddedToLoan)} onChange={set('mortgageFeeAddedToLoan')} />
                  <i />
                </label>
              </div>
            </section>
          </div>

          <aside className="acquisition-results">
            <span className="kicker">CASH TO DEPLOY</span>
            <strong>{currency(costs.cashRequired)}</strong>
            <small>Estimated cash required at completion</small>

            <dl>
              <div><dt>Deposit at {Number(costs.ltv).toFixed(0)}% LTV</dt><dd>{currency(costs.deposit)}</dd></div>
              <div><dt>{costs.taxLabel}</dt><dd>{currency(costs.transactionTax)}</dd></div>
              {isScotland && <>
                <div className="sub"><dt>LBTT</dt><dd>{currency(costs.baseTax)}</dd></div>
                <div className="sub"><dt>ADS · {Number(acquisition.adsRate || 0).toFixed(1)}%</dt><dd>{currency(costs.supplement)}</dd></div>
              </>}
              <div><dt>Legal fees</dt><dd>{currency(costs.legalFees)}</dd></div>
              <div><dt>Mortgage fee paid now</dt><dd>{currency(costs.upfrontMortgageFee)}</dd></div>
            </dl>

            <div className="acquisition-secondary-results">
              <div><span>Mortgage advance</span><b>{currency(costs.baseMortgage)}</b></div>
              <div><span>Effective loan incl. financed fee</span><b>{currency(costs.effectiveMortgage)}</b></div>
              <div><span>Total acquisition cost</span><b>{currency(costs.totalAcquisitionCost)}</b></div>
              <div><span>Expected gross yield</span><b>{grossYieldLabel}</b></div>
            </div>

            <p className="acquisition-tax-note">
              Residential BTL/additional-property rates. Planning estimate only; unusual reliefs, mixed-use purchases,
              linked transactions and non-resident surcharges are not represented.
            </p>
          </aside>
        </div>
      </div>
    </div>
  </article>
}

export default function AcquisitionSimulator({ acquisitions, onChange, defaultJurisdiction = 'england-ni' }) {
  const [listingUrl, setListingUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dragging, setDragging] = useState(false)
  const [expandedId, setExpandedId] = useState(() => acquisitions[0]?.id || '')

  useEffect(() => {
    if (expandedId && acquisitions.some((item) => item.id === expandedId)) return
    setExpandedId(acquisitions[0]?.id || '')
  }, [acquisitions, expandedId])

  const add = (values = {}) => {
    const created = createAcquisition(values, values.jurisdiction || defaultJurisdiction)
    onChange(prependAcquisition(acquisitions, created))
    setExpandedId(created.id)
    return created
  }

  const importUrl = async (value = listingUrl) => {
    const url = String(value || '').trim()
    if (!url || importing) return
    setImporting(true)
    setError('')
    setNotice('')
    try {
      const result = await listingRequest(url)
      add({
        ...result.listing,
        sourceUrl: url,
        sourceProvider: result.provider,
      })
      setListingUrl('')
      setNotice(result.warning || `${result.provider} details imported. Check any fields the listing did not provide.`)
    } catch (importError) {
      setError(importError.message)
    } finally {
      setImporting(false)
    }
  }

  const update = (id, key, value) => {
    const numericKeys = new Set([
      'purchasePrice',
      'expectedMonthlyRent',
      'bedrooms',
      'areaSqm',
      'ltv',
      'adsRate',
      'legalFees',
      'mortgageFee',
    ])
    onChange(acquisitions.map((item) => item.id === id
      ? { ...item, [key]: numericKeys.has(key) ? numericValue(value) : value }
      : item))
  }

  const remove = (id) => {
    if (!window.confirm('Remove this potential acquisition?')) return
    const next = acquisitions.filter((item) => item.id !== id)
    onChange(next)
    if (expandedId === id) setExpandedId(next[0]?.id || '')
  }

  const droppedUrl = (event) => {
    event.preventDefault()
    setDragging(false)
    const value = event.dataTransfer.getData('text/uri-list')
      || event.dataTransfer.getData('text/plain')
    const firstUrl = value.split(/\s+/).find((item) => /^https?:\/\//i.test(item)) || ''
    if (!firstUrl) {
      setError('Drop a Rightmove or Zoopla property link.')
      return
    }
    setListingUrl(firstUrl)
    importUrl(firstUrl)
  }

  return <div className="acquisition-workspace">
    <section
      className={`panel acquisition-import ${dragging ? 'dragging' : ''}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={droppedUrl}
    >
      <div className="acquisition-import-copy">
        <span className="kicker">NEW POTENTIAL ACQUISITION</span>
        <h2>Drop in a listing or start manually</h2>
        <p>Paste or drag a Rightmove or Zoopla sale listing. Available details are imported, then every field remains editable.</p>
      </div>
      <div className="acquisition-import-controls">
        <label>
          <Link2 size={17} />
          <input
            aria-label="Rightmove or Zoopla listing URL"
            type="url"
            placeholder="https://www.rightmove.co.uk/…"
            value={listingUrl}
            onChange={(event) => setListingUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                importUrl()
              }
            }}
          />
        </label>
        <button type="button" className="primary-button" disabled={!listingUrl.trim() || importing} onClick={() => importUrl()}>
          {importing ? <LoaderCircle className="spin" size={16} /> : <Link2 size={16} />}
          {importing ? 'Importing…' : 'Import listing'}
        </button>
        <button type="button" className="secondary-button" onClick={() => add()}>
          <Plus size={16} /> Manual entry
        </button>
      </div>
      {error && <p className="acquisition-import-message error">{error} <button type="button" onClick={() => add({ sourceUrl: listingUrl })}>Use manual entry</button></p>}
      {notice && <p className="acquisition-import-message">{notice}</p>}
      <div className="acquisition-import-hint"><Building2 size={15} /><span>Default assumptions: 75% LTV · £1,500 legal fees · Scottish ADS 8% when Scotland is selected.</span></div>
    </section>

    {!acquisitions.length
      ? <section className="panel acquisition-empty"><Building2 size={24} /><h2>No potential acquisitions yet</h2><p>Import a listing above or create a manual entry.</p></section>
      : <div className="acquisition-list">
          {acquisitions.map((acquisition) => <AcquisitionCard
            key={acquisition.id}
            acquisition={acquisition}
            expanded={expandedId === acquisition.id}
            onToggle={() => setExpandedId((current) => current === acquisition.id ? '' : acquisition.id)}
            onUpdate={update}
            onRemove={remove}
          />)}
        </div>}
  </div>
}
