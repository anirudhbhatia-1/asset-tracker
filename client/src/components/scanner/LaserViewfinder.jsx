import React from 'react';
import { CameraOff, Camera, AlertTriangle } from 'lucide-react';

export default function LaserViewfinder({ onRetryCamera }) {
  return (
    <div className="relative w-full max-w-xl mx-auto bg-base rounded-2xl border border-border/80 overflow-hidden shadow-2xl aspect-[4/5] sm:aspect-[4/3] flex flex-col items-center justify-center p-6 text-center">
      {/* Background tech grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Simulated Reticle Box */}
      <div className="relative w-64 h-48 sm:w-80 sm:h-56 border-2 border-border/60 rounded-2xl flex flex-col items-center justify-center p-4 bg-base/50 backdrop-blur-sm">
        {/* Corner brackets */}
        <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-border rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-border rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-border rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-border rounded-br-lg" />

        {/* Animated red laser scanline */}
        <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-danger to-transparent shadow-[0_0_12px_#f43f5e] animate-scanline opacity-75" />

        <CameraOff className="w-10 h-10 text-secondary mb-3" />
        <h4 className="text-sm font-semibold text-secondary">Laser Viewfinder (Simulator Mode)</h4>
        <p className="text-xs text-secondary mt-1 max-w-[200px]">
          Hardware webcam stream offline or permission denied.
        </p>
      </div>

      {/* Controls & Messaging */}
      <div className="mt-5 flex flex-col sm:flex-row items-center gap-3 relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-warning/10 border border-warning/20 text-warning text-xs font-medium">
          <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
          <span>Use the Serial Simulator below to test decoding</span>
        </div>

        {onRetryCamera && (
          <button
            type="button"
            onClick={onRetryCamera}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent text-white text-xs font-semibold transition-colors shadow-md shadow-accent/20 cursor-pointer shrink-0"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Enable Camera</span>
          </button>
        )}
      </div>
    </div>
  );
}
