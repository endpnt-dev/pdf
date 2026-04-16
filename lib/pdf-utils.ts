/**
 * Parse a page range string into an array of 1-indexed page numbers
 * Examples:
 * - "1-3,5,8-10" -> [1, 2, 3, 5, 8, 9, 10]
 * - "all" -> [1, 2, ..., totalPages]
 */
export function parsePageRange(rangeString: string, totalPages: number): number[] {
  if (rangeString === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages: Set<number> = new Set()
  const ranges = rangeString.split(',')

  for (const range of ranges) {
    const trimmedRange = range.trim()

    if (trimmedRange.includes('-')) {
      // Range like "1-3" or "8-10"
      const [startStr, endStr] = trimmedRange.split('-')
      const start = parseInt(startStr.trim())
      const end = parseInt(endStr.trim())

      if (isNaN(start) || isNaN(end) || start < 1 || end < 1) {
        throw new Error('INVALID_PARAMS')
      }

      if (start > end) {
        throw new Error('INVALID_PARAMS')
      }

      if (start > totalPages || end > totalPages) {
        throw new Error('PAGE_OUT_OF_RANGE')
      }

      for (let i = start; i <= end; i++) {
        pages.add(i)
      }
    } else {
      // Single page like "5"
      const page = parseInt(trimmedRange)

      if (isNaN(page) || page < 1) {
        throw new Error('INVALID_PARAMS')
      }

      if (page > totalPages) {
        throw new Error('PAGE_OUT_OF_RANGE')
      }

      pages.add(page)
    }
  }

  return Array.from(pages).sort((a, b) => a - b)
}

/**
 * Convert 1-indexed page numbers to 0-indexed for pdf-lib
 */
export function toZeroIndexed(pages: number[]): number[] {
  return pages.map(page => page - 1)
}

/**
 * Convert 0-indexed page numbers to 1-indexed for API responses
 */
export function toOneIndexed(pages: number[]): number[] {
  return pages.map(page => page + 1)
}

/**
 * Validate page number is within valid range (1-indexed)
 */
export function validatePageNumber(page: number, totalPages: number): void {
  if (!Number.isInteger(page) || page < 1) {
    throw new Error('INVALID_PARAMS')
  }

  if (page > totalPages) {
    throw new Error('PAGE_OUT_OF_RANGE')
  }
}

/**
 * Validate rotation angle (must be multiple of 90)
 */
export function validateRotation(rotation: number): void {
  if (!Number.isInteger(rotation) || rotation % 90 !== 0) {
    throw new Error('INVALID_PARAMS')
  }
}

/**
 * Validate page order array for reorder endpoint
 */
export function validatePageOrder(order: number[], totalPages: number): void {
  if (!Array.isArray(order) || order.length === 0) {
    throw new Error('INVALID_PARAMS')
  }

  // Check each page number is valid
  for (const page of order) {
    validatePageNumber(page, totalPages)
  }

  // Note: duplicates and missing pages are allowed (not an error)
  // e.g., [1,1,2] duplicates page 1, [1,3] skips page 2 - both valid
}

/**
 * Validate DPI value for rendering
 */
export function validateDpi(dpi: number, maxDpi: number = 300): void {
  if (!Number.isInteger(dpi) || dpi < 72 || dpi > maxDpi) {
    throw new Error('INVALID_PARAMS')
  }
}

/**
 * Validate opacity value (1-100)
 */
export function validateOpacity(opacity: number): void {
  if (!Number.isInteger(opacity) || opacity < 1 || opacity > 100) {
    throw new Error('INVALID_PARAMS')
  }
}

/**
 * Validate font size (must be positive)
 */
export function validateFontSize(fontSize: number): void {
  if (!Number.isInteger(fontSize) || fontSize < 1) {
    throw new Error('INVALID_PARAMS')
  }
}

/**
 * Validate hex color format
 */
export function validateHexColor(color: string): void {
  if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
    throw new Error('INVALID_PARAMS')
  }
}

/**
 * Convert hex color to RGB values (0-1 range for pdf-lib)
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  validateHexColor(hex)

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) {
    throw new Error('INVALID_PARAMS')
  }

  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  }
}

/**
 * Parse watermark position into coordinates
 */
export function parseWatermarkPosition(
  position: string,
  pageWidth: number,
  pageHeight: number,
  textWidth?: number,
  textHeight?: number
): { x: number; y: number; rotation?: number } {
  const w = textWidth || 0
  const h = textHeight || 0

  switch (position) {
    case 'top-left':
      return { x: 20, y: pageHeight - h - 20 }

    case 'top-right':
      return { x: pageWidth - w - 20, y: pageHeight - h - 20 }

    case 'bottom-left':
      return { x: 20, y: 20 }

    case 'bottom-right':
      return { x: pageWidth - w - 20, y: 20 }

    case 'center':
      return { x: (pageWidth - w) / 2, y: (pageHeight - h) / 2 }

    case 'diagonal':
      return {
        x: pageWidth / 2,
        y: pageHeight / 2,
        rotation: -Math.atan2(pageHeight, pageWidth) * (180 / Math.PI)
      }

    default:
      throw new Error('INVALID_PARAMS')
  }
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/**
 * Calculate compression savings percentage
 */
export function calculateSavings(originalSize: number, newSize: number): number {
  if (originalSize === 0) return 0
  return Math.round(((originalSize - newSize) / originalSize) * 100)
}