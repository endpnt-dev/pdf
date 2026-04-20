# endpnt PDF API — CC Spec
**Version:** 1.0
**Date:** April 16, 2026
**Author:** Opus (planning only — CC executes all code changes)
**Agent:** Start with architect → then implementation
**Repo:** `endpnt-dev/pdf`
**Subdomain:** `pdf.endpnt.dev`
**Branch strategy:** Commit and push directly to `main` (no dev branch workflow during pre-launch phase)

---

## Overview

Build the PDF API — the sixth utility API for endpnt.dev and the most feature-rich so far. This API handles both **manipulation** (merge, split, rotate, watermark, compress, encrypt/decrypt) and **extraction** (text, metadata, images, forms, page rendering) of PDF files. It is the platform's answer to PDF.co, iLovePDF, and Smallpdf — bundled into a single API that competes on speed, simplicity, and a generous free tier.

OCR (scanned PDF → text) is scoped as a v2 addition after the Vercel Pro upgrade, due to Tesseract.js dependency weight pushing against the Hobby tier's 50MB function size limit.

Follows the same architecture patterns established across the 5 existing endpnt APIs. Shared scaffolding (auth middleware, rate limiting, response format, error codes, health check) should be copied and adapted from any existing API repo — `convert` is the closest analog because it also handles multipart file uploads.

Deployed at `pdf.endpnt.dev`.

---

## Current State

Greenfield repo — nothing exists yet. The `endpnt-dev/pdf` GitHub repo has been created with `main` and `dev` branches. Infrastructure already in place:

