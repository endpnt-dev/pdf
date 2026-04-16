import { NextRequest } from 'next/server'
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib'
import { withAuth } from '@/lib/handlers'
import { successResponse } from '@/lib/response'
import { loadPdf } from '@/lib/pdf-loader'

export const POST = withAuth(async (request: NextRequest, context) => {
  const { buffer, params } = await loadPdf(request)

  // Parse and validate parameters
  const {
    user_password,
    owner_password,
    permissions = {}
  } = params

  if (!user_password) {
    throw new Error('INVALID_PARAMS')
  }

  if (typeof user_password !== 'string' || user_password.length === 0) {
    throw new Error('INVALID_PARAMS')
  }

  // Default permissions (restrictive by default)
  const defaultPermissions = {
    print: true,
    copy: false,
    modify: false,
    annotate: false,
    fill_forms: true,
    extract_text: true,
    assemble: false,
    print_high_quality: true
  }

  const finalPermissions = { ...defaultPermissions, ...permissions }

  // Validate permissions values
  for (const [key, value] of Object.entries(finalPermissions)) {
    if (typeof value !== 'boolean') {
      throw new Error('INVALID_PARAMS')
    }
  }

  // Use user_password as owner_password if not provided
  const finalOwnerPassword = owner_password || user_password

  // Load PDF
  const pdfDoc = await PDFDocument.load(buffer)
  const pageCount = pdfDoc.getPageCount()
  const originalSizeBytes = buffer.length

  // Encrypt the PDF
  try {
    await pdfDoc.encrypt({
      userPassword: user_password,
      ownerPassword: finalOwnerPassword,
      permissions: {
        printing: finalPermissions.print ? 'highQuality' : 'none',
        modifying: finalPermissions.modify,
        copying: finalPermissions.copy,
        annotating: finalPermissions.annotate,
        fillingForms: finalPermissions.fill_forms,
        contentExtraction: finalPermissions.extract_text,
        documentAssembly: finalPermissions.assemble,
      }
    })
  } catch (error) {
    console.error('PDF encryption failed:', error)
    throw new Error('PROCESSING_FAILED')
  }

  // Save the encrypted PDF
  const pdfBytes = await pdfDoc.save()
  const base64Pdf = Buffer.from(pdfBytes).toString('base64')

  const responseData = {
    pdf: base64Pdf,
    page_count: pageCount,
    file_size_bytes: pdfBytes.length,
    original_size_bytes: originalSizeBytes,
    encryption_applied: true,
    has_user_password: true,
    has_owner_password: !!owner_password,
    permissions: finalPermissions,
    security_note: 'PDF is now encrypted. Store passwords securely.'
  }

  return successResponse(responseData, {
    request_id: context.requestId,
    remaining_credits: 999, // Will be set by handler wrapper
  })
})