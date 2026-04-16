// Set qpdf binary path before importing node-qpdf2
// Binary is bundled in bin/qpdf/ and traced into the function by Next.js
import { join } from 'path';
import { chmodSync, existsSync } from 'fs';

// Only override if QPDF_PATH isn't already set (allows external override)
if (!process.env.QPDF_PATH) {
  // In Vercel serverless, __dirname is inside .next/server/chunks/...
  // process.cwd() is the function root, where bin/ lives after tracing
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

import { encrypt as qpdfEncrypt, decrypt as qpdfDecrypt, info as qpdfInfo } from 'node-qpdf2';
import { randomUUID } from 'crypto';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';

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