- GitHub repo: `endpnt-dev/pdf`
- Vercel project: `pdf` linked to the repo, production branch = `main`
- DNS: `pdf.endpnt.dev` CNAME → `cname.vercel-dns.com` (Hostinger DNS)
- Upstash Redis: shared `endpnt-ratelimit` database (env vars already set in Vercel)
- Env vars in Vercel: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `API_KEYS` (all applied to Production, Preview, Development)
- Local path: `C:\Repositories\endpnt\pdf\`

**Reference implementations** to copy shared code from (any of these work):
- `C:\Repositories\endpnt\convert\` — closest analog, handles multipart upload via Next.js App Router
- `C:\Repositories\endpnt\screenshot\` — returns binary file output (PDF will do the same)
- `C:\Repositories\endpnt\validate\` — simplest structure if you just need the auth/rate-limit scaffolding

---

## Requirements

### Manipulation endpoints (6)
1. **Merge** 2+ PDFs into a single PDF, preserving page order as provided
2. **Split** a PDF by page ranges (e.g., `"1-3,7,10-12"`) OR every N pages, returning multiple PDFs as a zip or array of base64
3. **Rotate** specified pages by 90/180/270 degrees (others unchanged)
4. **Reorder** pages according to a provided array of page numbers
5. **Watermark** every page with text OR an image overlay (configurable position, opacity, rotation)
6. **Compress** a PDF to reduce file size (image downsampling + stream compression)

### Security endpoints (2)
7. **Encrypt** a PDF with a user password (and optional owner password for permissions)
8. **Decrypt** a password-protected PDF given the correct password

### Extraction endpoints (5)
9. **Extract text** — full text content, per-page, with basic layout preservation
10. **Extract metadata** — title, author, subject, keywords, creation/mod dates, page count, PDF version, encryption status
11. **Extract images** — all embedded images, returned as base64 array with format + dimensions per image
12. **Extract form fields** — every AcroForm/XFA field with name, type, and current value
13. **Render pages** as PNG or JPEG images at configurable DPI

### Platform requirements
14. Accept PDFs via multipart file upload OR `pdf_url` parameter (same pattern as `convert` API)
15. Max upload size: **25MB** (higher than convert's 10MB — PDFs are legitimately larger)
16. For multi-file operations (merge), accept either multiple `pdf` fields OR array of `pdf_urls`
17. Standard endpnt response envelope (`success`, `data`, `meta.request_id`, `meta.processing_ms`, `meta.remaining_credits`)
18. API key auth via `x-api-key` header (shared auth pattern)
19. Upstash Redis rate limiting (shared `endpnt-ratelimit` database, same tiers as other APIs)
20. Health check at `/api/v1/health` returning 200 + `{ status: "ok", version }`
21. Landing page at `/` (describes API, features, code examples)
22. Interactive docs at `/docs` (all 13 endpoints with try-it-out)
23. Pricing page at `/pricing` (matches endpnt platform tiers)
24. Dark theme, Tailwind, same visual language as other endpnt APIs

### OCR (v2 — DO NOT implement in v1)
25. `/api/v1/extract/ocr` — scaffold the route as a 501 Not Implemented for now, with a TODO comment. Will be implemented after Vercel Pro upgrade to avoid function size issues.

---

## Suggestions & Context

### Tech Stack
- **Framework:** Next.js 14+ App Router, TypeScript (same as all other endpnt APIs)
- **PDF manipulation:** `pdf-lib` — pure JavaScript, handles merge/split/rotate/reorder/watermark/encrypt/decrypt/metadata. ~3MB dependency.
- **Text extraction:** `pdf-parse` — lightweight, reliable for standard PDFs (not OCR). Uses pdfjs-dist under the hood.
- **Image extraction:** `pdfjs-dist` (Mozilla's PDF.js) — needed for embedded image extraction and page rendering
- **Page rendering (PDF → PNG/JPEG):** `pdfjs-dist` + `canvas` (node-canvas) OR `@napi-rs/canvas` for better serverless compatibility. Architect should evaluate which renders reliably on Vercel.
- **Compression:** pdf-lib's stream compression + image downsampling via `sharp` (already used in convert)
- **Zip for multi-file output:** `jszip` or `archiver`
- **Rate limiting:** `@upstash/ratelimit` + `@upstash/redis` (shared pattern)

**Dependency weight check:** pdf-lib (~3MB) + pdfjs-dist (~5MB) + sharp (~20MB, already battle-tested in convert) + canvas (~5MB) ≈ 33MB. Fits Hobby tier 50MB limit with headroom. If canvas causes issues on Vercel serverless, fall back to `@napi-rs/canvas` which is built for this environment.

### Folder Structure

```
pdf/
  app/
    api/
      v1/
        merge/route.ts
        split/route.ts
        rotate/route.ts
        reorder/route.ts
        watermark/route.ts
        compress/route.ts
        encrypt/route.ts
        decrypt/route.ts
        extract/
          text/route.ts
          metadata/route.ts
          images/route.ts
          forms/route.ts
          ocr/route.ts          ← 501 stub for v2
        render/route.ts
        health/route.ts
    page.tsx                    ← Landing
    docs/page.tsx               ← Interactive docs
    pricing/page.tsx
    layout.tsx
    globals.css
  lib/
    auth.ts                     ← Copy from convert
    rate-limit.ts               ← Copy from convert
    response.ts                 ← Copy from convert
    config.ts                   ← Copy from convert
    pdf.ts                      ← NEW — shared PDF loading helper (multipart + URL)
    pdf-validate.ts             ← NEW — validate PDF is actually a PDF, check for encryption, etc.
  middleware.ts                 ← Copy from convert
  package.json
  tsconfig.json
  next.config.js
  tailwind.config.ts
  postcss.config.js
  .env.example
  vercel.json
  README.md
