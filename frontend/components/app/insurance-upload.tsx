'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/shadcn/utils';

export interface ExtractedInsurance {
  insuranceProvider: string;
  memberId: string;
  groupNumber: string;
  policyHolder: string;
}

interface InsuranceUploadProps {
  onImageReady: (base64: string) => void;
  onInsuranceExtracted?: (data: ExtractedInsurance) => void;
  className?: string;
}

type Mode = 'idle' | 'webcam' | 'captured' | 'uploaded';

export function InsuranceUpload({
  onImageReady,
  onInsuranceExtracted,
  className,
}: InsuranceUploadProps) {
  const [mode, setMode] = useState<Mode>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const extractInsurance = useCallback(
    async (base64: string) => {
      if (!onInsuranceExtracted) return;
      setIsExtracting(true);
      setExtractionError(null);
      try {
        const res = await fetch('/api/extract-insurance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 }),
        });
        const data = await res.json();
        if (!res.ok) {
          console.error('Insurance extraction API error:', data);
          throw new Error(data.error || 'Extraction failed');
        }
        onInsuranceExtracted(data as ExtractedInsurance);
      } catch (err) {
        console.error('Insurance extraction failed:', err);
        setExtractionError('Could not read card. Please fill in manually.');
      } finally {
        setIsExtracting(false);
      }
    },
    [onInsuranceExtracted]
  );

  // Clean up webcam stream on unmount or mode change
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      // Set mode first so the <video> element renders
      setMode('webcam');
    } catch {
      // Camera denied -- fall back to file upload
      inputRef.current?.click();
    }
  }, []);

  // Attach stream to video element once it's rendered
  useEffect(() => {
    if (mode === 'webcam' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [mode]);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const base64 = dataUrl.split(',')[1];

    setPreview(dataUrl);
    onImageReady(base64);
    stopWebcam();
    setMode('captured');
    extractInsurance(base64);
  }, [onImageReady, stopWebcam, extractInsurance]);

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setPreview(result);
        const base64 = result.split(',')[1];
        onImageReady(base64);
        setMode('uploaded');
        extractInsurance(base64);
      };
      reader.readAsDataURL(file);
    },
    [onImageReady, extractInsurance]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleRetake = useCallback(() => {
    setPreview(null);
    setMode('idle');
  }, []);

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="text-sm">Insurance card</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Hidden canvas for frame capture */}
        <canvas ref={canvasRef} className="hidden" />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {/* Webcam live view */}
        {mode === 'webcam' && (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-md border">
              <video ref={videoRef} autoPlay playsInline muted className="w-full" />
              <div className="bg-background/60 absolute right-0 bottom-0 left-0 p-2 text-center text-xs backdrop-blur-sm">
                Hold your insurance card in front of the camera
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={captureFrame} className="flex-1" size="sm">
                Capture
              </Button>
              <Button
                onClick={() => {
                  stopWebcam();
                  setMode('idle');
                }}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Captured / uploaded preview */}
        {(mode === 'captured' || mode === 'uploaded') && preview && (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Insurance card"
              className="w-full rounded-md border object-contain"
            />
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs">
                {isExtracting
                  ? 'Reading insurance card...'
                  : extractionError
                    ? extractionError
                    : 'Insurance data extracted and filled in.'}
              </p>
              <Button onClick={handleRetake} variant="ghost" size="sm" className="text-xs">
                Retake
              </Button>
            </div>
          </div>
        )}

        {/* Idle state: show camera + upload options */}
        {mode === 'idle' && (
          <div className="space-y-3">
            <Button onClick={startWebcam} variant="outline" className="w-full gap-2" size="sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
              Use camera
            </Button>
            <div
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-4 transition-colors',
                isDragOver ? 'border-primary bg-primary/5' : 'border-border'
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <p className="text-muted-foreground text-xs">
                Or drop an image here / click to upload
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
