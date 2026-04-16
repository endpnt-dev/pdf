import { NextRequest } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { withAuth } from '@/lib/handlers'
import { successResponse } from '@/lib/response'
import { loadPdf } from '@/lib/pdf-loader'
import {
  parsePageRange,
  toZeroIndexed,
  validateOpacity,
  validateFontSize,
  validateHexColor,
  hexToRgb,
  parseWatermarkPosition
} from '@/lib/pdf-utils'
import { WatermarkPosition } from '@/lib/config'

export const POST = withAuth(async (request: NextRequest, context) => {
  const { buffer, params } = await loadPdf(request)

  // Parse and validate parameters
  const {
    text,
    watermark_url,
    position = 'center',
    opacity = 30,
    font_size = 48,
    color = '#888888',
    pages = 'all'
  } = params

  // Exactly one of text or watermark_url must be provided
  if ((!text && !watermark_url) || (text && watermark_url)) {
    throw new Error('INVALID_PARAMS')
  }

  // Validate parameters
  validateOpacity(opacity)
  if (text) {
    validateFontSize(font_size)
    validateHexColor(color)
  }

  if (!['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center', 'diagonal'].includes(position)) {
    throw new Error('INVALID_PARAMS')
  }

  // Load PDF
  const pdfDoc = await PDFDocument.load(buffer)
  const pageCount = pdfDoc.getPageCount()
  const originalSizeBytes = buffer.length

  // Parse which pages to watermark
  const pageNumbers = parsePageRange(pages, pageCount)
  const zeroIndexedPages = toZeroIndexed(pageNumbers)

  let watermarkImage: any = null

  // If image watermark, fetch and embed the image
  if (watermark_url) {
    try {
      const imageResponse = await fetch(watermark_url, {
        headers: { 'User-Agent': 'endpnt-pdf/1.0' }
      })

      if (!imageResponse.ok) {
        throw new Error('PDF_FETCH_FAILED')
      }

      const imageBuffer = await imageResponse.arrayBuffer()
      const imageBytes = new Uint8Array(imageBuffer)

      // Detect image type and embed
      const contentType = imageResponse.headers.get('content-type')
      if (contentType?.includes('png')) {
        watermarkImage = await pdfDoc.embedPng(imageBytes)
      } else if (contentType?.includes('jpeg') || contentType?.includes('jpg')) {
        watermarkImage = await pdfDoc.embedJpg(imageBytes)
      } else {
        // Try to detect from URL extension
        if (watermark_url.toLowerCase().includes('.png')) {
          watermarkImage = await pdfDoc.embedPng(imageBytes)
        } else if (watermark_url.toLowerCase().match(/\.(jpg|jpeg)$/i)) {
          watermarkImage = await pdfDoc.embedJpg(imageBytes)
        } else {
          throw new Error('INVALID_PARAMS')
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_PARAMS') {
        throw error
      }
      throw new Error('PDF_FETCH_FAILED')
    }
  }

  // Apply watermark to specified pages
  const pages_modified = []

  for (const pageIndex of zeroIndexedPages) {
    const page = pdfDoc.getPage(pageIndex)
    const { width: pageWidth, height: pageHeight } = page.getSize()

    if (text) {
      // Text watermark
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const textWidth = font.widthOfTextAtSize(text, font_size)
      const textHeight = font_size

      // Calculate position
      const { x, y, rotation } = parseWatermarkPosition(
        position as WatermarkPosition,
        pageWidth,
        pageHeight,
        textWidth,
        textHeight
      )

      // Convert color and opacity
      const { r, g, b } = hexToRgb(color)
      const textColor = rgb(r, g, b)

      // Draw text watermark
      page.drawText(text, {
        x,
        y,
        size: font_size,
        font,
        color: textColor,
        opacity: opacity / 100,
        rotate: rotation ? { angle: rotation } : undefined,
      })

    } else if (watermarkImage) {
      // Image watermark
      const imageDims = watermarkImage.scale(0.5) // Default scale, can be made configurable

      // Calculate position (image dimensions for positioning)
      const { x, y, rotation } = parseWatermarkPosition(
        position as WatermarkPosition,
        pageWidth,
        pageHeight,
        imageDims.width,
        imageDims.height
      )

      // Draw image watermark
      page.drawImage(watermarkImage, {
        x,
        y,
        width: imageDims.width,
        height: imageDims.height,
        opacity: opacity / 100,
        rotate: rotation ? { angle: rotation } : undefined,
      })
    }

    pages_modified.push(pageIndex + 1) // Convert back to 1-indexed
  }

  // Save the watermarked PDF
  const pdfBytes = await pdfDoc.save()
  const base64Pdf = Buffer.from(pdfBytes).toString('base64')

  const responseData = {
    pdf: base64Pdf,
    page_count: pageCount,
    file_size_bytes: pdfBytes.length,
    original_size_bytes: originalSizeBytes,
    watermark_type: text ? 'text' : 'image',
    watermark_content: text || watermark_url,
    position,
    opacity,
    pages_watermarked: pages_modified.length,
    pages_modified: pages_modified,
    ...(text ? { font_size, color } : {})
  }

  return successResponse(responseData, {
    request_id: context.requestId,
    remaining_credits: 999, // Will be set by handler wrapper
  })
})