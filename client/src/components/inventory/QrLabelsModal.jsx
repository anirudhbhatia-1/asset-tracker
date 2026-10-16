import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { buildLabelSheetHtml, closeAfterPrint } from '../../utils/qrLabels';

/**
 * Preview and print a sheet of QR labels (code + name + serial) for the
 * selected assets. Codes encode the serial number, like the single-asset
 * tag (components/asset-detail/QrTagModal), so the Scanner opens them.
 */
export default function QrLabelsModal({ isOpen, onClose, assets = [] }) {
  const previewRef = useRef(null);

  const handlePrint = () => {
    const svgs = previewRef.current ? Array.from(previewRef.current.querySelectorAll('[data-qr-for]')) : [];
    const svgFor = new Map(svgs.map((el) => [el.getAttribute('data-qr-for'), el.querySelector('svg')?.outerHTML || '']));
    const html = buildLabelSheetHtml(assets.map((asset) => ({
      name: asset.name,
      serial: asset.serialNumber,
      model: asset.model,
      svg: svgFor.get(String(asset.id)) || '',
    })), { title: `Asset QR labels (${assets.length})` });

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      toast.error('Allow pop-ups for this site to print the labels.');
      return;
    }
    // Same origin as the app: everything written is escaped, and the popup
    // gets no handle back to this window.
    printWindow.opener = null;
    printWindow.document.write(html);
    printWindow.document.close();
    // Printed from here, not by an inline script (blocked by the CSP).
    // Closed on afterprint (not synchronously, which would cut Safari's
    // print dialog short), with a timeout fallback.
    printWindow.focus();
    closeAfterPrint(printWindow);
    printWindow.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`QR labels (${assets.length})`}
      maxWidth="max-w-2xl"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button onClick={handlePrint} disabled={assets.length === 0}>
            <Printer className="w-4 h-4" aria-hidden="true" />
            <span>Print labels</span>
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <p className="text-sm text-secondary">Each code encodes the asset’s serial number; scanning it in the Scanner opens the asset.</p>
        <div ref={previewRef} className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[50dvh] overflow-y-auto p-1">
          {assets.map((asset) => (
            <div key={asset.id} data-qr-for={String(asset.id)} className="border-2 border-dashed border-gray-300 rounded-xl p-3 flex flex-col items-center gap-2 bg-white text-center">
              {asset.serialNumber ? (
                <QRCodeSVG value={asset.serialNumber} size={112} level="H" includeMargin bgColor="#ffffff" fgColor="#111827" />
              ) : (
                <div className="w-[112px] h-[112px] flex items-center justify-center text-[11px] text-gray-400">No serial number</div>
              )}
              <p className="text-xs font-bold text-gray-900 leading-tight break-words w-full">{asset.name}</p>
              {asset.serialNumber && <p className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded break-all">{asset.serialNumber}</p>}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
