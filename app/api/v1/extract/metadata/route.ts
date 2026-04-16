import { NextRequest } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { withAuth } from '@/lib/handlers'
import { successResponse } from '@/lib/response'
import { loadPdf } from '@/lib/pdf-loader'

export const POST = withAuth(async (request: NextRequest, context) => {
  const { buffer } = await loadPdf(request)

  // Load PDF with pdf-lib
  const pdfDoc = await PDFDocument.load(buffer)

  // Extract metadata
  const pageCount = pdfDoc.getPageCount()
  const title = pdfDoc.getTitle() || null
  const author = pdfDoc.getAuthor() || null
  const subject = pdfDoc.getSubject() || null
  const keywords = pdfDoc.getKeywords() || null
  const creator = pdfDoc.getCreator() || null
  const producer = pdfDoc.getProducer() || null
  const creationDate = pdfDoc.getCreationDate()
  const modificationDate = pdfDoc.getModificationDate()

  // Check if encrypted (this shouldn't happen since loadPdf validates this)
  let isEncrypted = false
  try {
    // Try to load again without ignoring encryption to see if it would fail
    await PDFDocument.load(buffer, { ignoreEncryption: false })
  } catch (error) {
    if (error instanceof Error && error.message.includes('encrypted')) {
      isEncrypted = true
    }
  }

  // Extract PDF version from header
  let pdfVersion = null
  const headerString = buffer.subarray(0, 8).toString('ascii')
  const versionMatch = headerString.match(/%PDF-(\d+\.\d+)/)
  if (versionMatch) {
    pdfVersion = versionMatch[1]
  }

  // Get form information
  const form = pdfDoc.getForm()
  let formFields = 0
  let hasXfaForms = false

  try {
    const fields = form.getFields()
    formFields = fields.length

    // Check for XFA forms (Adobe LiveCycle)
    // XFA forms are indicated by the presence of an XFA entry in the AcroForm
    const catalog = pdfDoc.catalog
    const acroForm = catalog.get('AcroForm' as any)
    if (acroForm && typeof acroForm === 'object' && 'XFA' in acroForm) {
      hasXfaForms = true
    }
  } catch (error) {
    // Form parsing failed, continue without form info
  }

  const responseData = {
    page_count: pageCount,
    file_size_bytes: buffer.length,
    pdf_version: pdfVersion,
    is_encrypted: isEncrypted,
    title,
    author,
    subject,
    keywords,
    creator,
    producer,
    creation_date: creationDate?.toISOString() || null,
    modification_date: modificationDate?.toISOString() || null,
    form_fields_count: formFields,
    has_xfa_forms: hasXfaForms,
  }

  return successResponse(responseData, {
    request_id: context.requestId,
    remaining_credits: 999, // This will be properly set by the handler wrapper
  })
})