import { NextRequest } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { withAuth } from '@/lib/handlers'
import { successResponse } from '@/lib/response'
import { loadPdf } from '@/lib/pdf-loader'

export const POST = withAuth(async (request: NextRequest, context) => {
  // Load PDF with encryption allowed (special case for decrypt endpoint)
  const { buffer, params } = await loadPdf(request, { allowEncrypted: true })

  // Parse and validate parameters
  const { password } = params

  if (!password) {
    throw new Error('INVALID_PARAMS')
  }

  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('INVALID_PARAMS')
  }

  const originalSizeBytes = buffer.length

  // Try to load the PDF with the provided password
  let pdfDoc: PDFDocument
  try {
    pdfDoc = await PDFDocument.load(buffer, {
      password: password,
      ignoreEncryption: false
    })
  } catch (error) {
    if (error instanceof Error) {
      // Check if it's a password error
      if (error.message.includes('password') ||
          error.message.includes('invalid') ||
          error.message.includes('decrypt') ||
          error.message.includes('authentication')) {
        throw new Error('INVALID_PASSWORD')
      }

      // Check if PDF is not actually encrypted
      if (error.message.includes('not encrypted')) {
        // Try loading without password - PDF might not be encrypted
        try {
          pdfDoc = await PDFDocument.load(buffer)
        } catch {
          throw new Error('INVALID_PDF')
        }
      } else {
        throw new Error('PROCESSING_FAILED')
      }
    } else {
      throw new Error('PROCESSING_FAILED')
    }
  }

  const pageCount = pdfDoc.getPageCount()

  // Create a new unencrypted PDF with the same content
  const decryptedDoc = await PDFDocument.create()

  // Copy all pages
  const pageIndices = Array.from({ length: pageCount }, (_, i) => i)
  const copiedPages = await decryptedDoc.copyPages(pdfDoc, pageIndices)
  copiedPages.forEach(page => decryptedDoc.addPage(page))

  // Copy metadata
  const title = pdfDoc.getTitle()
  const author = pdfDoc.getAuthor()
  const subject = pdfDoc.getSubject()
  const keywords = pdfDoc.getKeywords()
  const creator = pdfDoc.getCreator()
  const producer = pdfDoc.getProducer()
  const creationDate = pdfDoc.getCreationDate()
  const modificationDate = pdfDoc.getModificationDate()

  if (title) decryptedDoc.setTitle(title)
  if (author) decryptedDoc.setAuthor(author)
  if (subject) decryptedDoc.setSubject(subject)
  if (keywords) decryptedDoc.setKeywords(keywords)
  if (creator) decryptedDoc.setCreator(creator)
  if (producer) decryptedDoc.setProducer(`${producer || ''} (Decrypted by endpnt PDF API)`.trim())
  if (creationDate) decryptedDoc.setCreationDate(creationDate)
  if (modificationDate) decryptedDoc.setModificationDate(modificationDate)

  // Save the decrypted PDF (without encryption)
  const pdfBytes = await decryptedDoc.save()
  const base64Pdf = Buffer.from(pdfBytes).toString('base64')

  // Verify the output is not encrypted by trying to load it without password
  try {
    await PDFDocument.load(pdfBytes, { ignoreEncryption: false })
  } catch (error) {
    // If it still fails to load without password, something went wrong
    console.error('Decryption verification failed:', error)
    throw new Error('PROCESSING_FAILED')
  }

  const responseData = {
    pdf: base64Pdf,
    page_count: pageCount,
    file_size_bytes: pdfBytes.length,
    original_size_bytes: originalSizeBytes,
    decryption_successful: true,
    is_encrypted: false,
    security_note: 'PDF has been decrypted and is now unprotected.',
    metadata_preserved: {
      title: !!title,
      author: !!author,
      subject: !!subject,
      keywords: !!keywords,
      creator: !!creator,
      dates: !!(creationDate || modificationDate)
    }
  }

  return successResponse(responseData, {
    request_id: context.requestId,
    remaining_credits: 999, // Will be set by handler wrapper
  })
})