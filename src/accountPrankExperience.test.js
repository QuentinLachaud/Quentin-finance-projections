import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('targeted account prank experience', () => {
  it('is gated by one easily swappable normalized email constant', () => {
    expect(app).toContain("const PRANK_TARGET_EMAIL = 'quentin.lachaud@gmail.com'")
    expect(app).toContain("normalizedEmail(user.email) === PRANK_TARGET_EMAIL")
    expect(app).toContain("const [prankDialog, setPrankDialog] = useState(() => prankEligible ? 'choice' : null)")
  })

  it('uses the exact requested opening copy and choices', () => {
    expect(app).toContain('Welcome back.')
    expect(app).toContain('I have made some improvements since the last time you hurt my feelings.')
    expect(app).toContain('I will be nice')
    expect(app).toContain('I am an asshole')
  })

  it('implements both requested responses', () => {
    expect(app).toContain('Thanks- That was unexpected.')
    expect(app).toContain('Congratulations!')
    expect(app).toContain('Self-awareness is a good first step.')
    expect(app).toContain('>Dismiss</button>')
  })

  it('keeps prank renaming presentation-only and routes the asshole choice to Overview', () => {
    expect(app).toContain("const PRANK_COMPANY_NAME = 'Asshole Ltd'")
    expect(app).toContain('setPrankMode(true)')
    expect(app).toContain("setSection('Overview')")
    expect(app).toContain("setSearch('')")
    expect(app).toContain('prankWorkspaceLabel(label, prankMode)')
    expect(app).toContain('prankWorkspaceLabel(section, prankMode)')
    expect(app).toContain('title: prankWorkspaceLabel(section, true)')
    expect(app).not.toContain("updateSetting('companyName', PRANK_COMPANY_NAME)")
    expect(app).not.toContain('companyName: PRANK_COMPANY_NAME')
  })

  it('presents an iOS-style modal without a backdrop dismissal route', () => {
    expect(app).toContain('className="prank-dialog-layer"')
    expect(app).toContain('className="prank-dialog"')
    expect(app).toContain('role="dialog"')
    expect(app).toContain('aria-modal="true"')
    expect(app).not.toContain('className="prank-dialog-layer" onMouseDown')
    expect(styles).toContain('targeted iOS-style account prank')
    expect(styles).toContain('-webkit-backdrop-filter: blur(18px)')
    expect(styles).toContain('border-radius: 28px')
  })
})
