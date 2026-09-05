import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, CalendarClock, Check, FileText, Home, Landmark, Pencil, Plus,
  ShieldCheck, Trash2, Users, Wrench, X,
} from 'lucide-react'
import {
  buildPropertyTimeline, createManualTimelineEvent, filterPropertyTimelineHistory,
  MANUAL_EVENT_TYPES, normalizeTimelineEvent, TIMELINE_FILTERS,
} from './propertyTimeline.js'
import { dateOnly } from './notifications.js'

const categoryMeta = {
  compliance: { label: 'Compliance', Icon: ShieldCheck },
  tenancy: { label: 'Tenancy', Icon: Users },
  finance: { label: 'Finance', Icon: Landmark },
  maintenance: { label: 'Maintenance', Icon: Wrench },
  other: { label: 'Property', Icon: Home },
}

const dateObject = (value) => value ? new Date(`${value}T12:00:00`) : null
const dateLabel = (value, options = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  const date = dateObject(value)
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('en-GB', options).format(date) : value
}
const monthLabel = (value) => dateLabel(value, { month: 'long', year: 'numeric' })
const dayLabel = (value) => dateLabel(value, { day: '2-digit' })
const moneyLabel = (value) => {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return ''
  const formatted = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(Math.abs(amount))
  return amount < 0 ? `−${formatted}` : formatted
}
const dueLabel = (days) => {
  if (!Number.isFinite(days)) return ''
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 60) return `${days} days`
  const months = Math.max(2, Math.round(days / 30.44))
  return `${months} months`
}
const contractorLabel = (contractors, id) => {
  const contractor = contractors.find((item) => String(item.id) === String(id))
  return contractor?.name || [contractor?.firstName, contractor?.lastName].filter(Boolean).join(' ') || contractor?.companyName || ''
}
const sourceActionLabel = (event) => {
  if (['document', 'expense'].includes(event.sourceType)) return 'Open documents'
  if (['loan', 'loan-change'].includes(event.sourceType)) return 'Open loan'
  if (event.sourceType === 'tenant') return 'Open tenant'
  if (['property', 'property-change'].includes(event.sourceType)) return 'Edit property'
  return ''
}

const groupHistory = (events) => events.reduce((groups, event) => {
  const key = event.occurredAt.slice(0, 7)
  const existing = groups.find((group) => group.key === key)
  if (existing) existing.events.push(event)
  else groups.push({ key, label: monthLabel(event.occurredAt), events: [event] })
  return groups
}, [])

function TimelineEventRow({ event, contractors, onEdit, onOpenSource }) {
  const meta = categoryMeta[event.category] || categoryMeta.other
  const Icon = meta.Icon
  const contractor = contractorLabel(contractors, event.contractorId)
  const actionLabel = sourceActionLabel(event)
  return <article className={`timeline-event-row ${event.major ? 'major' : ''}`} data-category={event.category}>
    <div className="timeline-event-date"><time dateTime={event.occurredAt}>{dayLabel(event.occurredAt)}</time></div>
    <div className={`timeline-event-marker ${event.category}`} aria-hidden="true"><span><Icon size={14} /></span></div>
    <div className="timeline-event-content">
      <div className="timeline-event-heading">
        <div><span className={`timeline-kind ${event.category}`}>{meta.label}</span><h4>{event.title}</h4></div>
        {event.amount !== '' && event.amount != null && <strong className={Number(event.amount) < 0 ? 'negative' : ''}>{moneyLabel(event.amount)}</strong>}
      </div>
      {event.details && <p>{event.details}</p>}
      <div className="timeline-event-meta">
        {contractor && <span>{contractor}</span>}
        {event.documentTitle && <span><FileText size={12} /> {event.documentTitle}</span>}
      </div>
      {(actionLabel || event.kind === 'manual') && <div className="timeline-event-actions">
        {actionLabel && <button type="button" onClick={() => onOpenSource?.(event)}>{actionLabel}</button>}
        {event.kind === 'manual' && <button type="button" onClick={() => onEdit?.(event)}><Pencil size={12} /> Edit</button>}
      </div>}
    </div>
  </article>
}

