# endpnt PDF API

The complete PDF processing API with 13 endpoints covering manipulation, security, extraction, and rendering.

🌐 **Live API:** https://pdf.endpnt.dev  
📚 **Documentation:** https://pdf.endpnt.dev/docs  
💰 **Pricing:** https://pdf.endpnt.dev/pricing  

## Features

### Manipulation (6 endpoints)
- **Merge** - Combine multiple PDFs into one document
- **Split** - Split by page ranges or every N pages  
- **Rotate** - Rotate specific pages by 90/180/270 degrees
- **Reorder** - Change page order with custom sequence
- **Watermark** - Add text or image watermarks with positioning
- **Compress** - Reduce file size with stream compression

### Security (2 endpoints)  
- **Encrypt** - Password protect PDFs with permission controls
- **Decrypt** - Remove password protection from encrypted PDFs

### Extraction (5 endpoints)
- **Text** - Extract text content (per-page or full document)
- **Metadata** - Get PDF info, page count, creation date, etc.
- **Images** - Extract embedded images as base64
- **Forms** - Extract AcroForm field data and values
- **OCR** - Scanned PDF text extraction (v2 - coming soon)

### Rendering (1 endpoint)
- **Render** - Convert PDF pages to PNG/JPEG images at any DPI

## Quick Start

```bash
# Health check
curl https://pdf.endpnt.dev/api/v1/health

# Extract PDF metadata  
curl -X POST https://pdf.endpnt.dev/api/v1/extract/metadata \
  -H "x-api-key: YOUR_API_KEY" \
  -F "pdf=@document.pdf"

# Merge two PDFs
curl -X POST https://pdf.endpnt.dev/api/v1/merge \
  -H "x-api-key: YOUR_API_KEY" \
  -F "pdfs=@file1.pdf" \
  -F "pdfs=@file2.pdf"

# Add watermark
curl -X POST https://pdf.endpnt.dev/api/v1/watermark \
  -H "x-api-key: YOUR_API_KEY" \
  -F "pdf=@document.pdf" \
  -F "text=CONFIDENTIAL" \
  -F "position=diagonal"
```

## Input Methods

All endpoints support both input methods:

**File Upload (multipart/form-data)**
```bash
curl -F "pdf=@document.pdf" -F "param=value" ...
```

**URL (application/json)**
```bash
curl -H "Content-Type: application/json" \
     -d '{"pdf_url":"https://example.com/doc.pdf","param":"value"}' ...
```

## Response Format

```json
{
  "success": true,
  "data": {
    "pdf": "base64_encoded_result...",
    "page_count": 15,
    "file_size_bytes": 245760
  },
  "meta": {
    "request_id": "req_a1b2c3",
    "processing_ms": 340,
    "remaining_credits": 4847
  }
}
```

## Limits

- **File Size:** 25MB per PDF
- **Rate Limits:** 10-1000 req/min based on tier
- **Render Limits:** Max 300 DPI, 50 pages per request
- **Timeout:** 10 seconds per operation (Hobby tier)

## Tech Stack

- **Framework:** Next.js 14 App Router + TypeScript
- **PDF Processing:** pdf-lib, pdfjs-dist, pdf-parse
- **Rendering:** @napi-rs/canvas (for PDF → image)  
- **Auth & Rate Limiting:** Upstash Redis
- **Deployment:** Vercel (serverless functions)
- **Domain:** pdf.endpnt.dev

## Development

```bash
# Install dependencies
npm install

# Run development server  
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check
```

## Architecture

```
app/
├── api/v1/           # API endpoints
│   ├── health/       # Health check
│   ├── merge/        # Merge PDFs
│   ├── split/        # Split PDF
│   ├── rotate/       # Rotate pages  
│   ├── reorder/      # Reorder pages
│   ├── watermark/    # Add watermarks
│   ├── compress/     # Compress PDF
│   ├── encrypt/      # Encrypt PDF
│   ├── decrypt/      # Decrypt PDF
│   ├── extract/      # Text, metadata, images, forms, OCR
│   └── render/       # PDF → images
├── components/       # React components
├── docs/            # Documentation page
├── pricing/         # Pricing page  
└── page.tsx         # Landing page

lib/
├── auth.ts          # API key validation
├── rate-limit.ts    # Upstash Redis rate limiting
├── pdf-loader.ts    # PDF loading (multipart/URL)
├── pdf-utils.ts     # Page parsing, validation
├── handlers.ts      # Auth wrapper for endpoints
├── response.ts      # Standard response format
└── config.ts        # Constants and types
```

## Error Codes

- `AUTH_REQUIRED` (401) - Missing API key
- `INVALID_API_KEY` (401) - Invalid API key
- `RATE_LIMIT_EXCEEDED` (429) - Rate limit hit
- `FILE_TOO_LARGE` (400) - File exceeds 25MB
- `INVALID_PDF` (400) - Not a valid PDF file
- `ENCRYPTED_PDF` (400) - PDF is encrypted (use decrypt first)
- `INVALID_PASSWORD` (400) - Wrong decryption password
- `PAGE_OUT_OF_RANGE` (400) - Page doesn't exist
- `PROCESSING_FAILED` (500) - PDF processing error

## Environment Variables

```env
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here  
API_KEYS={"ek_live_xyz":{"tier":"free","name":"Demo"}}
```

## Deployment

Automatic deployment via Vercel:
- **Production:** `main` branch → pdf.endpnt.dev
- **Preview:** Pull requests → auto-generated URLs

Function configuration in `vercel.json` sets timeouts for heavy operations.

## Contributing

This is a production API. For issues or feature requests, contact the endpnt team.

## License

Proprietary - Part of the endpnt.dev API platform.

---

**Built with ❤️ by the endpnt team**
