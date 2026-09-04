import React, { useState } from 'react'
import { Camera, FileUp, Plus } from 'lucide-react'

/**
 * Presentation-only seam for the future shared Documents feature.
 *
 * Intentionally owns no file inputs, camera APIs, storage, Supabase calls,
 * document metadata, categorisation or persistence. When Documents is built,
 * this component is the single contractor integration point to replace/compose.
 */
export default function ContractorDocumentsSlot({ contractorId, propertyIds = [] }) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const contextReady = Boolean(contractorId && propertyIds.length)

  return <section className="contractor-documents-slot" data-contractor-id={contractorId || ''}>
    <div className="contractor-documents-slot-head">
      <div>
        <strong>Documents</strong>
        <small>{contextReady ? 'Will link through the shared Documents feature.' : 'Link a BTL before adding property documents.'}</small>
      </div>
      <button type="button" className="secondary-button contractor-document-add" onClick={() => setPreviewOpen((open) => !open)}>
        <Plus size={14} /> Add document
      </button>
    </div>
    {previewOpen && <div className="contractor-document-placeholder" role="status">
      <button type="button" disabled><FileUp size={15} /> Upload from files</button>
      <button type="button" disabled className="contractor-document-photo"><Camera size={15} /> Take photo</button>
      <small>Document handling is intentionally not enabled yet. These controls will use the shared Documents module.</small>
    </div>}
  </section>
}
