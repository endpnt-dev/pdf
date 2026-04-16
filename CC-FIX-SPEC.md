# CC TASK: Production-grade encrypt/decrypt (qpdf) + real OCR (scribe.js)

**File(s):** 
- `app/api/v1/decrypt/route.ts`
- `app/api/v1/encrypt/route.ts`
- `app/api/v1/extract/ocr/route.ts` (currently a 501 stub — replace with real implementation)
- `lib/qpdf.ts` (new)
- `lib/ocr.ts` (new)
- `lib/response.ts` (add new error codes)
- `package.json`
- `next.config.js`
- Potentially `bin/` directory for qpdf binary fallback

---

## Context

- Vercel Pro is now active — 250MB function size, 300s max duration, 3GB memory
- User wants production-ready endpoints, not v1 stubs
- Two endpoints need upgrades: decrypt (doesn't work in pdf-lib), and OCR (stubbed as 501 in v1 due to old Hobby tier constraints)
- Pro upgrade unlocks both properly

## Production decisions

**Encrypt + Decrypt → node-qpdf2 (qpdf binary wrapper)**
- AES-256 default (industry standard, stronger than pdf-lib's crypto)
- Proper round-trip: encrypt with qpdf, decrypt with qpdf
- Keep pdf-lib for all 11 other non-crypto endpoints

**OCR → scribe.js-ocr (NOT raw tesseract.js)**
- Scribe.js is built specifically for PDF OCR, whereas tesseract.js only handles images
- Scribe.js wraps tesseract internally but adds PDF pipeline (render pages → OCR → combine text)
- Scribe.js also bypasses OCR for text-native PDFs (faster, more accurate)
- Scribe.js has a documented Next.js example repo — bundling issues are solved
- Avoids the known `worker-script/node/index.js` Tesseract.js + Next.js bundling bug

---

## PART 1 — Install dependencies

```bash
npm install node-qpdf2 scribe.js-ocr
```

Both are pure-JS wrappers. node-qpdf2 shells out to the qpdf binary; scribe.js ships its own WebAssembly bundle.

---

## PART 2 — qpdf binary availability on Vercel

### Option A (try first): Install qpdf during build
Add a build command override in `vercel.json`:

```json
{
  "buildCommand": "apt-get update && apt-get install -y qpdf && npm run build",
  "functions": {
    "app/api/v1/encrypt/route.ts": { "maxDuration": 60, "memory": 1024 },
    "app/api/v1/decrypt/route.ts": { "maxDuration": 60, "memory": 1024 },
    "app/api/v1/extract/ocr/route.ts": { "maxDuration": 300, "memory": 3008 },
    "app/api/v1/render/route.ts": { "maxDuration": 60, "memory": 1024 },
    "app/api/v1/compress/route.ts": { "maxDuration": 60, "memory": 1024 },
    "app/api/v1/merge/route.ts": { "maxDuration": 60, "memory": 1024 }
  }
}
```

Note: function configs above assume Pro tier. OCR gets the maximum allocation (300s / 3GB) since multi-page OCR is resource-intensive.

### Option B (fallback if Option A fails): Bundle qpdf binary in repo
If Vercel's build environment rejects apt commands:
1. Download `qpdf-11.x-bin-linux-x86_64.zip` from https://github.com/qpdf/qpdf/releases
2. Extract the `qpdf` binary (~7MB) and its `.so` dependencies
3. Place in `bin/qpdf/` inside the repo
4. Update `next.config.js` with `outputFileTracingIncludes` to ensure bin/ ships with the function
5. Set `QPDF_PATH` env var to `./bin/qpdf/qpdf`

**Architect: try Option A first. If the build log shows apt-get errors, switch to Option B.** Document which worked in the commit message.

---

## PART 3 — next.config.js updates

Must include scribe.js-ocr and node-qpdf2 in externals, and (if Option B) add binary tracing:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [
      '@napi-rs/canvas',
      'pdf-lib',
      'pdf-parse',
      'pdfjs-dist',
      'sharp',
      'node-qpdf2',
      'scribe.js-ocr',
    ],
    // Only needed if using Option B (bundled qpdf binary):
    // outputFileTracingIncludes: {
    //   '/api/v1/encrypt': ['./bin/**/*'],
    //   '/api/v1/decrypt': ['./bin/**/*'],
    // },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        { '@napi-rs/canvas': 'commonjs @napi-rs/canvas' },
        { 'node-qpdf2': 'commonjs node-qpdf2' },
        { 'scribe.js-ocr': 'commonjs scribe.js-ocr' },
      ];
    }
    return config;
  },
};

