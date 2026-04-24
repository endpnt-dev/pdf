# BUGS.md — PDF API Bug Tracker

**Scope:** Bugs specific to the PDF API (`pdf.endpnt.dev`). Cross-cutting bugs live at `../BUGS.md`.

**ID prefix:** `PDF-NNN` (sequential, do not reuse).

**Last updated:** 2026-04-24 (biweekly audit: PDF-002 resolved; PDF-003 through PDF-007 added from SSRF inventory).

---

## Open bugs

### PDF-001 — Runtime fixes deferred (SSRF inventory now partially complete)

- **Severity:** High (updated from "Unknown" — SSRF confirmed across 5 fetch paths)
- **Files:** Multiple — see PDF-003 through PDF-007 for specific SSRF entries
- **Discovered:** Pre-2026-04-24 (original placeholder); enumerated 2026-04-24 (biweekly audit)
- **Symptom:** Audit 2026-04-24 has now enumerated the primary runtime risk: 5 separate fetch() calls across PDF routes accept user-supplied URLs with no SSRF protection. See PDF-003 through PDF-007 for each specific entry.
- **Root cause:** URL-fetching code written before SSRF conventions were established platform-wide.
- **Impact:** See individual PDF-003–PDF-007 entries.
- **Fix approach:** PDF-001 is now partially resolved as an inventory exercise. Write a dedicated SSRF fix spec covering all 5 paths together (they share the same fix pattern). Close PDF-001 and supersede with PDF-003–PDF-007 once the fix spec is written.
- **Status:** Open (superseded by PDF-003–PDF-007 for tracking purposes). Close when all 5 are resolved.

### PDF-003 — SSRF in encrypt route (`pdf_url` parameter)

- **Severity:** High (launch blocker)
- **File:** `app/api/v1/encrypt/route.ts` — local `loadPdfFromUrl()` function
- **Discovered:** 2026-04-24 (biweekly code health audit)
- **Symptom:** The `/api/v1/encrypt` route accepts a `pdf_url` parameter. The local `loadPdfFromUrl()` calls `fetch(url, { headers: { 'User-Agent': 'endpnt-pdf/1.0' } })` with no SSRF protection. No private-IP check, follows redirects automatically, no size bounding after download.
- **Root cause:** URL-fetching implemented before platform SSRF conventions established.
- **Impact:** Attacker can submit any private IP (169.254.169.254, 10.x.x.x, 127.x.x.x) as `pdf_url` — server fetches it and may expose the content in error messages or behavior differences.
- **Fix approach:** Copy `preview/lib/url-utils.ts` `isSSRFProtected()` into `pdf/lib/url-utils.ts`. Apply before fetch. Set `redirect: 'manual'` with redirect re-validation. Add streaming byte counter. Add `BLOCKED_PDF_URL` error code to `lib/config.ts`. Bundle fix for all 5 SSRF paths (PDF-003–PDF-007) in a single spec.
- **Cross-reference:** `../BUGS.md#P-003`, PDF-001
- **Status:** Open. Launch blocker.

### PDF-004 — SSRF in decrypt route (`pdf_url` parameter)

- **Severity:** High (launch blocker)
- **File:** `app/api/v1/decrypt/route.ts` — local `loadPdfFromUrl()` function (same pattern as PDF-003)
- **Discovered:** 2026-04-24 (biweekly code health audit)
- **Symptom:** Same as PDF-003 — `/api/v1/decrypt` has its own `loadPdfFromUrl()` with the same unprotected fetch pattern.
- **Fix approach:** Same as PDF-003. Bundle in the same fix spec.
- **Cross-reference:** `../BUGS.md#P-003`, PDF-001
- **Status:** Open. Launch blocker.

### PDF-005 — SSRF in OCR route (`pdf_url` parameter)

- **Severity:** High (launch blocker)
- **File:** `app/api/v1/extract/ocr/route.ts` — local `loadPdfFromUrl()` function
- **Discovered:** 2026-04-24 (biweekly code health audit)
- **Symptom:** Same pattern as PDF-003/PDF-004 — `/api/v1/extract/ocr` has its own unprotected URL fetch.
- **Fix approach:** Same as PDF-003. Bundle in the same fix spec.
- **Cross-reference:** `../BUGS.md#P-003`, PDF-001
- **Status:** Open. Launch blocker.

### PDF-006 — SSRF in watermark route (`watermark_url` parameter)

- **Severity:** High (launch blocker)
- **File:** `app/api/v1/watermark/route.ts` line ~61
- **Discovered:** 2026-04-24 (biweekly code health audit)
- **Symptom:** `/api/v1/watermark` accepts a `watermark_url` parameter. `fetch(watermark_url, { headers: ... })` is called with no SSRF protection, no `redirect: 'manual'`, no size bounding. Distinct from the `pdf_url` fetch — this one fetches an image, not a PDF.
- **Fix approach:** Same as PDF-003. Bundle in the same fix spec.
- **Cross-reference:** `../BUGS.md#P-003`, PDF-001
- **Status:** Open. Launch blocker.

### PDF-007 — SSRF in shared `lib/pdf-loader.ts` `fetchPdfFromUrl()`

- **Severity:** High (launch blocker)
- **File:** `lib/pdf-loader.ts` line ~208
- **Discovered:** 2026-04-24 (biweekly code health audit)
- **Symptom:** `lib/pdf-loader.ts` exports `fetchPdfFromUrl()` which accepts user-supplied URLs. Has a 10s timeout and checks `content-length` header, but no private-IP blocklist, no `redirect: 'manual'`, no streaming byte counter. This shared loader is called by multiple routes.
- **Fix approach:** Apply SSRF protection at the shared function level — this will protect all routes that call it without requiring per-route changes. Bundle in the same fix spec.
- **Cross-reference:** `../BUGS.md#P-003`, PDF-001
- **Status:** Open. Launch blocker.

### PDF-008 — Placeholder key in landing page demo — demo is non-functional

- **Severity:** Medium
- **File:** `app/page.tsx` line ~21–24
- **Discovered:** 2026-04-24 (biweekly code health audit)
- **Symptom:** The landing page sends `'x-api-key': 'demo_key_placeholder'` to `/api/v1/extract/metadata` from client-side JavaScript. The API rejects this placeholder key — the demo is non-functional. No demo-proxy migration has been done for pdf.
- **Root cause:** Demo was scaffolded with a placeholder before demo-proxy pattern was established.
- **Impact:** Landing page demo shows an error to every visitor who tries it.
- **Fix approach:** Migrate to the demo-proxy pattern (add `lib/demo-proxy.ts`, add `/api/demo/extract/metadata` route, update frontend to call demo route). Read `docs/DEMO-PROXY-CONTRACTS.md` before implementing. Alternative short-term: display a static example result without a live API call.
- **Status:** Open. Fix before marketing launch.

---

## Resolved bugs

### PDF-002 — Next.js config syntax unverified

- **Originally:** Unknown severity, discovered 2026-04-24 (inaugural audit placeholder)
- **Resolved:** 2026-04-24 (verified by biweekly audit — no issue found)
- **Resolution commit:** N/A — no code change needed
- **What changed:** Nothing. Audit 2026-04-24 confirmed `next.config.js` correctly uses `experimental.serverComponentsExternalPackages` with all required packages. `outputFileTracingIncludes` is present and correct for encrypt/decrypt routes. No Next 15 syntax found.
- **Verification:** Biweekly code health audit 2026-04-24 read `next.config.js` directly and confirmed correct Next 14 syntax throughout.
