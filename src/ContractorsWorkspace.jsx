import React, { useMemo, useState } from 'react'
import {
  Check, ChevronDown, ChevronUp, Droplets, Flame, Hammer, HardHat, KeyRound,
  Mail, Paintbrush, Pencil, Phone, Plug, Plus, ShieldCheck, Trash2, Wrench, Zap,
} from 'lucide-react'
import DeleteConfirmDialog from './DeleteConfirmDialog.jsx'
import ContractorDocumentsSlot from './ContractorDocumentsSlot.jsx'
import {
  COMMON_TRADES, createBlankContractor, contractorDisplayName, filterContractors,
  normalizeContractor, normalizeContractorTags,
} from './contractors.js'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const ICONS = {
  flame: Flame,
  zap: Zap,
  plug: Plug,
  droplets: Droplets,
  wrench: Wrench,
  hammer: Hammer,
  'hard-hat': HardHat,
  paintbrush: Paintbrush,
  'key-round': KeyRound,
  'shield-check': ShieldCheck,
}

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 31 }, (_, index) => currentYear - index)
const phoneHref = (phone) => `tel:${String(phone || '').replace(/[^+\d]/g, '')}`
const monthYearLabel = (contractor) => contractor.lastJobMonth && contractor.lastJobYear
  ? `${MONTHS[contractor.lastJobMonth - 1]} ${contractor.lastJobYear}`
  : 'Not recorded'

function TagChip({ tag, selected = false, onClick = null }) {
  const Icon = ICONS[tag.iconKey] || Wrench
  const className = `contractor-tag-chip${selected ? ' is-selected' : ''}${onClick ? ' is-clickable' : ''}`
  if (!onClick) return <span className={className}><Icon size={13} />{tag.label}</span>
  return <button type="button" className={className} aria-pressed={selected} onClick={onClick}><Icon size={13} />{tag.label}{selected && <span className="contractor-tag-selected-mark" aria-hidden="true"><Check size={10} /></span>}</button>
}