```

### Key endpoint parameter shapes

**POST /api/v1/merge**
- `pdfs` (file[], required*) — multiple multipart PDF uploads in order
- `pdf_urls` (string[], required*) — OR array of URLs to fetch (alternative to upload)
- *One of the two required*

**POST /api/v1/split**
- `pdf` / `pdf_url` — input
- `ranges` (string, e.g., `"1-3,5,8-10"`) OR `every_n` (number) — one required
- `output_format` (string, default `"base64"`) — `"base64"` returns array, `"zip"` returns single zip file

**POST /api/v1/rotate**
- `pdf` / `pdf_url` — input
- `rotations` (object) — e.g., `{ "1": 90, "3": 180, "5": 270 }` keyed by page number
- `default_rotation` (number, optional) — applied to all pages not in `rotations`

**POST /api/v1/reorder**
- `pdf` / `pdf_url`
- `order` (number[], required) — new page sequence, e.g., `[3, 1, 2, 4]`

**POST /api/v1/watermark**
- `pdf` / `pdf_url`
- `text` (string) OR `watermark_url` (image URL) — one required
- `position` (string, default `"center"`) — `"top-left" | "top-right" | "bottom-left" | "bottom-right" | "center" | "diagonal"`
- `opacity` (number 1-100, default 30)
- `font_size` (number, default 48, text only)
- `color` (hex, default `"#888888"`, text only)
- `pages` (string, default `"all"`) — `"all"` or range string like `"1-3"`

**POST /api/v1/compress**
- `pdf` / `pdf_url`
- `quality` (string, default `"medium"`) — `"low" | "medium" | "high"` (affects image downsampling)
- `image_dpi` (number, default 150) — override for finer control

**POST /api/v1/encrypt**
- `pdf` / `pdf_url`
- `user_password` (string, required) — required to open the PDF
- `owner_password` (string, optional) — for permissions; defaults to user_password
- `permissions` (object, optional) — `{ print: true, copy: false, modify: false, annotate: false }`

**POST /api/v1/decrypt**
- `pdf` / `pdf_url`
- `password` (string, required)

**POST /api/v1/extract/text**
- `pdf` / `pdf_url`
- `per_page` (boolean, default true) — if true, returns array of `{ page: N, text: "..." }`
- `preserve_layout` (boolean, default false) — attempts to preserve whitespace/columns

**POST /api/v1/extract/metadata**
- `pdf` / `pdf_url` — no other params

**POST /api/v1/extract/images**
- `pdf` / `pdf_url`
- `min_width` (number, optional) — filter out small icons/decorative images
- `min_height` (number, optional)
- `format` (string, default `"png"`) — output format for extracted images

**POST /api/v1/extract/forms**
- `pdf` / `pdf_url` — no other params

**POST /api/v1/render**
- `pdf` / `pdf_url`
- `pages` (string, default `"all"`) — e.g., `"1-3,7"` or `"all"`
- `format` (string, default `"png"`) — `"png" | "jpeg"`
- `dpi` (number, default 150) — 72 to 300

### Standard success response (binary output — merge, split, rotate, etc.)

```json
{
  "success": true,
  "data": {
    "pdf": "base64_encoded_output...",
    "page_count": 24,
    "file_size_bytes": 845200,
    "original_size_bytes": 1240000
  },
  "meta": {
    "request_id": "req_a1b2c3",
    "processing_ms": 340,
    "remaining_credits": 4847
  }
}
```

### Standard success response (extraction)

```json
{
  "success": true,
  "data": {
    "pages": [
      { "page": 1, "text": "Chapter 1. Introduction..." },
      { "page": 2, "text": "This chapter covers..." }
    ],
    "total_pages": 24,
    "total_characters": 48230
  },
  "meta": { ... }
}
```

### Error codes (superset of platform errors + PDF-specific)

Platform errors (same as all endpnt APIs):
- `AUTH_REQUIRED` (401)
- `INVALID_API_KEY` (401)
- `RATE_LIMIT_EXCEEDED` (429)
- `INVALID_PARAMS` (400)

PDF-specific errors:
- `FILE_TOO_LARGE` (400) — exceeds 25MB
- `INVALID_PDF` (400) — not a valid PDF file
- `ENCRYPTED_PDF` (400) — PDF is encrypted, password required (for non-decrypt endpoints)
- `INVALID_PASSWORD` (400) — wrong password on decrypt
- `PAGE_OUT_OF_RANGE` (400) — requested page doesn't exist
- `PDF_FETCH_FAILED` (400) — couldn't download from `pdf_url`
- `UNSUPPORTED_PDF_VERSION` (400) — extremely old PDFs may fail
- `PROCESSING_FAILED` (500) — pdf-lib/pdfjs-dist processing error

### Shared PDF loading helper (`lib/pdf.ts`)

Create a helper that both multipart uploads and `pdf_url` inputs flow through. Same pattern as `lib/image.ts` in convert:

```typescript
// Pseudocode — architect decides exact implementation
async function loadPdf(request): Promise<Buffer> {
  // 1. Check if multipart: parse form data, get 'pdf' field
  // 2. Otherwise: parse JSON body, fetch pdf_url
  // 3. Validate: size <= 25MB, first bytes are %PDF-
  // 4. Return Buffer for pdf-lib to process
  // 5. Throw typed errors: FILE_TOO_LARGE, INVALID_PDF, PDF_FETCH_FAILED
}

