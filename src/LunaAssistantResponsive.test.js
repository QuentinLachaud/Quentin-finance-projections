import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const assistant = readFileSync(new URL('./LunaAssistant.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./LunaAssistant.css', import.meta.url), 'utf8')

describe('Luna mobile bottom sheet', () => {
  it('constrains the phone panel to a viewport-anchored grid', () => {
    const phoneStyles = styles.slice(styles.indexOf('@media (max-width: 700px)'))

    expect(phoneStyles).toMatch(/\.luna-panel\s*\{[\s\S]*?bottom:\s*calc\(74px \+ env\(safe-area-inset-bottom\)\)/)
    expect(phoneStyles).toMatch(/\.luna-panel\s*\{[\s\S]*?height:\s*clamp\(300px, 50dvh, 440px\)/)
    expect(phoneStyles).toMatch(/\.luna-panel\s*\{[\s\S]*?max-height:\s*calc\(100dvh[^;]+safe-area-inset-top[^;]+safe-area-inset-bottom[^;]+\)/)
    expect(phoneStyles).toMatch(/\.luna-panel\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\) auto auto/)
  })

  it('keeps messages as the independent scroll region', () => {
    expect(styles).toMatch(/\.luna-messages\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;/)
    expect(styles).toMatch(/\.luna-messages\s*\{[\s\S]*?overscroll-behavior:\s*contain;/)

    const headerEnd = assistant.indexOf('</header>')
    const messagesStart = assistant.indexOf('<div className="luna-messages"')
    const messagesEnd = assistant.indexOf('</div>', messagesStart)
    const confirmationStart = assistant.indexOf('{pending && <div className="luna-confirm">')
    const composerStart = assistant.indexOf('<form className="luna-input"')

    expect(headerEnd).toBeLessThan(messagesStart)
    expect(messagesEnd).toBeLessThan(confirmationStart)
    expect(messagesEnd).toBeLessThan(composerStart)
  })

  it('retains labelled controls and a mobile-sized close target', () => {
    expect(assistant).toContain('className="luna-close"')
    expect(assistant).toContain('aria-label="Close Luna"')
    expect(assistant).toContain('aria-label="Ask Luna"')
    expect(styles).toMatch(/\.luna-panel > header \.luna-close\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/)
  })
})
