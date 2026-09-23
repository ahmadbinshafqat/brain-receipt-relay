const form = document.getElementById('receiptForm');
const statusEl = document.getElementById('status');
const resultCard = document.getElementById('resultCard');
let currentReceipt = null;

const sample = `SUNRISE MARKET
123 Main Street
2025-01-03 12:45 PM
Bananas 2 x 0.79 1.58
Whole Milk 3.99
Sourdough Bread 5.49
Subtotal 11.06
Tax 0.91
TOTAL $11.97
Visa 11.97
Thank you!`;

document.getElementById('sampleBtn').addEventListener('click', () => {
  document.getElementById('text').value = sample;
});

function money(value, currency) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(value);
}

function render(receipt) {
  currentReceipt = receipt;
  resultCard.classList.remove('hidden');
  document.getElementById('merchant').textContent = receipt.merchant || 'Unknown merchant';
  document.getElementById('meta').textContent = `${receipt.date || 'No date'} • ${receipt.currency} • confidence ${Math.round(receipt.confidence * 100)}%`;
  document.getElementById('subtotal').textContent = money(receipt.subtotal, receipt.currency);
  document.getElementById('tax').textContent = money(receipt.tax, receipt.currency);
  document.getElementById('tip').textContent = money(receipt.tip, receipt.currency);
  document.getElementById('total').textContent = money(receipt.total, receipt.currency);
  document.getElementById('rawText').textContent = receipt.rawText;

  const tbody = document.getElementById('items');
  tbody.innerHTML = '';
  if (!receipt.lineItems.length) {
    tbody.innerHTML = '<tr><td colspan="4">No line items detected.</td></tr>';
  } else {
    for (const item of receipt.lineItems) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(item.name)}</td><td>${item.qty}</td><td>${money(item.unitPrice, receipt.currency)}</td><td>${money(item.amount, receipt.currency)}</td>`;
      tbody.appendChild(tr);
    }
  }
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  statusEl.textContent = 'Parsing receipt... image OCR can take a moment on first run.';
  const fd = new FormData(form);
  if (!fd.get('image')?.name) fd.delete('image');
  try {
    const res = await fetch('/api/receipts/parse', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Parse failed');
    statusEl.textContent = 'Parsed and saved.';
    render(data.receipt);
  } catch (err) {
    statusEl.textContent = err.message;
  }
});

document.getElementById('copyBtn').addEventListener('click', async () => {
  if (!currentReceipt) return;
  await navigator.clipboard.writeText(JSON.stringify(currentReceipt, null, 2));
  statusEl.textContent = 'Copied JSON to clipboard.';
});

document.getElementById('csvBtn').addEventListener('click', () => {
  if (!currentReceipt) return;
  const rows = [['name', 'qty', 'unitPrice', 'amount'], ...currentReceipt.lineItems.map((i) => [i.name, i.qty, i.unitPrice, i.amount])];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentReceipt.merchant || 'receipt'}-items.csv`.replace(/[^a-z0-9.-]+/gi, '-');
  a.click();
  URL.revokeObjectURL(url);
});
