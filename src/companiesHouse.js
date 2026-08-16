const DAY_MS = 24 * 60 * 60 * 1000

export const officialCompanyUrl = (companyNumber) => `https://find-and-update.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber || '')}`

export const formatCompanyAddress = (address = {}) => [
  address.premises,
  address.address_line_1,
  address.address_line_2,
  address.locality,
  address.region,
  address.postal_code,
  address.country,
].filter(Boolean).join(', ')

export const daysUntil = (dateString, now = new Date()) => {
  if (!dateString) return null
  const due = new Date(`${dateString}T12:00:00`)
  if (Number.isNaN(due.getTime())) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)
  return Math.ceil((due - today) / DAY_MS)
}

const deadlineStatus = (date, overdue, now) => {
  const days = daysUntil(date, now)
  if (overdue || (days != null && days < 0)) return 'overdue'
  if (days != null && days <= 30) return 'due-soon'
  return 'upcoming'
}

export const companyDeadlines = (profile, now = new Date()) => {
  if (!profile) return []
  const accountsDate = profile.accounts?.next_due || profile.accounts?.next_accounts?.due_on
  const confirmationDate = profile.confirmation_statement?.next_due
  return [
    accountsDate && {
      id: 'accounts',
      label: 'Annual accounts',
      date: accountsDate,
      days: daysUntil(accountsDate, now),
      status: deadlineStatus(accountsDate, profile.accounts?.overdue || profile.accounts?.next_accounts?.overdue, now),
    },
    confirmationDate && {
      id: 'confirmation',
      label: 'Confirmation statement',
      date: confirmationDate,
      days: daysUntil(confirmationDate, now),
      status: deadlineStatus(confirmationDate, profile.confirmation_statement?.overdue, now),
    },
  ].filter(Boolean)
}

export const activeOfficers = (officers) => (officers?.items || []).filter((officer) => !officer.resigned_on)
export const activePsc = (psc) => (psc?.items || []).filter((person) => !person.ceased && !person.ceased_on)
export const outstandingCharges = (charges) => (charges?.items || []).filter((charge) => charge.status !== 'fully-satisfied')

export const identityVerificationSummary = (officers, psc) => {
  const people = [...activeOfficers(officers), ...activePsc(psc)]
  const withDetails = people.filter((person) => person.identity_verification_details)
  const verified = withDetails.filter((person) => person.identity_verification_details.identity_verified_on || person.identity_verification_details.appointment_verification_statement_date)
  const due = withDetails.filter((person) => person.identity_verification_details.appointment_verification_statement_due_on && !person.identity_verification_details.appointment_verification_statement_date)
  return { total: people.length, published: withDetails.length, verified: verified.length, due: due.length }
}
