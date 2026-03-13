import { describe, it, expect } from 'vitest';
import {
  validateMediaFile,
  DEFAULT_MEDIA_CONSTRAINTS,
} from '@/types/media';

describe('validateMediaFile', () => {
  function createMockFile(name: string, size: number, type: string): File {
    // Create a real blob and then override size via the File constructor
    // In jsdom the File constructor respects the blob content length for .size,
    // so we create a blob of the desired size.
    const content = new Uint8Array(Math.min(size, 1024)); // cap actual content
    const file = new File([content], name, { type });
    // Override .size for testing with defineProperty on the file instance
    Object.defineProperty(file, 'size', { value: size, writable: false, configurable: true });
    return file;
  }

  it('accepts valid JPEG image', () => {
    const file = createMockFile('test.jpg', 5 * 1024 * 1024, 'image/jpeg');
    const result = validateMediaFile(file);
    expect(result.valid).toBe(true);
    expect(result.fileType).toBe('image');
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('accepts valid PNG image', () => {
    const file = createMockFile('test.png', 1024, 'image/png');
    const result = validateMediaFile(file);
    expect(result.valid).toBe(true);
    expect(result.fileType).toBe('image');
  });

  it('accepts valid WebP image', () => {
    const file = createMockFile('test.webp', 1024, 'image/webp');
    const result = validateMediaFile(file);
    expect(result.valid).toBe(true);
    expect(result.fileType).toBe('image');
  });

  it('accepts valid GIF image', () => {
    const file = createMockFile('test.gif', 1024, 'image/gif');
    const result = validateMediaFile(file);
    expect(result.valid).toBe(true);
    expect(result.fileType).toBe('image');
  });

  it('accepts valid MP4 video', () => {
    const file = createMockFile('test.mp4', 50 * 1024 * 1024, 'video/mp4');
    const result = validateMediaFile(file);
    expect(result.valid).toBe(true);
    expect(result.fileType).toBe('video');
    expect(result.mimeType).toBe('video/mp4');
  });

  it('accepts valid WebM video', () => {
    const file = createMockFile('test.webm', 10 * 1024 * 1024, 'video/webm');
    const result = validateMediaFile(file);
    expect(result.valid).toBe(true);
    expect(result.fileType).toBe('video');
  });

  it('accepts valid QuickTime video', () => {
    const file = createMockFile('test.mov', 10 * 1024 * 1024, 'video/quicktime');
    const result = validateMediaFile(file);
    expect(result.valid).toBe(true);
    expect(result.fileType).toBe('video');
  });

  it('rejects unsupported file type', () => {
    const file = createMockFile('test.pdf', 1024, 'application/pdf');
    const result = validateMediaFile(file);
    expect(result.valid).toBe(false);
    expect(result.fileType).toBe('unknown');
    expect(result.error).toContain('Unsupported file type');
  });

  it('rejects image exceeding size limit', () => {
    const file = createMockFile('big.jpg', 15 * 1024 * 1024, 'image/jpeg');
    const result = validateMediaFile(file);
    expect(result.valid).toBe(false);
    expect(result.fileType).toBe('image');
    expect(result.error).toContain('too large');
    expect(result.error).toContain('10 MB');
  });

  it('rejects video exceeding size limit', () => {
    const file = createMockFile('big.mp4', 150 * 1024 * 1024, 'video/mp4');
    const result = validateMediaFile(file);
    expect(result.valid).toBe(false);
    expect(result.fileType).toBe('video');
    expect(result.error).toContain('too large');
    expect(result.error).toContain('100 MB');
  });

  it('accepts image at exact size limit', () => {
    const file = createMockFile('exact.png', 10 * 1024 * 1024, 'image/png');
    const result = validateMediaFile(file);
    expect(result.valid).toBe(true);
  });

  it('accepts video at exact size limit', () => {
    const file = createMockFile('exact.mp4', 100 * 1024 * 1024, 'video/mp4');
    const result = validateMediaFile(file);
    expect(result.valid).toBe(true);
  });

  it('rejects file with empty type', () => {
    const file = createMockFile('noext', 1024, '');
    const result = validateMediaFile(file);
    expect(result.valid).toBe(false);
    expect(result.fileType).toBe('unknown');
  });

  it('uses custom constraints when provided', () => {
    const file = createMockFile('test.jpg', 2 * 1024 * 1024, 'image/jpeg');
    const result = validateMediaFile(file, {
      maxImageSizeBytes: 1 * 1024 * 1024,
      maxVideoSizeBytes: 50 * 1024 * 1024,
      allowedImageTypes: ['image/jpeg'],
      allowedVideoTypes: ['video/mp4'],
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too large');
  });

  it('returns correct sizeBytes in all cases', () => {
    const file = createMockFile('test.jpg', 12345, 'image/jpeg');
    const result = validateMediaFile(file);
    expect(result.sizeBytes).toBe(12345);
  });
});

describe('DEFAULT_MEDIA_CONSTRAINTS', () => {
  it('has correct default values', () => {
    expect(DEFAULT_MEDIA_CONSTRAINTS.maxImageSizeBytes).toBe(10 * 1024 * 1024);
    expect(DEFAULT_MEDIA_CONSTRAINTS.maxVideoSizeBytes).toBe(100 * 1024 * 1024);
    expect(DEFAULT_MEDIA_CONSTRAINTS.allowedImageTypes).toContain('image/jpeg');
    expect(DEFAULT_MEDIA_CONSTRAINTS.allowedImageTypes).toContain('image/png');
    expect(DEFAULT_MEDIA_CONSTRAINTS.allowedVideoTypes).toContain('video/mp4');
    expect(DEFAULT_MEDIA_CONSTRAINTS.allowedVideoTypes).toContain('video/webm');
  });
});
