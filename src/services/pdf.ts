/**
 * PDF slide extraction with pdf.js.
 *
 * The PDF never leaves the device: each page is rendered to an image for display and its
 * text is extracted for the classroom. Only the extracted text is ever sent to the AI.
 */
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Slide } from '@/types';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export const MAX_SLIDES = 40;
export const MAX_FILE_MB = 30;

export interface LoadResult {
  slides: Slide[];
  truncated: boolean;
}

export async function loadSlides(file: File, onProgress: (done: number, total: number) => void = () => {}): Promise<LoadResult> {
  if (!file) throw new Error('Choose a PDF file first.');
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) {
    if (/\.pptx?$/i.test(file.name)) {
      throw new Error('PowerPoint files need to be saved as a PDF first. In PowerPoint or Google Slides, use File, then Download or Export, then PDF.');
    }
    throw new Error('That file is not a PDF. Upload your slides as a PDF.');
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new Error(`That PDF is larger than ${MAX_FILE_MB} MB. Try exporting it with smaller images.`);
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjsLib.getDocument({ data });
  let doc: PDFDocumentProxy;
  try {
    doc = await task.promise;
  } catch {
    throw new Error('This PDF could not be opened. It may be damaged or password protected.');
  }

  const count = Math.min(doc.numPages, MAX_SLIDES);
  const slides: Slide[] = [];
  try {
    for (let i = 1; i <= count; i++) {
      onProgress(i, count);
      const page = await doc.getPage(i);
      const text = await pageText(page);
      const image = await renderPage(page);
      const title = (text.split('\n').find((line) => line.trim()) || '').trim().slice(0, 90);
      slides.push({ n: i, text, image, title });
      page.cleanup();
    }
  } finally {
    task.destroy().catch(() => {});
  }
  return { slides, truncated: doc.numPages > MAX_SLIDES };
}

async function pageText(page: PDFPageProxy): Promise<string> {
  const content = await page.getTextContent();
  let out = '';
  for (const item of content.items) {
    if (!('str' in item)) continue;
    out += item.str;
    out += item.hasEOL ? '\n' : ' ';
  }
  return out.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

async function renderPage(page: PDFPageProxy): Promise<string> {
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2, 1600 / base.width);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not render this PDF in your browser.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  const url = canvas.toDataURL('image/jpeg', 0.85);
  canvas.width = 0;
  canvas.height = 0;
  return url;
}
