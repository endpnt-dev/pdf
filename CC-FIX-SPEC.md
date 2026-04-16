# CC TASK: Fix extract/text responseData type + update stale OCR message

**File:** `app/api/v1/extract/text/route.ts`

---

## Problem

Build fails at line 150:

```
Type error: Property 'note' does not exist on type 
'{ text: string; total_pages: number; total_characters: number; extractio...'
```

## Two fixes

### Fix 1 — Add `note` to the response type

At line 150, the code does `responseData.note = 'No text found...'` but the `responseData` type doesn't include a `note` field. Add it as an optional property on the type definition.

Find where `responseData` is typed (likely near the top of the try block or as a type annotation on the object literal). It looks something like:

```typescript
const responseData: {
  text: string;
  total_pages: number;
  total_characters: number;
  extraction_method: string;  // or similar
} = { ... }
```

Add `note?: string;` to the type:

```typescript
const responseData: {
  text: string;
  total_pages: number;
  total_characters: number;
  extraction_method: string;
  note?: string;   // ← add this
} = { ... }
```

### Fix 2 — Update the stale OCR message

At line 150, the current message says:
```typescript
'No text found. This may be a scanned PDF that requires OCR (available in v2).'
```

This is stale. OCR is now implemented in v1 (scribe.js integration from the previous commit). Update the message to point users at the real OCR endpoint:

```typescript
'No text found. This may be a scanned PDF. Try the /api/v1/extract/ocr endpoint for scanned documents.'
```

---

## Search for other stale v2 references

While you're in the codebase, grep for any remaining references to "v2" or "coming soon" or "available in v2":

```bash
grep -rn "v2\|coming soon\|available in v2" app/ lib/ --include="*.ts" --include="*.tsx"
```

Update ANY references that point at OCR or decrypt as "v2" or "coming soon" — both are now implemented in v1. Specifically check:

- `app/docs/page.tsx` — any "Coming soon" badges on OCR or decrypt should be removed
- Any other route files with similar stale comments
- Any README files that reference v2

Leave intact any LEGITIMATE v2 references (e.g., features genuinely not yet built, like the to-pdf endpoint on the Markdown API — but that's a different repo, not this one).

---

## Verify locally

```bash
npm run build
```

Must complete with exit 0. This should be a quick fix with no other cascading type errors since the previous builds got all the way through compilation and only failed at this one specific type check.

If build passes:
```bash
git add -A && git commit -m "fix: add note field to extract/text responseData type + remove stale v2 OCR reference"
git push origin main
```

---

## Smoke Tests

| # | Scenario | Steps | Expected Result | Pass/Fail |
|---|----------|-------|-----------------|-----------|
| 1 | Build compiles locally | `npm run build` | Exit 0 | |
| 2 | Vercel deploy succeeds | Push to main | Green deployment | |
| 3 | Extract text on text PDF | `POST /extract/text` with text-based PDF | 200, text extracted, no note field | |
| 4 | Extract text on scanned PDF | `POST /extract/text` with image-only scanned PDF | 200, empty text, `note` field present | |
| 5 | Note message points at OCR endpoint | Check note field content | Mentions `/api/v1/extract/ocr`, NOT "v2" | |
| 6 | No stale v2 references in code | `grep -rn "available in v2" app/ lib/` | Returns zero results | |
| 7 | Other endpoints unaffected | Spot-check /merge, /encrypt, /extract/metadata | All still work | |