export function TimelineEventEditor({ event, contractors = [], allowDelete = false, onSave, onDelete, onCancel }) {
  const [draft, setDraft] = useState(() => ({ ...event }))
  useEffect(() => setDraft({ ...event }), [event?.id])
  useEffect(() => {
    const close = (keyboardEvent) => keyboardEvent.key === 'Escape' && onCancel?.()
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [onCancel])
  const selectedType = MANUAL_EVENT_TYPES.find((item) => item.id === draft.manualType) || MANUAL_EVENT_TYPES[0]
  const updateType = (manualType) => {
    const definition = MANUAL_EVENT_TYPES.find((item) => item.id === manualType) || MANUAL_EVENT_TYPES[0]
    setDraft((current) => ({ ...current, manualType: definition.id, category: definition.category }))
  }
  const save = () => {
    const normalized = normalizeTimelineEvent({ ...draft, kind: 'manual', category: selectedType.category })
    if (normalized) onSave?.(normalized)
  }
  const remove = () => {
    if (!allowDelete) return
    if (window.confirm(`Delete timeline event “${draft.title}”?`)) onDelete?.(draft.id)
  }
  return <div className="timeline-editor-layer" onMouseDown={(mouseEvent) => mouseEvent.target === mouseEvent.currentTarget && onCancel?.()}>
    <section className="timeline-editor" role="dialog" aria-modal="true" aria-labelledby="timeline-editor-title">
      <header><div><h2 id="timeline-editor-title">{allowDelete ? 'Edit event' : 'Add event'}</h2></div><button type="button" className="icon-button" onClick={onCancel} aria-label="Close"><X size={19} /></button></header>
      <div className="timeline-editor-body">
        <label><span>Date</span><input type="date" required max={dateOnly(new Date())} value={draft.occurredAt || ''} onChange={(e) => setDraft((current) => ({ ...current, occurredAt: e.target.value }))} /></label>
        <label><span>Type</span><select value={draft.manualType || 'maintenance'} onChange={(e) => updateType(e.target.value)}>{MANUAL_EVENT_TYPES.map((type) => <option value={type.id} key={type.id}>{type.label}</option>)}</select></label>
        <label className="timeline-editor-wide"><span>Title</span><input autoFocus type="text" required value={draft.title || ''} onChange={(e) => setDraft((current) => ({ ...current, title: e.target.value }))} placeholder="What happened?" /></label>
        <label><span>Cost <small>Optional</small></span><div className="timeline-cost-input"><i>£</i><input type="number" min="0" step="0.01" value={draft.amount ?? ''} onChange={(e) => setDraft((current) => ({ ...current, amount: e.target.value }))} /></div></label>
        <label><span>Contractor <small>Optional</small></span><select value={draft.contractorId || ''} onChange={(e) => setDraft((current) => ({ ...current, contractorId: e.target.value }))}><option value="">None</option>{contractors.map((contractor) => <option value={contractor.id} key={contractor.id}>{contractor.name || [contractor.firstName, contractor.lastName].filter(Boolean).join(' ') || contractor.companyName || 'Contractor'}</option>)}</select></label>
        <label className="timeline-editor-wide"><span>Notes <small>Optional</small></span><textarea rows={4} value={draft.details || ''} onChange={(e) => setDraft((current) => ({ ...current, details: e.target.value }))} /></label>
      </div>
      <footer>
        {allowDelete ? <button type="button" className="danger-button" onClick={remove}><Trash2 size={15} /> Delete</button> : <span />}
        <span />
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
        <button type="button" className="primary-button" disabled={!draft.title?.trim() || !draft.occurredAt} onClick={save}><Check size={16} /> Save event</button>
      </footer>
    </section>
  </div>
}

export default function PropertyTimeline({
  property,
  properties = [],
  loans = [],
  tenants = [],
  contractors = [],
  expenses = [],
  timelineEvents = [],
  onSelectProperty,
  onSaveEvent,
  onDeleteEvent,
  onAddDocument,
  onOpenSource,
}) {
  const [filter, setFilter] = useState('all')
  const [editor, setEditor] = useState(null)
  useEffect(() => setFilter('all'), [property?.id])
  const timeline = useMemo(() => buildPropertyTimeline({ property, loans, tenants, contractors, expenses, timelineEvents }), [property, loans, tenants, contractors, expenses, timelineEvents])
  const visibleHistory = useMemo(() => filterPropertyTimelineHistory(timeline.history, filter), [timeline.history, filter])
  const grouped = useMemo(() => groupHistory(visibleHistory), [visibleHistory])

  if (!property) return <section className="panel property-timeline-shell"><div className="timeline-empty"><CalendarClock size={22} /><b>No property selected</b></div></section>

  const addEvent = () => setEditor({ event: createManualTimelineEvent(property.id), isNew: true })
  const editEvent = (event) => setEditor({ event, isNew: false })
  const saveEvent = (event) => { onSaveEvent?.(event); setEditor(null) }
  const deleteEvent = (id) => { onDeleteEvent?.(id); setEditor(null) }

  return <>
    <section className="panel property-timeline-shell" aria-label={`${property.name} property timeline`}>
      <div className="timeline-property-switcher" role="tablist" aria-label="Property timeline">
        {properties.map((candidate) => <button type="button" role="tab" aria-selected={candidate.id === property.id} className={candidate.id === property.id ? 'active' : ''} key={candidate.id} onClick={() => onSelectProperty?.(candidate.id)}><b>{candidate.name}</b><small>{candidate.postcode || 'No postcode'}</small></button>)}
      </div>

      <header className="timeline-titlebar">
        <div><h2>{property.name} timeline</h2></div>
        <div>
          <button type="button" className="secondary-button small" onClick={() => onAddDocument?.(property.id)}><FileText size={14} /> Add document</button>
          <button type="button" className="primary-button small" onClick={addEvent}><Plus size={15} /> Add event</button>
        </div>
      </header>

      <section className="timeline-upcoming" aria-labelledby="timeline-upcoming-title">
        <div className="timeline-section-heading"><div><CalendarClock size={16} /><h3 id="timeline-upcoming-title">Upcoming</h3></div>{timeline.upcoming.length > 0 && <small>{timeline.upcoming.length} scheduled</small>}</div>
        {timeline.upcoming.length ? <div className="timeline-upcoming-grid">{timeline.upcoming.map((item) => {
          const meta = categoryMeta[item.category] || categoryMeta.other
          const Icon = meta.Icon
          return <article key={item.id} className={`timeline-upcoming-item ${item.category}`}>
            <span className="timeline-upcoming-icon"><Icon size={15} /></span>
            <div><b>{item.title}</b>{item.details && <small>{item.details}</small>}<time dateTime={item.date}>{dateLabel(item.date)}</time></div>
            <strong>{dueLabel(item.daysUntil)}</strong>
          </article>
        })}</div> : <div className="timeline-upcoming-empty"><Check size={15} /><span>No upcoming dates recorded for this property.</span></div>}
      </section>

      <section className="timeline-history" aria-labelledby="timeline-history-title">
        <div className="timeline-history-toolbar">
          <div className="timeline-section-heading"><div><Home size={16} /><h3 id="timeline-history-title">History</h3></div></div>
          <div className="timeline-filter-chips" role="group" aria-label="Filter timeline history">{TIMELINE_FILTERS.map(([id, label]) => <button type="button" aria-pressed={filter === id} className={filter === id ? 'active' : ''} key={id} onClick={() => setFilter(id)}>{label}</button>)}</div>
        </div>
        {grouped.length ? <div className="timeline-months">{grouped.map((group) => <section className="timeline-month" key={group.key}><h3>{group.label}</h3><div>{group.events.map((event) => <TimelineEventRow key={event.id} event={event} contractors={contractors} onEdit={editEvent} onOpenSource={onOpenSource} />)}</div></section>)}</div> : <div className="timeline-empty"><AlertTriangle size={18} /><b>No events match this filter</b><span>Switch back to All or add a property event.</span></div>}
      </section>
    </section>

    {editor && <TimelineEventEditor event={editor.event} contractors={contractors} allowDelete={!editor.isNew} onSave={saveEvent} onDelete={deleteEvent} onCancel={() => setEditor(null)} />}
  </>
}
