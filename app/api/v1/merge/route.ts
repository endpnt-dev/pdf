import { NextRequest } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { withAuth } from '@/lib/handlers'
import { successResponse } from '@/lib/response'
import { loadMultiplePdfs } from '@/lib/pdf-loader'

export const POST = withAuth(async (request: NextRequest, context) => {
  const { buffers, params } = await loadMultiplePdfs(request)

  if (buffers.length < 1) {
    throw new Error('INVALID_PARAMS')
  }

  // If only one PDF provided, return it unchanged (edge case, but valid)
  if (buffers.length === 1) {
    const base64Pdf = buffers[0].toString('base64')

    // Get page count from the single PDF
    const singlePdf = await PDFDocument.load(buffers[0])
    const pageCount = singlePdf.getPageCount()

    return successResponse({
      pdf: base64Pdf,
      page_count: pageCount,
      file_size_bytes: buffers[0].length,
      original_size_bytes: buffers[0].length,
      pdfs_merged: 1,
    }, {
      request_id: context.requestId,
      remaining_credits: 999,
    })
  }

  // Create new PDF document for merged output
  const mergedPdf = await PDFDocument.create()

  let totalPages = 0
  let totalOriginalSize = 0
  const pdfInfos = []

  // Process each PDF
  for (let i = 0; i < buffers.length; i++) {
    const buffer = buffers[i]
    totalOriginalSize += buffer.length

    try {
      // Load source PDF
      const sourcePdf = await PDFDocument.load(buffer)
      const pageCount = sourcePdf.getPageCount()
      totalPages += pageCount

      // Copy all pages from source to merged PDF
      const pageIndices = Array.from({ length: pageCount }, (_, idx) => idx)
      const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices)

      // Add copied pages to merged document
      copiedPages.forEach(page => mergedPdf.addPage(page))

      pdfInfos.push({
        pdf_index: i + 1,
        pages_copied: pageCount,
        size_bytes: buffer.length,
      })

      // Copy metadata from the first PDF
      if (i === 0) {
        const title = sourcePdf.getTitle()
        const author = sourcePdf.getAuthor()
        const subject = sourcePdf.getSubject()
        const keywords = sourcePdf.getKeywords()
        const creator = sourcePdf.getCreator()

        if (title) mergedPdf.setTitle(title)
        if (author) mergedPdf.setAuthor(author)
        if (subject) mergedPdf.setSubject(subject)
        if (keywords) mergedPdf.setKeywords(Array.isArray(keywords) ? keywords : [keywords])
        if (creator) mergedPdf.setCreator(creator)

        // Set producer to indicate this was created by endpnt
        mergedPdf.setProducer('endpnt PDF API')
      }

    } catch (error) {
      console.error(`Failed to process PDF ${i + 1}:`, error)
      throw new Error('PROCESSING_FAILED')
    }
  }

  // Save the merged PDF
  const pdfBytes = await mergedPdf.save()
  const base64Pdf = Buffer.from(pdfBytes).toString('base64')

  const responseData = {
    pdf: base64Pdf,
    page_count: totalPages,
    file_size_bytes: pdfBytes.length,
    original_size_bytes: totalOriginalSize,
    pdfs_merged: buffers.length,
    merge_details: pdfInfos,
  }

  return successResponse(responseData, {
    request_id: context.requestId,
    remaining_credits: 999, // Will be set by handler wrapper
  })
})