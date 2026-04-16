import { NextRequest } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { withAuth } from '@/lib/handlers'
import { successResponse } from '@/lib/response'
import { loadPdf } from '@/lib/pdf-loader'
import { validatePageOrder, toZeroIndexed } from '@/lib/pdf-utils'

export const POST = withAuth(async (request: NextRequest, context) => {
  const { buffer, params } = await loadPdf(request)

  // Parse and validate parameters
  const { order } = params

  if (!order) {
    throw new Error('INVALID_PARAMS')
  }

  // Load PDF
  const pdfDoc = await PDFDocument.load(buffer)
  const pageCount = pdfDoc.getPageCount()
  const originalSizeBytes = buffer.length

  // Validate page order array
  validatePageOrder(order, pageCount)

  // Create new PDF document
  const newPdfDoc = await PDFDocument.create()

  // Copy pages in the specified order
  for (const pageNumber of order) {
    // Convert to 0-indexed for pdf-lib
    const zeroIndexedPage = pageNumber - 1

    // Copy the page from source to destination
    const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [zeroIndexedPage])
    newPdfDoc.addPage(copiedPage)
  }

  // Copy document metadata
  const originalTitle = pdfDoc.getTitle()
  const originalAuthor = pdfDoc.getAuthor()
  const originalSubject = pdfDoc.getSubject()
  const originalKeywords = pdfDoc.getKeywords()
  const originalCreator = pdfDoc.getCreator()
  const originalProducer = pdfDoc.getProducer()

  if (originalTitle) newPdfDoc.setTitle(originalTitle)
  if (originalAuthor) newPdfDoc.setAuthor(originalAuthor)
  if (originalSubject) newPdfDoc.setSubject(originalSubject)
  if (originalKeywords) newPdfDoc.setKeywords(originalKeywords)
  if (originalCreator) newPdfDoc.setCreator(originalCreator)
  if (originalProducer) newPdfDoc.setProducer(originalProducer)

  // Save the reordered PDF
  const pdfBytes = await newPdfDoc.save()
  const base64Pdf = Buffer.from(pdfBytes).toString('base64')

  const responseData = {
    pdf: base64Pdf,
    page_count: order.length, // New page count matches order length
    original_page_count: pageCount,
    file_size_bytes: pdfBytes.length,
    original_size_bytes: originalSizeBytes,
    page_order: order,
  }

  return successResponse(responseData, {
    request_id: context.requestId,
    remaining_credits: 999, // Will be set by handler wrapper
  })
})