import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path) => readFileSync(path, 'utf8')

describe('redundant UI copy cleanup', () => {
  it('removes the audited high-vibe copy while retaining useful explanations', () => {
    const files = [
      'src/AuthScreen.jsx', 'src/App.jsx', 'src/LoansWorkspace.jsx', 'src/ExpensesWorkspace.jsx',
      'src/DocumentCaptureSheet.jsx', 'src/DocumentViewer.jsx', 'src/BillingWorkspace.jsx',
      'src/ContractorsWorkspace.jsx', 'src/CredentialsWorkspace.jsx', 'src/RemortgageSimulator.jsx',
      'src/AcquisitionSimulator.jsx', 'src/TimeToNextBtl.jsx', 'src/NotificationCenter.jsx',
      'src/OverviewPortfolioDashboard.jsx',
    ].map(read).join('\n')

    for (const copy of [
      'PRIVATE PORTFOLIO MODELLING', 'Your BTL portfolio, clearly modelled.', 'WELCOME TO BTL PORTFOLIO',
      'Sign in to your portfolio', 'New to BTL Portfolio?', 'CURRENT FINANCE', 'RECENT DOCUMENTS',
      'Your latest files', 'Synced securely to your account', 'ADD RECORD', 'NEW DOCUMENT',
      'Rename it here without breaking the secure stored file.', 'Opening securely…', 'Loading from your account',
      'BTL PORTFOLIO PRO', 'Grow beyond your first BTL', 'You have unrestricted portfolio access.',
      'Flexible access, billed each month.', 'Future Pro reporting and integrations',
      'Add people you use for maintenance, compliance and property work.',
      'Future property documents will be owned by the Documents feature, not by this contact.',
      'Add your first ID, code, reference or registered-office detail.', 'PRO · FINANCE DECISION TOOL',
      'Saved comparisons stay compact so you can compare them at a glance.', 'SAVED TARGETS',
      'POTENTIAL ACQUISITION', 'PURCHASE TIMING', 'PURCHASE FUNDING', 'UPCOMING',
      'Your current equity position across the properties included in portfolio totals.',
    ]) expect(files).not.toContain(copy)

    expect(files).toContain('Recent documents')
    expect(files).toContain('Upgrade to Pro')
    expect(files).toContain('Existing documents are kept.')
    expect(files).toContain('Saved acquisition scenarios.')
    expect(files).toContain('When your available cash can fund the next purchase.')
    expect(files).toContain('Financial details are optional.')
    expect(files).toContain('It does not OCR or parse document contents.')
    expect(files).toContain('it is not a separate encryption layer.')
    expect(files).toContain('Remortgages appear three months ahead; compliance dates appear two weeks ahead.')
  })
})
