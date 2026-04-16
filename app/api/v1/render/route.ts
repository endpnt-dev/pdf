import { NextRequest } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import { createCanvas, CanvasRenderingContext2D } from '@napi-rs/canvas'
import { withAuth } from '@/lib/handlers'
import { successResponse } from '@/lib/response'
import { loadPdf } from '@/lib/pdf-loader'
import { parsePageRange, toZeroIndexed, validateDpi } from '@/lib/pdf-utils'
import { PDF_LIMITS } from '@/lib/config'

// Configure pdfjs-dist for serverless environment
pdfjsLib.GlobalWorkerOptions.workerSrc = ''

export const POST = withAuth(async (request: NextRequest, context) => {
  const { buffer, params } = await loadPdf(request)

  // Parse and validate parameters
  const {
    pages = 'all',
    format = 'png',
    dpi = 150
  } = params

  if (!['png', 'jpeg'].includes(format)) {
    throw new Error('INVALID_PARAMS')
  }

  validateDpi(dpi, PDF_LIMITS.max_render_dpi)

  // Load PDF to get page count
  const pdfDoc = await PDFDocument.load(buffer)
  const totalPages = pdfDoc.getPageCount()

  // Parse which pages to render
  const pageNumbers = parsePageRange(pages, totalPages)

  // Check page count limit
  if (pageNumbers.length > PDF_LIMITS.max_render_pages) {
    throw new Error('INVALID_PARAMS')
  }

  const renderedPages = []

  try {
    // Load PDF with pdfjs-dist for rendering
    const loadingTask = pdfjsLib.getDocument({
      data: buffer,
    })

    const pdfDocument = await loadingTask.promise

    // Test canvas creation first (fail fast if @napi-rs/canvas doesn't work)
    try {
      const testCanvas = createCanvas(100, 100)
      const testCtx = testCanvas.getContext('2d')
      if (!testCtx) {
        throw new Error('Canvas context creation failed')
      }
    } catch (canvasError) {
      console.error('Canvas test failed:', canvasError)
      throw new Error('PROCESSING_FAILED')
    }

    // Render each requested page
    for (const pageNum of pageNumbers) {
      try {
        const page = await pdfDocument.getPage(pageNum)
        const viewport = page.getViewport({ scale: dpi / 72 })

        const width = Math.floor(viewport.width)
        const height = Math.floor(viewport.height)

        // Create canvas
        const canvas = createCanvas(width, height)
        const canvasContext = canvas.getContext('2d')

        if (!canvasContext) {
          throw new Error('Failed to create canvas context')
        }

        // Render page to canvas
        const renderContext = {
          canvasContext: canvasContext as any,
          viewport: viewport,
        }

        await page.render(renderContext).promise

        // Convert canvas to image data
        let imageData: Buffer
        if (format === 'png') {
          imageData = canvas.toBuffer('image/png')
        } else {
          imageData = canvas.toBuffer('image/jpeg', { quality: 0.85 })
        }

        const base64Image = imageData.toString('base64')

        renderedPages.push({
          page: pageNum,
          width: width,
          height: height,
          format: format,
          dpi: dpi,
          data: base64Image,
          size_bytes: imageData.length
        })

      } catch (pageError) {
        console.error(`Failed to render page ${pageNum}:`, pageError)

        // Add error entry for this page
        renderedPages.push({
          page: pageNum,
          error: 'Page rendering failed',
          width: 0,
          height: 0,
          format: format,
          dpi: dpi,
          data: null,
          size_bytes: 0
        })
      }
    }

    await pdfDocument.destroy()

  } catch (error) {
    console.error('PDF rendering failed:', error)

    // If canvas completely fails, throw appropriate error
    if (error instanceof Error && error.message.includes('canvas')) {
      throw new Error('PROCESSING_FAILED')
    }

    throw new Error('PROCESSING_FAILED')
  }

  // Calculate total output size
  const totalOutputSize = renderedPages.reduce((sum, page) => sum + (page.size_bytes || 0), 0)
  const successfulPages = renderedPages.filter(page => !page.error)
  const failedPages = renderedPages.filter(page => page.error)

  const responseData = {
    images: renderedPages,
    pages_rendered: successfulPages.length,
    pages_failed: failedPages.length,
    total_pages: totalPages,
    total_output_size_bytes: totalOutputSize,
    render_settings: {
      format: format,
      dpi: dpi,
      pages_requested: pageNumbers.length
    },
    notes: failedPages.length > 0
      ? [`${failedPages.length} pages failed to render. Check individual page results.`]
      : []
  }

  return successResponse(responseData, {
    request_id: context.requestId,
    remaining_credits: 999, // Will be set by handler wrapper
  })
})