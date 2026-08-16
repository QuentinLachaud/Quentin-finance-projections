export const assumptions = {
  appreciationRate: 0.03,
  rateShock: 0.007,
  corporationTaxRate: 0.19,
  managementRate: 0.12,
  cashHeld: 12700,
  bufferMonths: 6,
  projectionMonths: 60,
  landlordRegistration: '540076/260/18032',
}

export const newAccountDefaults = {
  cashHeld: 0,
  rateShock: 0,
}

const sharedCosts = {
  legionella: 0,
  gasCertificate: 0,
  eicr: 0,
  mortgageAdmin: 0,
  repairs: 0,
  applianceReserve: 0,
}

export const createBlankProperty = (name = 'BTL1') => ({
  id: crypto.randomUUID(),
  name,
  address: '',
  postcode: '',
  flatNumber: '',
  purchasePrice: 0,
  homeReportPurchase: 0,
  latestValuation: 0,
  loanAmount: 0,
  areaSqm: 0,
  bedrooms: 0,
  epc: '',
  rent: 0,
  purchaseDate: '',
  lender: '',
  mortgageNumber: '',
  baseRate: 0,
  fixedRateMonths: 24,
  mortgageOverride: '',
  mortgageOverrideRate: null,
  mortgageOverrideLoanAmount: null,
  voidsOverride: '',
  factorsFees: 0,
  tenantName: '',
  tenantEmail: '',
  tenantPhone: '',
  tenantOccupation: '',
  tenantMoveIn: '',
  tenantMoveOut: '',
  depositHeld: '',
  latestRemortgage: '',
  gasExpiry: '',
  eicrExpiry: '',
  epcExpiry: '',
  patExpiry: '',
  active: true,
  ...sharedCosts,
})

export const editableSections = [
  {
    title: 'Property',
    fields: [
      ['name', 'BTL name', 'text'], ['address', 'Street address', 'text'],
      ['postcode', 'Postcode', 'text'], ['flatNumber', 'Flat number', 'text'],
      ['purchasePrice', 'Purchase price', 'number'], ['homeReportPurchase', 'Home report at purchase', 'number'],
      ['latestValuation', 'Latest valuation', 'number'], ['loanAmount', 'Loan amount', 'number'],
      ['areaSqm', 'Area (m²)', 'number'], ['bedrooms', 'Bedrooms', 'number'],
      ['epc', 'EPC', 'text'], ['rent', 'Monthly rent', 'number'], ['purchaseDate', 'First purchased', 'date'],
    ],
  },
  {
    title: 'Loan & costs',
    fields: [
      ['lender', 'Current lender', 'text'], ['mortgageNumber', 'Mortgage reference (private)', 'text'],
      ['baseRate', 'Base interest rate', 'percent'], ['fixedRateMonths', 'Fixed period (months)', 'number'],
      ['factorsFees', 'Factors fees / month', 'number'], ['repairs', 'Repairs reserve / month', 'number'],
      ['latestRemortgage', 'Latest remortgage', 'date'],
    ],
  },
  {
    title: 'Compliance dates',
    fields: [
      ['gasExpiry', 'Gas certificate expiry', 'date'], ['eicrExpiry', 'EICR expiry', 'date'],
      ['epcExpiry', 'EPC expiry', 'date'], ['patExpiry', 'PAT expiry', 'date'],
    ],
  },
  {
    title: 'Tenant (private to this account)',
    fields: [
      ['tenantName', 'Name', 'text'], ['tenantEmail', 'Email', 'email'],
      ['tenantPhone', 'Phone', 'tel'], ['tenantOccupation', 'Occupation', 'text'],
      ['tenantMoveIn', 'Move-in date', 'date'], ['tenantMoveOut', 'Move-out date (optional)', 'date'],
      ['depositHeld', 'Deposit held', 'text'],
    ],
  },
]
