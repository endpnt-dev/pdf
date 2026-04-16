import { NextRequest } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import JSZip from 'jszip'
import { withAuth } from '@/lib/handlers'
import { successResponse } from '@/lib/response'
import { loadPdf } from '@/lib/pdf-loader'
import { parsePageRange, toZeroIndexed } from '@/lib/pdf-utils'
import { OutputFormat } from '@/lib/config'

export const POST = withAuth(async (request: NextRequest, context) => {
  const { buffer, params } = await loadPdf(request)

  // Parse and validate parameters
  const { ranges, every_n, output_format = 'base64' } = params

  // Exactly one of ranges or every_n must be provided
  if ((!ranges && !every_n) || (ranges && every_n)) {
    throw new Error('INVALID_PARAMS')
  }

  if (output_format && !['base64', 'zip'].includes(output_format)) {
    throw new Error('INVALID_PARAMS')
  }

  // Load PDF
  const pdfDoc = await PDFDocument.load(buffer)
  const pageCount = pdfDoc.getPageCount()
  const originalSizeBytes = buffer.length

  let splitRanges: number[][]

  if (ranges) {
    // Parse range string like "1-3,5,8-10"
    const pageNumbers = parsePageRange(ranges, pageCount)

    // Group consecutive pages into ranges for efficient splitting
    splitRanges = []
    let currentRange = [pageNumbers[0]]

    for (let i = 1; i < pageNumbers.length; i++) {
      if (pageNumbers[i] === pageNumbers[i - 1] + 1) {
        // Consecutive page, add to current range
        currentRange.push(pageNumbers[i])
      } else {
        // Gap found, start new range
        splitRanges.push(currentRange)
        currentRange = [pageNumbers[i]]
      }
    }

    splitRanges.push(currentRange)
  } else {
    // Split every N pages
    if (!Number.isInteger(every_n) || every_n < 1) {
      throw new Error('INVALID_PARAMS')
    }

    splitRanges = []
    for (let i = 1; i <= pageCount; i += every_n) {
      const rangeEnd = Math.min(i + every_n - 1, pageCount)
      const range = []
      for (let j = i; j <= rangeEnd; j++) {
        range.push(j)
      }
      splitRanges.push(range)
    }
  }

  // Create split PDFs
  const splitPdfs: Array<{
    pdf: string
    page_count: number
    file_size_bytes: number
    page_range: string
  }> = []

  let totalOutputSize = 0

  for (let i = 0; i < splitRanges.length; i++) {
    const pageRange = splitRanges[i]
    const zeroIndexedPages = toZeroIndexed(pageRange)

    // Create new PDF with these pages
    const newPdf = await PDFDocument.create()
    const copiedPages = await newPdf.copyPages(pdfDoc, zeroIndexedPages)
    copiedPages.forEach(page => newPdf.addPage(page))

    // Copy metadata from original
    const originalTitle = pdfDoc.getTitle()
    const originalAuthor = pdfDoc.getAuthor()
    const originalSubject = pdfDoc.getSubject()
    const originalCreator = pdfDoc.getCreator()

    if (originalTitle) newPdf.setTitle(`${originalTitle} (Part ${i + 1})`)
    if (originalAuthor) newPdf.setAuthor(originalAuthor)
    if (originalSubject) newPdf.setSubject(originalSubject)
    if (originalCreator) newPdf.setCreator(originalCreator)

    newPdf.setProducer('endpnt PDF API')

    // Save this split PDF
    const pdfBytes = await newPdf.save()
    totalOutputSize += pdfBytes.length

    const rangeString = pageRange.length === 1
      ? pageRange[0].toString()
      : `${pageRange[0]}-${pageRange[pageRange.length - 1]}`

    splitPdfs.push({
      pdf: Buffer.from(pdfBytes).toString('base64'),
      page_count: pageRange.length,
      file_size_bytes: pdfBytes.length,
      page_range: rangeString,
    })
  }

  // Return format based on output_format parameter
  if (output_format === 'zip') {
    // Create zip file containing all split PDFs
    const zip = new JSZip()

    splitPdfs.forEach((splitPdf, index) => {
      const filename = `split_${index + 1}_pages_${splitPdf.page_range}.pdf`
      const pdfBuffer = Buffer.from(splitPdf.pdf, 'base64')
      zip.file(filename, pdfBuffer)
    })

    const zipBuffer = await zip.generateAsync({ type: 'uint8array' })
    const base64Zip = Buffer.from(zipBuffer).toString('base64')

    return successResponse({
      zip: base64Zip,
      total_pdfs: splitPdfs.length,
      total_pages: pageCount,
      zip_size_bytes: zipBuffer.length,
      original_size_bytes: originalSizeBytes,
      split_summary: splitPdfs.map(pdf => ({
        page_range: pdf.page_range,
        page_count: pdf.page_count,
        file_size_bytes: pdf.file_size_bytes
      }))
    }, {
      request_id: context.requestId,
      remaining_credits: 999,
    })
  } else {
    // Return array of base64 PDFs
    return successResponse({
      pdfs: splitPdfs,
      total_pdfs: splitPdfs.length,
      total_pages: pageCount,
      total_output_size_bytes: totalOutputSize,
      original_size_bytes: originalSizeBytes,
    }, {
      request_id: context.requestId,
      remaining_credits: 999,
    })
  }
})