import cors from 'cors';
import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { getReceipt, listReceipts, saveReceipt } from './db.js';
import { extractTextFromImage } from './ocr.js';
import { parseReceipt } from './parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const uploadDir = path.join(projectRoot, 'uploads');
await fs.mkdir(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|bmp|tiff)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image uploads are supported.'));
  }
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(projectRoot, 'public')));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/receipts', (_req, res) => res.json({ receipts: listReceipts() }));
app.get('/api/receipts/:id', (req, res) => {
  const receipt = getReceipt(req.params.id);
  if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
  return res.json({ receipt });
});

app.post('/api/receipts/parse', upload.single('image'), async (req, res, next) => {
  let uploadedPath: string | undefined;
  try {
    const file = req.file;
    uploadedPath = file?.path;
    const pastedText = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    let rawText = pastedText;
    let sourceType: 'text' | 'image' = 'text';

    if (file) {
      sourceType = 'image';
      const ocrText = await extractTextFromImage(file.path);
      rawText = [pastedText, ocrText].filter(Boolean).join('\n').trim();
    }

    if (!rawText) return res.status(400).json({ error: 'Provide pasted receipt text or upload an image.' });

    const receipt = saveReceipt(parseReceipt(rawText, sourceType));
    return res.json({ receipt });
  } catch (err) {
    return next(err);
  } finally {
    if (uploadedPath) fs.unlink(uploadedPath).catch(() => undefined);
  }
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : 'Unexpected server error';
  res.status(500).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`Receipt Relay running at http://localhost:${config.port}`);
});
