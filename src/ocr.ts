import { createWorker } from 'tesseract.js';
import { config } from './config.js';

export async function extractTextFromImage(filePath: string): Promise<string> {
  const worker = await createWorker(config.ocrLang);
  try {
    const result = await worker.recognize(filePath);
    return result.data.text || '';
  } finally {
    await worker.terminate();
  }
}
