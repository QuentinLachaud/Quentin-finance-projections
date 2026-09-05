import React, { useMemo, useRef, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  KeyRound,
  LockKeyhole,
  Plus,
  Search,
  Trash2,
  UnlockKeyhole,
} from 'lucide-react'
import {
  createCredential,
  filterCredentials,
  moveCredential,
} from './credentials.js'

function IconAction({ label, children, ...props }) {
  return <button type="button" className="credential-icon-action" aria-label={label} title={label} {...props}>
    {children}
  </button>
}

function CredentialRow({
  item,
  revealed,
  copied,
  dragging,
  onChange,
  onReveal,
  onCopy,
  onArchive,
  onDelete,
  onDragStart,
  onDragEnd,
  onDrop,
}) {
  return <article
    className={`credential-row ${dragging ? 'dragging' : ''}`}
    draggable={!item.archived}
    onDragStart={(event) => {
      if (item.archived) return
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', item.id)
      onDragStart(item.id)
    }}
    onDragOver={(event) => {
      if (!item.archived) {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
      }
    }}
    onDrop={(event) => {
      if (item.archived) return
      event.preventDefault()
      onDrop(item.id)
    }}
    onDragEnd={onDragEnd}
  >
    <div className="credential-drag" title={item.archived ? undefined : 'Drag to reorder'} aria-hidden="true">
      <GripVertical size={18} />
    </div>

    <label className="credential-field credential-label-field">
      <span>Label</span>
      <input
        value={item.label}
        placeholder="e.g. Government Gateway ID"
        onChange={(event) => onChange('label', event.target.value)}
      />
    </label>

    <label className="credential-field credential-value-field">
      <span>Value</span>
      <div className="credential-value-input">
        <input
          type={item.sensitive && !revealed ? 'password' : 'text'}
          value={item.value}
          autoComplete="off"
          spellCheck={false}
          placeholder="Enter ID, code, reference or address"
          onChange={(event) => onChange('value', event.target.value)}
        />
        {item.sensitive && <IconAction
          label={revealed ? 'Hide value' : 'Reveal value'}
          onClick={onReveal}
        >
          {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
        </IconAction>}
        <IconAction label={copied ? 'Copied' : 'Copy value'} onClick={onCopy}>
          <Copy size={16} />
        </IconAction>
      </div>
    </label>

    <label className="credential-field credential-notes-field">
      <span>Notes <small>optional</small></span>
      <input
        value={item.notes}
        placeholder="What this is for"
        onChange={(event) => onChange('notes', event.target.value)}
      />
    </label>

    <div className="credential-row-actions">
      <IconAction
        label={item.sensitive ? 'Mark as non-sensitive' : 'Mask as sensitive'}
        onClick={() => onChange('sensitive', !item.sensitive)}
      >
        {item.sensitive ? <LockKeyhole size={16} /> : <UnlockKeyhole size={16} />}
      </IconAction>

      <IconAction
        label={item.archived ? 'Restore item' : 'Archive item'}
        onClick={onArchive}
      >
        {item.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
      </IconAction>

      <IconAction label="Delete permanently" className="credential-icon-action danger" onClick={onDelete}>
        <Trash2 size={16} />
      </IconAction>
    </div>
  </article>
}

export default function CredentialsWorkspace({ credentials = [], onChange }) {
  const [query, setQuery] = useState('')
  const [revealedIds, setRevealedIds] = useState(() => new Set())
  const [copiedId, setCopiedId] = useState('')
  const [draggingId, setDraggingId] = useState('')
  const copiedTimer = useRef(null)

  const active = useMemo(() => filterCredentials(credentials, query, false), [credentials, query])
  const archived = useMemo(() => filterCredentials(credentials, query, true), [credentials, query])
  const activeTotal = credentials.filter((item) => !item.archived).length
  const archivedTotal = credentials.filter((item) => item.archived).length

  const updateItem = (id, key, value) => {
    onChange(credentials.map((item) => item.id === id ? { ...item, [key]: value } : item))
  }

  const addItem = () => onChange([
    ...credentials,
    createCredential(),
  ])

  const toggleReveal = (id) => {
    setRevealedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const copyValue = async (item) => {
    if (!item.value) return
    try {
      await navigator.clipboard.writeText(item.value)
      setCopiedId(item.id)
      window.clearTimeout(copiedTimer.current)
      copiedTimer.current = window.setTimeout(() => setCopiedId(''), 1400)
    } catch {
      setCopiedId('')
    }
  }

  const toggleArchive = (item) => {
    updateItem(item.id, 'archived', !item.archived)
    setRevealedIds((current) => {
      const next = new Set(current)
      next.delete(item.id)
      return next
    })
  }

  const removeItem = (item) => {
    if (!window.confirm(`Permanently delete "${item.label || 'this item'}"? This cannot be undone.`)) return
    onChange(credentials.filter((candidate) => candidate.id !== item.id))
  }

  const dropItem = (targetId) => {
    if (!draggingId || draggingId === targetId) {
      setDraggingId('')
      return
    }
    onChange(moveCredential(credentials, draggingId, targetId))
    setDraggingId('')
  }

  const renderRow = (item) => <CredentialRow
    key={item.id}
    item={item}
    revealed={revealedIds.has(item.id)}
    copied={copiedId === item.id}
    dragging={draggingId === item.id}
    onChange={(key, value) => updateItem(item.id, key, value)}
    onReveal={() => toggleReveal(item.id)}
    onCopy={() => copyValue(item)}
    onArchive={() => toggleArchive(item)}
    onDelete={() => removeItem(item)}
    onDragStart={setDraggingId}
    onDragEnd={() => setDraggingId('')}
    onDrop={dropItem}
  />

  return <div className="credentials-workspace">
    <section className="panel credentials-command-bar">
      <div className="credentials-command-context"><LockKeyhole size={16} /><span>Sensitive values are masked on screen by default.</span></div>
      <button className="primary-button" onClick={addItem}><Plus size={16} /> Add item</button>
    </section>

    <section className="credentials-summary">
      <div><KeyRound size={18} /><span><b>{activeTotal}</b> active {activeTotal === 1 ? 'item' : 'items'}</span></div>
      <div><Archive size={18} /><span><b>{archivedTotal}</b> archived</span></div>
      <label className="credentials-search">
        <Search size={17} />
        <input
          aria-label="Search IDs and credentials"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search labels, values or notes"
        />
      </label>
    </section>

    <section className="credentials-list" aria-label="Active IDs and credentials">
      {active.map(renderRow)}
      {active.length === 0 && <div className="panel credentials-empty">
        <KeyRound size={24} />
        <h3>{query ? 'No matching items' : 'No IDs or credentials yet'}</h3>
        {query && <p>Try another search.</p>}
        {!query && <button className="secondary-button" onClick={addItem}><Plus size={16} /> Add first item</button>}
      </div>}
    </section>

    {archivedTotal > 0 && <details className="panel credentials-archive">
      <summary>
        <span><Archive size={17} /><b>Archived items</b><small>{archivedTotal} stored</small></span>
        <span>Show</span>
      </summary>
      <div className="credentials-archive-list">
        {archived.map(renderRow)}
        {query && archived.length === 0 && <p className="credentials-archive-empty">No archived items match this search.</p>}
      </div>
    </details>}

    <p className="credentials-footnote">
      Stored with your signed-in portfolio data. Masking hides a value on screen; it is not a separate encryption layer.
    </p>
  </div>
}
