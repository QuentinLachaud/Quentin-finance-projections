const clean = (value) => String(value ?? '').trim()

export const DOCUMENT_TYPES = [
  'Receipt / invoice',
  'Compliance certificate',
  'Quote',
  'Contract',
  'Statement',
  'Other document',
]

export const titleFromFilename = (name = '') => {
  const base = clean(name).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!base) return 'Untitled document'
  return base.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export const normalizeDocumentMeta = (document) => {
  if (!document || typeof document !== 'object') return null
  const association = document.association && typeof document.association === 'object'
    ? {
        kind: ['property', 'company', 'unassigned'].includes(document.association.kind) ? document.association.kind : 'unassigned',
        id: clean(document.association.id),
        label: clean(document.association.label),
      }
    : { kind: 'unassigned', id: '', label: '' }
  return {
    title: clean(document.title),
    type: DOCUMENT_TYPES.includes(document.type) ? document.type : 'Other document',
    tagIds: Array.isArray(document.tagIds) ? [...new Set(document.tagIds.map(clean).filter(Boolean))] : [],
    contractorId: clean(document.contractorId),
    association,
    storagePath: clean(document.storagePath),
    fileName: clean(document.fileName),
    mimeType: clean(document.mimeType),
    size: Number.isFinite(Number(document.size)) ? Number(document.size) : 0,
  }
}

export const isDocumentEntry = (entry) => Boolean(normalizeDocumentMeta(entry?.document)?.storagePath)
export const documentsForContractor = (entries, contractorId) => (entries || []).filter((entry) => normalizeDocumentMeta(entry?.document)?.contractorId === contractorId)
export const documentAssociationLabel = (document) => {
  const meta = normalizeDocumentMeta(document)
  if (!meta) return 'Unassigned'
  if (meta.association.kind === 'company') return meta.association.label || 'Company'
  if (meta.association.kind === 'property') return meta.association.label || 'BTL'
  return 'Unassigned'
}
