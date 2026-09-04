import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ContractorsWorkspace from './ContractorsWorkspace.jsx'

const properties = [{ id: 'btl-1', name: 'BTL1', postcode: 'G1 1AA' }]
const contractorTags = [{ id: 'boiler', label: 'Boiler', iconKey: 'flame' }]
const contractors = [{
  id: 'c1', firstName: 'Sam', lastName: 'Smith', companyName: 'Smith Gas', phone: '07700 900123',
  email: 'sam@example.com', trade: 'Gas Engineer', tagIds: ['gas', 'boiler'], propertyIds: ['btl-1'],
  lastJobMonth: 8, lastJobYear: 2026, notes: 'Reliable and answers WhatsApp.',
}]

describe('ContractorsWorkspace', () => {
  it('renders a compact useful contractor card with contact, trade, tags, BTL and last-job data', () => {
    const html = renderToStaticMarkup(<ContractorsWorkspace contractors={contractors} contractorTags={contractorTags} properties={properties} onSave={() => {}} onDelete={() => {}} onTagsChange={() => {}} />)
    expect(html).toContain('Sam Smith')
    expect(html).toContain('Smith Gas')
    expect(html).toContain('Gas Engineer')
    expect(html).toContain('GAS')
    expect(html).toContain('Boiler')
    expect(html).toContain('BTL1')
    expect(html).toContain('August 2026')
    expect(html).toContain('tel:07700900123')
    expect(html).toContain('mailto:sam@example.com')
  })

  it('offers BTL/trade/order controls and defaults the order to newest last job first', () => {
    const html = renderToStaticMarkup(<ContractorsWorkspace contractors={contractors} contractorTags={contractorTags} properties={properties} onSave={() => {}} onDelete={() => {}} onTagsChange={() => {}} />)
    expect(html).toContain('Filter contractors by BTL')
    expect(html).toContain('Filter contractors by trade')
    expect(html).toContain('Sort contractors')
    expect(html).toContain('Last job · newest')
  })
})
