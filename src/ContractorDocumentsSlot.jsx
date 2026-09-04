import React from 'react'
import { FileText, Plus } from 'lucide-react'
import { documentsForContractor, normalizeDocumentMeta } from './documents.js'

export default function ContractorDocumentsSlot({ contractorId, propertyIds = [], documents = [], onOpenDocuments }) {
  const associated = documentsForContractor(documents, contractorId)
  return <section className="contractor-documents-slot" data-contractor-id={contractorId || ''}>
    <div className="contractor-documents-slot-head">
      <div><strong>Associated documents</strong><small>{associated.length ? `${associated.length} linked document${associated.length === 1 ? '' : 's'}` : 'Invoices, receipts and certificates linked to this contractor.'}</small></div>
      <button type="button" className="secondary-button contractor-document-add" onClick={() => onOpenDocuments?.({ contractorId, propertyId: propertyIds[0] || '' })}><Plus size={14} /> Add document</button>
    </div>
    {associated.length > 0 && <div className="contractor-associated-documents">{associated.slice(0, 4).map((entry) => {
      const meta = normalizeDocumentMeta(entry.document)
      return <button type="button" key={entry.id} onClick={() => onOpenDocuments?.({ contractorId, focusEntryId: entry.id })}><FileText size={14} /><span><b>{meta?.title || entry.description || 'Document'}</b><small>{[meta?.type, entry.date].filter(Boolean).join(' · ')}</small></span></button>
    })}</div>}
  </section>
}
