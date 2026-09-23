export type SourceType = 'text' | 'image';

export interface LineItem {
  name: string;
  qty: number;
  unitPrice: number;
  amount: number;
}

export interface Receipt {
  id: string;
  createdAt: string;
  sourceType: SourceType;
  merchant: string | null;
  date: string | null;
  currency: string;
  subtotal: number | null;
  tax: number | null;
  tip: number | null;
  total: number | null;
  rawText: string;
  lineItems: LineItem[];
  confidence: number;
}
