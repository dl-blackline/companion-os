import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { X, UploadSimple, Image, VideoCamera } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { MediaType } from '@/types';

/** Maximum file sizes in bytes. */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

const ACCEPTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

const ALL_ACCEPTED = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES];

export interface MediaFile {
  file: File;
  previewUrl: string;
  mediaType: MediaType;
}

interface MediaUploaderProps {
  onSelect: (media: MediaFile) => void;
  onCancel: () => void;
  uploadProgress?: number;
  isUploading?: boolean;
}

function getMediaType(file: File): MediaType | null {
  if (ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'image';
  if (ACCEPTED_VIDEO_TYPES.includes(file.type)) return 'video';
  return null;
}

function validateFile(file: File): string | null {
  const mediaType = getMediaType(file);
  if (!mediaType) {
    return `Unsupported file type: ${file.type || 'unknown'}. Accepted: images (JPEG, PNG, GIF, WebP) and videos (MP4, WebM, MOV).`;
  }

  const maxSize = mediaType === 'image' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
  if (file.size > maxSize) {
    const limitMB = maxSize / (1024 * 1024);
    return `File too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum for ${mediaType}s is ${limitMB} MB.`;
  }

  return null;
}

export function MediaUploader({
  onSelect,
  onCancel,
  uploadProgress = 0,
  isUploading = false,
}: MediaUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MediaFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setError(null);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    const mediaType = getMediaType(file)!;
    const previewUrl = URL.createObjectURL(file);
    setPreview({ file, previewUrl, mediaType });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const clearPreview = () => {
    if (preview) {
      URL.revokeObjectURL(preview.previewUrl);
    }
    setPreview(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmSelection = () => {
    if (preview) onSelect(preview);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Upload Photo / Video</span>
        <button
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Drop zone */}
      {!preview && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors',
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/30 hover:border-primary/50',
          )}
        >
          <UploadSimple size={32} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">
            Drag & drop or <span className="text-primary font-medium">browse</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Images up to 10 MB · Videos up to 100 MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALL_ACCEPTED.join(',')}
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="relative rounded-lg overflow-hidden bg-black/5">
          {preview.mediaType === 'image' ? (
            <img
              src={preview.previewUrl}
              alt="Upload preview"
              className="max-h-60 w-full object-contain"
            />
          ) : (
            <video
              src={preview.previewUrl}
              controls
              className="max-h-60 w-full object-contain"
            />
          )}
          {!isUploading && (
            <button
              onClick={clearPreview}
              className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <div className="flex items-center gap-1 absolute bottom-2 left-2 bg-black/60 rounded px-2 py-0.5">
            {preview.mediaType === 'image' ? (
              <Image size={12} className="text-white" />
            ) : (
              <VideoCamera size={12} className="text-white" />
            )}
            <span className="text-xs text-white capitalize">{preview.mediaType}</span>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {isUploading && (
        <div className="space-y-1">
          <Progress value={uploadProgress} className="h-1.5" />
          <p className="text-xs text-muted-foreground text-center">
            Uploading… {Math.round(uploadProgress)}%
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Actions */}
      {preview && !isUploading && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={clearPreview}>
            Remove
          </Button>
          <Button size="sm" onClick={confirmSelection}>
            Attach
          </Button>
        </div>
      )}
    </div>
  );
}
