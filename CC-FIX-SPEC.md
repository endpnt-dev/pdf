# CC TASK: Fix watermark rotation type error

**File:** `app/api/v1/watermark/route.ts`

---

## ⚠️ Before starting, read:
1. `CLAUDE.md` (this repo)
2. `C:\Repositories\endpnt\CLAUDE.md` (platform-wide rules)

Non-negotiables from those files:
- Run `npm run build` locally BEFORE pushing. Exit code must be 0.
- TypeScript errors are blockers, not "minor issues for follow-up."
- Task is NOT done until Vercel deploys green.

---

## Problem

Build fails at `app/api/v1/watermark/route.ts:130:9`:

```
Type error: Type '{ angle: number; } | undefined' is not assignable to type 'Rotation | undefined'.
  Type '{ angle: number; }' is not assignable to type 'Rotation | undefined'.
    Property 'type' is missing in type '{ angle: number; }' but required in type 'Degrees'.
```

## Root cause

pdf-lib's `Rotation` type is a tagged union requiring a `type` discriminator:

```typescript
type Rotation = Degrees | Radians;
interface Degrees { type: 'degrees'; angle: number; }
interface Radians { type: 'radians'; angle: number; }
```

The current code writes `{ angle: rotation }` without the `type` field. TypeScript correctly rejects this.

pdf-lib provides helper functions to construct these properly: `degrees(n)` and `radians(n)`. The `rotate/route.ts` file in THIS SAME REPO already uses `degrees()` correctly:

```typescript
// app/api/v1/rotate/route.ts — correct pattern
import { PDFDocument, degrees } from 'pdf-lib'
// ...
page.setRotation(degrees(rotationToApply))
```

The watermark route should follow the same pattern.

## Fix

### Step 1: Import `degrees` from pdf-lib

Line 2 currently reads:
```typescript
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
```

Change to:
```typescript
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'
```

### Step 2: Fix both rotation call sites

**There are TWO identical bugs in this file — both must be fixed.**

**Bug 1 — line 130 (text watermark):**

```typescript
// BEFORE
page.drawText(text, {
  x,
  y,
  size: font_size,
  font,
  color: textColor,
  opacity: opacity / 100,
  rotate: rotation ? { angle: rotation } : undefined,
})

// AFTER
page.drawText(text, {
  x,
  y,
  size: font_size,
  font,
  color: textColor,
  opacity: opacity / 100,
  rotate: rotation ? degrees(rotation) : undefined,
})
```

**Bug 2 — around line 146 (image watermark):**

```typescript
// BEFORE
page.drawImage(watermarkImage, {
  x,
  y,
  width: imageDims.width,
  height: imageDims.height,
  opacity: opacity / 100,
  rotate: rotation ? { angle: rotation } : undefined,
})

// AFTER
page.drawImage(watermarkImage, {
  x,
  y,
  width: imageDims.width,
  height: imageDims.height,
  opacity: opacity / 100,
  rotate: rotation ? degrees(rotation) : undefined,
})
```

Both call sites use the SAME fix: replace `{ angle: rotation }` with `degrees(rotation)`.

### Step 3: Grep for any other instances

Before running the build, check for any remaining occurrences of this bad pattern:

```bash
grep -rn "{ angle:" app/ lib/
```

Should return zero results after the fix is applied.

Also check for similar hallucinated pdf-lib patterns:

```bash
grep -rn "rotate:.*angle" app/ lib/
```

If any results exist outside the two fixes above, they need the same treatment.

---

## Verify — MANDATORY LOCAL BUILD

Per CLAUDE.md "Definition of Done" section — DO NOT SKIP:

```bash
npm run build
```

**All three conditions must hold:**
1. Exit code 0
2. No TypeScript errors
3. No new warnings

If `npm run build` fails, fix the new error locally. Do NOT push speculative fixes.

If all three pass:
```bash
git add app/api/v1/watermark/route.ts
git commit -m "fix: use pdf-lib degrees() helper for watermark rotation (not { angle })"
git push origin main
```

---

## Smoke Tests

After Vercel deployment shows green:

| # | Scenario | Steps | Expected Result | Pass/Fail |
|---|----------|-------|-----------------|-----------|
| 1 | Local build passes | `npm run build` | Exit 0 | |
| 2 | Vercel deploys green | Check Vercel after push | Green deployment | |
| 3 | Text watermark — no rotation | `POST /api/v1/watermark` with text, position: "center" | 200 with watermarked PDF, text appears centered, not rotated | |
| 4 | Text watermark — diagonal | `POST /api/v1/watermark` with text, position: "diagonal" | 200 with watermarked PDF, text appears at 45° angle | |
| 5 | Image watermark — no rotation | `POST /api/v1/watermark` with watermark_url, position: "center" | 200 with watermarked PDF, image unrotated | |
| 6 | Image watermark — diagonal | `POST /api/v1/watermark` with watermark_url, position: "diagonal" | 200 with watermarked PDF, image at 45° | |
| 7 | Grep returns zero `{ angle:` | `grep -rn "{ angle:" app/ lib/` | Zero results | |
| 8 | Other endpoints unaffected | Spot-check /merge, /split, /rotate | Still work as before | |

---

## Honest status report format

When complete, report in this format (per CLAUDE.md):

```
Fix applied to app/api/v1/watermark/route.ts — added `degrees` import,
replaced two `{ angle: rotation }` call sites with `degrees(rotation)`.
`npm run build` passes locally with exit 0.
Pushed as <commit-hash>.
Vercel deployment <green|red>.
Smoke tests: <X of 8 pass>.
```

Do NOT report "main objective completed" with caveats about remaining issues. Either the build is green or it isn't.

---

## If Vercel reveals ANOTHER type error

If this fix lands green locally but Vercel produces a NEW TypeScript error in a different file:

1. Do NOT declare "main objective complete, minor issues remaining"
2. Do NOT push a follow-up speculative fix
3. Report the new error verbatim and ask for guidance

Today's theme: TypeScript is finally getting deep enough in the build to find pre-existing bugs. Each one is an opportunity to fix properly, not to rationalize away.
