import { describe, expect, it } from 'vitest'
import { editableSections } from './data.js'
import {
  PROPERTY_EDITOR_CORE_KEYS,
  PROPERTY_EDITOR_OPTIONAL_SECTIONS,
  propertyFieldHasValue,
  propertyHasMortgage,
  propertyMetricSupported,
  propertySectionCompletion,
  supportedPropertyRows,
} from './propertyDisclosure.js'

const allEditorKeys = editableSections.flatMap((section) => section.fields.map(([key]) => key))
const progressiveKeys = [
  ...PROPERTY_EDITOR_CORE_KEYS,
  ...PROPERTY_EDITOR_OPTIONAL_SECTIONS.flatMap((section) => section.keys),
]

describe('property progressive disclosure semantics', () => {
  it('keeps exactly five Essentials and represents every editable field exactly once', () => {
    expect(PROPERTY_EDITOR_CORE_KEYS).toEqual(['name', 'address', 'postcode', 'latestValuation', 'rent'])
    expect([...progressiveKeys].sort()).toEqual([...allEditorKeys].sort())
    expect(new Set(progressiveKeys).size).toBe(progressiveKeys.length)
  })

  it('treats sparse/default values as absent without treating the default fixed period as a mortgage', () => {
    expect(propertyFieldHasValue(null, 'rent')).toBe(false)
    expect(propertyFieldHasValue({ rent: 0 }, 'rent')).toBe(false)
    expect(propertyFieldHasValue({ rent: 1100 }, 'rent')).toBe(true)
    expect(propertyHasMortgage({ fixedRateMonths: 24 })).toBe(false)
    expect(propertySectionCompletion({ fixedRateMonths: 24 }, ['fixedRateMonths'])).toBe(0)
    expect(propertyHasMortgage({ fixedRateMonths: 24, loanAmount: 100000 })).toBe(true)
    expect(propertyHasMortgage({ lender: 'TMW' })).toBe(true)
  })

  it('counts only supplied fields in optional-section summaries', () => {
    expect(propertySectionCompletion({ lender: 'TMW', loanAmount: 100000, baseRate: 0 }, ['lender', 'loanAmount', 'baseRate'])).toBe(2)
  })

  it('requires the actual source inputs for finance-derived metrics', () => {
    const sparse = { latestValuation: 180000, fixedRateMonths: 24 }
    expect(propertyMetricSupported(sparse, 'currentValue')).toBe(true)
    expect(propertyMetricSupported(sparse, 'ltv')).toBe(false)
    expect(propertyMetricSupported(sparse, 'mortgagePayment')).toBe(false)
    expect(propertyMetricSupported({ ...sparse, loanAmount: 135000, baseRate: 0.045 }, 'ltv')).toBe(true)
    expect(propertyMetricSupported({ ...sparse, loanAmount: 135000, baseRate: 0.045 }, 'mortgagePayment')).toBe(true)
  })

  it('does not show yield/cash-flow precision without the inputs those metrics depend on', () => {
    expect(propertyMetricSupported({ rent: 1100 }, 'netYield')).toBe(false)
    expect(propertyMetricSupported({ rent: 1100, homeReportPurchase: 180000 }, 'netYield')).toBe(true)
    expect(propertyMetricSupported({ rent: 1100, lender: 'TMW' }, 'operatingCashflow')).toBe(false)
    expect(propertyMetricSupported({ rent: 1100, lender: 'TMW', loanAmount: 135000, baseRate: 0.045 }, 'operatingCashflow')).toBe(true)
    expect(propertyMetricSupported({ rent: 1100 }, 'operatingCashflow')).toBe(true)
  })

  it('covers property, purchase, remortgage and compliance dependency families', () => {
    expect(propertyMetricSupported({ address: '1 High St' }, 'address')).toBe(true)
    expect(propertyMetricSupported({}, 'address')).toBe(false)
    expect(propertyMetricSupported({ bedrooms: 2 }, 'bedrooms')).toBe(true)
    expect(propertyMetricSupported({ purchasePrice: 150000 }, 'purchasePrice')).toBe(true)
    expect(propertyMetricSupported({ latestValuation: 180000, latestRemortgage: '2025-01-01', fixedRateMonths: 24 }, 'expectedRemortgageValue')).toBe(true)
    expect(propertyMetricSupported({ latestValuation: 180000, fixedRateMonths: 24 }, 'expectedRemortgageValue')).toBe(false)
    expect(propertyMetricSupported({ eicrExpiry: '2029-01-01' }, 'eicrExpiry')).toBe(true)
    expect(propertyMetricSupported({}, 'eicrExpiry')).toBe(false)
  })

  it('preserves Basic/Full semantics and retains a row when any compared property supports it', () => {
    const rows = [
      ['Rent', () => 0, 'money', false, 'rent', null, 'rent'],
      ['EICR', () => '', 'date', true, 'eicrExpiry', null, 'eicrExpiry'],
    ]
    expect(supportedPropertyRows(rows, false, [{ rent: 0 }, { rent: 1100 }]).map(([label]) => label)).toEqual(['Rent'])
    expect(supportedPropertyRows(rows, false, [{ rent: 0 }])).toEqual([])
    expect(supportedPropertyRows(rows, true, [{ rent: 1100, eicrExpiry: '2029-01-01' }]).map(([label]) => label)).toEqual(['Rent', 'EICR'])
    expect(supportedPropertyRows(rows, true, [{ rent: 1100 }]).map(([label]) => label)).toEqual(['Rent'])
  })
})
