# CC TASK: Fix PDF build failures — pdf-lib compress options + @napi-rs/canvas bundling

**File(s):** `app/api/v1/compress/route.ts` and `next.config.js`

---

## Change 1 — Fix compress/route.ts pdf-lib save options

### Problem
Build fails with:
```
./app/api/v1/compress/route.ts:53:5
Type error: Object literal may only specify known properties,
and 'addDefaultPrefixToObjectStreams' does not exist in type
```

The property `addDefaultPrefixToObjectStreams` does NOT exist in pdf-lib's `SaveOptions` type. It was hallucinated.

### The actual pdf-lib `pdfDoc.save()` API
Only these options exist:
```typescript
interface SaveOptions {
  useObjectStreams?: boolean;       // default: true
  objectsPerTick?: number;          // default: 50
  updateFieldAppearances?: boolean; // default: true
}
```

### Fix
In `app/api/v1/compress/route.ts` around line 51-55, find the `pdfDoc.save({...})` call and REMOVE the `addDefaultPrefixToObjectStreams` line. Keep only `useObjectStreams` and `objectsPerTick`.

**Before (broken):**
```typescript
const compressedBytes = await pdfDoc.save({
  useObjectStreams: settings.useObjectStreams,
  addDefaultPrefixToObjectStreams: settings.addDefaultPrefixToObjectStreams,
  objectsPerTick: settings.objectsPerTick,
})
```

**After (fixed):**
```typescript
const compressedBytes = await pdfDoc.save({
  useObjectStreams: settings.useObjectStreams,
  objectsPerTick: settings.objectsPerTick,
})
```

Also remove any reference to `addDefaultPrefixToObjectStreams` from the `settings` object (or wherever it's defined) if it's used only in this file. If it's defined in a shared config, remove it there too. Search for the string `addDefaultPrefixToObjectStreams` across the whole codebase and remove every instance — it's not a valid pdf-lib option anywhere.

Verification:
```bash
grep -r "addDefaultPrefixToObjectStreams" .
```
Should return zero results after the fix.

---

## Change 2 — Fix @napi-rs/canvas webpack bundling error

### Problem
Build fails with:
```
./node_modules/@napi-rs/canvas-linux-x64-gnu/skia.linux-x64-gnu.node
Module parse failed: Unexpected character ' ' (1:0)
```

Next.js webpack tries to parse the native `.node` binary as JavaScript. Native binaries must be excluded from webpack bundling and treated as external dependencies that Node loads at runtime.

This pattern (serverComponentsExternalPackages + webpack externals) is the Next.js 14-recommended solution for native modules like @napi-rs/canvas. Verified via Next.js 14 official docs.

### Fix
Replace `next.config.js` entirely with the config below.

Two things changed:
1. The current config has `serverExternalPackages` at the top level — that key is invalid in Next 14 and triggers the "Invalid next.config.js options detected" warning visible in the build logs. Next 14 expects it as `experimental.serverComponentsExternalPackages`.
2. Add webpack externals fallback for `@napi-rs/canvas` specifically — this catches it in any code path where `serverComponentsExternalPackages` alone isn't sufficient (notably for neon-bindings native modules).

**Replace `next.config.js` entirely with:**

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
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't try to bundle native .node binaries — let Node load them at runtime
      config.externals = [
        ...(config.externals || []),
        { '@napi-rs/canvas': 'commonjs @napi-rs/canvas' },
      ];
    }
    return config;
  },
};

module.exports = nextConfig;
```

### Why this works
- `serverComponentsExternalPackages` tells Next.js: "these packages should run in Node's native module system, not webpack's bundle." This is the modern, preferred way.
- The webpack `externals` entry is a fallback specifically for native modules with `.node` binaries (neon bindings). Without this, webpack may still try to parse the `.node` file even when the package is listed in `serverComponentsExternalPackages`.
- This configuration is taken directly from Next.js 14 official guidance on native module handling.

### Do NOT add node-loader unless needed
An earlier version of this spec suggested adding `node-loader` as a dev dependency. Try WITHOUT it first — the two-part fix above should be sufficient.

ONLY if the build still fails with the same `.node` parse error after applying the fix above, add node-loader as a fallback:

```bash
npm install --save-dev node-loader
```

Then add inside the webpack function:
```javascript
config.module.rules.push({
  test: /\.node$/,
  use: 'node-loader',
});
```

Document clearly in commit message if node-loader becomes necessary.

---

## Why

Both of these are blocking every deployment to `pdf.endpnt.dev`. Phase 2 onward has failed on each commit. The first fix is a straight hallucinated-API error. The second is a known Next.js + native-module gotcha.

## Verify

After applying both fixes:

```bash
npm install
npm run build
```

Build must complete successfully with:
- No TypeScript errors
- No webpack parse errors on `.node` files
- No "Invalid next.config.js options detected" warning

If and only if build succeeds locally:
```bash
git add -A && git commit -m "fix: pdf-lib compress options + @napi-rs/canvas webpack externals"
git push origin main
```

Watch Vercel deployment — should go green.

## IMPORTANT — Process change going forward

From this point forward in this build (and on all future endpnt API builds), CC must run `npm run build` locally BEFORE every `git push`. The local build catches TypeScript errors, config errors, and webpack errors that Vercel also catches — discovering them locally saves a full CI cycle per failure.

If `npm run build` fails locally: do NOT push. Fix first, build again, only then push.

## Smoke Tests

| # | Scenario | Steps | Expected Result | Pass/Fail |
|---|----------|-------|-----------------|-----------|
| 1 | Build compiles locally | `npm run build` after fixes | Completes with exit 0, no errors, no warnings about invalid config | |
| 2 | Build compiles on Vercel | Push to main, check Vercel dashboard | Deployment shows "Ready" in green | |
| 3 | No references to invalid pdf-lib option | `grep -r "addDefaultPrefixToObjectStreams" .` | Returns zero results | |
| 4 | No serverExternalPackages at top level | `grep "serverExternalPackages" next.config.js` | Returns zero results (it's now under experimental) | |
| 5 | Compress endpoint works | `POST /api/v1/compress` with a test PDF + valid API key | Returns 200 with compressed PDF | |
| 6 | Render endpoint works | `POST /api/v1/render` with a test PDF | Returns 200 with base64 PNG | |
| 7 | Health check still works | `GET /api/v1/health` | Returns 200 `{ status: "ok" }` | |
| 8 | No invalid next.config.js warning in Vercel logs | Review Vercel build logs after push | No "Invalid next.config.js options detected" warning | |

DO NOT PUSH until `npm run build` passes locally.
