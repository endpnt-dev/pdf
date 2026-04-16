# CC TASK: Switch qpdf install to Option B (bundled binary)

**Context:** Option A (`apt-get install qpdf` in buildCommand) failed with `apt-get: command not found`. Vercel's build environment is Amazon Linux-based, not Debian/Ubuntu, and doesn't grant root access for package installation regardless of distro.

This is the expected fallback path documented in the previous spec. Switch to bundling the qpdf binary directly in the repo.

---

## Fix steps

### 1. Remove the buildCommand from `vercel.json`

The current `vercel.json` has:
```json
"buildCommand": "apt-get update && apt-get install -y qpdf && npm run build"
```

Remove that line entirely. Keep the `functions` config (memory + maxDuration per route). The default build command (`npm run build`) will run automatically without specification.

Expected final `vercel.json`:
```json
{
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

### 2. Download qpdf Linux x64 binary

From WSL (local machine):

```bash
cd /mnt/c/Repositories/endpnt/pdf
mkdir -p bin/qpdf

# Download qpdf v11 Linux x64 binary
curl -L -o /tmp/qpdf.zip https://github.com/qpdf/qpdf/releases/download/v11.9.1/qpdf-11.9.1-bin-linux-x86_64.zip

# Extract
cd /tmp
unzip -q qpdf.zip
cd qpdf-11.9.1-bin-linux-x86_64

# Copy the binary AND its required shared libraries into repo
# qpdf ships with .so dependencies that must travel with it
cp qpdf /mnt/c/Repositories/endpnt/pdf/bin/qpdf/
cp -r libqpdf/ /mnt/c/Repositories/endpnt/pdf/bin/qpdf/ 2>/dev/null || true

# Back to repo
cd /mnt/c/Repositories/endpnt/pdf

# Verify the binary is executable
chmod +x bin/qpdf/qpdf
ls -la bin/qpdf/
```

**Verify the binary works locally (requires WSL x86_64 Linux):**
```bash
./bin/qpdf/qpdf --version
# Should output: qpdf version 11.9.1
```

If WSL is x86_64 Linux (most common), the binary will run locally AND on Vercel (both are x86_64 Linux).

### 3. Add `bin/qpdf` to git tracking

The binary needs to be committed so Vercel can access it during build:

```bash
# Check .gitignore doesn't exclude bin/
cat .gitignore | grep bin
```

If `bin/` is excluded, remove that line. Binaries SHOULD be in the repo for this deployment pattern.

Note on repo size: the qpdf binary is roughly 7MB. Acceptable for a repo of this scope.

### 4. Update `lib/qpdf.ts` to use the bundled binary

At the top of `lib/qpdf.ts`, BEFORE the import statements from node-qpdf2, set the QPDF_PATH env var:

```typescript
// Set qpdf binary path before importing node-qpdf2
// Binary is bundled in bin/qpdf/ and traced into the function by Next.js
import { join } from 'path';

// Only override if QPDF_PATH isn't already set (allows external override)
if (!process.env.QPDF_PATH) {
  // In Vercel serverless, __dirname is inside .next/server/chunks/...
  // process.cwd() is the function root, where bin/ lives after tracing
  process.env.QPDF_PATH = join(process.cwd(), 'bin', 'qpdf', 'qpdf');
}

import { encrypt as qpdfEncrypt, decrypt as qpdfDecrypt, info as qpdfInfo } from 'node-qpdf2';
// ... rest of the existing file
```

**Critical:** The env var must be set BEFORE `node-qpdf2` is imported, because node-qpdf2 reads QPDF_PATH at module-load time.

### 5. Update `next.config.js` to trace the bin/ directory

Find the `experimental` block and uncomment/add `outputFileTracingIncludes`:

```javascript
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
  outputFileTracingIncludes: {
    '/api/v1/encrypt': ['./bin/qpdf/**/*'],
    '/api/v1/decrypt': ['./bin/qpdf/**/*'],
  },
},
```

This tells Next.js: "When building the serverless function for these routes, include everything under `bin/qpdf/`." Without this, Vercel's tree-shaking would omit the binary because nothing imports it via JS.

### 6. Verify `lib/qpdf.ts` sets the binary as executable at runtime

On Vercel, files traced in via `outputFileTracingIncludes` may lose their executable bit. Add a chmod call at module load, after the env var is set but before any qpdf call:

```typescript
import { chmodSync } from 'fs';
import { existsSync } from 'fs';

if (!process.env.QPDF_PATH) {
  process.env.QPDF_PATH = join(process.cwd(), 'bin', 'qpdf', 'qpdf');
}

// Ensure the qpdf binary is executable at runtime
// Tracing preserves files but may not preserve the +x bit
try {
  if (existsSync(process.env.QPDF_PATH)) {
    chmodSync(process.env.QPDF_PATH, 0o755);
  }
} catch (err) {
  // Log but don't crash — attempt to continue
  console.warn('Could not chmod qpdf binary:', err);
}
```

Alternatively, configure git to track the executable bit (`git update-index --chmod=+x bin/qpdf/qpdf`) — but the runtime chmod is more reliable because it doesn't depend on git preserving permissions across all environments.

---

## Verify locally before push

```bash
# Verify binary is in place
ls -la bin/qpdf/qpdf

# Build
npm run build
```

If `npm run build` passes, the Next.js tracing is working.

If you have qpdf installed on WSL already (`sudo apt install qpdf`), you can also test endpoints locally:
```bash
npm run dev
# In another terminal, hit encrypt/decrypt endpoints with a test PDF
```

**IMPORTANT: Test locally that the bundled binary works, NOT just the system qpdf.** You can verify this by temporarily unsetting the system qpdf alias or running the bundled binary directly: `./bin/qpdf/qpdf --version`.

---

## Commit

```bash
git add -A && git commit -m "fix: bundle qpdf binary directly (Option B) — apt-get unavailable on Vercel"
git push origin main
```

---

## Smoke Tests

| # | Scenario | Steps | Expected Result | Pass/Fail |
|---|----------|-------|-----------------|-----------|
| 1 | Local build passes | `npm run build` | Exit 0 | |
| 2 | Binary present in repo | `ls bin/qpdf/qpdf` | File exists, ~7MB | |
| 3 | Binary executable locally | `./bin/qpdf/qpdf --version` | Outputs version 11.9.1 | |
| 4 | Vercel deploy succeeds | Push to main | Deployment green | |
| 5 | qpdf resolves at runtime | First invocation of /encrypt | No "qpdf not found" error | |
| 6 | Encrypt works end-to-end | POST /encrypt with PDF + password | 200 with encrypted PDF | |
| 7 | Decrypt works end-to-end | POST /decrypt with encrypted PDF + password | 200 with decrypted PDF | |
| 8 | Binary is executable on Vercel | Check Vercel logs for any EACCES errors | None | |
| 9 | OCR unaffected | POST /extract/ocr | Works (scribe.js didn't depend on qpdf) | |
| 10 | Round trip | Encrypt → decrypt same PDF with same password | Functionally equivalent output | |

---

## If this also fails

If Vercel's file tracing still doesn't include the binary despite `outputFileTracingIncludes`, a final escape hatch is to inline-require the binary path in the route handler itself, forcing Vercel's tracer to detect the reference:

```typescript
// At top of encrypt/route.ts and decrypt/route.ts
import path from 'path';
const QPDF_BIN = path.join(process.cwd(), 'bin', 'qpdf', 'qpdf');
// Next.js will see this path reference and ensure bin/qpdf is traced
```

Only apply this if Option B as-specified doesn't work — it's a workaround for Vercel tracing edge cases.
