import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path) => readFileSync(path, 'utf8')

describe('interface information architecture', () => {
  it('groups the desktop navigation into scannable sections', () => {
    const app = read('src/App.jsx')
    for (const group of ['PORTFOLIO', 'PLANNING', 'COMPANY', 'ACCOUNT']) {
      expect(app).toContain(group)
    }
    expect(app).toContain('<small>YOUR BTLS</small>')
    expect(app).toContain('aria-current={section === label ? \'page\' : undefined}')
  })

  it('gives every workspace a contextual page heading and explanation', () => {
    const app = read('src/App.jsx')
    for (const title of [
      'Portfolio overview',
      'Properties',
      'Tenants',
      'Costs & Cash Flows',
      'Expenses',
      'Projections',
      'Remortgage Simulator',
      'Compliance',
      'Companies House',
      'IDs & Credentials',
      'Plan & billing',
    ]) {
      expect(app).toContain(`title: '${title}'`)
    }
    expect(app).not.toContain('Last calculated just now')
    expect(app).toContain('pageMeta.description')
  })

  it('keeps secondary model/profile controls available but collapsed by default', () => {
    const app = read('src/App.jsx')
    expect(app).toContain('sidebar-model-inputs sidebar-disclosure')
    expect(app).toContain('sidebar-profile-editor sidebar-disclosure')
    expect(app).toContain('<details')
    expect(app).toContain('<summary>')
  })
})

describe('interface usability contracts', () => {
  it('has visible keyboard focus and reduced-motion support', () => {
    const styles = read('src/styles.css')
    expect(styles).toContain('button:focus-visible')
    expect(styles).toContain('summary:focus-visible')
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('uses one consolidated final interface polish layer instead of stacking readability patches', () => {
    const styles = read('src/styles.css')
    expect(styles).toContain('/* Interface design system + usability audit')
    expect(styles).not.toContain('/* Global readability and spacing pass')
    expect(styles).toContain('--ui-surface')
    expect(styles).toContain('--ui-focus')
  })

  it('removes developer/spreadsheet language from visible planning copy', () => {
    const app = read('src/App.jsx')
    const expenses = read('src/ExpensesWorkspace.jsx')
    expect(app).not.toContain('sheet scenarios')
    expect(expenses).not.toContain('actual company cash movements')
  })

  it('uses restrained, user-facing authentication and billing copy', () => {
    const auth = read('src/AuthScreen.jsx')
    const billing = read('src/BillingWorkspace.jsx')
    expect(auth).not.toContain('never shared with another account')
    expect(auth).toContain('Your BTL portfolio, clearly modelled.')
    expect(billing).not.toContain('no hidden surprises')
    expect(billing).toContain('Remortgage Simulator and long-range projections')
  })
})
