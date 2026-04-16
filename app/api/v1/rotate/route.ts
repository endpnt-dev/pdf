import { NextRequest } from 'next/server'
import { PDFDocument, degrees } from 'pdf-lib'
import { withAuth } from '@/lib/handlers'
import { successResponse } from '@/lib/response'
import { loadPdf } from '@/lib/pdf-loader'
import { validateRotation, validatePageNumber } from '@/lib/pdf-utils'

export const POST = withAuth(async (request: NextRequest, context) => {
  const { buffer, params } = await loadPdf(request)

  // Parse and validate parameters
  const { rotations, default_rotation } = params

  if (!rotations && default_rotation === undefined) {
    throw new Error('INVALID_PARAMS')
  }

  // Load PDF
  const pdfDoc = await PDFDocument.load(buffer)
  const pageCount = pdfDoc.getPageCount()
  const originalSizeBytes = buffer.length

  // Validate rotations object if provided
  if (rotations) {
    if (typeof rotations !== 'object' || Array.isArray(rotations)) {
      throw new Error('INVALID_PARAMS')
    }

    // Validate each rotation entry
    for (const [pageStr, rotation] of Object.entries(rotations)) {
      const pageNumber = parseInt(pageStr)
      validatePageNumber(pageNumber, pageCount)
      validateRotation(rotation as number)
    }
  }

  // Validate default rotation if provided
  if (default_rotation !== undefined) {
    validateRotation(default_rotation)
  }

  // Apply rotations to pages
  const pages = pdfDoc.getPages()

  for (let i = 0; i < pageCount; i++) {
    const pageNumber = i + 1 // 1-indexed for API
    const page = pages[i]

    let rotationToApply = default_rotation || 0

    // Check if this page has a specific rotation
    if (rotations && rotations[pageNumber.toString()]) {
      rotationToApply = rotations[pageNumber.toString()]
    }

    if (rotationToApply !== 0) {
      page.setRotation(degrees(rotationToApply))
    }
  }

  // Save the modified PDF
  const pdfBytes = await pdfDoc.save()
  const base64Pdf = Buffer.from(pdfBytes).toString('base64')

  const responseData = {
    pdf: base64Pdf,
    page_count: pageCount,
    file_size_bytes: pdfBytes.length,
    original_size_bytes: originalSizeBytes,
    rotations_applied: {
      ...(rotations || {}),
      ...(default_rotation !== undefined ? { default: default_rotation } : {})
    }
  }

  return successResponse(responseData, {
    request_id: context.requestId,
    remaining_credits: 999, // Will be set by handler wrapper
  })
})