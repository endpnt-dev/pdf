# CC TASK: Fix PDF build failures — ROUND 2 (previous fix applied incorrectly)

**File(s):** `next.config.js` (and `app/api/v1/compress/route.ts` if not already fixed)

**Critical context:** The previous fix spec was applied but CC deviated from the instructions. The `next.config.js` now has `serverExternalPackages` at the top level (a Next 15 key, invalid in Next 14) and a `turbopack: {}` key (also invalid in Next 14). Vercel logs confirm: "Unrecognized key(s) in object: 'serverExternalPackages', 'turbopack'".

This round-2 fix is a VERBATIM file replacement. Do not edit line-by-line. Overwrite the entire file exactly as shown below.

---

## Next.js 14 vs 15 config key — this has been the root cause of repeated failures

**Next.js 14.2.x (which this project uses):**
- Key must be `experimental.serverComponentsExternalPackages` — nested inside `experimental: {}`
- Top-level `serverExternalPackages` is INVALID and will produce the "Unrecognized key(s)" warning
- No separate `turbopack` config key exists in Next 14 stable config

**Next.js 15+:**
- Key is top-level `serverExternalPackages` (renamed and promoted out of experimental)
- This is what CC has been writing, and it's wrong for Next 14

Verified source: https://nextjs.org/docs/14/app/api-reference/next-config-js/serverComponentsExternalPackages

Package.json says `"next": "^14.2.15"`. Build logs say `Detected Next.js version: 14.2.35`. DO NOT use Next 15 config syntax.

---

## FIX — Verbatim file replacement

### Replace the ENTIRE contents of `next.config.js` with exactly this:

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
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
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

### Key changes from current broken version:
1. `serverExternalPackages` (top-level) → REMOVED
2. `turbopack: {}` → REMOVED (invalid in Next 14)
3. `experimental.serverComponentsExternalPackages` → ADDED with the same package list
4. `webpack.externals` → ADDED for `@napi-rs/canvas` as a belt-and-suspenders fallback
5. `images` config → PRESERVED from current version

### What you MUST NOT do:
- Do NOT keep `serverExternalPackages` at the top level.
- Do NOT keep `turbopack: {}`.
- Do NOT "migrate to Next 15 syntax" — the project is on Next 14 and this is not a version upgrade.
- Do NOT add any config keys not shown above unless required for a separate reason.

---

## Also verify Change 1 from previous fix stuck

Run this to confirm the pdf-lib fix is still applied:
```bash
grep -rn "addDefaultPrefixToObjectStreams" .
```
Must return zero results. If any results, apply the previous fix spec's Change 1 (remove that option from the pdf-lib save call in `app/api/v1/compress/route.ts`).

---

## Verify — MANDATORY LOCAL BUILD

After replacing `next.config.js`:

```bash
npm run build
```

**Required outcomes (all three must be true):**
1. Exit code 0 (build succeeded)
2. NO "Invalid next.config.js options detected" warning in output
3. NO "Module parse failed" errors on `.node` files

If any of these fail, do NOT push. Debug locally first.

If all three pass:
```bash
git add -A && git commit -m "fix: correct next.config.js to Next 14 syntax (experimental.serverComponentsExternalPackages)"
git push origin main
```

---

## Smoke Tests

| # | Scenario | Steps | Expected Result | Pass/Fail |
|---|----------|-------|-----------------|-----------|
| 1 | Local build succeeds | `npm run build` | Exit 0, no errors, no warnings | |
| 2 | No invalid config warning | Check local build output | No "Unrecognized key(s)" warning | |
| 3 | No webpack parse error | Check local build output | No "Module parse failed" on .node files | |
| 4 | Top-level serverExternalPackages gone | `grep "^\s*serverExternalPackages" next.config.js` | Returns zero results | |
| 5 | experimental key present | `grep "serverComponentsExternalPackages" next.config.js` | Returns one result (inside experimental) | |
| 6 | No turbopack key | `grep "turbopack" next.config.js` | Returns zero results | |
| 7 | Vercel deploy succeeds | Push to main, check Vercel | Deployment turns green | |
| 8 | No "Unrecognized key(s)" in Vercel logs | View Vercel build logs | Warning is absent | |
| 9 | Compress endpoint works | `POST /api/v1/compress` with test PDF | Returns 200 with compressed PDF | |
| 10 | Render endpoint works | `POST /api/v1/render` with test PDF | Returns 200 with base64 PNG | |

---

## Process note for CC

For all subsequent endpnt API builds, remember:
- This project uses Next 14, not Next 15. Use Next 14 config syntax.
- Always run `npm run build` locally BEFORE `git push`.
- When a spec says "replace the entire file with exactly this", do NOT merge with existing contents. Overwrite.
- If uncertain about Next.js version-specific syntax, reference https://nextjs.org/docs/14/ (version-specific docs), not the latest unversioned docs.
