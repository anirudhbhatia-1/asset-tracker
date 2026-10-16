import React, { useState, useCallback, useEffect } from 'react';
import { scanSerial, getAsset, assignAssetApi, returnAssetApi } from '../api/assetsApi';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import useScanner from '../hooks/useScanner';
import WebcamFeed from '../components/scanner/WebcamFeed';
import LaserViewfinder from '../components/scanner/LaserViewfinder';
import ScanResultCard from '../components/scanner/ScanResultCard';
import RecentScans from '../components/scanner/RecentScans';
import AssignmentModal from '../components/forms/AssignmentModal';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import PageHeader from '../components/ui/PageHeader';
import { addRecentScan, loadRecentScans, saveRecentScans } from '../utils/recentScans';
import { RefreshCw, Camera, Search } from 'lucide-react';

export default function Scanner() {
  const { hasPermission } = useAuth();
  const canReadAssets = hasPermission('assets:read');
  const canAssignAssets = hasPermission('assets:assign');

  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [manualSerial, setManualSerial] = useState('');
  const [recentScans, setRecentScans] = useState(loadRecentScans);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    saveRecentScans(recentScans);
  }, [recentScans]);

  // Shows an asset on the card and bumps it to the top of Recent scans.
  const showAsset = useCallback((assetData) => {
    setScanResult(assetData);
    setRecentScans(prev => addRecentScan(prev, assetData));
  }, []);

  const resolveSerial = useCallback(async (serialText) => {
    setLoading(true);
    setScanError(null);
    setScanResult(null);
    try {
      const res = await scanSerial(serialText.trim());
      const assetData = res?.data?.data || res?.data;
      if (assetData && assetData.id) {
        showAsset(assetData);
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
  }, [showAsset]);

  // Hold camera decoding while a lookup runs, a result or scan error is on
  // the card or a dialog is open; Clear empties it and resumes decoding.
  // Manual lookups still work while paused.
  const scanPaused = loading || !!scanResult || !!scanError || isAssignOpen || isReturnOpen;

  const {
    videoRef,
    cameraAvailable,
    isScanning,
    startScanner,
    stopScanner,
    resetScannerState
  } = useScanner({ onDecode: resolveSerial, paused: scanPaused });

  const handleManualLookup = (e) => {
    e.preventDefault();
    if (!manualSerial.trim() || loading) return;
    resolveSerial(manualSerial);
  };

  // Re-open a recent scan. Reading by id skips the rate-limited serial
  // lookup; users without assets:read fall back to the scanner endpoint.
  const reopenRecent = useCallback(async (scan) => {
    if (!canReadAssets) {
      resolveSerial(scan.serialNumber);
      return;
    }
    setLoading(true);
    setScanError(null);
    try {
      const res = await getAsset(scan.id);
      const assetData = res?.data?.data || res?.data;
      if (assetData?.id) showAsset(assetData);
    } catch (err) {
      setScanResult(null);
      setScanError(err.response?.data?.message || `Could not reload "${scan.serialNumber}"`);
    } finally {
      setLoading(false);
    }
  }, [canReadAssets, resolveSerial, showAsset]);

  // Assign/return respond with the updated asset, so the card refreshes
  // without another lookup.
  const handleAssign = useCallback(async (employeeId, assignedDate, note) => {
    setActionBusy(true);
    try {
      const res = await assignAssetApi(scanResult.id, { employeeId, assignedDate, note });
      const updated = res.data?.data || res.data;
      if (updated?.id) showAsset(updated);
      toast.success('Asset assigned successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to assign asset');
      throw err; // keeps AssignmentModal open
    } finally {
      setActionBusy(false);
    }
  }, [scanResult, showAsset]);

  const isClientAsset = scanResult?.assetType === 'client';

  const handleReturnConfirm = useCallback(async () => {
    setActionBusy(true);
    try {
      const res = await returnAssetApi(scanResult.id);
      const updated = res.data?.data || res.data;
      if (updated?.id) showAsset(updated);
      toast.success(isClientAsset ? 'Asset returned to client' : 'Asset returned to stock');
      setIsReturnOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to return asset');
    } finally {
      setActionBusy(false);
    }
  }, [scanResult, isClientAsset, showAsset]);

  const resetScan = useCallback(() => {
    setScanResult(null);
    setScanError(null);
    resetScannerState();
  }, [resetScannerState]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Page Header */}
      <PageHeader
        className="border-b border-border pb-5"
        title="Barcode & Serial Scanner"
        subtitle="Decode QR tags or 1D barcodes with your camera, or type a serial number to look up an asset."
        actions={<>
          {isScanning && cameraAvailable ? (
            <Button variant="secondary" size="sm" onClick={stopScanner}>
              <span>Pause camera</span>
            </Button>
          ) : (
            <Button size="sm" onClick={startScanner}>
              <Camera className="w-3.5 h-3.5" />
              <span>Start camera</span>
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={resetScan}
            disabled={!scanResult && !scanError}
            title="Clear the current scan result"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-accent' : ''}`} />
            <span>Clear</span>
          </Button>
        </>}
      />

      {/* Main Scanner Area: Video Viewfinder or Simulated Laser */}
      <div className="space-y-6">
        {cameraAvailable && isScanning ? (
          <WebcamFeed
            videoRef={videoRef}
            onStop={stopScanner}
          />
        ) : (
          <LaserViewfinder
            onRetryCamera={startScanner}
          />
        )}

        {/* Manual serial entry — runs the same lookup as a camera decode */}
        <form onSubmit={handleManualLookup} className="w-full max-w-xl mx-auto flex items-center gap-2">
          <label htmlFor="manual-serial" className="sr-only">Serial number</label>
          <Input
            id="manual-serial"
            type="text"
            value={manualSerial}
            onChange={(e) => setManualSerial(e.target.value)}
            placeholder="Enter serial number…"
            autoComplete="off"
            className="flex-1 min-w-0 font-mono placeholder:font-sans"
          />
          <Button type="submit" disabled={!manualSerial.trim() || loading}>
            <Search className="w-4 h-4" />
            <span>Look up</span>
          </Button>
        </form>

        {/* Loading Indicator when resolving decoded serial against backend */}
        {loading && (
          <div className="w-full max-w-xl mx-auto bg-surface/80 rounded-xl border border-border p-6 animate-pulse space-y-4 text-center">
            <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin mx-auto" />
            <p className="text-xs font-mono text-accent">Looking up asset…</p>
          </div>
        )}

        {/* Decoded Scan Result Card or 404 Error Banner */}
        <ScanResultCard
          asset={scanResult}
          error={scanError}
          onClear={resetScan}
          canOpenDetails={canReadAssets}
          canAssign={canAssignAssets}
          onAssign={() => setIsAssignOpen(true)}
          onReturn={() => setIsReturnOpen(true)}
          actionBusy={actionBusy}
        />

        <RecentScans
          scans={recentScans}
          activeId={scanResult?.id}
          onSelect={reopenRecent}
          onClear={() => setRecentScans([])}
          disabled={loading}
        />
      </div>

      {scanResult && canAssignAssets && (
        <>
          <AssignmentModal
            isOpen={isAssignOpen}
            onClose={() => setIsAssignOpen(false)}
            onAssign={handleAssign}
            asset={scanResult}
          />

          <Modal
            isOpen={isReturnOpen}
            onClose={() => !actionBusy && setIsReturnOpen(false)}
            title={isClientAsset ? 'Confirm Return to Client' : 'Confirm Return to Stock'}
            maxWidth="max-w-md"
            footer={(
              <>
                <Button variant="secondary" onClick={() => setIsReturnOpen(false)} disabled={actionBusy}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleReturnConfirm} loading={actionBusy}>
                  {isClientAsset ? 'Return to client' : 'Return to stock'}
                </Button>
              </>
            )}
          >
            <p className="text-sm text-secondary">
              Unassign <span className="font-semibold text-primary">{scanResult.name}</span> ({scanResult.serialNumber})
              {scanResult.assigneeName && <> from <span className="font-semibold text-primary">{scanResult.assigneeName}</span></>}
              {isClientAsset
                ? ` and mark it as returned to ${scanResult.clientName || 'the client'}?`
                : ' and mark it as available in inventory?'}
            </p>
          </Modal>
        </>
      )}

    </div>
  );
}
