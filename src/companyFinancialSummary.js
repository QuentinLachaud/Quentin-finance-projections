import { effectiveLoanAmount, loanCostSummary } from './loans.js'
import { performanceTreatmentForTransaction } from './banking.js'

const humaniseRegisterValue = (value) => String(value || '').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

export const describePscControl = (value) => {
  const code = String(value || '')
  const shares = code.match(/^ownership-of-shares-(25-to-50|50-to-75|75-to-100)-percent/)
  if (shares) return `${shares[1].replace('-to-', '–')}% of shares`
  const votes = code.match(/^voting-rights-(25-to-50|50-to-75|75-to-100)-percent/)
  if (votes) return `${votes[1].replace('-to-', '–')}% of voting rights`
  if (code === 'ownership-of-shares-more-than-25-percent') return 'more than 25% of shares'
  if (code === 'voting-rights-more-than-25-percent') return 'more than 25% of voting rights'
  if (code === 'right-to-appoint-and-remove-directors') return 'right to appoint/remove directors'
  if (code === 'significant-influence-or-control') return 'significant influence/control'
  return code ? code.replaceAll('-', ' ') : ''
}

const manualOwnershipSummary = (shareholders = []) => (Array.isArray(shareholders) ? shareholders : [])
  .map((owner) => {
    if (typeof owner === 'string') return owner.trim()
    const name = owner?.name || owner?.shareholderName || owner?.label || ''
    const percentage = Number(owner?.percentage ?? owner?.percent ?? owner?.shareholding)
    if (!name) return ''
    return Number.isFinite(percentage) ? `${name} — ${percentage}%` : name
  })
  .filter(Boolean)
  .join('; ')

export function companyFromCompaniesHouse(details, fallback = {}) {
  const profile = details?.profile || {}
  const directors = (details?.officers?.items || []).filter((person) => !person.resigned_on).map((person) => person.name).filter(Boolean)
  const ownership = (details?.psc?.items || [])
    .filter((person) => !person.ceased && !person.ceased_on)
    .map((person) => ({
      name: person.name || person.name_elements?.forename || '',
      controls: (person.natures_of_control || []).map(describePscControl).filter(Boolean),
    }))
    .filter((person) => person.name)
  const registerOwnershipSummary = ownership.map((person) => `${person.name}${person.controls.length ? ` — ${person.controls.join(', ')}` : ''}`).join('; ')
  const fallbackOwnershipSummary = manualOwnershipSummary(fallback.shareholders)

  return {
    ...fallback,
    registeredName: profile.company_name || fallback.registeredName || fallback.companyName || 'Property company',
    companyName: profile.company_name || fallback.companyName || fallback.registeredName || 'Property company',
    companyNumber: profile.company_number || fallback.companyNumber || '',
    incorporationDate: profile.date_of_creation || fallback.incorporationDate || '',
    jurisdiction: profile.jurisdiction ? humaniseRegisterValue(profile.jurisdiction) : (fallback.jurisdiction || ''),
    sicCode: profile.sic_codes?.length ? profile.sic_codes.join(', ') : (fallback.sicCode || ''),
    directors: directors.length ? directors : (fallback.directors || []),
    shareholders: Array.isArray(fallback.shareholders) ? fallback.shareholders : [],
    ownership,
    ownershipSummary: registerOwnershipSummary || fallbackOwnershipSummary,
    ownershipSource: registerOwnershipSummary ? 'Companies House PSC register' : (fallbackOwnershipSummary ? 'BTLPortfolio' : ''),
  }
}