module.exports = nextConfig;
```

Uncomment `outputFileTracingIncludes` only if Option B is used.

---

## PART 4 — Create `lib/qpdf.ts`

Centralized qpdf helper. Handles Buffer ↔ /tmp file conversion.

```typescript
import { encrypt as qpdfEncrypt, decrypt as qpdfDecrypt, info as qpdfInfo } from 'node-qpdf2';
import { randomUUID } from 'crypto';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

// If Option B (bundled binary), respect QPDF_PATH env var
// If Option A (apt install), qpdf is in system PATH, no config needed

type QpdfRestrictions = {
  print?: 'y' | 'n' | 'low' | 'full';
  modify?: 'none' | 'all' | 'annotate' | 'form' | 'assembly';
  extract?: 'y' | 'n';
  useAes?: 'y' | 'n';
};

export interface EncryptParams {
  pdfBuffer: Buffer;
  userPassword: string;
  ownerPassword?: string;
  keyLength?: 40 | 128 | 256;
  restrictions?: QpdfRestrictions;
}

export interface DecryptParams {
  pdfBuffer: Buffer;
  password: string;
}

async function runWithTempFiles<T>(
  pdfBuffer: Buffer,
  op: (inputPath: string, outputPath: string) => Promise<void>
): Promise<Buffer> {
  const id = randomUUID();
  const inputPath = join(tmpdir(), `qpdf-in-${id}.pdf`);
  const outputPath = join(tmpdir(), `qpdf-out-${id}.pdf`);
  
  try {
    await writeFile(inputPath, pdfBuffer);
    await op(inputPath, outputPath);
    return await readFile(outputPath);
  } finally {
    // Clean up both files, ignore errors on cleanup
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

export async function encryptPdf(params: EncryptParams): Promise<Buffer> {
  return runWithTempFiles(params.pdfBuffer, async (input, output) => {
    await qpdfEncrypt({
      input,
      output,
      password: params.ownerPassword
        ? { user: params.userPassword, owner: params.ownerPassword }
        : params.userPassword,
      keyLength: params.keyLength ?? 256,
      restrictions: params.restrictions,
    });
  });
}

export async function decryptPdf(params: DecryptParams): Promise<Buffer> {
  return runWithTempFiles(params.pdfBuffer, async (input, output) => {
    await qpdfDecrypt({
      input,
      output,
      password: params.password,
    });
  });
}

export async function isPdfEncrypted(pdfBuffer: Buffer): Promise<boolean> {
  const id = randomUUID();
  const inputPath = join(tmpdir(), `qpdf-info-${id}.pdf`);
  try {
    await writeFile(inputPath, pdfBuffer);
    const result = await qpdfInfo({ input: inputPath });
    // qpdfInfo returns the string "File is not encrypted" when unencrypted
    return !String(result).includes('File is not encrypted');
  } finally {
    await unlink(inputPath).catch(() => {});
  }
}
```

Architect: verify node-qpdf2's exact password parameter shape for owner/user passwords — the interface may accept either a string or an object depending on the version. Code above assumes the object form for owner+user pairs.

---

## PART 5 — Create `lib/ocr.ts`

Centralized scribe.js helper.

```typescript
import scribe from 'scribe.js-ocr';
import { randomUUID } from 'crypto';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export interface OcrParams {
  pdfBuffer: Buffer;
  languages?: string[];  // e.g., ['eng', 'spa']. Default: ['eng']
  pages?: number[] | 'all';  // specific pages or all
}

export interface OcrResult {
  pages: Array<{
    page: number;
    text: string;
    confidence: number;  // 0-100
  }>;
  total_pages: number;
  total_characters: number;
  languages_used: string[];
  processing_ms: number;
}

export async function ocrPdf(params: OcrParams): Promise<OcrResult> {
  const start = Date.now();
  const id = randomUUID();
  const inputPath = join(tmpdir(), `ocr-in-${id}.pdf`);
  
  try {
    await writeFile(inputPath, params.pdfBuffer);
    
    const langs = params.languages ?? ['eng'];
    
    // Scribe.js loads languages, then extracts text
    // When PDF has native text, scribe skips OCR and returns the text directly
    // When PDF is image-based, scribe runs OCR via tesseract WASM
    await scribe.init({ ocr: true, font: true });
    await scribe.importFiles([inputPath]);
    
    // Set language(s)
    if (langs.length > 0) {
      // scribe.js accepts language codes via extractOpt
      // architect: verify exact scribe.js API for language setting
    }
    
    const extracted = await scribe.recognize({ langs });
    
    // Scribe returns per-page data
    const pages = extracted.map((pageData: any, idx: number) => ({
      page: idx + 1,
      text: pageData.text || '',
      confidence: pageData.confidence ?? 0,
    }));
    
    const totalChars = pages.reduce((sum, p) => sum + p.text.length, 0);
    
    await scribe.terminate();
    
    return {
      pages,
      total_pages: pages.length,
      total_characters: totalChars,
      languages_used: langs,
      processing_ms: Date.now() - start,
    };
  } finally {
    await unlink(inputPath).catch(() => {});
  }
}
```

**Important for architect:** Scribe.js's API evolves; the code above is a pattern, not exact. Before implementing, check the current scribe.js-ocr Node.js API at https://github.com/scribeocr/scribe.js. The key functions are `init`, `importFiles`, `recognize`, and `terminate`. Verify the exact signatures and adapt.

Also note: Scribe.js may take 5-15 seconds to initialize on a cold start because it loads WASM. The 300s `maxDuration` accounts for this.

---

## PART 6 — Rewrite `app/api/v1/decrypt/route.ts`

Full implementation using qpdf helper:

```typescript
import { NextRequest } from 'next/server';
import { validateApiKey, getApiKeyFromHeaders } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/response';
import { loadPdf } from '@/lib/pdf';
import { decryptPdf, isPdfEncrypted } from '@/lib/qpdf';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  const apiKey = getApiKeyFromHeaders(request.headers);
  const keyInfo = validateApiKey(apiKey);
  if (!keyInfo) {
    return errorResponse('AUTH_REQUIRED', 'API key required', 401);
  }
  
  // Rate limiting — copy pattern from other routes
  
  try {
    const contentType = request.headers.get('content-type') || '';
    let pdfBuffer: Buffer;
    let password: string;
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('pdf') as File | null;
      password = formData.get('password') as string;
      
      if (!file) return errorResponse('INVALID_PARAMS', 'pdf field required', 400);
      if (!password) return errorResponse('INVALID_PARAMS', 'password field required', 400);
      
      pdfBuffer = Buffer.from(await file.arrayBuffer());
    } else {
      const body = await request.json();
      if (!body.pdf_url) return errorResponse('INVALID_PARAMS', 'pdf_url or multipart file required', 400);
      if (!body.password) return errorResponse('INVALID_PARAMS', 'password field required', 400);
      
      pdfBuffer = await loadPdf(body.pdf_url);
      password = body.password;
    }
    
    if (pdfBuffer.length > 25 * 1024 * 1024) {
      return errorResponse('FILE_TOO_LARGE', 'PDF exceeds 25MB limit', 400);
    }
    
    const encrypted = await isPdfEncrypted(pdfBuffer);
    if (!encrypted) {
      return errorResponse('NOT_ENCRYPTED', 'PDF is not encrypted', 400);
    }
    
    const decryptedBuffer = await decryptPdf({ pdfBuffer, password });
    
    return successResponse({
      pdf: decryptedBuffer.toString('base64'),
      file_size_bytes: decryptedBuffer.length,
      original_size_bytes: pdfBuffer.length,
    }, {
      processing_ms: Date.now() - startTime,
      remaining_credits: keyInfo.remaining_credits ?? 0,
    });
    
  } catch (error: any) {
    const message = error.message || '';
    
    if (message.includes('invalid password') || message.includes('incorrect password') || message.includes('password')) {
      return errorResponse('INVALID_PASSWORD', 'Password is incorrect', 400);
    }
    if (message.includes('is not encrypted')) {
      return errorResponse('NOT_ENCRYPTED', 'PDF is not encrypted', 400);
    }
    if (message.includes('damaged') || message.includes('malformed')) {
      return errorResponse('INVALID_PDF', 'PDF is corrupted or malformed', 400);
    }
    
    console.error('Decrypt error:', message);
    return errorResponse('PROCESSING_FAILED', 'Failed to decrypt PDF', 500);
  }
}
```

---

## PART 7 — Rewrite `app/api/v1/encrypt/route.ts`

Same pattern as decrypt, but uses `encryptPdf` helper. Parameter mapping:

- `user_password` (required) → `userPassword`
- `owner_password` (optional) → `ownerPassword`
- `permissions` object → map to qpdf `restrictions`:
  - `permissions.print: true` → `restrictions.print: 'full'`
  - `permissions.print: false` → `restrictions.print: 'n'`
  - `permissions.modify: true` → `restrictions.modify: 'all'`
  - `permissions.modify: false` → `restrictions.modify: 'none'`
  - `permissions.copy: true` → `restrictions.extract: 'y'`
  - `permissions.copy: false` → `restrictions.extract: 'n'`
- Default `keyLength: 256` for AES-256

Error handling parallels decrypt — catch qpdf errors and map to specific error codes.

**Note:** If the existing `encrypt/route.ts` already uses pdf-lib encryption (from earlier phase builds), replace it entirely. Do NOT try to keep both.

---

## PART 8 — Rewrite `app/api/v1/extract/ocr/route.ts`

Currently returns 501. Replace entirely:

```typescript
import { NextRequest } from 'next/server';
import { validateApiKey, getApiKeyFromHeaders } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/response';
import { loadPdf } from '@/lib/pdf';
import { ocrPdf } from '@/lib/ocr';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  const apiKey = getApiKeyFromHeaders(request.headers);
  const keyInfo = validateApiKey(apiKey);
  if (!keyInfo) {
    return errorResponse('AUTH_REQUIRED', 'API key required', 401);
  }
  
  // Rate limiting
  
  try {
    const contentType = request.headers.get('content-type') || '';
    let pdfBuffer: Buffer;
    let languages: string[] = ['eng'];
    let pages: number[] | 'all' = 'all';
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('pdf') as File | null;
      
      if (!file) return errorResponse('INVALID_PARAMS', 'pdf field required', 400);
      
      pdfBuffer = Buffer.from(await file.arrayBuffer());
      
      const langsParam = formData.get('languages');
      if (langsParam) {
        languages = String(langsParam).split(',').map(s => s.trim()).filter(Boolean);
      }
    } else {
      const body = await request.json();
      if (!body.pdf_url) return errorResponse('INVALID_PARAMS', 'pdf_url or multipart file required', 400);
      
      pdfBuffer = await loadPdf(body.pdf_url);
      if (body.languages) languages = body.languages;
      if (body.pages) pages = body.pages;
    }
    
    if (pdfBuffer.length > 25 * 1024 * 1024) {
      return errorResponse('FILE_TOO_LARGE', 'PDF exceeds 25MB limit', 400);
    }
    
    // Validate languages (allow known Tesseract language codes only)
    const validLangs = ['eng', 'spa', 'fra', 'deu', 'ita', 'por', 'rus', 'chi_sim', 'chi_tra', 'jpn', 'kor', 'ara', 'hin'];
    const invalidLang = languages.find(l => !validLangs.includes(l));
    if (invalidLang) {
      return errorResponse('INVALID_LANGUAGE', `Unsupported language: ${invalidLang}. Supported: ${validLangs.join(', ')}`, 400);
    }
    
    const result = await ocrPdf({ pdfBuffer, languages, pages });
    
    return successResponse(result, {
      processing_ms: Date.now() - startTime,
      remaining_credits: keyInfo.remaining_credits ?? 0,
    });
    
  } catch (error: any) {
    const message = error.message || '';
    
    if (message.includes('damaged') || message.includes('malformed')) {
      return errorResponse('INVALID_PDF', 'PDF is corrupted or malformed', 400);
    }
    if (message.includes('timeout')) {
      return errorResponse('PROCESSING_TIMEOUT', 'OCR processing exceeded time limit. Try a smaller PDF or fewer pages.', 504);
    }
    
    console.error('OCR error:', message);
    return errorResponse('PROCESSING_FAILED', 'Failed to process OCR', 500);
  }
}
```

---

## PART 9 — Update `lib/response.ts`

Ensure these error codes are registered:
- `NOT_ENCRYPTED` (400)
- `INVALID_PASSWORD` (400)
- `INVALID_PDF` (400)
- `FILE_TOO_LARGE` (400)
- `INVALID_LANGUAGE` (400)
- `PROCESSING_FAILED` (500)
- `PROCESSING_TIMEOUT` (504)

If `errorResponse` doesn't accept arbitrary codes, add the new ones to its allowed list.

---

## PART 10 — Update docs page

In `app/docs/page.tsx`:
- Remove "Coming soon" badge from the OCR endpoint
- Document OCR parameters: `pdf` or `pdf_url`, `languages` (array), `pages` (array or "all")
- Document supported languages: eng, spa, fra, deu, ita, por, rus, chi_sim, chi_tra, jpn, kor, ara, hin
- Add note: "OCR automatically detects if the PDF has native text and bypasses OCR for faster extraction"

Both encrypt and decrypt should be documented as fully supported. Remove any "v2" or "Coming soon" language from either.

---

## Verify

After applying all changes:

```bash
npm install
npm run build
```

**For local testing (recommended):**
```bash
# On WSL Ubuntu — install qpdf locally for build testing
sudo apt install qpdf

