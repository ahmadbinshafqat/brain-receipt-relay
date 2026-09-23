import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { Receipt } from './types.js';

const dbDir = path.dirname(config.databasePath);
fs.mkdirSync(dbDir, { recursive: true });

export const db = new Database(config.databasePath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY,
    createdAt TEXT NOT NULL,
    sourceType TEXT NOT NULL,
    merchant TEXT,
    date TEXT,
    currency TEXT NOT NULL,
    subtotal REAL,
    tax REAL,
    tip REAL,
    total REAL,
    rawText TEXT NOT NULL,
    lineItems TEXT NOT NULL,
    confidence REAL NOT NULL
  );
`);

export function saveReceipt(receipt: Receipt): Receipt {
  db.prepare(`
    INSERT INTO receipts (
      id, createdAt, sourceType, merchant, date, currency, subtotal, tax, tip, total, rawText, lineItems, confidence
    ) VALUES (
      @id, @createdAt, @sourceType, @merchant, @date, @currency, @subtotal, @tax, @tip, @total, @rawText, @lineItems, @confidence
    )
  `).run({ ...receipt, lineItems: JSON.stringify(receipt.lineItems) });
  return receipt;
}

export function listReceipts(): Receipt[] {
  const rows = db.prepare('SELECT * FROM receipts ORDER BY createdAt DESC LIMIT 25').all() as Array<Omit<Receipt, 'lineItems'> & { lineItems: string }>;
  return rows.map((row) => ({ ...row, lineItems: JSON.parse(row.lineItems) }));
}

export function getReceipt(id: string): Receipt | null {
  const row = db.prepare('SELECT * FROM receipts WHERE id = ?').get(id) as (Omit<Receipt, 'lineItems'> & { lineItems: string }) | undefined;
  return row ? { ...row, lineItems: JSON.parse(row.lineItems) } : null;
}
