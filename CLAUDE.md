# CLAUDE.md — PDF API Specific Rules

**This file supplements `C:\Repositories\endpnt\CLAUDE.md` (platform-wide rules).** Read both. Universal rules (definition of done, mandatory workflow, agent usage, status-report honesty, etc.) are in the platform file. Only PDF-specific guidance lives here.

---

## PDF Library Stack

This API uses multiple PDF libraries for different operations. Each has known API quirks — verify signatures in `.d.ts` files before calling.

| Library | Purpose | Key gotcha |
|---|---|---|
| `pdf-lib` | Merge, split, rotate, reorder, watermark, compress, metadata, forms | Does NOT support `password` on `load()`. Cannot decrypt. Can only encrypt via `save({ userPassword, ownerPassword, permissions })`. |
| `pdf-parse` | Text extraction | API is simple but error messages are opaque — wrap in try/catch. |
| `pdfjs-dist` | Page rendering | Set `GlobalWorkerOptions.workerSrc = ''` for serverless. |
| `@napi-rs/canvas` | Canvas for rendering | `toBuffer('image/jpeg', quality)` takes a **plain number**, NOT `{ quality }`. Different from node-canvas. |
| `node-qpdf2` | Encrypt/decrypt via qpdf | Requires qpdf binary. Spawns subprocess. Use file-based workflow (/tmp in, /tmp out, cleanup in finally). |
| `scribe.js-ocr` | OCR for /extract/ocr | WASM-based. Set `serverComponentsExternalPackages` in next.config.js. |

---

## qpdf Binary (bundled)

qpdf Linux x86_64 binary is bundled in `bin/qpdf/` and traced via `outputFileTracingIncludes` in next.config.js. At runtime, `lib/qpdf.ts` sets `QPDF_PATH` before importing node-qpdf2, and chmods the binary to 755 (Vercel tracing may strip executable bit).

**Do not remove `bin/qpdf/` from git tracking.** It needs to ship with the repo.

**Do not attempt to install qpdf via `apt-get` in vercel.json buildCommand.** Vercel's Amazon Linux build container rejects it. We already tried — it's why we bundle the binary.

---

## OCR via scribe.js

`lib/ocr.ts` wraps scribe.js-ocr. Key behaviors:

- Scribe bypasses OCR entirely when PDF has native text — much faster
- Languages passed as array of Tesseract language codes: `['eng', 'spa', 'fra']`, etc.
- Cold-start WASM load takes 5-15 seconds. The `/extract/ocr` route has `maxDuration: 300` and `memory: 3008` in vercel.json to accommodate.
- Call `scribe.terminate()` after extraction to free memory

---

## Function Resource Config

Per `vercel.json`, resource-intensive routes have explicit configs:

- `/api/v1/extract/ocr` — 300s, 3GB memory (OCR is CPU/memory heavy)
- `/api/v1/encrypt`, `/api/v1/decrypt` — 60s, 1GB memory (qpdf operations)
- `/api/v1/render` — 60s, 1GB memory (canvas rendering)
- Others default to Vercel's standard config

---

## Temp File Cleanup

Several endpoints write to `/tmp` (qpdf, OCR). ALWAYS use try/finally:

```typescript
const inputPath = join(tmpdir(), `op-${randomUUID()}.pdf`);
try {
  await writeFile(inputPath, buffer);
  // ... do work
  return result;
} finally {
  await unlink(inputPath).catch(() => {});
}
```

Without cleanup, /tmp fills up across invocations and endpoints fail with ENOSPC.

---

## PDF-Specific Error Codes

Beyond platform errors:
- `NOT_ENCRYPTED` (400)
- `INVALID_PASSWORD` (400)
- `INVALID_PDF` (400)
- `FILE_TOO_LARGE` (400)
- `INVALID_LANGUAGE` (400) — OCR only
- `PROCESSING_FAILED` (500)
- `PROCESSING_TIMEOUT` (504)
