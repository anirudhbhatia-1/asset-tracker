import React, { useState } from 'react';
import useAssets from '../../hooks/useAssets';
import { Terminal, Play, Search, ArrowRight } from 'lucide-react';
import Button from '../ui/Button';
import Pill from '../ui/Pill';
import Field, { Select } from '../ui/Field';
import { controlClass } from '../ui/fieldStyles';

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
    <div className="w-full max-w-xl mx-auto bg-surface border border-border/80 rounded-xl p-6 shadow-xl space-y-6 text-left">
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
        <Pill className="font-mono">
          DEMO TOOL
        </Pill>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Dropdown Selection from Active Database */}
        <form onSubmit={handleDropdownSimulate} className="space-y-3 bg-base/50 p-4 rounded-xl border border-border/50 flex flex-col justify-between">
          <Field
            id="sim-existing-serial"
            label="Select Existing Hardware Tag"
            hint={`Populated directly from local DB (${assets.length} devices found).`}
          >
            <Select
              value={selectedSerial}
              onChange={(e) => setSelectedSerial(e.target.value)}
              disabled={loading || disabled}
              className="font-mono"
            >
              <option value="">-- Choose Asset Serial --</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.serialNumber}>
                  {asset.serialNumber} — {asset.name}
                </option>
              ))}
            </Select>
          </Field>

          <Button type="submit" size="sm" disabled={!selectedSerial || disabled} className="w-full mt-3">
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Simulate Barcode Scan</span>
          </Button>
        </form>

        {/* Manual Barcode Entry */}
        <form onSubmit={handleManualSimulate} className="space-y-3 bg-base/50 p-4 rounded-xl border border-border/50 flex flex-col justify-between">
          <div>
            <label htmlFor="sim-manual-serial" className="block text-sm font-medium text-primary mb-1.5">
              Manual Serial Tag Entry
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-secondary" />
              <input
                id="sim-manual-serial"
                type="text"
                value={manualSerial}
                onChange={(e) => setManualSerial(e.target.value.toUpperCase())}
                disabled={disabled}
                placeholder="e.g. SN-LPT001 or INVALID"
                className={`${controlClass()} pl-8 font-mono`}
              />
            </div>
            <p className="text-xs text-secondary mt-1.5">
              Type exact serial number to test hit or 404 error state.
            </p>
          </div>

          <Button type="submit" variant="secondary" size="sm" disabled={!manualSerial.trim() || disabled} className="w-full mt-3">
            <span>Execute Lookup</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