# Then test
npm run build
npm run dev

# Hit endpoints with a test PDF to verify:
# - encrypt (test.pdf + password → encrypted.pdf)
# - decrypt (encrypted.pdf + password → test.pdf)
# - ocr (scan.pdf → extracted text)
```

If build and local tests pass:
```bash
git add -A && git commit -m "feat: production encrypt/decrypt via qpdf (AES-256) + real OCR via scribe.js"
git push origin main
```

Watch Vercel deployment carefully — the binary install step (Option A) may fail and trigger the Option B fallback. If so, do NOT commit again until Option B is fully implemented.

---

## Smoke Tests

### Encrypt / Decrypt

| # | Scenario | Steps | Expected Result | Pass/Fail |
|---|----------|-------|-----------------|-----------|
| 1 | Build compiles locally | `npm run build` | Exit 0, no errors | |
| 2 | Vercel deploy succeeds | Push to main | Deployment green | |
| 3 | qpdf available at runtime | Check encrypt route logs for first invocation | No "qpdf not found" error | |
| 4 | Encrypt with user password | `POST /encrypt` with PDF + `user_password: "test"` | 200 with encrypted base64 PDF | |
| 5 | Encrypted PDF actually encrypted | Download output, open in Adobe Reader | Prompts for password | |
| 6 | Decrypt valid password | `POST /decrypt` with encrypted PDF + correct password | 200 with decrypted PDF | |
| 7 | Decrypt wrong password | Wrong password | 400 `INVALID_PASSWORD` | |
| 8 | Decrypt non-encrypted | Non-encrypted PDF | 400 `NOT_ENCRYPTED` | |
| 9 | Round-trip | Encrypt then decrypt | Output functionally equivalent to input | |
| 10 | AES-256 verified | qpdf info on encrypted output | Shows AES-256 encryption | |
| 11 | Permissions applied | Encrypt with `permissions: { print: false }` | Output PDF has print disabled | |
| 12 | Owner password distinct | Encrypt with user + owner passwords | Both work for their scopes | |
| 13 | /tmp cleanup | After 20 encrypts, check Vercel /tmp size | Not growing unboundedly | |

### OCR

| # | Scenario | Steps | Expected Result | Pass/Fail |
|---|----------|-------|-----------------|-----------|
| 14 | OCR text-based PDF | `POST /extract/ocr` with PDF that has native text | Returns text quickly (bypasses OCR) | |
| 15 | OCR scanned PDF | `POST /extract/ocr` with image-only scanned PDF | Returns extracted text, ~5-30s depending on pages | |
| 16 | OCR per-page structure | Any OCR response | Returns `pages` array with page numbers | |
| 17 | OCR confidence scores | Any OCR response | Each page has a `confidence` field 0-100 | |
| 18 | OCR multi-language | `POST /extract/ocr` with `languages: ["eng", "spa"]` | Successfully recognizes both languages | |
| 19 | OCR invalid language | `languages: ["xyz"]` | 400 `INVALID_LANGUAGE` with supported list | |
| 20 | OCR large PDF | 50-page scanned PDF | Completes within 300s, returns all pages | |
| 21 | OCR respects maxDuration | Extremely large PDF | Returns `PROCESSING_TIMEOUT` rather than hanging | |

### General

| # | Scenario | Steps | Expected Result | Pass/Fail |
|---|----------|-------|-----------------|-----------|
| 22 | All 3 endpoints require auth | No API key | 401 `AUTH_REQUIRED` | |
| 23 | File size limits enforced | 30MB PDF | 400 `FILE_TOO_LARGE` | |
| 24 | Invalid PDF rejected | JPG renamed .pdf | 400 `INVALID_PDF` | |
| 25 | Credits decrement | Two calls to any endpoint | Counter decreases by 1 per call | |
| 26 | Docs page updated | Visit /docs | OCR no longer shows "Coming soon"; encrypt/decrypt documented | |
| 27 | No top-level serverExternalPackages | grep next.config.js | Key is under experimental. | |
| 28 | No "Unrecognized key" warning in Vercel | Build logs | Clean, no warnings | |

---

## Process requirements

- Run `npm run build` locally BEFORE pushing — mandatory
- Install qpdf on WSL for local testing: `sudo apt install qpdf`
- Target `main` directly per pre-launch workflow
- Commit once per logical unit (qpdf integration, OCR integration, docs update) — easier to rollback if one piece fails

## Rollback plan

If OCR consistently fails on Vercel despite local success:
- Mark OCR back to 501 stub
- Commit the encrypt/decrypt work alone
- Open a GitHub issue on scribe.js-ocr with the failing scenario
- Revisit OCR in a follow-up spec with a different approach (e.g., deferred to a background job queue)

Encrypt/decrypt should NOT be reverted — qpdf is a known-good pattern with broad serverless adoption.
