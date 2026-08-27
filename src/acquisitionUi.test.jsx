import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import AcquisitionSimulator, { AcquisitionCard, AcquisitionEditorModal } from './AcquisitionSimulator.jsx'
import { createAcquisition, reorderAcquisitions } from './acquisition.js'
const noop = () => {}

describe('Simplified Acquisition UI', () => {
  it('shows only name, price/rent and funding controls in the review modal', () => {
    const html = renderToStaticMarkup(<AcquisitionEditorModal draft={createAcquisition({ id:'x', name:'BTL3', purchasePrice:180000, expectedMonthlyRent:'', jurisdiction:'scotland' })} mode="create" onChange={noop} onCancel={noop} onConfirm={noop} />)
    expect(html).toContain('Review acquisition'); expect(html).toContain('value="180000"'); expect(html).toContain('placeholder="1,200"'); expect(html).toContain('Funding &amp; purchase costs')
    for (const text of ['Address','Postcode','Bedrooms','EPC','Property type']) expect(html).not.toContain(text)
  })
  it('keeps a collapsed card summary to price, gross yield and cash needed only', () => {
    const html = renderToStaticMarkup(<AcquisitionCard acquisition={createAcquisition({ id:'x', name:'BTL3', purchasePrice:200000, expectedMonthlyRent:1200, jurisdiction:'scotland' })} expanded={false} onToggle={noop} onEdit={noop} onRemove={noop} />)
    for (const text of ['BTL3','Price','Gross yield','7.20%','Cash needed']) expect(html).toContain(text)
    expect(html).not.toContain('Rent / mo')
    for (const text of ['Mortgage advance','Effective loan','Total acquisition cost']) expect(html).not.toContain(text)
  })
  it('shows only completion-cash components when expanded', () => {
    const html = renderToStaticMarkup(<AcquisitionCard acquisition={createAcquisition({ id:'x', name:'BTL3', purchasePrice:200000, expectedMonthlyRent:1200, jurisdiction:'scotland', mortgageFee:1200, mortgageFeeAddedToLoan:false })} expanded onToggle={noop} onEdit={noop} onRemove={noop} />)
    for (const text of ['Deposit','LBTT','ADS','Legal fees','Mortgage fee paid now']) expect(html).toContain(text)
    for (const text of ['Purchase tax regime','Solicitor / legal fees','Expected gross yield']) expect(html).not.toContain(text)
  })
})

describe('Acquisition card controls and ordering', () => {
  it('renders native-style edit/delete controls and a reorder handle', () => {
    const html = renderToStaticMarkup(<AcquisitionCard
      acquisition={createAcquisition({ id:'x', name:'BTL3', purchasePrice:200000 })}
      expanded={false}
      onToggle={noop}
      onEdit={noop}
      onRemove={noop}
    />)
    expect(html).toContain('aria-label="Reorder BTL3"')
    expect(html).toContain('aria-label="Edit BTL3"')
    expect(html).toContain('aria-label="Remove BTL3"')
    expect(html).toContain('acq-card-action-capsule')
  })

  it('reorders acquisition cards without mutating the original list', () => {
    const source = [
      createAcquisition({ id:'a', name:'A' }),
      createAcquisition({ id:'b', name:'B' }),
      createAcquisition({ id:'c', name:'C' }),
    ]
    const reordered = reorderAcquisitions(source, 0, 2)
    expect(reordered.map((item) => item.id)).toEqual(['b', 'c', 'a'])
    expect(source.map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('Acquisition card default expansion', () => {
  it('starts with every saved acquisition card collapsed', () => {
    const html = renderToStaticMarkup(<AcquisitionSimulator
      acquisitions={[
        createAcquisition({ id:'one', name:'BTL3', purchasePrice:180000 }),
        createAcquisition({ id:'two', name:'BTL4', purchasePrice:220000 }),
      ]}
      onChange={noop}
      defaultJurisdiction="scotland"
      existingPropertyCount={2}
    />)
    expect(html).not.toContain('aria-expanded="true"')
    expect((html.match(/<button class="acq-card-main"[^>]*aria-expanded="false"/g) || []).length).toBe(2)
  })

  it('keeps cash needed as the emphasized summary metric', () => {
    const html = renderToStaticMarkup(<AcquisitionCard
      acquisition={createAcquisition({ id:'x', name:'BTL3', purchasePrice:200000, expectedMonthlyRent:1200, jurisdiction:'scotland' })}
      expanded={false}
      onToggle={noop}
      onEdit={noop}
      onRemove={noop}
    />)
    expect(html).toContain('class="cash"')
    expect(html).toContain('Cash needed')
    expect(html).toContain('Gross yield')
    expect(html).toContain('Price')
  })
})

describe('Acquisition empty-state runtime safety', () => {
  it('renders the empty Acquisition Simulator without throwing', () => {
    expect(() => renderToStaticMarkup(
      <AcquisitionSimulator
        acquisitions={[]}
        onChange={noop}
        defaultJurisdiction="scotland"
        existingPropertyCount={2}
      />
    )).not.toThrow()

    const html = renderToStaticMarkup(
      <AcquisitionSimulator
        acquisitions={[]}
        onChange={noop}
        defaultJurisdiction="scotland"
        existingPropertyCount={2}
      />
    )
    expect(html).toContain('No potential acquisitions yet')
    expect(html).toContain('Add acquisition')
    expect(html).not.toContain('Import a listing')
  })
})
