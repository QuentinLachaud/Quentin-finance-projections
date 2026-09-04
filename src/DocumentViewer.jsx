import React, { useEffect, useMemo, useState } from 'react'
import { Download, ExternalLink, FileImage, FileText, LoaderCircle, X } from 'lucide-react'
import { createStoredDocumentUrl } from './documentStorage.js'

const textLike = new Set(['text/plain', 'text/csv', 'text/rtf', 'application/rtf'])

export const documentPreviewKind = (document = {}) => {
  const mime = String(document.mimeType || '').toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf') return 'pdf'
  if (textLike.has(mime)) return 'text'
  return 'file'
}

const fileSize = (bytes) => {
  const value = Number(bytes || 0)
  if (!value) return ''
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`
  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`
}

export default function DocumentViewer({ document, onClose }) {
  const [signedUrl, setSignedUrl] = useState('')
  const [error, setError] = useState('')
  const kind = useMemo(() => documentPreviewKind(document), [document])
  const title = document?.title || document?.fileName || 'Document'
  const detail = [document?.type, document?.association?.label, fileSize(document?.size)].filter(Boolean).join(' · ')

  useEffect(() => {
    let active = true
    setSignedUrl('')
    setError('')
    createStoredDocumentUrl(document?.storagePath, 900)
      .then((url) => { if (active) setSignedUrl(url) })
      .catch((viewerError) => { if (active) setError(viewerError.message) })
    return () => { active = false }
  }, [document?.storagePath])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose() }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return <div className="document-viewer-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="document-viewer-sheet" role="dialog" aria-modal="true" aria-labelledby="document-viewer-title">
      <div className="document-viewer-grabber" aria-hidden="true" />
      <header className="document-viewer-header">
        <div className="document-viewer-title">
          <span className="document-viewer-icon">{kind === 'image' ? <FileImage size={19} /> : <FileText size={19} />}</span>
          <span><small>DOCUMENT</small><h2 id="document-viewer-title">{title}</h2>{detail && <p>{detail}</p>}</span>
        </div>
        <div className="document-viewer-actions">
          {signedUrl && <a className="document-viewer-action" href={signedUrl} download={document?.fileName || undefined} aria-label="Download document"><Download size={18} /></a>}
          {signedUrl && <a className="document-viewer-action" href={signedUrl} target="_blank" rel="noreferrer" aria-label="Open original document"><ExternalLink size={18} /></a>}
          <button type="button" className="document-viewer-close" onClick={onClose} aria-label="Close document"><X size={20} /></button>
        </div>
      </header>

      <div className={`document-viewer-stage ${kind}`}>
        {!signedUrl && !error && <div className="document-viewer-loading"><LoaderCircle size={26} /><b>Opening document…</b><span>Securely loading from your account</span></div>}
        {error && <div className="document-viewer-error"><FileText size={30} /><b>Couldn’t open this document</b><span>{error}</span></div>}
        {signedUrl && kind === 'image' && <img src={signedUrl} alt={title} />}
        {signedUrl && ['pdf', 'text'].includes(kind) && <iframe src={signedUrl} title={title} />}
        {signedUrl && kind === 'file' && <div className="document-viewer-file-fallback">
          <span className="document-viewer-file-icon"><FileText size={34} /></span>
          <b>{document?.fileName || title}</b>
          <p>This file type is best viewed in its native app.</p>
          <a href={signedUrl} target="_blank" rel="noreferrer">Open file <ExternalLink size={16} /></a>
        </div>}
      </div>
    </section>
  </div>
}
