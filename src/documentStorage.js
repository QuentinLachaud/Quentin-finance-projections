import { isSupabaseConfigured, supabase } from './supabase.js'

export const DOCUMENT_BUCKET = 'documents'
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024

export const DOCUMENT_MIME_BY_EXTENSION = Object.freeze({
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.rtf': 'application/rtf',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
})

export const SUPPORTED_DOCUMENT_MIME_TYPES = Object.freeze([
  ...new Set([...Object.values(DOCUMENT_MIME_BY_EXTENSION), 'text/rtf']),
])
const SUPPORTED_DOCUMENT_MIME_SET = new Set(SUPPORTED_DOCUMENT_MIME_TYPES)
const supportedExtensions = Object.keys(DOCUMENT_MIME_BY_EXTENSION)
const imageExtensions = supportedExtensions.filter((extension) => DOCUMENT_MIME_BY_EXTENSION[extension].startsWith('image/'))
export const DOCUMENT_FILE_ACCEPT = supportedExtensions.join(',')
export const DOCUMENT_IMAGE_ACCEPT = [...new Set(imageExtensions.map((extension) => DOCUMENT_MIME_BY_EXTENSION[extension]))].join(',')

const safeFileName = (name = 'document') => String(name || 'document')
  .normalize('NFKD')
  .replace(/[^a-zA-Z0-9._-]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^[-.]+|[-.]+$/g, '')
  .slice(0, 120) || 'document'

const extensionOf = (name = '') => {
  const match = String(name || '').trim().toLowerCase().match(/\.[^.\/]+$/)
  return match?.[0] || ''
}

export const resolveDocumentMimeType = (file) => {
  const supplied = String(file?.type || '').trim().toLowerCase()
  if (SUPPORTED_DOCUMENT_MIME_SET.has(supplied)) return supplied
  const inferred = DOCUMENT_MIME_BY_EXTENSION[extensionOf(file?.name)] || ''
  if (!supplied || supplied === 'application/octet-stream') return inferred
  return ''
}

export const validateDocumentFile = (file) => {
  if (!file) return 'Choose a file first.'
  if (Number(file.size || 0) > MAX_DOCUMENT_BYTES) return 'Files must be 20 MB or smaller.'
  if (!resolveDocumentMimeType(file)) return 'Use a supported PDF, Office/OpenDocument/RTF/text file, or raster image.'
  return ''
}

const currentUser = async () => {
  if (!isSupabaseConfigured || !supabase) throw new Error('Document storage is not configured for this deployment.')
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user?.id) throw new Error('Sign in again before uploading documents.')
  return data.user
}

export const uploadStoredDocument = async (file, documentId) => {
  const validation = validateDocumentFile(file)
  if (validation) throw new Error(validation)
  const user = await currentUser()
  const mimeType = resolveDocumentMimeType(file)
  const path = `${user.id}/${documentId}/${safeFileName(file.name)}`
  const { error } = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: mimeType,
    upsert: false,
  })
  if (error) {
    if (/bucket|not found/i.test(error.message || '')) throw new Error('Document storage is not ready yet. Apply the documents storage migration, then try again.')
    throw new Error(error.message || 'Document upload failed.')
  }
  return { storagePath: path, fileName: file.name, mimeType, size: Number(file.size || 0) }
}

export const openStoredDocument = async (storagePath) => {
  if (!storagePath) throw new Error('This document has no stored file.')
  await currentUser()
  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(storagePath, 600)
  if (error || !data?.signedUrl) throw new Error(error?.message || 'Could not open this document.')
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
}

export const removeStoredDocument = async (storagePath) => {
  if (!storagePath) return
  await currentUser()
  const { error } = await supabase.storage.from(DOCUMENT_BUCKET).remove([storagePath])
  if (error) throw new Error(error.message || 'Could not delete the stored document.')
}
