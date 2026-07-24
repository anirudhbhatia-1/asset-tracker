import React, { useState, useCallback } from 'react';
import { scanSerial } from '../api/assetsApi';
import toast from 'react-hot-toast';
import useScanner from '../hooks/useScanner';
import WebcamFeed from '../components/scanner/WebcamFeed';
import LaserViewfinder from '../components/scanner/LaserViewfinder';
import ScanResultCard from '../components/scanner/ScanResultCard';
import SerialSimulator from '../components/scanner/SerialSimulator';
import { QrCode, RefreshCw, ShieldCheck, Camera } from 'lucide-react';

export default function Scanner() {
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState(null);

  const resolveSerial = useCallback(async (serialText) => {
    setLoading(true);
    setScanError(null);
    setScanResult(null);
    try {
      const res = await scanSerial(serialText.trim());
      const assetData = res?.data?.data || res?.data;
      if (assetData && assetData.id) {
        setScanResult(assetData);
        toast.success(`Asset identified: ${assetData.name || assetData.serialNumber}`);
      } else {
        setScanError(`No asset found for serial number: "${serialText}"`);
      }
    } catch (err) {
      if (err?.status === 404 || err?.response?.status === 404 || err?.message?.toLowerCase().includes('not found')) {
        setScanError(`No asset found for serial number: "${serialText}"`);
      } else {
        const msg = err.response?.data?.message || err.message || 'Error resolving serial tag';
        setScanError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const {
    videoRef,
    cameraAvailable,
    isScanning,
    startScanner,
    stopScanner,
    resetScannerState
  } = useScanner({ onDecode: resolveSerial });

  const resetScan = useCallback(() => {
    setScanResult(null);
    setScanError(null);
    resetScannerState();
  }, [resetScannerState]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-primary tracking-tight">Barcode & Serial Scanner</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent/10 text-accent border border-accent/20">
              Phase 2 Active
            </span>
          </div>
          <p className="text-sm text-secondary mt-1">
            Decode QR tags or 1D barcodes via webcam frame capture, or test asset lookups via the interactive simulator.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isScanning && cameraAvailable ? (
            <button
              type="button"
              onClick={stopScanner}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-surface hover:bg-raised text-secondary border border-border transition-colors cursor-pointer"
            >
              <span>Pause Webcam</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={startScanner}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-accent hover:bg-accent text-white transition-colors shadow-md shadow-accent/20 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Enable Webcam Stream</span>
            </button>
          )}

          <button
            type="button"
            onClick={resetScan}
            disabled={!scanResult && !scanError}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-surface hover:bg-raised text-secondary border border-border transition-colors disabled:opacity-40 cursor-pointer"
            title="Reset current scan reading"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-accent' : ''}`} />
            <span>Reset Card</span>
          </button>
        </div>
      </div>

      {/* Main Scanner Area: Video Viewfinder or Simulated Laser */}
      <div className="space-y-6">
        {cameraAvailable && isScanning ? (
          <WebcamFeed
            videoRef={videoRef}
            isScanning={isScanning}
            onStop={stopScanner}
          />
        ) : (
          <LaserViewfinder
            onRetryCamera={startScanner}
          />
        )}

        {/* Loading Indicator when resolving decoded serial against backend */}
        {loading && (
          <div className="w-full max-w-xl mx-auto bg-surface/80 rounded-2xl border border-border p-6 animate-pulse space-y-4 text-center">
            <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin mx-auto" />
            <p className="text-xs font-mono text-accent">Querying regional SQLite database for decoded serial tag...</p>
          </div>
        )}

        {/* Decoded Scan Result Card or 404 Error Banner */}
        <ScanResultCard
          asset={scanResult}
          error={scanError}
          onClear={resetScan}
        />
      </div>

      {/* Interactive Serial & Barcode Simulator below */}
      <div className="pt-4 border-t border-border">
        <SerialSimulator
          onSimulateScan={(serial) => {
            resolveSerial(serial);
            // Scroll smoothly towards result box
            window.scrollTo({ top: 120, behavior: 'smooth' });
          }}
          disabled={loading}
        />
      </div>

      {/* Footer Info Box */}
      <div className="max-w-xl mx-auto bg-base/40 rounded-xl p-4 border border-border flex items-start gap-3 text-xs text-secondary">
        <ShieldCheck className="w-4 h-4 text-success shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-secondary block mb-0.5">Hardware Compatibility & ZXing Decoding</span>
          <span>
            The ZXing multi-format reader decodes standard QR tags, Code 128, Code 39, and EAN-13 barcodes directly from your local video frame buffer (`BrowserMultiFormatReader`). All checks against `GET /api/serial/scan/:serial` execute locally with sub-10ms response times.
          </span>
        </div>
      </div>
    </div>
  );
}
