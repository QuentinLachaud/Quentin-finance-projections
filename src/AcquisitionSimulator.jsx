import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { acquisitionCosts, acquisitionJurisdictions, createAcquisition, nextAcquisitionName, prependAcquisition, reorderAcquisitions } from './acquisition.js'
import { currency } from './calculations.js'

const numericKeys = new Set(['purchasePrice','expectedMonthlyRent','ltv','adsRate','legalFees','mortgageFee'])
const numericValue = (value) => value === '' ? '' : Number(value)

function InputShell({ label, prefix = '', suffix = '', children }) {
  return <label className="acq-sheet-field"><span>{label}</span><div className="acq-sheet-input">{prefix && <b>{prefix}</b>}{children}{suffix && <em>{suffix}</em>}</div></label>
}

export function AcquisitionEditorModal({ draft, mode, warning = '', onChange, onCancel, onConfirm }) {
  const [closing, setClosing] = useState(false)
  const costs = useMemo(() => acquisitionCosts(draft), [draft])
  const isScotland = draft.jurisdiction === 'scotland'
  const valid = String(draft.name || '').trim() && Number(draft.purchasePrice || 0) > 0
  const closeThen = (callback) => { if (!closing) { setClosing(true); window.setTimeout(callback, 180) } }

  useEffect(() => {
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const keydown = (event) => event.key === 'Escape' && closeThen(onCancel)
    document.addEventListener('keydown', keydown)
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', keydown) }
  }, [onCancel])

  const set = (key) => (event) => {
    const raw = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    onChange(key, numericKeys.has(key) ? numericValue(raw) : raw)
  }

  return <div className={`acq-sheet-layer ${closing ? 'closing' : ''}`} onMouseDown={(event) => event.target === event.currentTarget && closeThen(onCancel)}>
    <form className="acq-sheet" role="dialog" aria-modal="true" aria-labelledby="acq-sheet-title" onSubmit={(event) => { event.preventDefault(); if (valid) closeThen(onConfirm) }}>
      <header className="acq-sheet-header">
        <button type="button" onClick={() => closeThen(onCancel)}>Cancel</button>
        <div><span>{mode === 'edit' ? 'EDIT ACQUISITION' : 'NEW ACQUISITION'}</span><h2 id="acq-sheet-title">{mode === 'edit' ? 'Update acquisition' : 'Review acquisition'}</h2></div>
        <button type="submit" className="confirm" disabled={!valid}>Confirm</button>
      </header>
      <div className="acq-sheet-scroll">
        <section className="acq-sheet-group name"><label><span>Acquisition name</span><input aria-label="Acquisition name" value={draft.name} onChange={set('name')} /></label></section>
        {warning && <p className="acq-sheet-warning">{warning}</p>}
        <section className="acq-sheet-group">
          <header><b>Property assumptions</b><small>Enter the purchase price and expected monthly rent.</small></header>
          <div className="acq-sheet-grid">
            <InputShell label="Purchase price" prefix="£"><input aria-label="Purchase price" type="number" min="0" step="1000" placeholder="200,000" value={draft.purchasePrice} onChange={set('purchasePrice')} /></InputShell>
            <InputShell label="Expected rent per month" prefix="£"><input aria-label="Expected rent per month" type="number" min="0" step="50" placeholder="1,200" value={draft.expectedMonthlyRent} onChange={set('expectedMonthlyRent')} /></InputShell>
          </div>
        </section>
        <section className="acq-sheet-group">
          <header><b>Funding & purchase costs</b><small>Adjust the assumptions used to calculate completion cash.</small></header>
          <div className="acq-sheet-grid funding">
            <label className="acq-sheet-field jurisdiction"><span>Purchase tax regime</span><select aria-label="Purchase tax regime" value={draft.jurisdiction} onChange={set('jurisdiction')}>{acquisitionJurisdictions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
            <InputShell label="LTV" suffix="%"><input aria-label="LTV" type="number" min="0" max="100" step="1" value={draft.ltv} onChange={set('ltv')} /></InputShell>
            {isScotland && <InputShell label="ADS" suffix="%"><input aria-label="ADS" type="number" min="0" step=".1" value={draft.adsRate} onChange={set('adsRate')} /></InputShell>}
            <InputShell label="Solicitor / legal fees" prefix="£"><input aria-label="Solicitor / legal fees" type="number" min="0" step="50" value={draft.legalFees} onChange={set('legalFees')} /></InputShell>
            <InputShell label="Mortgage product fee" prefix="£"><input aria-label="Mortgage product fee" type="number" min="0" step="50" value={draft.mortgageFee} onChange={set('mortgageFee')} /></InputShell>
            <label className="acq-sheet-switch"><span><b>Add mortgage fee to loan</b><small>Turn off to include it in cash required now.</small></span><input aria-label="Add mortgage fee to loan" type="checkbox" checked={Boolean(draft.mortgageFeeAddedToLoan)} onChange={set('mortgageFeeAddedToLoan')} /><i /></label>
          </div>
          <div className="acq-sheet-live"><span>Estimated cash to deploy</span><strong>{currency(costs.cashRequired)}</strong></div>
        </section>
      </div>
    </form>
  </div>
}

export function AcquisitionCard({
  acquisition,
  expanded,
  onToggle,
  onEdit,
  onRemove,
  reorder = {},
}) {
  const costs = useMemo(() => acquisitionCosts(acquisition), [acquisition])
  const yieldLabel = costs.grossYield ? `${(costs.grossYield * 100).toFixed(2)}%` : '—'
  const isScotland = acquisition.jurisdiction === 'scotland'

  return <article
    ref={reorder.ref}
    className={`panel acq-card ${expanded ? 'expanded' : 'collapsed'} ${reorder.dragging ? 'is-dragging' : ''}`}
    style={reorder.style}
  >
    <header className="acq-card-header">
      <button
        type="button"
        className="acq-reorder-handle"
        aria-label={`Reorder ${acquisition.name || 'acquisition'}`}
        title="Drag to reorder"
        onPointerDown={reorder.onPointerDown}
        onPointerMove={reorder.onPointerMove}
        onPointerUp={reorder.onPointerUp}
        onPointerCancel={reorder.onPointerCancel}
        onKeyDown={reorder.onKeyDown}
      >
        <GripVertical size={17} aria-hidden="true" />
      </button>

      <button className="acq-card-main" type="button" aria-expanded={expanded} onClick={onToggle}>
        <div className="acq-card-name">
          <span>POTENTIAL ACQUISITION</span>
          <h2>{acquisition.name || 'Untitled acquisition'}</h2>
        </div>

        <div className="acq-card-metrics" aria-label="Acquisition summary">
          <div className="price">
            <span>Price</span>
            <b>{costs.price ? currency(costs.price) : '—'}</b>
          </div>
          <div className="yield">
            <span>Gross yield</span>
            <b>{yieldLabel}</b>
          </div>
          <div className="cash">
            <span>Cash needed</span>
            <b>{costs.price ? currency(costs.cashRequired) : '—'}</b>
          </div>
        </div>

        <span className="acq-card-chevron" aria-hidden="true">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>

      <div className="acq-card-actions" aria-label="Acquisition actions">
        <div className="acq-card-action-capsule">
          <button
            type="button"
            className="icon-button acq-edit-button"
            aria-label={`Edit ${acquisition.name || 'acquisition'}`}
            title="Edit acquisition"
            onClick={onEdit}
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            className="icon-button acq-delete-button"
            aria-label={`Remove ${acquisition.name || 'acquisition'}`}
            title="Remove acquisition"
            onClick={onRemove}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </header>

    <div className="acq-card-body-shell" aria-hidden={!expanded}>
      <div className="acq-card-body-inner">
        <section className="acq-cash-breakdown">
          <div className="acq-cash-total">
            <span>CASH TO DEPLOY</span>
            <strong>{currency(costs.cashRequired)}</strong>
          </div>
          <dl>
            <div><dt>Deposit</dt><dd>{currency(costs.deposit)}</dd></div>
            {isScotland
              ? <>
                  <div><dt>LBTT</dt><dd>{currency(costs.baseTax)}</dd></div>
                  <div><dt>ADS</dt><dd>{currency(costs.supplement)}</dd></div>
                </>
              : <div><dt>{costs.taxLabel}</dt><dd>{currency(costs.baseTax)}</dd></div>}
            <div><dt>Legal fees</dt><dd>{currency(costs.legalFees)}</dd></div>
            <div><dt>Mortgage fee paid now</dt><dd>{currency(costs.upfrontMortgageFee)}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  </article>
}

export default function AcquisitionSimulator({
  acquisitions,
  onChange,
  defaultJurisdiction = 'england-ni',
  existingPropertyCount = 0,
}) {
  const [expandedId, setExpandedId] = useState('')
  const [editor, setEditor] = useState(null)
  const [dragState, setDragState] = useState(null)
  const acquisitionNodes = useRef(new Map())

  useEffect(() => {
    if (expandedId && !acquisitions.some((item) => item.id === expandedId)) {
      setExpandedId('')
    }
  }, [acquisitions, expandedId])

  const openNew = (values = {}, warning = '') => setEditor({
    mode: 'create',
    warning,
    draft: createAcquisition({
      name: nextAcquisitionName(existingPropertyCount, acquisitions),
      ...values,
      expectedMonthlyRent: '',
    }, values.jurisdiction || defaultJurisdiction),
  })
  const openManual = () => openNew()

  const edit = (item) => setEditor({
    mode: 'edit',
    warning: '',
    draft: createAcquisition({
      ...item,
      name: item.name || nextAcquisitionName(existingPropertyCount, acquisitions),
    }, item.jurisdiction || defaultJurisdiction),
  })

  const updateDraft = (key, value) => setEditor((current) => current
    ? { ...current, draft: { ...current.draft, [key]: value } }
    : current)

  const confirm = () => {
    if (!editor) return
    const confirmed = createAcquisition(editor.draft, editor.draft.jurisdiction || defaultJurisdiction)
    if (editor.mode === 'edit') {
      onChange(acquisitions.map((item) => item.id === confirmed.id ? { ...item, ...confirmed } : item))
    } else {
      onChange(prependAcquisition(acquisitions, confirmed))
    }
    setExpandedId('')
    setEditor(null)
  }

  const remove = (id) => {
    if (!window.confirm('Remove this potential acquisition?')) return
    const next = acquisitions.filter((item) => item.id !== id)
    onChange(next)
    if (expandedId === id) setExpandedId('')
  }

  const moveAcquisition = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= acquisitions.length) return
    onChange(reorderAcquisitions(acquisitions, fromIndex, toIndex))
  }

  const dragShift = (index) => {
    if (!dragState || index === dragState.fromIndex) return 0
    const distance = dragState.height + dragState.gap
    if (dragState.fromIndex < dragState.toIndex && index > dragState.fromIndex && index <= dragState.toIndex) return -distance
    if (dragState.fromIndex > dragState.toIndex && index >= dragState.toIndex && index < dragState.fromIndex) return distance
    return 0
  }

  const beginAcquisitionDrag = (event, acquisition, index) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const node = acquisitionNodes.current.get(acquisition.id)
    if (!node) return

    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)

    const rect = node.getBoundingClientRect()
    const stack = node.parentElement
    const gap = Number.parseFloat(stack ? window.getComputedStyle(stack).rowGap : '12') || 12

    setDragState({
      id: acquisition.id,
      pointerId: event.pointerId,
      fromIndex: index,
      toIndex: index,
      startY: event.clientY,
      currentY: event.clientY,
      height: rect.height,
      gap,
    })
  }

  const updateAcquisitionDrag = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return
    event.preventDefault()

    const pointerY = event.clientY
    let targetIndex = dragState.fromIndex

    for (let index = 0; index < acquisitions.length; index += 1) {
      if (index === dragState.fromIndex) continue
      const node = acquisitionNodes.current.get(acquisitions[index].id)
      if (!node) continue
      const rect = node.getBoundingClientRect()
      const midpoint = rect.top + (rect.height / 2)

      if (index < dragState.fromIndex && pointerY < midpoint) {
        targetIndex = index
        break
      }
      if (index > dragState.fromIndex && pointerY > midpoint) targetIndex = index
    }

    setDragState((current) => current && current.pointerId === event.pointerId
      ? { ...current, currentY: pointerY, toIndex: targetIndex }
      : current)
  }

  const finishAcquisitionDrag = (event, cancelled = false) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.releasePointerCapture?.(event.pointerId)

    const { fromIndex, toIndex } = dragState
    setDragState(null)
    if (!cancelled && fromIndex !== toIndex) {
      onChange(reorderAcquisitions(acquisitions, fromIndex, toIndex))
    }
  }

  return <div className="acquisition-workspace acq-simplified">
    <div className="acq-add-toolbar">
      <button type="button" className="primary-button acq-add-button" onClick={openManual}>
        <Plus size={16} /> Add acquisition
      </button>
    </div>

    {!acquisitions.length
      ? <section className="panel acquisition-empty"><Building2 size={24} /><h2>No potential acquisitions yet</h2><p>Import a listing or create a manual entry above.</p></section>
      : <div className={`acquisition-list acq-list ${dragState ? 'is-reordering' : ''}`}>
          {acquisitions.map((item, index) => {
            const isDragging = dragState?.id === item.id
            const shift = dragShift(index)
            const dragOffset = isDragging ? dragState.currentY - dragState.startY : 0
            return <AcquisitionCard
              key={item.id}
              acquisition={item}
              expanded={expandedId === item.id}
              onToggle={() => setExpandedId((current) => current === item.id ? '' : item.id)}
              onEdit={() => edit(item)}
              onRemove={() => remove(item.id)}
              reorder={{
                dragging: isDragging,
                style: {
                  '--acq-reorder-y': `${isDragging ? dragOffset : shift}px`,
                  '--acq-reorder-scale': isDragging ? '1.018' : '1',
                },
                ref: (node) => {
                  if (node) acquisitionNodes.current.set(item.id, node)
                  else acquisitionNodes.current.delete(item.id)
                },
                onPointerDown: (event) => beginAcquisitionDrag(event, item, index),
                onPointerMove: updateAcquisitionDrag,
                onPointerUp: (event) => finishAcquisitionDrag(event),
                onPointerCancel: (event) => finishAcquisitionDrag(event, true),
                onKeyDown: (event) => {
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    moveAcquisition(index, index - 1)
                  }
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    moveAcquisition(index, index + 1)
                  }
                },
              }}
            />
          })}
        </div>}

    {editor && <AcquisitionEditorModal draft={editor.draft} mode={editor.mode} warning={editor.warning} onChange={updateDraft} onCancel={() => setEditor(null)} onConfirm={confirm} />}
  </div>
}
