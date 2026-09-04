import { isSupabaseConfigured, supabase } from './supabase.js'

export const DOCUMENT_BUCKET = 'documents'
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024

const safeFileName = (name = 'document') => String(name || 'document')
  .normalize('NFKD')
  .replace(/[^a-zA-Z0-9._-]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^[-.]+|[-.]+$/g, '')
  .slice(0, 120) || 'document'

const allowedMime = (type = '') => type.startsWith('image/') || [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
].includes(type)

export const validateDocumentFile = (file) => {
  if (!file) return 'Choose a file first.'
  if (Number(file.size || 0) > MAX_DOCUMENT_BYTES) return 'Files must be 20 MB or smaller.'
  if (!allowedMime(file.type || '')) return 'Use a PDF, image, Word/Excel document, CSV or text file.'
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
  const path = `${user.id}/${documentId}/${safeFileName(file.name)}`
  const { error } = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || undefined,
    upsert: false,
  })
  if (error) {
    if (/bucket|not found/i.test(error.message || '')) throw new Error('Document storage is not ready yet. Apply the documents storage migration, then try again.')
    throw new Error(error.message || 'Document upload failed.')
  }
  return { storagePath: path, fileName: file.name, mimeType: file.type || '', size: Number(file.size || 0) }
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
