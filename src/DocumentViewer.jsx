import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Download, ExternalLink, FileImage, FileText, LoaderCircle, Minus, Pencil, Plus, X } from 'lucide-react'
import { createStoredDocumentUrl } from './documentStorage.js'

const textLike = new Set(['text/plain', 'text/csv', 'text/rtf', 'application/rtf'])
const clampZoom = (value) => Math.min(4, Math.max(1, Number(value) || 1))

export const documentPreviewKind = (document = {}) => {
  const mime = String(document.mimeType || '').toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf') return 'pdf'
  if (textLike.has(mime)) return 'text'
  return 'file'
}

export const normalizeRenamedFileName = (nextName, currentName = '') => {
  const currentExtension = String(currentName || '').trim().match(/\.[^.]+$/)?.[0] || ''
  const cleaned = String(nextName ?? '')
    .trim()
    .replace(/[\\/<>:"|?*\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .slice(0, 120)
    .trim()
  if (!cleaned) return ''
  const hasExtension = /\.[^.]+$/.test(cleaned)
  return hasExtension || !currentExtension ? cleaned : `${cleaned}${currentExtension}`
}

const fileSize = (bytes) => {
  const value = Number(bytes || 0)
  if (!value) return ''
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`
  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`
}

const downloadBlob = async (signedUrl, fileName) => {
  const response = await fetch(signedUrl)
  if (!response.ok) throw new Error('Could not download this file.')
  const blob = await response.blob()
  const objectUrl = globalThis.URL.createObjectURL(blob)
  try {
    const link = globalThis.document.createElement('a')
    link.href = objectUrl
    link.download = fileName || 'document'
    link.style.display = 'none'
    globalThis.document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    globalThis.URL.revokeObjectURL(objectUrl)
  }
}

function PdfCanvasPreview({ signedUrl, zoom, onError }) {
  const hostRef = useRef(null)
  const renderVersion = useRef(0)

  useEffect(() => {
    const host = hostRef.current
    if (!host || !signedUrl) return undefined
    const version = ++renderVersion.current
    let loadingTask = null
    let pdfDocument = null
    let cancelled = false

    const renderPdf = async () => {
      host.replaceChildren()
      host.setAttribute('aria-busy', 'true')
      try {
        const response = await fetch(signedUrl)
        if (!response.ok) throw new Error('Could not load this PDF.')
        const bytes = new Uint8Array(await response.arrayBuffer())
        const [pdfjs, workerModule] = await Promise.all([
          import('pdfjs-dist'),
          import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
        ])
        if (cancelled || version !== renderVersion.current) return
        pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default
        loadingTask = pdfjs.getDocument({ data: bytes })
        pdfDocument = await loadingTask.promise

        for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
          if (cancelled || version !== renderVersion.current) return
          const page = await pdfDocument.getPage(pageNumber)
          const baseViewport = page.getViewport({ scale: 1 })
          const availableWidth = Math.max(280, host.clientWidth - 24)
          const cssScale = (availableWidth / baseViewport.width) * zoom
          const pixelRatio = Math.min(globalThis.devicePixelRatio || 1, 2)
          const renderScale = cssScale * pixelRatio
          const renderViewport = page.getViewport({ scale: renderScale })
          const canvas = globalThis.document.createElement('canvas')
          canvas.width = Math.max(1, Math.floor(renderViewport.width))
          canvas.height = Math.max(1, Math.floor(renderViewport.height))
          canvas.style.width = `${Math.max(1, Math.floor(baseViewport.width * cssScale))}px`
          canvas.style.height = `${Math.max(1, Math.floor(baseViewport.height * cssScale))}px`
          canvas.setAttribute('aria-label', `PDF page ${pageNumber} of ${pdfDocument.numPages}`)
          const pageShell = globalThis.document.createElement('div')
          pageShell.className = 'document-viewer-pdf-page'
          pageShell.appendChild(canvas)
          host.appendChild(pageShell)
          const context = canvas.getContext('2d', { alpha: false })
          await page.render({ canvasContext: context, viewport: renderViewport }).promise
          page.cleanup()
        }
        if (!cancelled && version === renderVersion.current) host.setAttribute('aria-busy', 'false')
      } catch (pdfError) {
        if (!cancelled && version === renderVersion.current) {
          host.setAttribute('aria-busy', 'false')
          onError(pdfError?.message || 'Could not display this PDF.')
        }
      }
    }

    renderPdf()
    return () => {
      cancelled = true
      renderVersion.current += 1
      try { loadingTask?.destroy?.() } catch {}
      try { pdfDocument?.destroy?.() } catch {}
    }
  }, [signedUrl, zoom, onError])

  return <div ref={hostRef} className="document-viewer-pdf-pages" aria-label="PDF preview" />
}

export default function DocumentViewer({ document: documentMeta, onClose, onRename }) {
  const [signedUrl, setSignedUrl] = useState('')
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const [zoom, setZoom] = useState(1)
  const [renaming, setRenaming] = useState(false)
  const [renameDraft, setRenameDraft] = useState(documentMeta?.fileName || documentMeta?.title || '')
  const [renameError, setRenameError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const kind = useMemo(() => documentPreviewKind(documentMeta), [documentMeta])
  const title = documentMeta?.fileName || documentMeta?.title || 'Document'
  const detail = [documentMeta?.type, documentMeta?.association?.label, fileSize(documentMeta?.size)].filter(Boolean).join(' · ')
  const zoomable = kind === 'image' || kind === 'pdf'

  useEffect(() => {
    let active = true
    setSignedUrl('')
    setLoadError('')
    setNotice('')
    setZoom(1)
    setRenameDraft(documentMeta?.fileName || documentMeta?.title || '')
    setRenaming(false)
    setRenameError('')
    createStoredDocumentUrl(documentMeta?.storagePath, 900)
      .then((url) => { if (active) setSignedUrl(url) })
      .catch((viewerError) => { if (active) setLoadError(viewerError.message) })
    return () => { active = false }
  }, [documentMeta?.storagePath, documentMeta?.fileName, documentMeta?.title])

  useEffect(() => {
    const page = globalThis.document
    if (!page?.body) return undefined
    const previousOverflow = page.body.style.overflow
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      if (renaming) setRenaming(false)
      else onClose()
    }
    page.body.style.overflow = 'hidden'
    page.addEventListener('keydown', onKeyDown)
    return () => {
      page.body.style.overflow = previousOverflow
      page.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, renaming])

  const changeZoom = (delta) => setZoom((current) => clampZoom(current + delta))
  const resetZoom = () => setZoom(1)
  const handleDownload = async () => {
    if (!signedUrl || downloading) return
    setDownloading(true)
    setNotice('')
    try { await downloadBlob(signedUrl, documentMeta?.fileName || documentMeta?.title || 'document') }
    catch (downloadError) { setNotice(downloadError.message) }
    finally { setDownloading(false) }
  }
  const saveRename = async (event) => {
    event.preventDefault()
    const nextName = normalizeRenamedFileName(renameDraft, documentMeta?.fileName || '')
    if (!nextName) { setRenameError('Enter a file name.'); return }
    setRenameError('')
    try {
      await Promise.resolve(onRename?.(nextName))
      setRenameDraft(nextName)
      setRenaming(false)
    } catch (renameFailure) {
      setRenameError(renameFailure?.message || 'Could not rename this file.')
    }
  }

  return <div className="document-viewer-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={`document-viewer-sheet document-viewer-polished document-viewer-${kind}`} role="dialog" aria-modal="true" aria-labelledby="document-viewer-title">
      <div className="document-viewer-grabber" aria-hidden="true" />
      <header className="document-viewer-header">
        <div className="document-viewer-title">
          <span className="document-viewer-icon">{kind === 'image' ? <FileImage size={19} /> : <FileText size={19} />}</span>
          <span><small>{kind === 'image' ? 'IMAGE' : kind === 'pdf' ? 'PDF' : 'DOCUMENT'}</small><h2 id="document-viewer-title">{title}</h2>{detail && <p>{detail}</p>}</span>
        </div>
        <button type="button" className="document-viewer-close" onClick={onClose} aria-label="Close viewer"><X size={20} /></button>
      </header>

      {renaming && <form className="document-viewer-rename-panel" onSubmit={saveRename}>
        <label htmlFor="document-viewer-rename"><span>File name</span></label>
        <div>
          <input id="document-viewer-rename" autoFocus value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} onFocus={(event) => event.currentTarget.select()} />
          <button type="button" className="document-viewer-rename-cancel" onClick={() => { setRenaming(false); setRenameError('') }}>Cancel</button>
          <button type="submit" className="document-viewer-rename-save"><Check size={16} /> Save</button>
        </div>
        {renameError && <p>{renameError}</p>}
      </form>}

      <div className={`document-viewer-stage ${kind}`}>
        <div
          className={`document-viewer-scroll-region ${kind}${kind === 'image' ? ' document-viewer-image-scroll' : ''}`}
          role="region"
          aria-label="Document preview"
          tabIndex={0}
          onDoubleClick={kind === 'image' ? () => setZoom((current) => current === 1 ? 2 : 1) : undefined}
        >
          {!signedUrl && !loadError && <div className="document-viewer-loading"><LoaderCircle size={26} /><b>Opening…</b></div>}
          {loadError && <div className="document-viewer-error"><FileText size={30} /><b>Couldn’t display this file</b><span>{loadError}</span></div>}
          {signedUrl && kind === 'image' && <img
            src={signedUrl}
            alt={title}
            draggable="false"
            style={zoom === 1 ? undefined : { width: `${Math.round(zoom * 100)}%`, maxWidth: 'none', maxHeight: 'none' }}
          />}
          {signedUrl && kind === 'pdf' && <PdfCanvasPreview signedUrl={signedUrl} zoom={zoom} onError={setLoadError} />}
          {signedUrl && kind === 'text' && <iframe src={signedUrl} title={title} />}
          {signedUrl && kind === 'file' && <div className="document-viewer-file-fallback">
            <span className="document-viewer-file-icon"><FileText size={34} /></span>
            <b>{documentMeta?.fileName || title}</b>
            <p>This file type is best viewed in its native app.</p>
            <a href={signedUrl} target="_blank" rel="noreferrer">Open file <ExternalLink size={16} /></a>
          </div>}
        </div>
      </div>

      {notice && <div className="document-viewer-notice" role="status">{notice}</div>}
      <nav className="document-viewer-toolbar" aria-label="Viewer controls">
        {zoomable && <div className="document-viewer-zoom-controls" aria-label={`${kind === 'pdf' ? 'PDF' : 'Image'} zoom`}>
          <button type="button" onClick={() => changeZoom(-0.25)} disabled={zoom <= 1 || !signedUrl} aria-label="Zoom out"><Minus size={18} /></button>
          <button type="button" className="document-viewer-zoom-value" onClick={resetZoom} disabled={!signedUrl} aria-label="Reset zoom">{Math.round(zoom * 100)}%</button>
          <button type="button" onClick={() => changeZoom(0.25)} disabled={zoom >= 4 || !signedUrl} aria-label="Zoom in"><Plus size={18} /></button>
        </div>}
        <button type="button" onClick={handleDownload} disabled={!signedUrl || downloading} aria-label="Download file"><Download size={18} /><span>{downloading ? 'Downloading…' : 'Download'}</span></button>
        <button type="button" onClick={() => { setRenameDraft(documentMeta?.fileName || documentMeta?.title || ''); setRenaming(true) }} aria-label="Rename file"><Pencil size={18} /><span>Rename</span></button>
      </nav>
    </section>
  </div>
}
