import { PDFDocument } from 'pdf-lib'
import { PDF_LIMITS } from './config'

export interface LoadedPdf {
  buffer: Buffer
  params: Record<string, any>
}

export interface LoadedPdfs {
  buffers: Buffer[]
  params: Record<string, any>
}

export interface LoadPdfOptions {
  allowEncrypted?: boolean
}

/**
 * Load a single PDF from either multipart upload or URL
 */
export async function loadPdf(
  request: Request,
  options: LoadPdfOptions = {}
): Promise<LoadedPdf> {
  const contentType = request.headers.get('content-type')

  if (contentType?.includes('multipart/form-data')) {
    return await loadPdfFromMultipart(request, options)
  } else {
    return await loadPdfFromJson(request, options)
  }
}

/**
 * Load multiple PDFs (for merge endpoint)
 */
export async function loadMultiplePdfs(
  request: Request,
  options: LoadPdfOptions = {}
): Promise<LoadedPdfs> {
  const contentType = request.headers.get('content-type')

  if (contentType?.includes('multipart/form-data')) {
    return await loadMultiplePdfsFromMultipart(request, options)
  } else {
    return await loadMultiplePdfsFromJson(request, options)
  }
}

async function loadPdfFromMultipart(
  request: Request,
  options: LoadPdfOptions = {}
): Promise<LoadedPdf> {
  const formData = await request.formData()

  // Extract PDF file
  const pdfFile = formData.get('pdf') as File
  if (!pdfFile) {
    throw new Error('INVALID_PARAMS')
  }

  // Check file size
  if (pdfFile.size > PDF_LIMITS.max_file_size_bytes) {
    throw new Error('FILE_TOO_LARGE')
  }

  if (pdfFile.size === 0) {
    throw new Error('INVALID_PDF')
  }

  // Convert to buffer
  const arrayBuffer = await pdfFile.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Validate PDF
  await validatePdfBuffer(buffer, options)

  // Extract other parameters
  const params: Record<string, any> = {}
  formData.forEach((value, key) => {
    if (key !== 'pdf') {
      // Parse JSON values if they look like JSON
      if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        try {
          params[key] = JSON.parse(value)
        } catch {
          params[key] = value
        }
      } else {
        params[key] = value
      }
    }
  })

  return { buffer, params }
}

async function loadPdfFromJson(
  request: Request,
  options: LoadPdfOptions = {}
): Promise<LoadedPdf> {
  const body = await request.json()

  if (!body.pdf_url) {
    throw new Error('INVALID_PARAMS')
  }

  // Fetch PDF from URL
  const buffer = await fetchPdfFromUrl(body.pdf_url)

  // Validate PDF
  await validatePdfBuffer(buffer, options)

  // Return buffer and all other params
  const { pdf_url, ...params } = body
  return { buffer, params }
}

async function loadMultiplePdfsFromMultipart(
  request: Request,
  options: LoadPdfOptions = {}
): Promise<LoadedPdfs> {
  const formData = await request.formData()

  // Extract all PDF files
  const pdfFiles: File[] = []
  const params: Record<string, any> = {}

  formData.forEach((value, key) => {
    if (key === 'pdf' || key === 'pdfs') {
      if (value instanceof File) {
        pdfFiles.push(value)
      }
    } else {
      // Parse JSON values if they look like JSON
      if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        try {
          params[key] = JSON.parse(value)
        } catch {
          params[key] = value
        }
      } else {
        params[key] = value
      }
    }
  })

  if (pdfFiles.length === 0) {
    throw new Error('INVALID_PARAMS')
  }

  // Convert all to buffers and validate
  const buffers: Buffer[] = []
  for (const pdfFile of pdfFiles) {
    // Check file size
    if (pdfFile.size > PDF_LIMITS.max_file_size_bytes) {
      throw new Error('FILE_TOO_LARGE')
    }

    if (pdfFile.size === 0) {
      throw new Error('INVALID_PDF')
    }

    // Convert to buffer
    const arrayBuffer = await pdfFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Validate PDF
    await validatePdfBuffer(buffer, options)

    buffers.push(buffer)
  }

  return { buffers, params }
}

async function loadMultiplePdfsFromJson(
  request: Request,
  options: LoadPdfOptions = {}
): Promise<LoadedPdfs> {
  const body = await request.json()

  if (!body.pdf_urls || !Array.isArray(body.pdf_urls)) {
    throw new Error('INVALID_PARAMS')
  }

  // Fetch all PDFs from URLs
  const buffers: Buffer[] = []
  for (const url of body.pdf_urls) {
    const buffer = await fetchPdfFromUrl(url)
    await validatePdfBuffer(buffer, options)
    buffers.push(buffer)
  }

  // Return buffers and all other params
  const { pdf_urls, ...params } = body
  return { buffers, params }
}

async function fetchPdfFromUrl(url: string): Promise<Buffer> {
  try {
    // Validate URL format
    new URL(url)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'endpnt-pdf/1.0'
      }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error('PDF_FETCH_FAILED')
    }

    // Check content length
    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > PDF_LIMITS.max_file_size_bytes) {
      throw new Error('FILE_TOO_LARGE')
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Double-check size after download
    if (buffer.length > PDF_LIMITS.max_file_size_bytes) {
      throw new Error('FILE_TOO_LARGE')
    }

    if (buffer.length === 0) {
      throw new Error('INVALID_PDF')
    }

    return buffer
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'FILE_TOO_LARGE' || error.message === 'INVALID_PDF') {
        throw error
      }
      if (error.name === 'AbortError') {
        throw new Error('PDF_FETCH_FAILED')
      }
    }
    throw new Error('PDF_FETCH_FAILED')
  }
}

async function validatePdfBuffer(buffer: Buffer, options: LoadPdfOptions = {}): Promise<void> {
  // Check PDF magic bytes
  if (!buffer.subarray(0, 4).equals(Buffer.from('%PDF'))) {
    throw new Error('INVALID_PDF')
  }

  // Try to load with pdf-lib to validate structure
  try {
    await PDFDocument.load(buffer, {
      ignoreEncryption: options.allowEncrypted || false
    })
  } catch (error) {
    if (error instanceof Error) {
      // Check for encryption errors
      if (error.message.includes('encrypted') && !options.allowEncrypted) {
        throw new Error('ENCRYPTED_PDF')
      }

      // Check for corruption/unsupported version
      if (error.message.includes('version') || error.message.includes('unsupported')) {
        throw new Error('UNSUPPORTED_PDF_VERSION')
      }
    }

    // Generic PDF processing error
    throw new Error('INVALID_PDF')
  }
}