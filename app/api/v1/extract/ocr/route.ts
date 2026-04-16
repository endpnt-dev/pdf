import { NextRequest } from 'next/server'
import { errorResponse } from '@/lib/response'
import { generateRequestId } from '@/lib/response'

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()

  return errorResponse(
    'NOT_IMPLEMENTED',
    'OCR is coming in v2. Stay tuned for scanned PDF text extraction.',
    501,
    {
      request_id: requestId,
      planned_release: 'v2.0',
      alternative: 'Use /extract/text for text-based PDFs',
      reason: 'OCR requires Tesseract.js which exceeds Vercel Hobby tier 50MB function limit'
    }
  )
}