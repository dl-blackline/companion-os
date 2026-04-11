/**
 * ItemDecoderUploader — Image upload component that triggers AI decode.
 *
 * Features drag-and-drop zone, file validation, preview thumbnails,
 * decode button, loading state, and error display.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase-client';
import type { DecoderOutput } from '@/types/catalog';

/* ── Props ───────────────────────────────────────────────────── */

export interface ItemDecoderUploaderProps {
  onDecodeComplete: (output: DecoderOutput, imageFiles: File[]) => void;
  onCancel?: () => void;
}

/* ── Accepted types ──────────────────────────────────────────── */

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILES = 10;

/* ── Component ───────────────────────────────────────────────── */

export function ItemDecoderUploader({ onDecodeComplete, onCancel }: ItemDecoderUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [decoding, setDecoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef<string[]>([]);

  // Revoke preview object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      previewsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const addFiles = useCallback(
    (incoming: File[]) => {
      const valid = incoming.filter((f) => ACCEPTED_TYPES.includes(f.type));
      if (valid.length !== incoming.length) {
        setError('Some files were skipped — only JPEG, PNG, and WebP images are accepted.');
      } else {
        setError(null);
      }

      const next = [...files, ...valid].slice(0, MAX_FILES);
      setFiles(next);

      // Generate previews
      const urls = next.map((f) => URL.createObjectURL(f));
      // Revoke old previews
      previews.forEach((u) => URL.revokeObjectURL(u));
      setPreviews(urls);
      previewsRef.current = urls;
    },
    [files, previews],
  );

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  /* ── Drop handlers ─────────────────────────────────────────── */

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = Array.from(e.dataTransfer.files);
      addFiles(dropped);
    },
    [addFiles],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
    // Reset so the same file can be selected again
    e.target.value = '';
  };

  /* ── Decode ────────────────────────────────────────────────── */

  const handleDecode = async () => {
    setDecoding(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('Not authenticated. Please sign in and try again.');
        setDecoding(false);
        return;
      }

      // Convert images to base64 data URLs for JSON transport
      const imageDataUrls = await Promise.all(
        files.map(
          (f) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error('Failed to read image'));
              reader.readAsDataURL(f);
            }),
        ),
      );

      const res = await fetch('/.netlify/functions/item-decoder', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ images: imageDataUrls }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Decode failed (${res.status})`);
      }

      const json = await res.json();
      const data = json.data ?? json;
      const decoderOutput: DecoderOutput = data.decoderOutput ?? data;

      onDecodeComplete(decoderOutput, files);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decode failed. Please try again.');
    } finally {
      setDecoding(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* ── Drop zone ────────────────────────────────────────── */}
      <Card
        className={cn(
          'border-2 border-dashed transition-colors cursor-pointer',
          dragOver ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-border',
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
      >
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-3">
          <div className="text-3xl text-muted-foreground/40">📷</div>
          <p className="text-sm font-medium text-foreground">
            {dragOver ? 'Drop images here' : 'Drag & drop images here'}
          </p>
          <p className="text-[10px] text-muted-foreground">
            or click to browse · JPEG, PNG, WebP · up to {MAX_FILES} images
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          multiple
          onChange={handleInputChange}
          className="hidden"
        />
      </Card>

      {/* ── Previews ─────────────────────────────────────────── */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            {files.length} image{files.length !== 1 ? 's' : ''} selected
          </p>
          <div className="flex gap-2 flex-wrap">
            {previews.map((src, i) => (
              <div key={i} className="relative group">
                <img
                  src={src}
                  alt={`Preview ${i + 1}`}
                  className="h-20 w-20 object-cover rounded-lg border border-border/60"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* ── Actions ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleDecode}
          disabled={files.length === 0 || decoding}
          className="flex-1"
        >
          {decoding ? 'Decoding…' : `Decode ${files.length > 0 ? `(${files.length} image${files.length !== 1 ? 's' : ''})` : ''}`}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={decoding}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
