import { useState, useRef, useEffect, useCallback } from 'react';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';

export default function useScanner({ onDecode, autoStart = true } = {}) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const streamRef = useRef(null);
  const lastScannedRef = useRef({ text: null, timestamp: 0 });

  const [cameraAvailable, setCameraAvailable] = useState(null); // null = checking, true = available, false = denied/unavailable
  const [isScanning, setIsScanning] = useState(false);

  const stopScanner = useCallback(() => {
    setIsScanning(false);
    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch (e) {
        // ignore
      }
      readerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startScanner = useCallback(async () => {
    stopScanner();
    lastScannedRef.current = { text: null, timestamp: 0 };

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraAvailable(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          advanced: [{ focusMode: 'continuous' }]
        }
      });
      streamRef.current = stream;
      setCameraAvailable(true);
      setIsScanning(true);
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
      setCameraAvailable(false);
      setIsScanning(false);
    }
  }, [stopScanner]);

  const resetScannerState = useCallback(() => {
    lastScannedRef.current = { text: null, timestamp: 0 };
    if (cameraAvailable && !isScanning) {
      startScanner();
    }
  }, [cameraAvailable, isScanning, startScanner]);

  // Start decoder once video element is mounted and camera stream is ready
  useEffect(() => {
    if (!isScanning || !streamRef.current || !videoRef.current) return;

    const videoElem = videoRef.current;
    if (videoElem.srcObject !== streamRef.current) {
      videoElem.srcObject = streamRef.current;
      videoElem.setAttribute('playsinline', 'true');
      videoElem.setAttribute('muted', 'true');
      videoElem.play().catch(() => {});
    }

    // Use Native BarcodeDetector if available (Ultra-fast, hardware accelerated, handles all formats effortlessly)
    if ('BarcodeDetector' in window) {
      const barcodeDetector = new window.BarcodeDetector({ 
        formats: ['qr_code', 'ean_13', 'upc_a', 'code_128', 'code_39', 'ean_8', 'upc_e', 'itf', 'data_matrix'] 
      });
      let isLooping = true;
      let timeoutId;

      const detectLoop = async () => {
        if (!isLooping) return;
        try {
          if (videoElem.readyState >= 2) {
            const barcodes = await barcodeDetector.detect(videoElem);
            if (barcodes.length > 0) {
              const text = barcodes[0].rawValue;
              const now = Date.now();
              if (lastScannedRef.current.text !== text || now - lastScannedRef.current.timestamp >= 1000) {
                lastScannedRef.current = { text, timestamp: now };
                if (onDecode) onDecode(text);
              }
            }
          }
        } catch (e) {
          // Ignore transient errors
        }
        
        if (isLooping) {
          // Check roughly every 200ms
          timeoutId = setTimeout(() => {
            requestAnimationFrame(detectLoop);
          }, 200);
        }
      };

      detectLoop();

      readerRef.current = {
        reset: () => {
          isLooping = false;
          clearTimeout(timeoutId);
        }
      };
      
      return () => {
        if (readerRef.current) {
          readerRef.current.reset();
          readerRef.current = null;
        }
      };
    }

    // Fallback: ZXing Javascript Library
    if (!readerRef.current) {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.AZTEC,
        BarcodeFormat.CODABAR,
        BarcodeFormat.CODE_39,
        BarcodeFormat.CODE_93,
        BarcodeFormat.CODE_128,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.EAN_8,
        BarcodeFormat.EAN_13,
        BarcodeFormat.ITF,
        BarcodeFormat.MAXICODE,
        BarcodeFormat.PDF_417,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.RSS_14,
        BarcodeFormat.RSS_EXPANDED,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.UPC_EAN_EXTENSION
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new BrowserMultiFormatReader(hints);
      reader.timeBetweenDecodingAttempts = 350; // Slower interval for all formats to save CPU
      readerRef.current = reader;

      try {
        reader.decodeFromVideoElementContinuously(videoElem, (result, error) => {
          if (result) {
            const text = result.getText();
            if (!text) return;

            const now = Date.now();
            if (lastScannedRef.current.text === text && now - lastScannedRef.current.timestamp < 1000) {
              return;
            }

            lastScannedRef.current = { text, timestamp: now };
            if (onDecode) {
              onDecode(text);
            }
          }
        });
      } catch (err) {
        console.warn('Error initializing ZXing fallback:', err);
      }
    }

    return () => {
      if (readerRef.current) {
        try {
          readerRef.current.reset();
        } catch (e) {}
        readerRef.current = null;
      }
    };
  }, [isScanning, onDecode]);

  useEffect(() => {
    if (autoStart) {
      startScanner();
    }
    return () => {
      stopScanner();
    };
  }, [startScanner, stopScanner, autoStart]);

  return {
    videoRef,
    cameraAvailable,
    isScanning,
    startScanner,
    stopScanner,
    resetScannerState
  };
}