export function ContractorEditor({ contractor, properties, tags, documents = [], onOpenDocuments = null, onSave, onCancel }) {
  const [draft, setDraft] = useState(() => normalizeContractor(contractor, properties, tags))
  const update = (patch) => setDraft((current) => ({ ...current, ...patch }))
  const saveDisabled = !draft.name.trim() || !draft.phone.trim()
  const selectedPropertyNames = properties.filter((property) => draft.propertyIds.includes(String(property.id))).map((property) => property.name || 'BTL')
  const propertySummary = selectedPropertyNames.length === 0 ? 'Select properties' : selectedPropertyNames.length <= 2 ? selectedPropertyNames.join(' · ') : `${selectedPropertyNames.length} properties selected`

  const toggleProperty = (propertyId) => {
    const selected = draft.propertyIds.includes(propertyId)
    update({ propertyIds: selected ? draft.propertyIds.filter((id) => id !== propertyId) : [...draft.propertyIds, propertyId] })
  }

  const toggleTag = (tagId) => {
    const selected = draft.tagIds.includes(tagId)
    update({ tagIds: selected ? draft.tagIds.filter((id) => id !== tagId) : [...draft.tagIds, tagId] })
  }

  return <div className="contractor-editor">
    <div className="contractor-editor-grid">
      <label><span>Name</span><input value={draft.name} onChange={(event) => update({ name: event.target.value })} autoComplete="name" placeholder="e.g. Sam Smith" /></label>
      <label><span>Company <small>optional</small></span><input value={draft.companyName} onChange={(event) => update({ companyName: event.target.value })} autoComplete="organization" placeholder="e.g. Smith Gas Ltd" /></label>

      <label><span>Phone number</span><input type="tel" value={draft.phone} onChange={(event) => update({ phone: event.target.value })} autoComplete="tel" /></label>
      <label><span>Email <small>optional</small></span><input type="email" value={draft.email} onChange={(event) => update({ email: event.target.value })} autoComplete="email" /></label>

      <label className="contractor-editor-span"><span>Trade</span><select value={draft.trade} onChange={(event) => update({ trade: event.target.value })}><option value="">Select trade</option>{COMMON_TRADES.map((trade) => <option key={trade} value={trade}>{trade}</option>)}</select></label>

      <fieldset className="contractor-fieldset contractor-editor-span">
        <legend>Tags</legend>
        <div className="contractor-tag-picker">{tags.map((tag) => <TagChip key={tag.id} tag={tag} selected={draft.tagIds.includes(tag.id)} onClick={() => toggleTag(tag.id)} />)}</div>
      </fieldset>

      <fieldset className="contractor-fieldset contractor-editor-span">
        <legend>Used for properties</legend>
        {properties.length ? <details className="contractor-property-select">
          <summary><span>{propertySummary}</span><ChevronDown size={15} aria-hidden="true" /></summary>
          <div className="contractor-property-select-menu">{properties.map((property) => {
            const propertyId = String(property.id)
            const selected = draft.propertyIds.includes(propertyId)
            return <label key={propertyId} className={selected ? 'is-selected' : ''}>
              <input type="checkbox" checked={selected} onChange={() => toggleProperty(propertyId)} />
              <span><b>{property.name || 'BTL'}</b><small>{property.postcode || property.address || 'Property'}</small></span>
            </label>
          })}</div>
        </details> : <small>No BTLs available yet.</small>}
      </fieldset>

      <fieldset className="contractor-fieldset contractor-editor-span">
        <legend>Last job</legend>
        <div className="contractor-last-job-row">
          <label><span>Month</span><select value={draft.lastJobMonth || ''} onChange={(event) => update({ lastJobMonth: Number(event.target.value) || 0 })}><option value="">Month</option>{MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></label>
          <label><span>Year</span><select value={draft.lastJobYear || ''} onChange={(event) => update({ lastJobYear: Number(event.target.value) || 0 })}><option value="">Year</option>{yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        </div>
      </fieldset>

      <label className="contractor-editor-span"><span>Notes <small>personal</small></span><textarea rows="4" value={draft.notes} onChange={(event) => update({ notes: event.target.value })} placeholder="Reliability, preferred contact method, availability, pricing notes…" /></label>

      <div className="contractor-editor-span">
        <ContractorDocumentsSlot contractorId={draft.id} propertyIds={draft.propertyIds} documents={documents} onOpenDocuments={onOpenDocuments} />
      </div>
    </div>
    <div className="contractor-editor-actions">
      <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
      <button type="button" className="primary-button" disabled={saveDisabled} onClick={() => onSave(draft)}>Save contractor</button>
    </div>
  </div>
}

function ContractorCard({ contractor, propertiesById, tagsById, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const linkedProperties = contractor.propertyIds.map((id) => propertiesById.get(id)).filter(Boolean)
  const selectedTags = contractor.tagIds.map((id) => tagsById.get(id)).filter(Boolean)

  return <article className="contractor-card">
    <div className="contractor-card-head">
      <div className="contractor-card-identity">
        <strong>{contractorDisplayName(contractor)}</strong>
        {contractor.companyName && <small>{contractor.companyName}</small>}
      </div>
      <div className="contractor-card-actions">
        <button type="button" aria-label={`Edit ${contractorDisplayName(contractor)}`} onClick={onEdit}><Pencil size={15} /></button>
        <button type="button" aria-label={`Delete ${contractorDisplayName(contractor)}`} onClick={onDelete}><Trash2 size={15} /></button>
      </div>
    </div>

    <div className="contractor-card-trade">{contractor.trade || 'Trade not set'}</div>
    {selectedTags.length > 0 && <div className="contractor-card-tags">{selectedTags.map((tag) => <TagChip key={tag.id} tag={tag} />)}</div>}

    <div className="contractor-card-contact">
      <a href={phoneHref(contractor.phone)}><Phone size={14} /><span>{contractor.phone || 'No phone'}</span></a>
      {contractor.email && <a href={`mailto:${contractor.email}`}><Mail size={14} /><span>{contractor.email}</span></a>}
    </div>

    <div className="contractor-card-meta">
      <div><small>Properties</small><strong>{linkedProperties.length ? linkedProperties.map((property) => property.name || 'BTL').join(' · ') : 'Unassigned'}</strong></div>
      <div><small>Last job</small><strong>{monthYearLabel(contractor)}</strong></div>
    </div>

    {(contractor.notes || contractor.companyName || contractor.email) && <>
      <button type="button" className="contractor-card-expand" aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {expanded ? 'Less' : 'Details'}
      </button>
      {expanded && <div className="contractor-card-details">{contractor.notes && <p>{contractor.notes}</p>}</div>}
    </>}
  </article>
}

export default function ContractorsWorkspace({ contractors = [], contractorTags = [], properties = [], documents = [], onSave, onDelete, onTagsChange, onOpenDocuments }) {
  const tags = useMemo(() => normalizeContractorTags(contractorTags), [contractorTags])
  const [editor, setEditor] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [tradeFilter, setTradeFilter] = useState('all')
  const [sort, setSort] = useState('last-desc')
  const propertiesById = useMemo(() => new Map(properties.map((property) => [property.id, property])), [properties])
  const tagsById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags])
  const availableTrades = useMemo(() => [...new Set(contractors.map((contractor) => contractor.trade).filter(Boolean))].sort(), [contractors])
  const visible = useMemo(() => filterContractors(contractors, { propertyId: propertyFilter, trade: tradeFilter, sort }), [contractors, propertyFilter, tradeFilter, sort])

  const save = (draft) => {
    onSave(normalizeContractor(draft, properties, tags))
    setEditor(null)
  }

  return <div className="contractors-workspace">
    <div className="contractors-toolbar">
      <div className="contractors-filter-row">
        <label><span>BTL</span><select aria-label="Filter contractors by BTL" value={propertyFilter} onChange={(event) => setPropertyFilter(event.target.value)}><option value="all">All properties</option><option value="unassigned">Unassigned</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name || 'BTL'}</option>)}</select></label>
        <label><span>Trade</span><select aria-label="Filter contractors by trade" value={tradeFilter} onChange={(event) => setTradeFilter(event.target.value)}><option value="all">All trades</option>{availableTrades.map((trade) => <option key={trade} value={trade}>{trade}</option>)}</select></label>
        <label><span>Order</span><select aria-label="Sort contractors" value={sort} onChange={(event) => setSort(event.target.value)}><option value="last-desc">Last job · newest</option><option value="last-asc">Last job · oldest</option><option value="name-asc">Name · A–Z</option></select></label>
      </div>
      <button type="button" className="primary-button" onClick={() => setEditor(createBlankContractor())}><Plus size={15} /> Add contractor</button>
    </div>

    {editor && <ContractorEditor key={editor.id} contractor={editor} properties={properties} tags={tags} documents={documents} onOpenDocuments={onOpenDocuments} onSave={save} onCancel={() => setEditor(null)} />}

    {!contractors.length && !editor && <div className="contractors-empty"><Wrench size={22} /><strong>No contractors yet</strong><p>Add people you use for maintenance, compliance and property work.</p><button type="button" className="primary-button" onClick={() => setEditor(createBlankContractor())}><Plus size={15} /> Add contractor</button></div>}

    {contractors.length > 0 && !visible.length && <div className="contractors-empty is-filtered"><strong>No matching contractors</strong><p>Change the BTL or trade filter to see more contacts.</p></div>}

    {visible.length > 0 && <div className="contractor-card-grid">{visible.map((contractor) => <ContractorCard
      key={contractor.id}
      contractor={contractor}
      propertiesById={propertiesById}
      tagsById={tagsById}
      onEdit={() => setEditor({ ...contractor })}
      onDelete={() => setDeleteTarget(contractor)}
    />)}</div>}

    {deleteTarget && <DeleteConfirmDialog
      title="Delete contractor?"
      message={`${contractorDisplayName(deleteTarget)} will be removed from your contractor list. Future property documents will be owned by the Documents feature, not by this contact.`}
      confirmLabel="Delete contractor"
      onCancel={() => setDeleteTarget(null)}
      onConfirm={() => { onDelete(deleteTarget.id); setDeleteTarget(null) }}
    />}
  </div>
}
