const finiteNonNegative = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

export const privateIncomeIsKnown = (settings = {}) =>
  settings.privateIncomeConfirmed === true || finiteNonNegative(settings.grossAnnualIncome) > 0

export const confirmPrivateIncome = (settings = {}, grossAnnualIncome = 0) => ({
  ...settings,
  accountType: 'private',
  grossAnnualIncome: finiteNonNegative(grossAnnualIncome),
  privateIncomeConfirmed: true,
})
