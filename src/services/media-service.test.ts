import { describe, it, expect } from 'vitest';
import { validateVideoFile } from '@/services/video-service';
import { validateImageFile, createEditorState, applyTransform, undoTransform, redoTransform, resetEditor } from '@/services/image-service';
import type { ImageTransformOp, ImageEditorState } from '@/types/media';

describe('validateVideoFile', () => {
  function createMockFile(name: string, size: number, type: string): File {
    const content = new Uint8Array(Math.min(size, 1024));
    const file = new File([content], name, { type });
    Object.defineProperty(file, 'size', { value: size, writable: false, configurable: true });
    return file;
  }

  it('accepts valid MP4', () => {
    const file = createMockFile('test.mp4', 50 * 1024 * 1024, 'video/mp4');
    const result = validateVideoFile(file);
    expect(result.valid).toBe(true);
    expect(result.fileType).toBe('video');
  });

  it('accepts valid WebM', () => {
    const file = createMockFile('test.webm', 10 * 1024 * 1024, 'video/webm');
    const result = validateVideoFile(file);
    expect(result.valid).toBe(true);
  });

  it('accepts valid MOV', () => {
    const file = createMockFile('test.mov', 10 * 1024 * 1024, 'video/quicktime');
    const result = validateVideoFile(file);
    expect(result.valid).toBe(true);
  });

  it('rejects non-video file', () => {
    const file = createMockFile('test.txt', 100, 'text/plain');
    const result = validateVideoFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unsupported video format');
  });

  it('rejects oversized video', () => {
    const file = createMockFile('big.mp4', 150 * 1024 * 1024, 'video/mp4');
    const result = validateVideoFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too large');
  });
});

describe('validateImageFile', () => {
  function createMockFile(name: string, size: number, type: string): File {
    const content = new Uint8Array(Math.min(size, 1024));
    const file = new File([content], name, { type });
    Object.defineProperty(file, 'size', { value: size, writable: false, configurable: true });
    return file;
  }

  it('accepts valid JPEG', () => {
    const file = createMockFile('test.jpg', 5 * 1024 * 1024, 'image/jpeg');
    const result = validateImageFile(file);
    expect(result.valid).toBe(true);
    expect(result.fileType).toBe('image');
  });

  it('accepts valid PNG', () => {
    const file = createMockFile('test.png', 1024, 'image/png');
    const result = validateImageFile(file);
    expect(result.valid).toBe(true);
  });

  it('rejects non-image file', () => {
    const file = createMockFile('test.pdf', 100, 'application/pdf');
    const result = validateImageFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unsupported image format');
  });

  it('rejects oversized image', () => {
    const file = createMockFile('big.png', 15 * 1024 * 1024, 'image/png');
    const result = validateImageFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too large');
  });
});

describe('Image Editor State Management', () => {
  it('creates initial editor state', () => {
    const state = createEditorState('https://example.com/image.png');
    expect(state.originalUrl).toBe('https://example.com/image.png');
    expect(state.currentUrl).toBe('https://example.com/image.png');
    expect(state.transforms).toEqual([]);
    expect(state.undoStack).toEqual([]);
    expect(state.redoStack).toEqual([]);
    expect(state.isDirty).toBe(false);
  });

  it('applies a transform', () => {
    const state = createEditorState('https://example.com/image.png');
    const op: ImageTransformOp = { type: 'rotate', degrees: 90 };
    const newState = applyTransform(state, op);

    expect(newState.transforms).toHaveLength(1);
    expect(newState.transforms[0]).toEqual(op);
    expect(newState.isDirty).toBe(true);
    expect(newState.undoStack).toHaveLength(1);
    expect(newState.redoStack).toEqual([]);
  });

  it('applies multiple transforms', () => {
    let state = createEditorState('url');
    state = applyTransform(state, { type: 'rotate', degrees: 90 });
    state = applyTransform(state, { type: 'flip', direction: 'horizontal' });
    state = applyTransform(state, { type: 'filter', filterName: 'grayscale', intensity: 0.5 });

    expect(state.transforms).toHaveLength(3);
    expect(state.undoStack).toHaveLength(3);
    expect(state.isDirty).toBe(true);
  });

  it('undoes a transform', () => {
    let state = createEditorState('url');
    state = applyTransform(state, { type: 'rotate', degrees: 90 });
    state = applyTransform(state, { type: 'flip', direction: 'horizontal' });

    state = undoTransform(state);
    expect(state.transforms).toHaveLength(1);
    expect(state.transforms[0]).toEqual({ type: 'rotate', degrees: 90 });
    expect(state.undoStack).toHaveLength(1);
    expect(state.redoStack).toHaveLength(1);
  });

  it('redo after undo', () => {
    let state = createEditorState('url');
    const flip: ImageTransformOp = { type: 'flip', direction: 'horizontal' };
    state = applyTransform(state, { type: 'rotate', degrees: 90 });
    state = applyTransform(state, flip);

    state = undoTransform(state);
    state = redoTransform(state);
    expect(state.transforms).toHaveLength(2);
    expect(state.transforms[1]).toEqual(flip);
    expect(state.redoStack).toEqual([]);
  });

  it('undo on empty stack is a no-op', () => {
    const state = createEditorState('url');
    const result = undoTransform(state);
    expect(result).toBe(state); // Same reference — no change
  });

  it('redo on empty stack is a no-op', () => {
    const state = createEditorState('url');
    const result = redoTransform(state);
    expect(result).toBe(state);
  });

  it('new transform clears redo stack', () => {
    let state = createEditorState('url');
    state = applyTransform(state, { type: 'rotate', degrees: 90 });
    state = applyTransform(state, { type: 'flip', direction: 'horizontal' });
    state = undoTransform(state);
    expect(state.redoStack).toHaveLength(1);

    // Apply new transform — should clear redo
    state = applyTransform(state, { type: 'filter', filterName: 'grayscale', intensity: 1 });
    expect(state.redoStack).toEqual([]);
    expect(state.transforms).toHaveLength(2);
  });

  it('reset returns to original state', () => {
    let state = createEditorState('https://example.com/image.png');
    state = applyTransform(state, { type: 'rotate', degrees: 90 });
    state = applyTransform(state, { type: 'flip', direction: 'horizontal' });

    state = resetEditor(state);
    expect(state.originalUrl).toBe('https://example.com/image.png');
    expect(state.transforms).toEqual([]);
    expect(state.undoStack).toEqual([]);
    expect(state.isDirty).toBe(false);
  });

  it('isDirty is false after undoing all transforms', () => {
    let state = createEditorState('url');
    state = applyTransform(state, { type: 'rotate', degrees: 90 });
    state = undoTransform(state);
    expect(state.isDirty).toBe(false);
  });
});
