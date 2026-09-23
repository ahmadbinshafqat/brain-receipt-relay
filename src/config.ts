import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3000),
  databasePath: process.env.DATABASE_PATH || './data/receipts.db',
  ocrLang: process.env.OCR_LANG || 'eng',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 8)
};
