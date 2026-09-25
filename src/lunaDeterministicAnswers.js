import { currency, percent } from './calculations.js'
import { executePortfolioAction } from './lunaCapabilities.js'
import { chatActionsForPortfolioResult } from './lunaChatActions.js'

const clean = (value) => String(value ?? '').trim()
const readOnlyRequest = (message) => !/\b(?:add|change|create|delete|edit|increase|remove|rename|set|update)\b/i.test(message)

const referenceParts = (value) => clean(value).toLowerCase()
  .replace(/([a-z])([0-9])/g, '$1 $2')
  .replace(/([0-9])([a-z])/g, '$1 $2')
  .split(/[^a-z0-9]+/)
  .filter(Boolean)

const referenceAppearsIn = (message, reference) => {
  const parts = referenceParts(reference)
  if (!parts.length || parts.join('').length < 3) return false
  const pattern = parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^a-z0-9]*')
  return new RegExp(`(?:^|[^a-z0-9])${pattern}(?![a-z0-9])`, 'i').test(message)
}

const mentionedProperty = (portfolio, message) => {
  const matches = []
  for (const property of Array.isArray(portfolio?.properties) ? portfolio.properties : []) {
    const references = [property?.name, property?.address, property?.postcode, property?.id]
      .filter((reference) => referenceAppearsIn(message, reference))
    if (references.length) matches.push(property)
  }
  return matches.length === 1 ? matches[0] : null
}

export const detectDeterministicPortfolioRead = (portfolio, rawMessage) => {
  const message = clean(rawMessage)
  if (!message || !readOnlyRequest(message)) return null
  const property = mentionedProperty(portfolio, message)
  const target = property?.id || null

  if (/\b(?:net|operating)\b[\s\S]*\b(?:monthly|month)\b[\s\S]*\b(?:income|cash\s*flow|cashflow)\b/i.test(message)
    || /\b(?:monthly|month)\b[\s\S]*\b(?:net|operating)\b[\s\S]*\b(?:income|cash\s*flow|cashflow)\b/i.test(message)) {
    return target ? { operation: 'property.financial_summary', target, data: null } : null
  }
  if (/\b(?:loans?|mortgages?|financing)\b/i.test(message)) {
    return target ? { operation: 'property.loans', target, data: null } : null
  }
  if (/\btenants?\b/i.test(message)) {
    return target
      ? { operation: 'property.tenants', target, data: null }
      : { operation: 'tenant.list', target: null, data: null }
  }
  if (/\brent\b/i.test(message)) {
    return target ? { operation: 'property.get', target, data: null } : null
  }
  return null
}

const propertyName = (result) => clean(result?.property?.name || result?.name) || 'This property'

const formatLoanAnswer = (result) => {
  const name = propertyName(result)
  if (!result.loans.length) return `**${name}** has no linked loans.`
  const lines = result.loans.map((loan) => {
    const lender = clean(loan.lender) || 'Lender not set'
    const repayment = loan.interestOnly ? 'interest-only' : 'repayment'
    return `- **${lender}** — ${currency(loan.balance)} balance at ${percent(loan.rate, 2)} (${repayment}); ${currency(loan.monthlyPayment)} per month`
  })
  const heading = result.loans.length === 1
    ? `**${name} has 1 linked loan:**`
    : `**${name} has ${result.loans.length} linked loans:**`
  return `${heading}\n${lines.join('\n')}\n\n**Total balance:** ${currency(result.summary.loanAmount)} · **Total monthly payment:** ${currency(result.summary.monthlyPayment)}`
}

const formatTenantAnswer = (result, portfolio) => {
  const tenants = Array.isArray(result) ? result : result.tenants
  const properties = Array.isArray(portfolio?.properties) ? portfolio.properties : []
  const prefix = Array.isArray(result) ? '**Stored tenants:**' : `**Tenants for ${propertyName(result)}:**`
  if (!tenants.length) return Array.isArray(result)
    ? 'There are no stored tenants.'
    : `**${propertyName(result)}** has no linked tenants.`
  const lines = tenants.map((tenant) => {
    const property = properties.find((candidate) => candidate.id === tenant.propertyId)
    const details = [clean(property?.name), clean(tenant.email), clean(tenant.phone)].filter(Boolean)
    return `- **${clean(tenant.name) || 'Unnamed tenant'}**${details.length ? ` — ${details.join(' · ')}` : ''}`
  })
  return `${prefix}\n${lines.join('\n')}`
}

const formatFinancialAnswer = (result) => {
  const { components } = result
  return [
    `**${propertyName(result)} ${result.metricLabel}:** ${currency(result.operatingCashflow)}.`,
    'This is the same property-level metric shown in the app: rent less mortgage payment, property operating allowances, and management when enabled.',
    `- Rent: ${currency(components.rent)}`,
    `- Mortgage payment: ${currency(components.mortgagePayment)}`,
    `- Other fixed and variable property costs: ${currency(components.fixedCosts + components.variableCosts - components.mortgagePayment)}`,
    `- Management: ${currency(components.management)}`,
    '',
    'It excludes portfolio/company tax, company-level costs, and extractions.',
  ].join('\n')
}

const formatAnswer = (portfolio, args, result) => {
  if (args.operation === 'property.get') return `**${clean(result.name) || 'Property'} rent:** ${currency(result.rent)} per month.`
  if (args.operation === 'property.loans') return formatLoanAnswer(result)
  if (args.operation === 'property.tenants' || args.operation === 'tenant.list') return formatTenantAnswer(result, portfolio)
  if (args.operation === 'property.financial_summary') return formatFinancialAnswer(result)
  return ''
}

export function answerDeterministicPortfolioQuestion(portfolio, message) {
  const action = detectDeterministicPortfolioRead(portfolio, message)
  if (!action) return null
  const { result } = executePortfolioAction(portfolio, action)
  return {
    operation: action.operation,
    message: formatAnswer(portfolio, action, result),
    chatActions: chatActionsForPortfolioResult(portfolio, action, result),
  }
}
