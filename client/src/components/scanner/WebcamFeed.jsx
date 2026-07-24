import React from 'react';
import { Camera, RefreshCw } from 'lucide-react';

export default function WebcamFeed({ videoRef, isScanning, onStop }) {
  return (
    <div className="relative w-full max-w-xl mx-auto bg-base rounded-2xl border border-border/80 overflow-hidden shadow-2xl aspect-[4/5] sm:aspect-[4/3] flex items-center justify-center">
      {/* Video element connected to media stream */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      {/* Reticle Overlay */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
        <div className="relative w-64 h-48 sm:w-80 sm:h-56 border-2 border-accent/30 rounded-2xl overflow-hidden flex items-center justify-center">
          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-accent rounded-tl-lg" />
          <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-accent rounded-tr-lg" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-accent rounded-bl-lg" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-accent rounded-br-lg" />

          {/* Animated red laser scanline */}
          <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-danger to-transparent shadow-[0_0_12px_#f43f5e] animate-scanline" />

          {/* Center aiming dot */}
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/60 animate-ping" />
        </div>
      </div>

      {/* Top Status Banner Overlay */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-base/80 backdrop-blur-md border border-border/60 text-xs font-mono text-primary">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span>LIVE WEBCAM STREAM</span>
        </div>

        {onStop && (
          <button
            type="button"
            onClick={onStop}
            className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-base/80 hover:bg-surface backdrop-blur-md border border-border/60 text-xs font-medium text-secondary hover:text-white transition-colors cursor-pointer shadow-sm"
          >
            <Camera className="w-3.5 h-3.5 text-accent" />
            <span>Switch to Viewfinder</span>
          </button>
        )}
      </div>

      {/* Bottom instructions overlay */}
      <div className="absolute bottom-3 inset-x-3 text-center pointer-events-none">
        <span className="inline-block px-3 py-1 rounded-lg bg-base/80 backdrop-blur-md text-[11px] font-mono text-secondary border border-border/50">
          Align hardware QR code / 1D barcode within the target reticle
        </span>
      </div>
    </div>
  );
}
