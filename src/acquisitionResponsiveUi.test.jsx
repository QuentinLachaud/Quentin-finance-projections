import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const simulator = readFileSync('src/AcquisitionSimulator.jsx', 'utf8')
const styles = readFileSync('src/styles.css', 'utf8')

describe('Acquisition Simulator simplified entry and adaptive mobile metrics', () => {
  it('removes listing-import UI and frontend logic', () => {
    for (const text of ['Rightmove', 'Zoopla', 'listingRequest', '/api/property-listing', 'listingUrl', 'droppedUrl']) {
      expect(simulator).not.toContain(text)
    }
    expect(simulator).not.toContain("from './supabase.js'")
  })

  it('keeps one Add acquisition action', () => {
    expect(simulator).toContain('className="acq-add-toolbar"')
    expect(simulator).toContain('className="primary-button acq-add-button"')
    expect(simulator).toContain('Add acquisition')
    expect(simulator).toContain('onClick={openManual}')
  })

  it('keeps all three metrics and makes Price addressable', () => {
    expect(simulator).toContain('<div className="price">')
    expect(simulator).toContain('<span>Price</span>')
    expect(simulator).toContain('<div className="yield">')
    expect(simulator).toContain('<span>Gross yield</span>')
    expect(simulator).toContain('<div className="cash">')
    expect(simulator).toContain('<span>Cash needed</span>')
  })

  it('prioritises cash on mobile and hides optional metrics as width shrinks', () => {
    expect(styles).toContain('container-name: acquisition-card-main')
    expect(styles).toContain('.acq-card-metrics .cash { order: 1; }')
    expect(styles).toContain('.acq-card-metrics .price { order: 2; }')
    expect(styles).toContain('.acq-card-metrics .yield { order: 3; }')
    expect(styles).toContain('@container acquisition-card-main (max-width: 290px)')
    expect(styles).toContain('@container acquisition-card-main (max-width: 215px)')
  })
})
