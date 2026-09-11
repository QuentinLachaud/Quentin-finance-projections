const money = (value) => value == null || !Number.isFinite(Number(value)) ? 'Unavailable' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value)
const pct = (value, digits = 1) => value == null || !Number.isFinite(Number(value)) ? 'Unavailable' : `${(value * 100).toFixed(digits)}%`
const safe = (value) => String(value || '—')
const crop = (text, n) => String(text || '').length > n ? `${String(text).slice(0, n - 1)}…` : String(text || '')

export async function exportCompanyFinancialSummaryPdf(snapshot, filename = 'company-financial-summary.pdf') {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const W = 210, M = 15, right = W - M
  const navy = [24, 49, 83], charcoal = [38, 42, 48], grey = [110, 118, 126], rule = [216, 220, 224]
  const text = (value, x, y, opts = {}) => { doc.setTextColor(...(opts.colour || charcoal)); doc.setFont('helvetica', opts.bold ? 'bold' : 'normal'); doc.setFontSize(opts.size || 9.5); doc.text(String(value), x, y, { align: opts.align || 'left', maxWidth: opts.maxWidth }) }
  const line = (y) => { doc.setDrawColor(...rule); doc.setLineWidth(0.25); doc.line(M, y, right, y) }
  const section = (title, y) => { text(title.toUpperCase(), M, y, { bold: true, size: 8.5, colour: navy }); line(y + 2.2); return y + 7 }

  text('Company Financial Summary', M, 19, { bold: true, size: 20, colour: navy })
  text('Private & Confidential', right, 18.5, { size: 8.5, colour: grey, align: 'right' })
  text(safe(snapshot.company?.registeredName || snapshot.company?.companyName || snapshot.company?.name), M, 27, { bold: true, size: 10.5 })
  text(`Company no. ${safe(snapshot.company?.companyNumber)}  •  Reporting date ${snapshot.reportingDate}  •  Period ${snapshot.periodStart} to ${snapshot.reportingDate}`, M, 32, { size: 8.5, colour: grey })
  text(`Incorporated ${safe(snapshot.company?.incorporationDate)}  •  ${safe(snapshot.company?.jurisdiction)}  •  Directors: ${crop((snapshot.company?.directors || []).join(', '), 68)}`, M, 37, { size: 8.5 })
  if (snapshot.company?.ownershipSummary) text(`Ownership / control: ${crop(snapshot.company.ownershipSummary, 112)}`, M, 41, { size: 7.8, colour: grey })

  let y = section('1. Portfolio overview', 45)
  const metrics = [
    ['Portfolio value', money(snapshot.portfolio.portfolioValue)], ['Mortgage debt', money(snapshot.portfolio.mortgageDebt)],
    ['Aggregate LTV', pct(snapshot.portfolio.aggregateLtv)], ['Annual contracted rent', money(snapshot.portfolio.annualContractedRent)],
  ]
  metrics.forEach(([label, value], i) => { const x = M + (i % 4) * 45; text(label, x, y, { size: 8.2, colour: grey }); text(value, x, y + 5, { bold: true, size: 12, colour: charcoal }) })
  y += 15
  text(`Properties ${snapshot.portfolio.propertyCount}   •   Gross property equity ${money(snapshot.portfolio.grossPropertyEquity)}   •   Occupancy ${pct(snapshot.portfolio.occupancy, 0)}   •   Weighted rate ${pct(snapshot.portfolio.weightedRate)}   •   Earliest product expiry ${safe(snapshot.portfolio.earliestExpiry)}`, M, y, { size: 8.3 })

  y = section('2. Financial performance', y + 9)
  text('Metric', M, y, { bold: true, size: 8.5 }); text('Trailing 12m actual', 126, y, { bold: true, size: 8.5, align: 'right' }); text('Current annualised', right, y, { bold: true, size: 8.5, align: 'right' }); y += 4; line(y); y += 4
  const rows = [
    ['Rent / operating income', snapshot.actual ? money(snapshot.actual.rentCollected || snapshot.actual.operatingIncome) : 'Unavailable', money(snapshot.runRate.annualRent)],
    ['Operating costs', snapshot.actual ? money(snapshot.actual.operatingOutflow) : 'Unavailable', money(snapshot.runRate.operatingCosts)],
    ['Debt service', snapshot.actual ? money(snapshot.actual.debtServiceCash) : 'Unavailable', money(snapshot.runRate.debtService)],
    ['Net cash flow', snapshot.actual ? money(snapshot.actual.netCashFlow) : 'Unavailable', money(snapshot.runRate.cashFlow)],
  ]
  rows.forEach((r) => { text(r[0], M, y, { size: 8.7 }); text(r[1], 126, y, { size: 8.7, align: 'right' }); text(r[2], right, y, { size: 8.7, align: 'right' }); y += 5 })

  y = section('3. Balance sheet & resilience', y + 3)
  const navLabel = snapshot.resilience.cashHeld == null ? 'Net asset value: Unavailable — cash/liability data incomplete' : `Indicative net assets before unrecorded liabilities: ${money(snapshot.portfolio.grossPropertyEquity + snapshot.resilience.cashHeld)}`
  text(navLabel, M, y, { bold: true, size: 9.2 }); y += 5
  text(`Cash held ${money(snapshot.resilience.cashHeld)}   •   Cash buffer ${snapshot.resilience.bufferMonths == null ? 'Unavailable' : `${snapshot.resilience.bufferMonths.toFixed(1)} months`}   •   ICR ${snapshot.resilience.icr == null ? 'Unavailable' : `${snapshot.resilience.icr.toFixed(2)}x`}   •   ${snapshot.resilience.stressIncluded ? '+2% stressed ICR' : 'ICR'} ${snapshot.resilience.stressedIcr == null ? 'Unavailable' : `${snapshot.resilience.stressedIcr.toFixed(2)}x`}`, M, y, { size: 8.6 })

  y = section('4. Property schedule', y + 8)
  const cols = [M, 74, 105, 132, 154, right]
  ;[['Property', cols[0]], ['Value', cols[2]], ['Debt', cols[3]], ['LTV', cols[4]], ['Rent/m', cols[5]]].forEach(([label, x], i) => text(label, x, y, { bold: true, size: 8.2, align: i ? 'right' : 'left' })); y += 3; line(y); y += 4
  const maxRows = Math.min(snapshot.properties.length, 6)
  snapshot.properties.slice(0, maxRows).forEach((p) => { text(crop(`${p.name} — ${p.address}`, 56), cols[0], y, { size: 8.1, maxWidth: 84 }); text(money(p.value), cols[2], y, { size: 8.1, align: 'right' }); text(money(p.debt), cols[3], y, { size: 8.1, align: 'right' }); text(pct(p.ltv), cols[4], y, { size: 8.1, align: 'right' }); text(money(p.rentMonthly), cols[5], y, { size: 8.1, align: 'right' }); y += 5 })
  if (snapshot.properties.length > maxRows) { text(`+ ${snapshot.properties.length - maxRows} additional properties included in portfolio totals; detailed schedule available in-app.`, M, y, { size: 8, colour: grey }); y += 5 }

  y = section('5. Data quality & principal risks', y + 2)
  const risk = []
  if (snapshot.portfolio.earliestExpiry) risk.push(`Earliest mortgage product expiry: ${snapshot.portfolio.earliestExpiry}.`)
  if (snapshot.runRate.cashFlow < 0) risk.push('Current annualised cash flow is negative.')
  if (snapshot.resilience.stressedIcr != null && snapshot.resilience.stressedIcr < 1.25) risk.push('+2% stressed ICR is below 1.25x.')
  const notes = [...snapshot.warnings, ...risk].slice(0, 4)
  if (!notes.length) notes.push('No material data-quality warnings identified from the available application records.')
  notes.forEach((note) => { text(`• ${crop(note, 115)}`, M, y, { size: 8.1 }); y += 4.4 })

  line(281)
  text('Management report generated from BTLPortfolio records. Figures marked unavailable are not inferred from missing data.', M, 286, { size: 7.5, colour: grey })
  text(`Generated ${snapshot.generatedAt.slice(0, 10)}`, right, 286, { size: 7.5, colour: grey, align: 'right' })
  if (doc.getNumberOfPages() !== 1) throw new Error('Company Financial Summary must render as exactly one page')
  doc.save(filename)
}