async function loadMultiplePdfs(request): Promise<Buffer[]> {
  // Same but for merge endpoint — returns array
}
```

### Landing page (`/`)

Hero: "The complete PDF API. Merge, split, extract, and secure PDFs with one API call."

Features strip:
- 13 endpoints, one API key
- Handles PDFs up to 25MB
- Sub-second response for most operations
- Free tier: 100 operations/month

Interactive demo: Upload a PDF → see metadata extracted instantly. Low-effort engagement hook that doesn't require writing code.

Code examples: cURL + Node.js + Python snippets for the 3 most popular operations (merge, extract text, watermark).

### Docs page (`/docs`)

Structure the sidebar to match the URL tree:

```
Getting Started
  ├─ Authentication
  └─ Rate limits
Manipulate
  ├─ Merge
  ├─ Split
  ├─ Rotate
  ├─ Reorder
  ├─ Watermark
  └─ Compress
Secure
  ├─ Encrypt
  └─ Decrypt
Extract
  ├─ Text
  ├─ Metadata
  ├─ Images
  ├─ Forms
  └─ OCR (Coming soon)
Render
  └─ Pages to image
```

Each endpoint page: description, parameter table, request example, response example, inline try-it-out widget with file upload.

### Vercel function config

Some of these operations (render, compress, large merges) can take 5-10 seconds on Hobby tier's 10s limit. Add `vercel.json`:

```json
{
  "functions": {
    "app/api/v1/render/route.ts": { "maxDuration": 10 },
    "app/api/v1/compress/route.ts": { "maxDuration": 10 },
    "app/api/v1/merge/route.ts": { "maxDuration": 10 },
    "app/api/v1/extract/images/route.ts": { "maxDuration": 10 }
  }
}
```

After Pro upgrade, these can be bumped to 60-120s for handling larger documents.

### Dependencies to install

```bash
npm install pdf-lib pdf-parse pdfjs-dist @napi-rs/canvas sharp jszip @upstash/ratelimit @upstash/redis
npm install -D typescript @types/node @types/pdf-parse
```

---

## Key Discoveries

1. **pdf-lib is sufficient for 90% of the manipulation work** — it handles merge, split, rotate, reorder, watermark, encrypt, decrypt, and metadata read/write. Only extraction (text/images/rendering) needs pdfjs-dist.

2. **pdf-parse is much simpler than pdfjs-dist for just text extraction** — if architect finds pdfjs-dist text extraction unreliable, pdf-parse is a drop-in alternative. Not mutually exclusive — can use both.

3. **Encrypted PDF detection should happen early** — call `PDFDocument.load(buffer, { ignoreEncryption: false })` first. If it throws, return `ENCRYPTED_PDF` error immediately. Only the decrypt endpoint accepts encrypted input.

4. **Page numbers are 1-indexed externally, 0-indexed internally** — pdf-lib uses 0-indexed pages. Always convert at the API boundary. Document this in the code clearly.

5. **Vercel serverless + canvas can be finicky** — `@napi-rs/canvas` is a better choice than node-canvas for Vercel. Has prebuilt binaries for Linux x64, no native build step. This is a known gotcha.

6. **Sharp is already in convert's function bundle** — architecture-wise, consider whether sharp needs to be duplicated in pdf, or if compress can use pdf-lib's built-in stream compression without image downsampling (simpler, smaller bundle, less aggressive compression).

7. **OCR route must exist but return 501** — RapidAPI listing will reference all endpoints. Having the route present (even as a 501) means the listing reads "13 endpoints" on day one, with one marked "coming soon" in docs.

---

## DO NOT TOUCH

- Any files in other endpnt API repos (`screenshot`, `qr`, `preview`, `convert`, `validate`, `web`)
- The existing Upstash Redis database schema (use same rate limit key pattern as other APIs)
- Hostinger DNS records (already configured)
- Vercel project settings (already linked to repo)
- Environment variables in Vercel dashboard — use only what's already set (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `API_KEYS`)

---

## Edge Cases

1. **Empty PDF upload** — 0-byte file should return `INVALID_PDF`, not crash
2. **Corrupted PDF** — pdf-lib throws on malformed PDFs. Catch and return `INVALID_PDF` with helpful message.
3. **Password-protected PDF sent to non-decrypt endpoint** — detect and return `ENCRYPTED_PDF`
4. **Decrypt endpoint with wrong password** — return `INVALID_PASSWORD` (don't leak whether password is close)
5. **Merge with single PDF** — should succeed and return the input unchanged (edge case, not an error)
6. **Split with invalid range** (e.g., `"5-3"` or `"20-25"` on a 10-page PDF) — return `INVALID_PARAMS` with specific message
7. **Rotate with non-multiple-of-90 degrees** — reject at param validation, return `INVALID_PARAMS`
8. **Reorder with duplicate or missing pages** — `[1,1,2]` on 3-page PDF is technically valid (duplicates a page); `[1,3]` on 3-page PDF drops page 2 (also valid). Document both behaviors. Only reject if page numbers are out of range.
9. **Watermark on encrypted PDF** — return `ENCRYPTED_PDF` (same as other manipulation endpoints)
10. **Extract from scanned PDF (image-only)** — text extraction returns empty strings per page. This is expected behavior; don't error. Add `note` in response meta suggesting OCR (when available).
11. **Render at very high DPI on large PDFs** — could blow function memory. Cap DPI at 300 and page count at 50 per request. Return `INVALID_PARAMS` if exceeded with helpful message.
12. **Very large PDFs near 25MB limit** — memory pressure during processing. Architect should test with a 24MB PDF during development.
13. **PDFs with XFA forms (Adobe LiveCycle)** — pdf-lib doesn't support XFA. Form extraction should detect XFA and return a note in meta indicating limited form support.
14. **Concurrent identical requests** — rate limiting handles this, but ensure idempotency: same input produces same output (no timestamps baked into generated PDFs).
15. **Special characters in passwords** — ensure UTF-8 handling through the whole stack (client → multipart → pdf-lib)

---

## Git Commit

```bash
git add -A && git commit -m "feat: initial build — endpnt PDF API v1 (13 endpoints, OCR stubbed for v2)"
git push origin main
```

Push directly to `main` per current pre-launch workflow. Vercel auto-deploys to `pdf.endpnt.dev`.

---

## Smoke Tests

Run against `https://pdf.endpnt.dev` after deploy. Use a valid test API key and a small test PDF (< 5MB).

