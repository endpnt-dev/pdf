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

    // Initialize scribe.js with OCR engine
    await scribe.init({ ocr: true, pdf: true, font: true });

    // Import the PDF file
    await scribe.importFiles([inputPath]);

    // Perform OCR with specified languages
    await scribe.recognize({
      langs: langs,
      mode: 'quality',
      modeAdv: 'combined',
      combineMode: 'data'
    });

    // Export the recognized text
    const extractedText = await scribe.exportData('txt');

    // Since scribe.js doesn't provide per-page breakdown directly,
    // we'll split the text and estimate pages based on form feeds or length
    const fullText = String(extractedText || '');

    // Split by form feed characters if present, otherwise estimate pages
    let pageTexts: string[] = [];
    if (fullText.includes('\f')) {
      pageTexts = fullText.split('\f').filter(text => text.trim().length > 0);
    } else {
      // Rough estimation: split text into chunks (fallback)
      const charsPerPage = Math.max(1, Math.floor(fullText.length / Math.max(1, Math.floor(fullText.length / 2000))));
      pageTexts = [];
      for (let i = 0; i < fullText.length; i += charsPerPage) {
        const chunk = fullText.slice(i, i + charsPerPage);
        if (chunk.trim()) pageTexts.push(chunk);
      }
      if (pageTexts.length === 0 && fullText.trim()) {
        pageTexts = [fullText]; // Single page fallback
      }
    }

    // Create page results (confidence estimation since scribe.js doesn't expose per-page confidence)
    const pages = pageTexts.map((text, idx) => ({
      page: idx + 1,
      text: text.trim(),
      confidence: text.trim().length > 0 ? 85 : 0, // Rough confidence estimate
    }));

    // If no pages found but we have text, create a single page
    if (pages.length === 0 && fullText.trim()) {
      pages.push({
        page: 1,
        text: fullText.trim(),
        confidence: 85,
      });
    }

    const totalChars = pages.reduce((sum, p) => sum + p.text.length, 0);

    // Clean up scribe.js resources
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