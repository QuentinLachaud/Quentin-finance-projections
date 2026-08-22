import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AcquisitionCard } from './AcquisitionSimulator.jsx'
import { createAcquisition, prependAcquisition } from './acquisition.js'

const callbacks = {
  onToggle: () => {},
  onUpdate: () => {},
  onRemove: () => {},
}

describe('Acquisition Simulator card behaviour', () => {
  it('prepends a newly-created acquisition ahead of existing scenarios', () => {
    const old = createAcquisition({ id: 'old', address: 'Old acquisition' })
    const created = createAcquisition({ id: 'new', address: 'New acquisition' })
    expect(prependAcquisition([old], created).map((item) => item.id)).toEqual(['new', 'old'])
  })

  it('shows gross yield and core acquisition numbers while collapsed', () => {
    const acquisition = createAcquisition({
      id: 'test',
      address: '10 Test Street',
      postcode: 'G3 8PP',
      propertyType: 'Flat',
      bedrooms: 2,
      areaSqm: 68,
      purchasePrice: 200000,
      expectedMonthlyRent: 1500,
    })
    const html = renderToStaticMarkup(<AcquisitionCard
      acquisition={acquisition}
      expanded={false}
      {...callbacks}
    />)

    expect(html).toContain('Gross yield')
    expect(html).toContain('9.00%')
    expect(html).toContain('Flat')
    expect(html).toContain('68 m²')
    expect(html).toContain('aria-expanded="false"')
  })

  it('renders imported area and property type into editable fields when expanded', () => {
    const acquisition = createAcquisition({
      id: 'test',
      propertyType: 'Terraced house',
      areaSqm: 91.5,
    })
    const html = renderToStaticMarkup(<AcquisitionCard
      acquisition={acquisition}
      expanded
      {...callbacks}
    />)

    expect(html).toContain('aria-label="Property type"')
    expect(html).toContain('value="Terraced house"')
    expect(html).toContain('aria-label="Area in square metres"')
    expect(html).toContain('value="91.5"')
  })
})
