import { v4 as uuidv4 } from 'uuid';
import { LineItem, Receipt, SourceType } from './types.js';

const moneyRegex = /([$€£])?\s*(-?\d{1,4}(?:[,.]\d{3})*(?:[.,]\d{2})|-?\d+[.,]\d{2})\b/g;
const totalLabels = /\b(grand\s+total|amount\s+due|balance\s+due|total)\b/i;
const subtotalLabels = /\b(sub\s*total|subtotal)\b/i;
const taxLabels = /\b(tax|vat|hst|gst|sales\s+tax)\b/i;
const tipLabels = /\b(tip|gratuity|service\s+charge)\b/i;
const skipItemLabels = /\b(change|cash|card|visa|mastercard|amex|auth|approved|payment|tender|refund|discount|coupon|total|subtotal|tax|tip|gratuity|balance|amount due)\b/i;

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function parseMoney(raw: string): number {
  const cleaned = raw.replace(/[^\d,.-]/g, '');
  const normalized = cleaned.includes(',') && !cleaned.includes('.') ? cleaned.replace(',', '.') : cleaned.replace(/,/g, '');
  return Math.round(Number(normalized) * 100) / 100;
}

function moneyValues(line: string): number[] {
  const matches = [...line.matchAll(moneyRegex)].map((m) => parseMoney(m[0])).filter((n) => Number.isFinite(n));
  return matches;
}

function lastMoney(line: string): number | null {
  const vals = moneyValues(line);
  return vals.length ? vals[vals.length - 1] : null;
}

function detectCurrency(text: string): string {
  if (text.includes('€')) return 'EUR';
  if (text.includes('£')) return 'GBP';
  if (/\b(CAD|C\$)\b/i.test(text)) return 'CAD';
  if (/\b(AUD|A\$)\b/i.test(text)) return 'AUD';
  return 'USD';
}

function detectDate(lines: string[]): string | null {
  const patterns = [
    /\b(20\d{2}|19\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/,
    /\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|19\d{2}|\d{2})\b/
  ];
  for (const line of lines) {
    for (const pattern of patterns) {
      const m = line.match(pattern);
      if (!m) continue;
      if (m[1].length === 4) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
      const year = m[3].length === 2 ? `20${m[3]}` : m[3];
      return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    }
  }
  return null;
}

function detectMerchant(lines: string[]): string | null {
  const bad = /\b(receipt|invoice|date|tel|phone|www|http|tax|total|subtotal)\b/i;
  for (const line of lines.slice(0, 8)) {
    if (line.length >= 3 && !bad.test(line) && !moneyValues(line).length) return line.replace(/[^a-zA-Z0-9 '&.-]/g, '').trim();
  }
  return lines[0] || null;
}

function labeledAmount(lines: string[], labels: RegExp): number | null {
  let value: number | null = null;
  for (const line of lines) {
    if (labels.test(line)) {
      const amount = lastMoney(line);
      if (amount !== null) value = amount;
    }
  }
  return value;
}

function parseLineItems(lines: string[]): LineItem[] {
  const items: LineItem[] = [];
  for (const line of lines) {
    if (skipItemLabels.test(line)) continue;
    const vals = moneyValues(line);
    if (!vals.length) continue;
    const amount = vals[vals.length - 1];
    if (amount <= 0) continue;
    const name = line.replace(moneyRegex, '').replace(/\b(qty|quantity|each|ea)\b/gi, '').replace(/[*#]/g, '').trim();
    if (name.length < 2 || /^\d+$/.test(name)) continue;
    let qty = 1;
    const qtyMatch = line.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*[x@]\s*/i) || line.match(/\bqty\s*[:x]?\s*(\d+(?:\.\d+)?)/i);
    if (qtyMatch) qty = Number(qtyMatch[1]);
    const unitPrice = Math.round((amount / qty) * 100) / 100;
    items.push({ name, qty, unitPrice, amount });
  }
  return items.slice(0, 50);
}

function confidence(receipt: Omit<Receipt, 'confidence'>): number {
  let score = 0.15;
  if (receipt.merchant) score += 0.15;
  if (receipt.date) score += 0.15;
  if (receipt.total !== null) score += 0.2;
  if (receipt.subtotal !== null) score += 0.1;
  if (receipt.tax !== null) score += 0.1;
  if (receipt.lineItems.length) score += 0.15;
  return Math.min(0.98, Math.round(score * 100) / 100);
}

export function parseReceipt(rawText: string, sourceType: SourceType): Receipt {
  const lines = normalizeLines(rawText);
  const subtotal = labeledAmount(lines, subtotalLabels);
  const tax = labeledAmount(lines, taxLabels);
  const tip = labeledAmount(lines, tipLabels);
  let total = labeledAmount(lines, totalLabels);
  if (total === null) {
    const allMoney = lines.flatMap(moneyValues).filter((n) => n > 0);
    total = allMoney.length ? Math.max(...allMoney) : null;
  }
  const draft: Omit<Receipt, 'confidence'> = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    sourceType,
    merchant: detectMerchant(lines),
    date: detectDate(lines),
    currency: detectCurrency(rawText),
    subtotal,
    tax,
    tip,
    total,
    rawText,
    lineItems: parseLineItems(lines)
  };
  return { ...draft, confidence: confidence(draft) };
}