const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : 0
const positive = (value) => Math.max(0, finite(value))
const iso = (value) => String(value || '').slice(0, 10)
const addDays = (date, days) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10) }
const monthsBetween = (start, end) => Math.max(1, (new Date(`${end}T12:00:00Z`) - new Date(`${start}T12:00:00Z`)) / 2629800000)
const txDate = (tx) => iso(tx.bookedAt || tx.booked_at || tx.bookingDate || tx.booking_date || tx.date || tx.transactionDate)
const txAmount = (tx) => finite(tx.amount)
const txCategory = (tx) => tx.category || tx.userCategory || tx.user_category || tx.classification || 'other'
const inRange = (date, start, end) => date && date >= start && date <= end
const earliest = (values) => values.filter(Boolean).sort()[0] || ''
const staleDays = (date, asOf) => date ? Math.floor((new Date(`${asOf}T12:00:00Z`) - new Date(`${date}T12:00:00Z`)) / 86400000) : Infinity

export function annualDebtService(loans = []) {
  return loans.reduce((sum, loan) => sum + loanCostSummary(loan).monthlyPayment * 12, 0)
}

export function buildCompanyFinancialSnapshot({ company, properties = [], loans = [], tenants = [], transactions = [], settings = {}, reportingDate, periodStart, includeExtractions = true, includeRateStress = true }) {
  const asOf = iso(reportingDate || new Date().toISOString())
  const start = iso(periodStart || addDays(asOf, -365))
  const active = properties.filter((property) => property.active !== false)
  const propertyIds = new Set(active.map((property) => property.id))
  const companyLoans = loans.filter((loan) => propertyIds.has(loan.propertyId))
  const unassociatedLoans = loans.filter((loan) => !loan.propertyId)
  const portfolioValue = active.reduce((sum, property) => sum + positive(property.latestValuation), 0)
  const mortgageDebt = companyLoans.reduce((sum, loan) => sum + effectiveLoanAmount(loan), 0)
  const aggregateLtv = portfolioValue > 0 ? mortgageDebt / portfolioValue : null
  const grossPropertyEquity = portfolioValue - mortgageDebt
  const annualContractedRent = active.reduce((sum, property) => sum + positive(property.rent) * 12 + positive(property.garageRent) * 12, 0)
  const weightedRate = mortgageDebt > 0 ? companyLoans.reduce((sum, loan) => sum + effectiveLoanAmount(loan) * positive(loan.rate), 0) / mortgageDebt : 0
  const earliestExpiry = earliest(companyLoans.map((loan) => loan.fixedEndDate || loan.productExpiry || loan.fixedExpiry || (loan.fixedStartDate && loan.fixedRateMonths ? (() => { const d = new Date(`${loan.fixedStartDate}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + Number(loan.fixedRateMonths)); return d.toISOString().slice(0, 10) })() : '')))
  const debtService = annualDebtService(companyLoans)
  const interestService = companyLoans.reduce((sum, loan) => sum + loanCostSummary(loan).monthlyInterestCost * 12, 0)
  const stressedInterest = companyLoans.reduce((sum, loan) => sum + effectiveLoanAmount(loan) * (positive(loan.rate) + (includeRateStress ? 0.02 : 0)), 0)

  const booked = transactions.filter((tx) => inRange(txDate(tx), start, asOf))
  const actual = booked.reduce((acc, tx) => {
    const amount = txAmount(tx)
    const category = txCategory(tx)
    const treatment = performanceTreatmentForTransaction({ ...tx, category })
    if (category === 'mortgage') acc.debtServiceCash += Math.abs(Math.min(0, amount))
    if (['exclude', 'transfer', 'investor', 'capital', 'liability', 'financing', 'review'].includes(treatment)) return acc
    if (treatment === 'extraction' && !includeExtractions) return acc
    if (category === 'rent' || category === 'other_property_income') acc.rentCollected += Math.max(0, amount)
    if (amount > 0) acc.operatingIncome += amount
    else acc.operatingOutflow += Math.abs(amount)
    if (treatment === 'extraction') acc.ownerExtractions += Math.abs(amount)
    return acc
  }, { rentCollected: 0, operatingIncome: 0, operatingOutflow: 0, debtServiceCash: 0, ownerExtractions: 0 })
  actual.netCashFlow = actual.operatingIncome - actual.operatingOutflow

  const companyCosts = (settings.companyCosts || []).filter((item) => item.enabled !== false).reduce((sum, item) => sum + positive(item.amount), 0)
  const runRateOperatingCosts = active.reduce((sum, property) => sum + positive(property.factorsCosts || property.factorCost || 0) * 12 + positive(property.repairsMonthly || 0) * 12 + positive(property.insuranceAnnual || 0), 0) + companyCosts
  const runRateCashFlow = annualContractedRent - runRateOperatingCosts - debtService
  const cashHeld = Number.isFinite(Number(settings.cashHeld)) ? Number(settings.cashHeld) : null
  const bufferMonths = cashHeld != null && (runRateOperatingCosts + debtService) > 0 ? cashHeld / ((runRateOperatingCosts + debtService) / 12) : null
  const icr = interestService > 0 ? annualContractedRent / interestService : null
  const stressedIcr = stressedInterest > 0 ? annualContractedRent / stressedInterest : null

  const occupiedIds = new Set((tenants || []).filter((tenant) => !tenant.moveOutDate && !tenant.moveOut && tenant.propertyId).map((tenant) => tenant.propertyId))
  const occupancy = active.length ? occupiedIds.size / active.length : null
  const warnings = []
  active.forEach((property) => {
    if (!positive(property.latestValuation)) warnings.push(`${property.name || 'Property'}: current valuation is missing.`)
    const valuationDate = property.latestValuationDate || property.valuationDate || property.updatedAt || ''
    if (positive(property.latestValuation) && valuationDate && staleDays(valuationDate, asOf) > 730) warnings.push(`${property.name || 'Property'}: valuation is more than 24 months old.`)
    if (!positive(property.rent)) warnings.push(`${property.name || 'Property'}: current rent is missing.`)
  })
  if (unassociatedLoans.length) warnings.push(`${unassociatedLoans.length} loan${unassociatedLoans.length === 1 ? '' : 's'} are not associated with a property and are excluded from company debt.`)
  if (!transactions.length) warnings.push('No reconciled banking transactions are available; trailing-12-month actuals are unavailable or incomplete.')
  if (!company?.companyNumber) warnings.push('Company registration number is missing.')

  const propertiesTable = active.map((property) => {
    const propertyLoans = companyLoans.filter((loan) => loan.propertyId === property.id)
    const debt = propertyLoans.reduce((sum, loan) => sum + effectiveLoanAmount(loan), 0)
    const value = positive(property.latestValuation)
    return {
      id: property.id, name: property.name || 'Property', address: [property.flatNumber, property.address, property.postcode].filter(Boolean).join(', '),
      value, debt, ltv: value > 0 ? debt / value : null, rentMonthly: positive(property.rent) + positive(property.garageRent),
      weightedRate: debt > 0 ? propertyLoans.reduce((sum, loan) => sum + effectiveLoanAmount(loan) * positive(loan.rate), 0) / debt : 0,
      lenders: [...new Set(propertyLoans.map((loan) => loan.lender).filter(Boolean))].join(' / '),
    }
  })

  return Object.freeze({
    generatedAt: new Date().toISOString(), reportingDate: asOf, periodStart: start, periodMonths: monthsBetween(start, asOf), company,
    portfolio: { propertyCount: active.length, portfolioValue, mortgageDebt, aggregateLtv, grossPropertyEquity, annualContractedRent, occupancy, weightedRate, earliestExpiry },
    actual: transactions.length ? actual : null,
    runRate: { annualRent: annualContractedRent, operatingCosts: runRateOperatingCosts, debtService, interestService, cashFlow: runRateCashFlow },
    resilience: { cashHeld, bufferMonths, icr, stressedIcr, stressIncluded: includeRateStress },
    properties: propertiesTable,
    warnings,
  })
}
