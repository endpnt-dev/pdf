import { NextRequest } from 'next/server';
import { validateApiKey, getApiKeyFromHeaders } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { successResponse, errorResponse, generateRequestId, getErrorMessage } from '@/lib/response';
import { decryptPdf, isPdfEncrypted } from '@/lib/qpdf';

async function loadPdfFromUrl(url: string): Promise<Buffer> {
  const response = await fetch(url, { headers: { 'User-Agent': 'endpnt-pdf/1.0' } });
  if (!response.ok) throw new Error('PDF_FETCH_FAILED');
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = generateRequestId();

  try {
    // API Key validation
    const apiKey = getApiKeyFromHeaders(request.headers);
    if (!apiKey) {
      return errorResponse('AUTH_REQUIRED', getErrorMessage('AUTH_REQUIRED'), 401, { request_id: requestId });
    }

    const keyInfo = validateApiKey(apiKey);
    if (!keyInfo) {
      return errorResponse('INVALID_API_KEY', getErrorMessage('INVALID_API_KEY'), 401, { request_id: requestId });
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(apiKey, keyInfo.tier);
    if (!rateLimitResult.allowed) {
      return errorResponse('RATE_LIMIT_EXCEEDED', getErrorMessage('RATE_LIMIT_EXCEEDED'), 429, {
        request_id: requestId,
        remaining_credits: rateLimitResult.remaining
      });
    }

    const contentType = request.headers.get('content-type') || '';
    let pdfBuffer: Buffer;
    let password: string;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('pdf') as File | null;
      password = formData.get('password') as string;

      if (!file) return errorResponse('INVALID_PARAMS', 'pdf field required', 400, { request_id: requestId });
      if (!password) return errorResponse('INVALID_PARAMS', 'password field required', 400, { request_id: requestId });

      pdfBuffer = Buffer.from(await file.arrayBuffer());
    } else {
      const body = await request.json();
      if (!body.pdf_url) return errorResponse('INVALID_PARAMS', 'pdf_url or multipart file required', 400, { request_id: requestId });
      if (!body.password) return errorResponse('INVALID_PARAMS', 'password field required', 400, { request_id: requestId });

      pdfBuffer = await loadPdfFromUrl(body.pdf_url);
      password = body.password;
    }

    if (pdfBuffer.length > 25 * 1024 * 1024) {
      return errorResponse('FILE_TOO_LARGE', getErrorMessage('FILE_TOO_LARGE'), 400, { request_id: requestId });
    }

    // Check if PDF is actually encrypted
    const encrypted = await isPdfEncrypted(pdfBuffer);
    if (!encrypted) {
      return errorResponse('NOT_ENCRYPTED', getErrorMessage('NOT_ENCRYPTED'), 400, { request_id: requestId });
    }

    // Decrypt the PDF using qpdf
    const decryptedBuffer = await decryptPdf({ pdfBuffer, password });

    return successResponse({
      pdf: decryptedBuffer.toString('base64'),
      file_size_bytes: decryptedBuffer.length,
      original_size_bytes: pdfBuffer.length,
      decryption_successful: true,
      is_encrypted: false,
      method: 'qpdf (AES-256)',
      security_note: 'PDF has been decrypted and is now unprotected.',
    }, {
      request_id: requestId,
      processing_ms: Date.now() - startTime,
      remaining_credits: rateLimitResult.remaining,
    });

  } catch (error: any) {
    const message = error.message || '';

    if (message.includes('invalid password') || message.includes('incorrect password') || message.includes('password')) {
      return errorResponse('INVALID_PASSWORD', getErrorMessage('INVALID_PASSWORD'), 400, { request_id: requestId });
    }
    if (message.includes('is not encrypted')) {
      return errorResponse('NOT_ENCRYPTED', getErrorMessage('NOT_ENCRYPTED'), 400, { request_id: requestId });
    }
    if (message.includes('damaged') || message.includes('malformed')) {
      return errorResponse('INVALID_PDF', getErrorMessage('INVALID_PDF'), 400, { request_id: requestId });
    }
    if (message.includes('PDF_FETCH_FAILED')) {
      return errorResponse('PDF_FETCH_FAILED', getErrorMessage('PDF_FETCH_FAILED'), 400, { request_id: requestId });
    }

    console.error('Decrypt error:', message);
    return errorResponse('PROCESSING_FAILED', getErrorMessage('PROCESSING_FAILED'), 500, { request_id: requestId });
  }
}