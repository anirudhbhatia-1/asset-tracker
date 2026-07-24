import React, { useState } from 'react';
import useAssets from '../../hooks/useAssets';
import Badge from '../ui/Badge';
import { Terminal, Play, Search, ArrowRight } from 'lucide-react';

export default function SerialSimulator({ onSimulateScan, disabled }) {
  const { assets, loading } = useAssets();
  const [selectedSerial, setSelectedSerial] = useState('');
  const [manualSerial, setManualSerial] = useState('');

  const handleDropdownSimulate = (e) => {
    e.preventDefault();
    if (!selectedSerial) return;
    onSimulateScan(selectedSerial);
  };

  const handleManualSimulate = (e) => {
    e.preventDefault();
    if (!manualSerial.trim()) return;
    onSimulateScan(manualSerial.trim());
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-surface border border-border/80 rounded-2xl p-6 shadow-xl space-y-6 text-left">
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-primary">Barcode & Serial Simulator</h3>
            <p className="text-xs text-secondary">
              Test scanning workflows without physical camera or QR tags
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-base border border-border text-secondary">
          DEMO TOOL
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Dropdown Selection from Active Database */}
        <form onSubmit={handleDropdownSimulate} className="space-y-3 bg-base/50 p-4 rounded-xl border border-border/50 flex flex-col justify-between">
          <div>
            <label className="block text-xs font-semibold text-secondary mb-1.5">
              Select Existing Hardware Tag
            </label>
            <select
              value={selectedSerial}
              onChange={(e) => setSelectedSerial(e.target.value)}
              disabled={loading || disabled}
              className="w-full bg-base border border-border rounded-lg px-3 py-2 text-xs text-primary focus:outline-none focus:border-accent font-mono disabled:opacity-50"
            >
              <option value="">-- Choose Asset Serial --</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.serialNumber}>
                  {asset.serialNumber} — {asset.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-secondary mt-1.5">
              Populated directly from local DB ({assets.length} devices found).
            </p>
          </div>

          <button
            type="submit"
            disabled={!selectedSerial || disabled}
            className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent text-white text-xs font-semibold transition-colors shadow-md disabled:opacity-40 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Simulate Barcode Scan</span>
          </button>
        </form>

        {/* Manual Barcode Entry */}
        <form onSubmit={handleManualSimulate} className="space-y-3 bg-base/50 p-4 rounded-xl border border-border/50 flex flex-col justify-between">
          <div>
            <label className="block text-xs font-semibold text-secondary mb-1.5">
              Manual Serial Tag Entry
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-secondary" />
              <input
                type="text"
                value={manualSerial}
                onChange={(e) => setManualSerial(e.target.value.toUpperCase())}
                disabled={disabled}
                placeholder="e.g. SN-LPT001 or INVALID"
                className="w-full bg-base border border-border rounded-lg pl-8 pr-3 py-2 text-xs text-primary font-mono focus:outline-none focus:border-accent disabled:opacity-50"
              />
            </div>
            <p className="text-[11px] text-secondary mt-1.5">
              Type exact serial number to test hit or 404 error state.
            </p>
          </div>

          <button
            type="submit"
            disabled={!manualSerial.trim() || disabled}
            className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-surface hover:bg-raised text-primary text-xs font-semibold border border-border transition-colors shadow-sm disabled:opacity-40 cursor-pointer"
          >
            <span>Execute Lookup</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
