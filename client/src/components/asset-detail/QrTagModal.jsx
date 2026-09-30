import React, { useRef, useId } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';
import { escapeHtml } from '../../utils/html';

export default function QrTagModal({ isOpen, onClose, asset }) {
  const printRef = useRef(null);

  const dialogRef = useRef(null);
  const titleId = useId();
  // Traps Tab inside the dialog and closes it on Escape
  useFocusTrap(dialogRef, isOpen && !!asset, onClose);

  if (!isOpen || !asset) return null;

  const handlePrint = () => {
    // Open a minimal print window with just the QR tag
    const printWindow = window.open('', '_blank', 'width=400,height=500');
    if (!printWindow) return;
    // The popup shares this origin, so asset text must be escaped, and it
    // gets no handle back to the app window.
    printWindow.opener = null;
    const name = escapeHtml(asset.name);
    const serial = escapeHtml(asset.serialNumber);
    const model = escapeHtml(asset.model);
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Asset Tag — ${serial}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              background: white;
              padding: 24px;
            }
            .tag {
              border: 2px dashed #d1d5db;
              border-radius: 12px;
              padding: 20px 24px;
              text-align: center;
              max-width: 280px;
              width: 100%;
            }
            .company {
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.1em;
              text-transform: uppercase;
              color: #6b7280;
              margin-bottom: 12px;
            }
            svg { display: block; margin: 0 auto 12px; }
            .name {
              font-size: 14px;
              font-weight: 700;
              color: #111827;
              margin-bottom: 4px;
              word-break: break-word;
            }
            .serial {
              font-size: 11px;
              font-family: 'Courier New', monospace;
              color: #6366f1;
              background: #eef2ff;
              padding: 3px 8px;
              border-radius: 4px;
              display: inline-block;
              margin-bottom: 4px;
            }
            .model {
              font-size: 10px;
              color: #6b7280;
            }
          </style>
        </head>
        <body>
          <div class="tag">
            <div class="company">Thinkvibes Asset Tag</div>
            ${printRef.current?.querySelector('svg')?.outerHTML || ''}
            <div class="name">${name}</div>
            <div class="serial">${serial}</div>
            ${model ? `<div class="model">${model}</div>` : ''}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    // Print from here rather than an inline script in the popup, which the
    // production Content-Security-Policy would block.
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative w-full max-w-sm bg-surface border border-border rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-base/50">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-primary">Asset QR Tag</h2>
            <p className="text-xs text-secondary mt-0.5">Scan to identify this asset</p>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="p-2 text-secondary hover:text-primary rounded-lg hover:bg-raised/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QR Code Display */}
        <div className="p-6 flex flex-col items-center gap-4" ref={printRef}>
          {/* Printable Tag Area */}
          <div className="border-2 border-dashed border-border rounded-xl p-5 flex flex-col items-center gap-3 w-full bg-white">
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-secondary">
              Thinkvibes Asset Tag
            </p>
            <QRCodeSVG
              value={asset.serialNumber}
              size={160}
              level="H"
              includeMargin={true}
              bgColor="#ffffff"
              fgColor="#111827"
            />
            <div className="text-center space-y-1">
              <p className="text-sm font-bold text-gray-900 leading-tight">{asset.name}</p>
              <p className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded inline-block">
                {asset.serialNumber}
              </p>
              {asset.model && (
                <p className="text-[10px] text-gray-500">{asset.model}</p>
              )}
            </div>
          </div>

          {/* Info text */}
          <p className="text-xs text-secondary text-center">
            This QR code encodes the serial number. Scanning it with the Asset Scanner will open this asset's profile.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-border bg-base/50">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-secondary hover:text-primary hover:bg-raised/50 rounded-lg transition-colors border border-border"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-on-accent bg-accent hover:bg-accent/90 rounded-lg shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Tag
          </button>
        </div>
      </div>
    </div>
  );
}
