import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CashFlowDetail } from './OverviewPortfolioDashboard.jsx'
import { currency } from './calculations.js'

const scenario = (tax) => ({
  collectedRent: 1500,
  voidLoss: 0,
  management: 0,
  problemBudget: 100,
  tax,
  bankCashflow: 500 - tax,
  cashflow: 500 - tax,
})

const portfolio = (tax) => ({
  scenarios: [scenario(tax)],
  rent: 1500,
  propertyFixedCosts: 900,
  companyCosts: 0,
  extractionTotal: 0,
})

const renderedTax = (tax) => {
  const html = renderToStaticMarkup(
    <CashFlowDetail portfolio={portfolio(tax)} settings={{ accountType: 'company' }} />,
  )
  const match = html.match(/Estimated corporation tax[\s\S]*?<\/span><strong>(.*?)<\/strong>/)
  expect(match).not.toBeNull()
  return { value: match[1], html }
}

describe('Overview Corporation Tax presentation', () => {
  it('shows the positive tax charge rather than formatting it as a negative tax liability', () => {
    const { value, html } = renderedTax(150)
    expect(value).toBe(currency(150))
    expect(html).toContain('already deducted from monthly cash flow')
    expect(html).toContain(currency(350))
  })

  it('shows a zero charge without suggesting a refundable tax credit', () => {
    const { value, html } = renderedTax(0)
    expect(value).toBe(currency(0))
    expect(html).toContain(currency(500))
  })
})
