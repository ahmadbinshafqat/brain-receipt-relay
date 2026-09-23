import { parseReceipt } from './parser.js';

const sample = `
SUNRISE MARKET
123 Main Street
2025-01-03 12:45 PM
Bananas 2 x 0.79 1.58
Whole Milk 3.99
Sourdough Bread 5.49
Subtotal 11.06
Tax 0.91
TOTAL $11.97
Visa 11.97
Thank you!
`;

console.log(JSON.stringify(parseReceipt(sample, 'text'), null, 2));
