import React from 'react';
import { QrCode } from 'lucide-react';

const Scanner = () => {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Barcode / QR Scanner</h2>
        <p className="text-sm text-slate-400 mt-1">
          Scan hardware serial tags using device camera or USB scanner
        </p>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center text-slate-400">
        <QrCode className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-200">Phase 2 Feature</h3>
        <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
          The webcam barcode scanning integration (`html5-qrcode` / `ZXing`) is scheduled for implementation in Phase 2 (Week 8).
        </p>
      </div>
    </div>
  );
};

export default Scanner;
