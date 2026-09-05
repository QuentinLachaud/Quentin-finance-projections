import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PropertyTimeline, { TimelineEventEditor } from './PropertyTimeline.jsx'

const property = { id: 'btl-1', name: 'BTL1', postcode: 'G1 1AA', purchaseDate: '2025-02-28', purchasePrice: 235000, gasExpiry: '2026-09-20', latestRemortgage: '2025-02-28', fixedRateMonths: 24 }
const contractors = [{ id: 'c1', name: 'Sam Smith', companyName: 'Smith Gas' }]

describe('PropertyTimeline UI', () => {
  it('renders a compact property selector, upcoming obligations, filters, history and useful actions', () => {
    const html = renderToStaticMarkup(<PropertyTimeline
      property={property}
      properties={[property, { id: 'btl-2', name: 'BTL2', postcode: 'G2 2AA' }]}
      contractors={contractors}
      expenses={[{ id: 'e1', date: '2026-08-20', property: 'BTL1', category: 'Repairs', amount: -185, description: 'Boiler repaired', document: { title: 'Invoice', type: 'Receipt / invoice', contractorId: 'c1', association: { kind: 'property', id: 'btl-1', label: 'BTL1' }, storagePath: 'invoice.pdf' } }]}
      timelineEvents={[{ id: 'm1', propertyId: 'btl-1', kind: 'manual', manualType: 'note', category: 'other', occurredAt: '2026-08-10', title: 'Neighbour reported roof issue' }]}
    />)
    expect(html).toContain('BTL1 timeline')
    expect(html).toContain('Add document')
    expect(html).toContain('Add event')
    expect(html).toContain('Upcoming')
    expect(html).toContain('Gas certificate due')
    expect(html).toContain('History')
    for (const label of ['All', 'Compliance', 'Tenancy', 'Finance', 'Maintenance']) expect(html).toContain(`>${label}<`)
    expect(html).toContain('Boiler repaired')
    expect(html).toContain('Sam Smith')
    expect(html).toContain('Invoice')
    expect(html).toContain('Neighbour reported roof issue')
    expect(html).toContain('Open documents')
  })

  it('renders the deliberately small manual event form with optional cost and contractor', () => {
    const html = renderToStaticMarkup(<TimelineEventEditor
      event={{ id: 'm1', propertyId: 'btl-1', kind: 'manual', manualType: 'maintenance', category: 'maintenance', occurredAt: '2026-09-05', title: 'Repair', details: '', amount: 95, contractorId: 'c1' }}
      contractors={contractors}
      allowDelete
    />)
    expect(html).toContain('Edit event')
    for (const label of ['Maintenance / repair', 'Improvement', 'Inspection / visit', 'Incident', 'General note']) expect(html).toContain(label)
    expect(html).toContain('Cost')
    expect(html).toContain('Contractor')
    expect(html).toContain('Notes')
    expect(html).toContain('Delete')
    expect(html).not.toContain('Rent change')
    expect(html).not.toContain('Mortgage change')
  })
})