| # | Scenario | Steps | Expected Result | Pass/Fail |
|---|----------|-------|-----------------|-----------|
| 1 | Health check responds | `GET /api/v1/health` | 200 with `{ status: "ok", version }` | |
| 2 | Missing API key returns 401 | `POST /api/v1/extract/metadata` without `x-api-key` header | 401 with `AUTH_REQUIRED` error code | |
| 3 | Invalid API key returns 401 | Same request with `x-api-key: invalid` | 401 with `INVALID_API_KEY` | |
| 4 | Rate limit enforced | Burst 20 requests on free tier (limit: 10/min) | Requests 11+ return 429 with `RATE_LIMIT_EXCEEDED` | |
| 5 | Extract metadata works | `POST /api/v1/extract/metadata` with valid PDF upload | 200 with title, author, page_count in data | |
| 6 | Extract text per-page | `POST /api/v1/extract/text` with `per_page: true` | Returns `data.pages` array with page + text per entry | |
| 7 | Merge two PDFs | `POST /api/v1/merge` with 2 PDFs (3 pages + 2 pages) | Returns base64 PDF; decoded output has 5 pages | |
| 8 | Split by range | `POST /api/v1/split` with 10-page PDF, `ranges: "1-3,7"` | Returns 2 PDFs: 3 pages and 1 page | |
| 9 | Rotate specific pages | `POST /api/v1/rotate` with `{ "1": 90 }` on 3-page PDF | Page 1 rotated 90°, pages 2-3 unchanged | |
| 10 | Watermark with text | `POST /api/v1/watermark` with `text: "DRAFT"`, `position: "diagonal"` | Returns PDF; visual inspection confirms DRAFT on all pages | |
| 11 | Compress reduces size | `POST /api/v1/compress` with 2MB image-heavy PDF | Response `file_size_bytes` < `original_size_bytes`; `savings_percent` present | |
| 12 | Encrypt then decrypt roundtrip | Encrypt with password "test123", then decrypt with same password | Output PDF is identical to original input | |
| 13 | Wrong password on decrypt | Decrypt with password "wrong" on a PDF encrypted with "correct" | 400 with `INVALID_PASSWORD` | |
| 14 | Encrypted PDF to non-decrypt endpoint | Send encrypted PDF to `/extract/text` | 400 with `ENCRYPTED_PDF` | |
| 15 | File too large | Upload 30MB PDF | 400 with `FILE_TOO_LARGE` | |
| 16 | Invalid PDF rejected | Upload a .jpg renamed to .pdf | 400 with `INVALID_PDF` | |
| 17 | Render page to PNG | `POST /api/v1/render` with `pages: "1", format: "png", dpi: 150` | Returns base64 PNG; decoded image opens correctly | |
| 18 | OCR route returns 501 | `POST /api/v1/extract/ocr` with any PDF | 501 Not Implemented with message indicating v2 availability | |
| 19 | pdf_url input works | `POST /api/v1/extract/metadata` with `pdf_url` pointing to public test PDF | Same successful response as multipart upload | |
| 20 | Landing page loads | Visit `https://pdf.endpnt.dev/` in browser | Page renders, dark theme, features visible, code examples shown | |
| 21 | Docs page loads with all 13 endpoints | Visit `https://pdf.endpnt.dev/docs` | Sidebar shows all manipulate/secure/extract/render endpoints; OCR marked "Coming soon" | |
| 22 | Pricing page loads | Visit `https://pdf.endpnt.dev/pricing` | Pricing tiers match other endpnt APIs | |
| 23 | CORS preflight works | `OPTIONS /api/v1/merge` from a browser origin | 204 with appropriate CORS headers | |
| 24 | Response includes meta fields | Any successful call | Response includes `meta.request_id`, `meta.processing_ms`, `meta.remaining_credits` | |
| 25 | Remaining credits decrements | Call any endpoint twice, compare `meta.remaining_credits` | Second call shows value one less than first | |

---

## Post-Implementation

After CC completes the build and all smoke tests pass:

1. Verify the RapidAPI listing draft can reference all 13 endpoints (12 working + 1 OCR stub)
2. Add PDF API to the hub site (`endpnt.dev`) — requires a separate micro spec for `endpnt-dev/web` repo to update the API grid and `lib/apis.ts`
3. Update platform docs/README to reflect 6 APIs live instead of 5


---

## ✅ Completion Record

- **Completed:** 2026-04-13
- **Final commit:** [commit hash from original buildout]
- **Vercel deployment:** green
- **Agents invoked:** architect, backend-agent, review-qa-agent
- **Smoke tests:** [N of N] passing
- **Notes:** Retired as part of 2026-04-20 housekeeping sweep. Content absorbed into platform CLAUDE.md and repo CLAUDE.md files. PDF API successfully built and deployed.
