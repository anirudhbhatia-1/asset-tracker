import { escapeHtml } from './html';

/**
 * A printable HTML page with a grid of asset QR labels. `labels` are
 * { name, serial, model?, svg }: text is escaped; `svg` must be markup the
 * app generated itself (a QR code rendered from the serial). No scripts:
 * the caller prints the window, which the production CSP requires.
 */
export function buildLabelSheetHtml(labels, { title = 'Asset QR labels', company = 'Thinkvibes Asset Tag' } = {}) {
  const cells = labels.map((label) => `
      <div class="tag">
        <div class="company">${escapeHtml(company)}</div>
        ${label.svg || '<div class="noqr">No serial number</div>'}
        <div class="name">${escapeHtml(label.name)}</div>
        <div class="serial">${escapeHtml(label.serial)}</div>
        ${label.model ? `<div class="model">${escapeHtml(label.model)}</div>` : ''}
      </div>`).join('');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      @page { margin: 10mm; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: white; padding: 12px; color: #111827; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
      .tag { border: 1.5px dashed #d1d5db; border-radius: 10px; padding: 10px; text-align: center; break-inside: avoid; page-break-inside: avoid; }
      .company { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7280; margin-bottom: 6px; }
      svg { display: block; margin: 0 auto 6px; width: 120px; height: 120px; }
      .noqr { height: 120px; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #9ca3af; }
      .name { font-size: 12px; font-weight: 700; margin-bottom: 3px; word-break: break-word; }
      .serial { font-size: 10px; font-family: 'Courier New', monospace; color: #4f46e5; background: #eef2ff; padding: 2px 6px; border-radius: 4px; display: inline-block; word-break: break-all; }
      .model { font-size: 9px; color: #6b7280; margin-top: 3px; }
    </style>
  </head>
  <body>
    <div class="grid">${cells}
    </div>
  </body>
</html>`;
}

/**
 * Closes a print popup once its print dialog is done. Closing synchronously
 * after `print()` cuts the dialog short in browsers where `print()` returns
 * at once (Safari), so the window closes on `afterprint` instead, with a
 * timeout fallback for browsers that never fire it. Call before `print()`.
 * Returns the close function (exposed for tests and manual cleanup).
 */
export function closeAfterPrint(printWindow, { timeoutMs = 60000 } = {}) {
  let done = false;
  const close = () => {
    if (done) return;
    done = true;
    try {
      printWindow.close();
    } catch {
      // Already closed by the user.
    }
  };
  try {
    printWindow.addEventListener('afterprint', close);
  } catch {
    // No listener support: the timeout still closes it.
  }
  setTimeout(close, timeoutMs);
  return close;
}
