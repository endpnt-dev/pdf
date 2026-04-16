import { NextRequest } from 'next/server';
import { validateApiKey, getApiKeyFromHeaders } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { successResponse, errorResponse, generateRequestId, getErrorMessage } from '@/lib/response';
import { ocrPdf } from '@/lib/ocr';

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
    let languages: string[] = ['eng'];
    let pages: number[] | 'all' = 'all';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('pdf') as File | null;

      if (!file) return errorResponse('INVALID_PARAMS', 'pdf field required', 400, { request_id: requestId });

      pdfBuffer = Buffer.from(await file.arrayBuffer());

      const langsParam = formData.get('languages');
      if (langsParam) {
        languages = String(langsParam).split(',').map(s => s.trim()).filter(Boolean);
      }

      const pagesParam = formData.get('pages');
      if (pagesParam && pagesParam !== 'all') {
        try {
          pages = JSON.parse(pagesParam as string);
        } catch {
          pages = 'all';
        }
      }
    } else {
      const body = await request.json();
      if (!body.pdf_url) return errorResponse('INVALID_PARAMS', 'pdf_url or multipart file required', 400, { request_id: requestId });

      pdfBuffer = await loadPdfFromUrl(body.pdf_url);
      if (body.languages) languages = body.languages;
      if (body.pages) pages = body.pages;
    }

    if (pdfBuffer.length > 25 * 1024 * 1024) {
      return errorResponse('FILE_TOO_LARGE', getErrorMessage('FILE_TOO_LARGE'), 400, { request_id: requestId });
    }

    // Validate languages (allow known Tesseract language codes)
    const validLangs = ['eng', 'spa', 'fra', 'deu', 'ita', 'por', 'rus', 'chi_sim', 'chi_tra', 'jpn', 'kor', 'ara', 'hin'];
    const invalidLang = languages.find(l => !validLangs.includes(l));
    if (invalidLang) {
      return errorResponse('INVALID_LANGUAGE', `Unsupported language: ${invalidLang}. Supported: ${validLangs.join(', ')}`, 400, { request_id: requestId });
    }

    // Perform OCR
    const result = await ocrPdf({ pdfBuffer, languages, pages });

    return successResponse(result, {
      request_id: requestId,
      processing_ms: Date.now() - startTime,
      remaining_credits: rateLimitResult.remaining,
    });

  } catch (error: any) {
    const message = error.message || '';

    if (message.includes('damaged') || message.includes('malformed')) {
      return errorResponse('INVALID_PDF', getErrorMessage('INVALID_PDF'), 400, { request_id: requestId });
    }
    if (message.includes('timeout')) {
      return errorResponse('PROCESSING_TIMEOUT', getErrorMessage('PROCESSING_TIMEOUT'), 504, { request_id: requestId });
    }
    if (message.includes('PDF_FETCH_FAILED')) {
      return errorResponse('PDF_FETCH_FAILED', getErrorMessage('PDF_FETCH_FAILED'), 400, { request_id: requestId });
    }

    console.error('OCR error:', message);
    return errorResponse('PROCESSING_FAILED', getErrorMessage('PROCESSING_FAILED'), 500, { request_id: requestId });
  }
}