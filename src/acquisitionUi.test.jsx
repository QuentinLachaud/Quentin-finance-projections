import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AcquisitionCard, AcquisitionEditorModal } from './AcquisitionSimulator.jsx'
import { createAcquisition } from './acquisition.js'
const noop = () => {}

describe('Simplified Acquisition UI', () => {
  it('shows only name, price/rent and funding controls in the review modal', () => {
    const html = renderToStaticMarkup(<AcquisitionEditorModal draft={createAcquisition({ id:'x', name:'BTL3', purchasePrice:180000, expectedMonthlyRent:'', jurisdiction:'scotland' })} mode="create" onChange={noop} onCancel={noop} onConfirm={noop} />)
    expect(html).toContain('Review acquisition'); expect(html).toContain('value="180000"'); expect(html).toContain('placeholder="1,200"'); expect(html).toContain('Funding &amp; purchase costs')
    for (const text of ['Address','Postcode','Bedrooms','EPC','Property type']) expect(html).not.toContain(text)
  })
  it('keeps the card summary to name, price, rent, yield and cash', () => {
    const html = renderToStaticMarkup(<AcquisitionCard acquisition={createAcquisition({ id:'x', name:'BTL3', purchasePrice:200000, expectedMonthlyRent:1200, jurisdiction:'scotland' })} expanded={false} onToggle={noop} onEdit={noop} onRemove={noop} />)
    for (const text of ['BTL3','Price','Rent / mo','Gross yield','7.20%','Cash to deploy']) expect(html).toContain(text)
    for (const text of ['Mortgage advance','Effective loan','Total acquisition cost']) expect(html).not.toContain(text)
  })
  it('shows only completion-cash components when expanded', () => {
    const html = renderToStaticMarkup(<AcquisitionCard acquisition={createAcquisition({ id:'x', name:'BTL3', purchasePrice:200000, expectedMonthlyRent:1200, jurisdiction:'scotland', mortgageFee:1200, mortgageFeeAddedToLoan:false })} expanded onToggle={noop} onEdit={noop} onRemove={noop} />)
    for (const text of ['Deposit','LBTT','ADS','Legal fees','Mortgage fee paid now']) expect(html).toContain(text)
    for (const text of ['Purchase tax regime','Solicitor / legal fees','Expected gross yield']) expect(html).not.toContain(text)
  })
})
