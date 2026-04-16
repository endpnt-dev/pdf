import { NextRequest } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import pdf from 'pdf-parse'
import { withAuth } from '@/lib/handlers'
import { successResponse } from '@/lib/response'
import { loadPdf } from '@/lib/pdf-loader'

export const POST = withAuth(async (request: NextRequest, context) => {
  const { buffer, params } = await loadPdf(request)

  // Parse and validate parameters
  const { per_page = true, preserve_layout = false } = params

  const originalSizeBytes = buffer.length

  // Get basic PDF info first
  const pdfDoc = await PDFDocument.load(buffer)
  const totalPages = pdfDoc.getPageCount()

  if (per_page) {
    // Extract text per page
    const pagesData = []

    try {
      // Use pdf-parse with page render callback to get text per page
      const options = {
        pagerender: (pageData: any) => {
          // This callback gets called for each page
          let renderOptions: any = {}

          if (preserve_layout) {
            // Attempt to preserve layout by using text item positions
            renderOptions.normalizeWhitespace = false
            renderOptions.disableCombineTextItems = true
          }

          return pageData.getTextContent(renderOptions).then((textContent: any) => {
            let pageText = ''

            if (preserve_layout) {
              // Attempt to preserve layout using item positions
              const items = textContent.items
              let currentY = -1
              let lineText = ''

              for (const item of items) {
                // Start new line if Y position changed significantly
                if (currentY !== -1 && Math.abs(item.transform[5] - currentY) > 5) {
                  if (lineText.trim()) {
                    pageText += lineText.trim() + '\n'
                  }
                  lineText = ''
                }

                lineText += item.str
                currentY = item.transform[5]

                // Add space between items if there's a gap
                const nextItem = items[items.indexOf(item) + 1]
                if (nextItem && (nextItem.transform[4] - (item.transform[4] + item.width)) > 3) {
                  lineText += ' '
                }
              }

              // Add final line
              if (lineText.trim()) {
                pageText += lineText.trim()
              }
            } else {
              // Simple text extraction
              pageText = textContent.items.map((item: any) => item.str).join(' ')
            }

            return pageText
          })
        }
      }

      // Extract text using pdf-parse with custom page rendering
      let pageNumber = 0
      const pageTexts: string[] = []

      // We need to extract page by page manually since pdf-parse doesn't directly support per-page extraction
      for (let i = 1; i <= totalPages; i++) {
        try {
          // Create a single-page PDF for extraction
          const singlePageDoc = await PDFDocument.create()
          const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i - 1])
          singlePageDoc.addPage(copiedPage)
          const singlePageBuffer = await singlePageDoc.save()

          // Extract text from this single page
          const result = await pdf(Buffer.from(singlePageBuffer))
          pageTexts.push(result.text || '')
        } catch (error) {
          // If extraction fails for this page, add empty string
          pageTexts.push('')
        }
      }

      // Format per-page response
      let totalCharacters = 0
      for (let i = 0; i < pageTexts.length; i++) {
        const text = pageTexts[i]
        pagesData.push({
          page: i + 1,
          text: text,
          character_count: text.length
        })
        totalCharacters += text.length
      }

      return successResponse({
        pages: pagesData,
        total_pages: totalPages,
        total_characters: totalCharacters,
        extraction_method: 'per_page',
        preserve_layout: preserve_layout
      }, {
        request_id: context.requestId,
        remaining_credits: 999,
      })

    } catch (error) {
      console.error('Per-page text extraction failed:', error)
      throw new Error('PROCESSING_FAILED')
    }

  } else {
    // Extract all text as one block
    try {
      const result = await pdf(buffer)

      const responseData: {
        text: string;
        total_pages: number;
        total_characters: number;
        extraction_method: string;
        preserve_layout: any;
        metadata: {
          info: any;
          version: any;
          creator: any;
          producer: any;
        };
        note?: string;
      } = {
        text: result.text || '',
        total_pages: totalPages,
        total_characters: (result.text || '').length,
        extraction_method: 'full_document',
        preserve_layout: preserve_layout,
        metadata: {
          info: result.info || {},
          version: result.version || null,
          creator: result.info?.Creator || null,
          producer: result.info?.Producer || null,
        }
      }

      // Add note if text is empty (likely scanned PDF)
      if (!result.text || result.text.trim().length === 0) {
        responseData.note = 'No text found. This may be a scanned PDF. Try the /api/v1/extract/ocr endpoint for scanned documents.'
      }

      return successResponse(responseData, {
        request_id: context.requestId,
        remaining_credits: 999,
      })

    } catch (error) {
      console.error('Text extraction failed:', error)
      throw new Error('PROCESSING_FAILED')
    }
  }
})