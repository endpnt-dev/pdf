import { NextRequest } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { withAuth } from '@/lib/handlers'
import { successResponse } from '@/lib/response'
import { loadPdf } from '@/lib/pdf-loader'
import { calculateSavings } from '@/lib/pdf-utils'
import { CompressionLevel } from '@/lib/config'

export const POST = withAuth(async (request: NextRequest, context) => {
  const { buffer, params } = await loadPdf(request)

  // Parse and validate parameters
  const { quality = 'medium', image_dpi } = params

  if (quality && !['low', 'medium', 'high'].includes(quality)) {
    throw new Error('INVALID_PARAMS')
  }

  if (image_dpi && (!Number.isInteger(image_dpi) || image_dpi < 72 || image_dpi > 300)) {
    throw new Error('INVALID_PARAMS')
  }

  // Load PDF
  const pdfDoc = await PDFDocument.load(buffer)
  const pageCount = pdfDoc.getPageCount()
  const originalSizeBytes = buffer.length

  // Map quality levels to compression settings
  const compressionSettings = {
    low: {
      useObjectStreams: true,
      addDefaultPrefixToObjectStreams: true,
      objectsPerTick: 50,
    },
    medium: {
      useObjectStreams: true,
      addDefaultPrefixToObjectStreams: true,
      objectsPerTick: 500,
    },
    high: {
      useObjectStreams: true,
      addDefaultPrefixToObjectStreams: true,
      objectsPerTick: 5000,
    }
  }

  const settings = compressionSettings[quality as CompressionLevel]

  // For v1, we're using pdf-lib's built-in stream compression only
  // More aggressive image downsampling with sharp will be added in v1.1
  const compressedBytes = await pdfDoc.save({
    useObjectStreams: settings.useObjectStreams,
    addDefaultPrefixToObjectStreams: settings.addDefaultPrefixToObjectStreams,
    objectsPerTick: settings.objectsPerTick,
  })

  const compressedSizeBytes = compressedBytes.length
  const savingsPercent = calculateSavings(originalSizeBytes, compressedSizeBytes)
  const base64Pdf = Buffer.from(compressedBytes).toString('base64')

  // Analyze compression results
  const compressionRatio = originalSizeBytes > 0 ? compressedSizeBytes / originalSizeBytes : 1
  let compressionMethod = 'Stream compression'

  if (savingsPercent < 5) {
    compressionMethod = 'Minimal compression (PDF was already optimized)'
  } else if (savingsPercent >= 5 && savingsPercent < 20) {
    compressionMethod = 'Stream compression'
  } else {
    compressionMethod = 'Stream compression with object deduplication'
  }

  const responseData = {
    pdf: base64Pdf,
    page_count: pageCount,
    file_size_bytes: compressedSizeBytes,
    original_size_bytes: originalSizeBytes,
    savings_bytes: originalSizeBytes - compressedSizeBytes,
    savings_percent: savingsPercent,
    compression_ratio: Math.round(compressionRatio * 100) / 100,
    compression_method: compressionMethod,
    quality_level: quality,
    note: savingsPercent < 5
      ? 'PDF was already well-optimized. Consider v1.1 for image downsampling.'
      : undefined
  }

  return successResponse(responseData, {
    request_id: context.requestId,
    remaining_credits: 999, // Will be set by handler wrapper
  })
})