'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/shadcn/utils';

export type CaptureType = 'id' | 'insurance';

interface CardCaptureProps {
  captureType: CaptureType;
  onImageCaptured: (base64: string) => void;
  onDataExtracted?: (data: Record<string, string>) => void;
  className?: string;
}

const CONFIG: Record<
  CaptureType,
  { title: string; prompt: string; apiRoute: string; extractingMsg: string; doneMsg: string }
> = {
  id: {
    title: 'Photo ID',
    prompt: "Hold your driver's license in front of the camera",
    apiRoute: '/api/extract-id',
    extractingMsg: 'Reading your ID...',
    doneMsg: 'ID data extracted and filled in.',
  },
  insurance: {
    title: 'Insurance card',
    prompt: 'Hold your insurance card in front of the camera',
    apiRoute: '/api/extract-insurance',
    extractingMsg: 'Reading insurance card...',
    doneMsg: 'Insurance data extracted and filled in.',
  },
};

type Mode = 'idle' | 'webcam' | 'captured' | 'uploaded';

export function CardCapture({
  captureType,
  onImageCaptured,
  onDataExtracted,
  className,
}: CardCaptureProps) {
  const cfg = CONFIG[captureType];
  const [mode, setMode] = useState<Mode>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-start webcam when captureType changes (agent requested capture)
  useEffect(() => {
    setPreview(null);
    setIsExtracting(false);
    setExtractionError(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    // Auto-open webcam immediately
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      .then((stream) => {
        streamRef.current = stream;
        setMode('webcam');
      })
      .catch(() => {
        // Camera denied — fall back to file upload
        setMode('idle');
      });
  }, [captureType]);

  const extractData = useCallback(
    async (base64: string) => {
      if (!onDataExtracted) return;
      setIsExtracting(true);
      setExtractionError(null);
      try {
        const res = await fetch(cfg.apiRoute, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 }),
        });
        const data = await res.json();
        if (!res.ok) {
          console.error(`${cfg.title} extraction API error:`, data);
          throw new Error(data.error || 'Extraction failed');
        }
        onDataExtracted(data as Record<string, string>);
      } catch (err) {
        console.error(`${cfg.title} extraction failed:`, err);
        setExtractionError('Could not read card. Please fill in manually.');
      } finally {
        setIsExtracting(false);
      }
    },
    [onDataExtracted, cfg]
  );

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
      setMode('webcam');
    } catch {
      inputRef.current?.click();
    }
  }, []);

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
    onImageCaptured(base64);
    stopWebcam();
    setMode('captured');
    extractData(base64);
  }, [onImageCaptured, stopWebcam, extractData]);

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setPreview(result);
        const base64 = result.split(',')[1];
        onImageCaptured(base64);
        setMode('uploaded');
        extractData(base64);
      };
      reader.readAsDataURL(file);
    },
    [onImageCaptured, extractData]
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
        <CardTitle className="text-sm">{cfg.title}</CardTitle>
      </CardHeader>
      <CardContent>
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

        {mode === 'webcam' && (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-md border">
              <video ref={videoRef} autoPlay playsInline muted className="w-full" />
              <div className="bg-background/60 absolute right-0 bottom-0 left-0 p-2 text-center text-xs backdrop-blur-sm">
                {cfg.prompt}
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

        {(mode === 'captured' || mode === 'uploaded') && preview && (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt={cfg.title}
              className="w-full rounded-md border object-contain"
            />
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs">
                {isExtracting ? cfg.extractingMsg : extractionError ? extractionError : cfg.doneMsg}
              </p>
              <Button onClick={handleRetake} variant="ghost" size="sm" className="text-xs">
                Retake
              </Button>
            </div>
          </div>
        )}

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
