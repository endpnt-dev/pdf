export const API_VERSION = '1.0.0'

export const TIER_LIMITS = {
  free: {
    requests_per_minute: 10,
    requests_per_month: 100
  },
  starter: {
    requests_per_minute: 60,
    requests_per_month: 5000
  },
  pro: {
    requests_per_minute: 300,
    requests_per_month: 25000
  },
  enterprise: {
    requests_per_minute: 1000,
    requests_per_month: 100000
  },
} as const

export const PDF_LIMITS = {
  max_file_size_bytes: 25 * 1024 * 1024, // 25MB
  max_render_dpi: 300,
  max_render_pages: 50,
}

export const WATERMARK_POSITIONS = [
  'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center', 'diagonal'
] as const

export const COMPRESSION_LEVELS = [
  'low', 'medium', 'high'
] as const

export const IMAGE_FORMATS = [
  'png', 'jpeg'
] as const

export const OUTPUT_FORMATS = [
  'base64', 'zip'
] as const

export const ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_API_KEY: 'INVALID_API_KEY',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_PARAMS: 'INVALID_PARAMS',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_PDF: 'INVALID_PDF',
  ENCRYPTED_PDF: 'ENCRYPTED_PDF',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  PAGE_OUT_OF_RANGE: 'PAGE_OUT_OF_RANGE',
  PDF_FETCH_FAILED: 'PDF_FETCH_FAILED',
  UNSUPPORTED_PDF_VERSION: 'UNSUPPORTED_PDF_VERSION',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
} as const

export type WatermarkPosition = typeof WATERMARK_POSITIONS[number]
export type CompressionLevel = typeof COMPRESSION_LEVELS[number]
export type ImageFormat = typeof IMAGE_FORMATS[number]
export type OutputFormat = typeof OUTPUT_FORMATS[number]
export type ApiTier = keyof typeof TIER_LIMITS
export type ErrorCode = keyof typeof ERROR_CODES