import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Download } from 'lucide-react'
import { supabase } from './supabase.js'
import { buildCompanyFinancialSnapshot } from './companyFinancialSummary.js'
import { exportCompanyFinancialSummaryPdf } from './companyFinancialSummaryPdf.js'
import BrainDrainNumericInput from './BrainDrainNumericInput.jsx'

const today = () => new Date().toISOString().slice(0, 10)
const oneYearBefore = (date) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() - 1); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10) }
const money = (value) => value == null || !Number.isFinite(Number(value)) ? 'Unavailable' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value)
const pct = (value) => value == null || !Number.isFinite(Number(value)) ? 'Unavailable' : `${(value * 100).toFixed(1)}%`

export default function CompanyFinancialSummaryWorkspace({ user, properties, loans, tenants, settings }) {
  const [reportingDate, setReportingDate] = useState(today())
  const [periodStart, setPeriodStart] = useState(oneYearBefore(today()))
  const [includeExtractions, setIncludeExtractions] = useState(true)
  const [includeRateStress, setIncludeRateStress] = useState(true)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const { data } = await supabase.from('bank_transactions').select('*').eq('user_id', user.id).order('booked_at', { ascending: true })
      if (alive) { setTransactions(data || []); setLoading(false) }
    })()
    return () => { alive = false }
  }, [user.id])

  useEffect(() => { setPeriodStart(oneYearBefore(reportingDate)) }, [reportingDate])
  const company = useMemo(() => ({
    registeredName: settings.companyName || 'Property company', companyName: settings.companyName || 'Property company',
    companyNumber: settings.companyNumber || '', incorporationDate: settings.incorporationDate || '', jurisdiction: settings.companyJurisdiction || 'United Kingdom',
    directors: settings.companyDirectors || [], shareholders: settings.companyShareholders || [], sicCode: settings.companySicCode || '',
  }), [settings])
  const snapshot = useMemo(() => buildCompanyFinancialSnapshot({ company, properties, loans, tenants, transactions, settings, reportingDate, periodStart, includeExtractions, includeRateStress }), [company, properties, loans, tenants, transactions, settings, reportingDate, periodStart, includeExtractions, includeRateStress])

  return <div className="company-summary-workspace">
    <div className="company-summary-toolbar">
      <label>Company<select value={company.registeredName} disabled><option>{company.registeredName}</option></select></label>
      <label>Reporting date<BrainDrainNumericInput type="date" value={reportingDate} onChange={(e) => setReportingDate(e.target.value)} /></label>
      <label>Period start<BrainDrainNumericInput type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} max={reportingDate} /></label>
      <label className="company-summary-check"><BrainDrainNumericInput type="checkbox" checked={includeExtractions} onChange={(e) => setIncludeExtractions(e.target.checked)} /> Include owner extractions</label>
      <label className="company-summary-check"><BrainDrainNumericInput type="checkbox" checked={includeRateStress} onChange={(e) => setIncludeRateStress(e.target.checked)} /> Include +2% rate stress</label>
      <button className="primary-button" onClick={() => exportCompanyFinancialSummaryPdf(snapshot, `company-financial-summary-${reportingDate}.pdf`)}><Download size={16} /> Export PDF</button>
    </div>
    {snapshot.warnings.length > 0 && <div className="company-summary-warnings"><AlertTriangle size={16} /><div><strong>Data quality</strong>{snapshot.warnings.slice(0, 5).map((warning) => <div key={warning}>{warning}</div>)}</div></div>}
    <div className="company-summary-paper" aria-label="A4 Company Financial Summary preview">
      <header><div><h1>Company Financial Summary</h1><h2>{company.registeredName}</h2><p>Company no. {company.companyNumber || 'Unavailable'} · Reporting date {snapshot.reportingDate} · Period {snapshot.periodStart} to {snapshot.reportingDate}</p></div><span>Private &amp; Confidential</span></header>
      <section><h3>1. Portfolio overview</h3><div className="company-summary-metrics"><div><small>Portfolio value</small><b>{money(snapshot.portfolio.portfolioValue)}</b></div><div><small>Mortgage debt</small><b>{money(snapshot.portfolio.mortgageDebt)}</b></div><div><small>Aggregate LTV</small><b>{pct(snapshot.portfolio.aggregateLtv)}</b></div><div><small>Annual contracted rent</small><b>{money(snapshot.portfolio.annualContractedRent)}</b></div></div><p>{snapshot.portfolio.propertyCount} properties · Gross property equity {money(snapshot.portfolio.grossPropertyEquity)} · Weighted rate {pct(snapshot.portfolio.weightedRate)} · Earliest product expiry {snapshot.portfolio.earliestExpiry || 'Unavailable'}</p></section>
      <section><h3>2. Financial performance</h3><table><thead><tr><th>Metric</th><th>Trailing 12m actual</th><th>Current annualised</th></tr></thead><tbody><tr><td>Rent / operating income</td><td>{snapshot.actual ? money(snapshot.actual.rentCollected || snapshot.actual.operatingIncome) : 'Unavailable'}</td><td>{money(snapshot.runRate.annualRent)}</td></tr><tr><td>Operating costs</td><td>{snapshot.actual ? money(snapshot.actual.operatingOutflow) : 'Unavailable'}</td><td>{money(snapshot.runRate.operatingCosts)}</td></tr><tr><td>Debt service</td><td>{snapshot.actual ? money(snapshot.actual.debtServiceCash) : 'Unavailable'}</td><td>{money(snapshot.runRate.debtService)}</td></tr><tr><td>Net cash flow</td><td>{snapshot.actual ? money(snapshot.actual.netCashFlow) : 'Unavailable'}</td><td>{money(snapshot.runRate.cashFlow)}</td></tr></tbody></table></section>
      <section><h3>3. Balance sheet &amp; resilience</h3><p><strong>{snapshot.resilience.cashHeld == null ? 'Net asset value unavailable — complete cash/liability data is required.' : `Indicative net assets before unrecorded liabilities ${money(snapshot.portfolio.grossPropertyEquity + snapshot.resilience.cashHeld)}`}</strong></p><p>Cash held {money(snapshot.resilience.cashHeld)} · Cash buffer {snapshot.resilience.bufferMonths == null ? 'Unavailable' : `${snapshot.resilience.bufferMonths.toFixed(1)} months`} · ICR {snapshot.resilience.icr == null ? 'Unavailable' : `${snapshot.resilience.icr.toFixed(2)}x`} · +2% stressed ICR {snapshot.resilience.stressedIcr == null ? 'Unavailable' : `${snapshot.resilience.stressedIcr.toFixed(2)}x`}</p></section>
      <section><h3>4. Property schedule</h3><table><thead><tr><th>Property</th><th>Value</th><th>Debt</th><th>LTV</th><th>Rent / m</th></tr></thead><tbody>{snapshot.properties.slice(0, 6).map((p) => <tr key={p.id}><td>{p.name} — {p.address}</td><td>{money(p.value)}</td><td>{money(p.debt)}</td><td>{pct(p.ltv)}</td><td>{money(p.rentMonthly)}</td></tr>)}</tbody></table>{snapshot.properties.length > 6 && <p className="company-summary-muted">+ {snapshot.properties.length - 6} additional properties included in totals.</p>}</section>
      <section><h3>5. Data quality &amp; principal risks</h3><ul>{snapshot.warnings.slice(0, 4).map((warning) => <li key={warning}>{warning}</li>)}{!snapshot.warnings.length && <li>No material data-quality warnings identified from available application records.</li>}</ul></section>
      <footer>Management report generated from BTLPortfolio records. Missing values are not inferred. {loading ? 'Banking data loading…' : ''}</footer>
    </div>
  </div>
}
