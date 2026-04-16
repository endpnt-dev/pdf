import { NextRequest } from 'next/server';
import { validateApiKey, getApiKeyFromHeaders } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { successResponse, errorResponse, generateRequestId, getErrorMessage } from '@/lib/response';
import { encryptPdf } from '@/lib/qpdf';

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
    let userPassword: string;
    let ownerPassword: string | undefined;
    let permissions: any = {};

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('pdf') as File | null;
      userPassword = formData.get('user_password') as string;
      ownerPassword = formData.get('owner_password') as string || undefined;

      const permissionsParam = formData.get('permissions');
      if (permissionsParam) {
        try {
          permissions = JSON.parse(permissionsParam as string);
        } catch {
          permissions = {};
        }
      }

      if (!file) return errorResponse('INVALID_PARAMS', 'pdf field required', 400, { request_id: requestId });
      if (!userPassword) return errorResponse('INVALID_PARAMS', 'user_password field required', 400, { request_id: requestId });

      pdfBuffer = Buffer.from(await file.arrayBuffer());
    } else {
      const body = await request.json();
      if (!body.pdf_url) return errorResponse('INVALID_PARAMS', 'pdf_url or multipart file required', 400, { request_id: requestId });
      if (!body.user_password) return errorResponse('INVALID_PARAMS', 'user_password field required', 400, { request_id: requestId });

      pdfBuffer = await loadPdfFromUrl(body.pdf_url);
      userPassword = body.user_password;
      ownerPassword = body.owner_password;
      permissions = body.permissions || {};
    }

    if (pdfBuffer.length > 25 * 1024 * 1024) {
      return errorResponse('FILE_TOO_LARGE', getErrorMessage('FILE_TOO_LARGE'), 400, { request_id: requestId });
    }

    // Map permissions to qpdf restrictions format
    const restrictions: any = {};

    if (permissions.print === false) {
      restrictions.print = 'n';
    } else if (permissions.print === true) {
      restrictions.print = 'full';
    }

    if (permissions.modify === false) {
      restrictions.modify = 'none';
    } else if (permissions.modify === true) {
      restrictions.modify = 'all';
    }

    if (permissions.copy === false) {
      restrictions.extract = 'n';
    } else if (permissions.copy === true) {
      restrictions.extract = 'y';
    }

    // Use AES-256 encryption
    restrictions.useAes = 'y';

    // Encrypt the PDF using qpdf
    const encryptedBuffer = await encryptPdf({
      pdfBuffer,
      userPassword,
      ownerPassword,
      keyLength: 256, // AES-256
      restrictions
    });

    return successResponse({
      pdf: encryptedBuffer.toString('base64'),
      file_size_bytes: encryptedBuffer.length,
      original_size_bytes: pdfBuffer.length,
      encryption_applied: true,
      encryption_method: 'AES-256',
      has_user_password: true,
      has_owner_password: !!ownerPassword,
      permissions: permissions,
      security_note: 'PDF is now encrypted with AES-256. Store passwords securely.'
    }, {
      request_id: requestId,
      processing_ms: Date.now() - startTime,
      remaining_credits: rateLimitResult.remaining,
    });

  } catch (error: any) {
    const message = error.message || '';

    if (message.includes('damaged') || message.includes('malformed')) {
      return errorResponse('INVALID_PDF', getErrorMessage('INVALID_PDF'), 400, { request_id: requestId });
    }
    if (message.includes('PDF_FETCH_FAILED')) {
      return errorResponse('PDF_FETCH_FAILED', getErrorMessage('PDF_FETCH_FAILED'), 400, { request_id: requestId });
    }

    console.error('Encrypt error:', message);
    return errorResponse('PROCESSING_FAILED', getErrorMessage('PROCESSING_FAILED'), 500, { request_id: requestId });
  }
}