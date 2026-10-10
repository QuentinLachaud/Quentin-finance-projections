export const assumptions = {
  appreciationRate: 0.03,
  rentGrowthRate: 0.02,
  rateShock: 0,
  associatedCompanies: 0,
  accountingPeriodMonths: 12,
  augmentedProfitDistributions: 0,
  closeInvestmentHoldingCompany: false,
  budgetedPropertyCostsTaxDeductible: false,
  propertyLossBroughtForward: 0,
  financeCostsBroughtForward: 0,
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

export const DEFAULT_DEPOSIT_SCHEME = 'SafeDeposits Scotland'

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
  mortgagePrincipalAmount: 0,
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
  mortgageFeeMode: 'percent',
  mortgageFeeValue: 0,
  mortgageFeeAddedToLoan: false,
  mortgageInterestOnly: true,
  mortgageTermMonths: 300,
  mortgageLtvBand: 0,
  mortgageOverride: '',
  mortgageOverrideRate: null,
  mortgageOverrideLoanAmount: null,
  qualifyingFinanceBalance: '',
  voidsOverride: '',
  factorsFees: 0,
  factorsProvider: '',
  factorsAccountNumber: '',
  buildingsInsuranceProvider: '',
  buildingsInsurancePolicyNumber: '',
  buildingsInsuranceInsuredValue: '',
  depositScheme: DEFAULT_DEPOSIT_SCHEME,
  depositRegistrationNumber: '',
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

// Migration for older user portfolios; never infer the factors provider.
export const normalizePropertyRecord = (property = {}) => {
  const value = property && typeof property === 'object' ? property : {}
  return {
    ...value,
    mortgageNumber: value.mortgageNumber ?? '',
    factorsProvider: value.factorsProvider ?? '',
    factorsAccountNumber: value.factorsAccountNumber ?? '',
    buildingsInsuranceProvider: value.buildingsInsuranceProvider ?? '',
    buildingsInsurancePolicyNumber: value.buildingsInsurancePolicyNumber ?? '',
    buildingsInsuranceInsuredValue: value.buildingsInsuranceInsuredValue ?? '',
    depositScheme: typeof value.depositScheme === 'string' && value.depositScheme.trim()
      ? value.depositScheme.trim() : DEFAULT_DEPOSIT_SCHEME,
    depositRegistrationNumber: value.depositRegistrationNumber ?? '',
  }
}

export const editableSections = [
  {
    title: 'Property',
    fields: [
      ['name', 'BTL name', 'text'], ['address', 'Street address', 'text'],
      ['postcode', 'Postcode', 'text'], ['flatNumber', 'Flat number', 'text'],
      ['purchasePrice', 'Purchase price', 'number'], ['homeReportPurchase', 'Home report at purchase', 'number'],
      ['latestValuation', 'Latest valuation', 'number'], ['loanAmount', 'Loan amount before fee', 'number'],
      ['areaSqm', 'Area (m²)', 'number'], ['bedrooms', 'Bedrooms', 'number'],
      ['epc', 'EPC', 'text'], ['rent', 'Monthly rent', 'number'], ['purchaseDate', 'First purchased', 'date', true],
    ],
  },
  {
    title: 'Loan & costs',
    fields: [
      ['lender', 'Current lender', 'text'],
      ['baseRate', 'Base interest rate', 'percent'], ['fixedRateMonths', 'Fixed period (months)', 'number'],
      ['qualifyingFinanceBalance', 'Private-tax qualifying finance balance (blank = full loan)', 'optional-number'],
      ['factorsFees', 'Factors fees / month', 'number'], ['repairs', 'Repairs budget / month', 'number'],
      ['latestRemortgage', 'Latest remortgage', 'date', true],
    ],
  },
  {
    title: 'Property administration',
    fields: [
      ['factorsProvider', 'Building Factors provider', 'text', true, 'Speirs Gumley'],
      ['factorsAccountNumber', 'Factors account number', 'text', true],
      ['mortgageNumber', 'Mortgage provider account number', 'text', true],
      ['buildingsInsuranceProvider', 'Buildings insurance provider', 'text', true],
      ['buildingsInsurancePolicyNumber', 'Buildings insurance policy number', 'text', true],
      ['buildingsInsuranceInsuredValue', 'Buildings insurance insured value', 'optional-number', true],
      ['depositScheme', 'Deposit scheme', 'text', true],
      ['depositRegistrationNumber', 'Deposit registration number', 'text', true],
    ],
  },
  {
    title: 'Compliance dates',
    fields: [
      ['gasExpiry', 'Gas certificate expiry', 'date', true], ['eicrExpiry', 'EICR expiry', 'date', true],
      ['epcExpiry', 'EPC expiry', 'date', true], ['patExpiry', 'PAT expiry', 'date', true],
    ],
  },
  {
    title: 'Tenant (private to this account)',
    fields: [
      ['tenantName', 'Name', 'text'], ['tenantEmail', 'Email', 'email'],
      ['tenantPhone', 'Phone', 'tel'], ['tenantOccupation', 'Occupation', 'text'],
      ['tenantMoveIn', 'Move-in date', 'date', true], ['tenantMoveOut', 'Move-out date', 'date', true],
      ['depositHeld', 'Deposit held', 'text'],
    ],
  },
]
