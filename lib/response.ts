import { NextResponse } from 'next/server'
import { ErrorCode } from './config'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: ErrorCode
    message: string
  }
  meta?: {
    request_id?: string
    processing_ms?: number
    remaining_credits?: number
  }
}

export function successResponse<T>(
  data: T,
  meta?: ApiResponse<T>['meta'],
  status: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      meta,
    },
    { status }
  )
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  status: number = 400,
  meta?: ApiResponse['meta']
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
      },
      meta,
    },
    { status }
  )
}

export function generateRequestId(): string {
  return `req_${Math.random().toString(36).substr(2, 8)}`
}

export function getErrorMessage(code: ErrorCode): string {
  const messages: Record<ErrorCode, string> = {
    AUTH_REQUIRED: 'API key is required. Include x-api-key header.',
    INVALID_API_KEY: 'Invalid API key. Check your credentials.',
    RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please try again later.',
    INVALID_PARAMS: 'Invalid parameters. Check the request format.',
    FILE_TOO_LARGE: 'PDF file is too large. Maximum size is 25MB.',
    INVALID_PDF: 'Invalid PDF file. Please provide a valid PDF document.',
    ENCRYPTED_PDF: 'PDF is encrypted. Use the decrypt endpoint first.',
    INVALID_PASSWORD: 'Invalid password for encrypted PDF.',
    PAGE_OUT_OF_RANGE: 'Requested page number does not exist in the PDF.',
    PDF_FETCH_FAILED: 'Failed to fetch PDF from URL. Check the PDF URL.',
    UNSUPPORTED_PDF_VERSION: 'Unsupported PDF version. Please use a more recent PDF.',
    PROCESSING_FAILED: 'Failed to process PDF. Please try again.',
    INTERNAL_ERROR: 'Internal server error. Please try again later.',
    NOT_IMPLEMENTED: 'This endpoint is not yet implemented.',
    NOT_ENCRYPTED: 'PDF is not encrypted.',
    INVALID_LANGUAGE: 'Invalid or unsupported language code for OCR.',
    PROCESSING_TIMEOUT: 'Processing timed out. Try a smaller file or reduce complexity.',
  }
  return messages[code]
}