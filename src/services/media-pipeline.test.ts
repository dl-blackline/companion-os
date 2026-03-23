import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  MediaRefinementRequest,
  MediaRefinementResult,
  RefinementAction,
  MediaAsset,
  VideoAudioMode,
  MediaSavePayload,
  UserMediaRecord,
  MediaProcessingJob,
  MediaJobStatus,
  MediaPipelineState,
  ProviderConfig,
  ApiResult,
  ErrorResult,
} from '@/types/media';
import { buildRefinementPrompt, IMAGE_REFINEMENT_ACTIONS, VIDEO_REFINEMENT_ACTIONS } from '@/services/media-refinement-service';

// ─── New Type Tests ───────────────────────────────────────────────────────────

describe('VideoAudioMode type', () => {
  it('allows silent mode', () => {
    const mode: VideoAudioMode = 'silent';
    expect(mode).toBe('silent');
  });

  it('allows with-audio mode', () => {
    const mode: VideoAudioMode = 'with-audio';
    expect(mode).toBe('with-audio');
  });

  it('allows audio-only mode', () => {
    const mode: VideoAudioMode = 'audio-only';
    expect(mode).toBe('audio-only');
  });
});

describe('MediaAsset type', () => {
  it('creates a valid image asset', () => {
    const asset: MediaAsset = {
      id: 'asset-1',
      userId: 'user-1',
      type: 'image',
      sourceUrl: 'https://example.com/photo.jpg',
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024 * 1024,
      createdAt: Date.now(),
    };
    expect(asset.type).toBe('image');
    expect(asset.mimeType).toBe('image/jpeg');
  });

  it('creates a valid video asset with metadata', () => {
    const asset: MediaAsset = {
      id: 'asset-2',
      userId: 'user-1',
      type: 'video',
      sourceUrl: 'https://example.com/video.mp4',
      filename: 'video.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 50 * 1024 * 1024,
      createdAt: Date.now(),
      metadata: {
        width: 1920,
        height: 1080,
        durationSeconds: 30,
        sizeBytes: 50 * 1024 * 1024,
        hasAudio: true,
      },
    };
    expect(asset.type).toBe('video');
    expect(asset.metadata).toBeDefined();
  });
});

describe('MediaRefinementRequest type', () => {
  it('creates a valid enhance request', () => {
    const req: MediaRefinementRequest = {
      mediaUrl: 'https://example.com/photo.jpg',
      mediaType: 'image',
      action: 'enhance',
    };
    expect(req.action).toBe('enhance');
    expect(req.mediaType).toBe('image');
  });

  it('creates a valid custom refinement with prompt', () => {
    const req: MediaRefinementRequest = {
      mediaUrl: 'https://example.com/video.mp4',
      mediaType: 'video',
      action: 'custom',
      prompt: 'Make it look like a vintage film',
      model: 'test-model',
      options: { intensity: 0.8 },
    };
    expect(req.action).toBe('custom');
    expect(req.prompt).toBe('Make it look like a vintage film');
    expect(req.options).toEqual({ intensity: 0.8 });
  });
});

describe('MediaRefinementResult type', () => {
  it('creates a valid refinement result', () => {
    const result: MediaRefinementResult = {
      id: 'ref-1',
      originalUrl: 'https://example.com/original.jpg',
      refinedUrl: 'https://example.com/refined.jpg',
      action: 'upscale',
      model: 'openai-image',
      provider: 'openai',
      createdAt: Date.now(),
    };
    expect(result.refinedUrl).not.toBe(result.originalUrl);
    expect(result.action).toBe('upscale');
  });
});

describe('MediaProcessingJob type', () => {
  it('creates a valid processing job', () => {
    const job: MediaProcessingJob = {
      id: 'job-1',
      type: 'generation',
      mediaType: 'image',
      status: 'processing',
      progress: 0.5,
      createdAt: Date.now(),
    };
    expect(job.status).toBe('processing');
    expect(job.progress).toBe(0.5);
  });

  it('represents a completed job', () => {
    const job: MediaProcessingJob = {
      id: 'job-2',
      type: 'refinement',
      mediaType: 'video',
      status: 'completed',
      resultUrl: 'https://example.com/result.mp4',
      createdAt: Date.now(),
      completedAt: Date.now() + 5000,
    };
    expect(job.status).toBe('completed');
    expect(job.resultUrl).toBeDefined();
  });

  it('represents a failed job', () => {
    const job: MediaProcessingJob = {
      id: 'job-3',
      type: 'generation',
      mediaType: 'image',
      status: 'failed',
      error: 'Provider timeout',
      createdAt: Date.now(),
    };
    expect(job.status).toBe('failed');
    expect(job.error).toBe('Provider timeout');
  });
});

describe('MediaSavePayload type', () => {
  it('creates a valid save payload for generation', () => {
    const payload: MediaSavePayload = {
      userId: 'user-1',
      mediaUrl: 'https://example.com/generated.png',
      mediaType: 'image',
      filename: 'generated.png',
      prompt: 'A futuristic city at sunset',
      style: 'cinematic',
      model: 'openai-image',
      provider: 'openai',
      source: 'generation',
    };
    expect(payload.source).toBe('generation');
    expect(payload.userId).toBe('user-1');
  });

  it('creates a valid save payload for refinement', () => {
    const payload: MediaSavePayload = {
      userId: 'user-2',
      mediaUrl: 'https://example.com/refined.mp4',
      mediaType: 'video',
      filename: 'refined.mp4',
      source: 'refinement',
    };
    expect(payload.source).toBe('refinement');
  });
});

describe('UserMediaRecord type', () => {
  it('creates a valid user media record', () => {
    const record: UserMediaRecord = {
      id: 'rec-1',
      userId: 'user-1',
      mediaUrl: 'https://example.com/photo.jpg',
      mediaType: 'image',
      filename: 'photo.jpg',
      prompt: 'A beautiful sunset',
      source: 'generation',
      createdAt: new Date().toISOString(),
    };
    expect(record.id).toBe('rec-1');
    expect(record.source).toBe('generation');
  });
});

describe('ProviderConfig type', () => {
  it('creates a valid provider config', () => {
    const config: ProviderConfig = {
      id: 'openai',
      name: 'OpenAI',
      type: 'image',
      enabled: true,
      models: ['gpt-image-1', 'dall-e-3'],
    };
    expect(config.enabled).toBe(true);
    expect(config.models).toHaveLength(2);
  });
});

describe('ApiResult type', () => {
  it('represents a success result', () => {
    const result: ApiResult<string> = {
      success: true,
      data: 'test-data',
    };
    expect(result.success).toBe(true);
    expect(result.data).toBe('test-data');
  });

  it('represents an error result', () => {
    const result: ErrorResult = {
      success: false,
      error: 'Something went wrong',
      code: 500,
    };
    expect(result.success).toBe(false);
    expect(result.error).toBe('Something went wrong');
  });
});

describe('MediaPipelineState discriminated union', () => {
  it('represents idle phase', () => {
    const state: MediaPipelineState = { phase: 'idle' };
    expect(state.phase).toBe('idle');
  });

  it('represents uploading phase with progress', () => {
    const state: MediaPipelineState = { phase: 'uploading', progress: 0.6 };
    expect(state.phase).toBe('uploading');
    if (state.phase === 'uploading') {
      expect(state.progress).toBe(0.6);
    }
  });

  it('represents generating phase', () => {
    const state: MediaPipelineState = { phase: 'generating', mediaType: 'image' };
    expect(state.phase).toBe('generating');
    if (state.phase === 'generating') {
      expect(state.mediaType).toBe('image');
    }
  });

  it('represents refining phase', () => {
    const state: MediaPipelineState = { phase: 'refining', action: 'enhance' };
    expect(state.phase).toBe('refining');
  });

  it('represents preview-ready phase', () => {
    const state: MediaPipelineState = {
      phase: 'preview-ready',
      resultUrl: 'https://example.com/result.png',
      mediaType: 'image',
    };
    expect(state.phase).toBe('preview-ready');
    if (state.phase === 'preview-ready') {
      expect(state.resultUrl).toBeDefined();
    }
  });

  it('represents saving phase', () => {
    const state: MediaPipelineState = { phase: 'saving' };
    expect(state.phase).toBe('saving');
  });

  it('represents success phase', () => {
    const state: MediaPipelineState = { phase: 'success', savedId: 'rec-1' };
    expect(state.phase).toBe('success');
    if (state.phase === 'success') {
      expect(state.savedId).toBe('rec-1');
    }
  });

  it('represents error phase', () => {
    const state: MediaPipelineState = { phase: 'error', message: 'Failed', retryable: true };
    expect(state.phase).toBe('error');
    if (state.phase === 'error') {
      expect(state.retryable).toBe(true);
    }
  });
});

describe('RefinementAction type', () => {
  it('covers all expected actions', () => {
    const actions: RefinementAction[] = [
      'enhance', 'upscale', 'stylize', 'denoise', 'colorize',
      'restore', 'background-remove', 'super-resolution', 'custom',
    ];
    expect(actions).toHaveLength(9);
    actions.forEach(action => expect(typeof action).toBe('string'));
  });
});

// ─── Refinement Service Tests ─────────────────────────────────────────────────

describe('buildRefinementPrompt', () => {
  it('returns a prompt for enhance action', () => {
    const result = buildRefinementPrompt('enhance');
    expect(result).toContain('Enhance');
    expect(result).toContain('quality');
  });

  it('returns a prompt for upscale action', () => {
    const result = buildRefinementPrompt('upscale');
    expect(result).toContain('Upscale');
    expect(result).toContain('resolution');
  });

  it('returns a prompt for denoise action', () => {
    const result = buildRefinementPrompt('denoise');
    expect(result).toContain('noise');
  });

  it('returns a prompt for colorize action', () => {
    const result = buildRefinementPrompt('colorize');
    expect(result).toContain('color');
  });

  it('returns a prompt for restore action', () => {
    const result = buildRefinementPrompt('restore');
    expect(result).toContain('Restore');
  });

  it('returns a prompt for background-remove action', () => {
    const result = buildRefinementPrompt('background-remove');
    expect(result).toContain('background');
  });

  it('returns a prompt for super-resolution action', () => {
    const result = buildRefinementPrompt('super-resolution');
    expect(result).toContain('super-resolution');
  });

  it('uses custom prompt for custom action', () => {
    const result = buildRefinementPrompt('custom', 'Make it look vintage');
    expect(result).toBe('Make it look vintage');
  });

  it('uses custom prompt for stylize action', () => {
    const result = buildRefinementPrompt('stylize', 'Watercolor painting style');
    expect(result).toBe('Watercolor painting style');
  });

  it('falls back for custom action without prompt', () => {
    const result = buildRefinementPrompt('custom');
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('IMAGE_REFINEMENT_ACTIONS', () => {
  it('has at least 5 actions', () => {
    expect(IMAGE_REFINEMENT_ACTIONS.length).toBeGreaterThanOrEqual(5);
  });

  it('includes enhance action', () => {
    const enhance = IMAGE_REFINEMENT_ACTIONS.find(a => a.value === 'enhance');
    expect(enhance).toBeDefined();
    expect(enhance!.label).toBeTruthy();
    expect(enhance!.description).toBeTruthy();
  });

  it('includes upscale action', () => {
    const upscale = IMAGE_REFINEMENT_ACTIONS.find(a => a.value === 'upscale');
    expect(upscale).toBeDefined();
  });

  it('includes background-remove action for images', () => {
    const bgRemove = IMAGE_REFINEMENT_ACTIONS.find(a => a.value === 'background-remove');
    expect(bgRemove).toBeDefined();
  });

  it('includes custom action', () => {
    const custom = IMAGE_REFINEMENT_ACTIONS.find(a => a.value === 'custom');
    expect(custom).toBeDefined();
  });

  it('all actions have value, label, and description', () => {
    IMAGE_REFINEMENT_ACTIONS.forEach(action => {
      expect(action.value).toBeTruthy();
      expect(action.label).toBeTruthy();
      expect(action.description).toBeTruthy();
    });
  });
});

describe('VIDEO_REFINEMENT_ACTIONS', () => {
  it('has at least 4 actions', () => {
    expect(VIDEO_REFINEMENT_ACTIONS.length).toBeGreaterThanOrEqual(4);
  });

  it('includes enhance action', () => {
    const enhance = VIDEO_REFINEMENT_ACTIONS.find(a => a.value === 'enhance');
    expect(enhance).toBeDefined();
  });

  it('includes super-resolution action for video', () => {
    const sr = VIDEO_REFINEMENT_ACTIONS.find(a => a.value === 'super-resolution');
    expect(sr).toBeDefined();
  });

  it('does not include background-remove for video', () => {
    const bgRemove = VIDEO_REFINEMENT_ACTIONS.find(a => a.value === 'background-remove');
    expect(bgRemove).toBeUndefined();
  });

  it('all actions have value, label, and description', () => {
    VIDEO_REFINEMENT_ACTIONS.forEach(action => {
      expect(action.value).toBeTruthy();
      expect(action.label).toBeTruthy();
      expect(action.description).toBeTruthy();
    });
  });
});

// ─── Refinement API Tests (mocked fetch) ──────────────────────────────────────

describe('refineMedia', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends correct request body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'ref-1',
        url: 'https://example.com/refined.jpg',
        model: 'openai-image',
        provider: 'openai',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { refineMedia } = await import('@/services/media-refinement-service');
    await refineMedia({
      mediaUrl: 'https://example.com/original.jpg',
      mediaType: 'image',
      action: 'enhance',
      prompt: 'Make it better',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/ai-orchestrator');
    const body = JSON.parse(options.body);
    expect(body.type).toBe('refine_media');
    expect(body.data.media_url).toBe('https://example.com/original.jpg');
    expect(body.data.media_type).toBe('image');
    expect(body.data.action).toBe('enhance');
  });

  it('returns success on ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'ref-2',
        url: 'https://example.com/refined.mp4',
        model: 'veo-3.1',
        provider: 'google',
      }),
    }));

    const { refineMedia } = await import('@/services/media-refinement-service');
    const result = await refineMedia({
      mediaUrl: 'https://example.com/original.mp4',
      mediaType: 'video',
      action: 'upscale',
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data.refinedUrl).toBe('https://example.com/refined.mp4');
      expect(result.data.action).toBe('upscale');
    }
  });

  it('returns error on failed response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal error' }),
    }));

    const { refineMedia } = await import('@/services/media-refinement-service');
    const result = await refineMedia({
      mediaUrl: 'https://example.com/original.jpg',
      mediaType: 'image',
      action: 'denoise',
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.message).toContain('Internal error');
      expect(result.error.retryable).toBe(true);
    }
  });

  it('returns error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const { refineMedia } = await import('@/services/media-refinement-service');
    const result = await refineMedia({
      mediaUrl: 'https://example.com/original.jpg',
      mediaType: 'image',
      action: 'enhance',
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.category).toBe('network');
      expect(result.error.retryable).toBe(true);
    }
  });

  it('handles rate limit responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: 'Rate limited' }),
    }));

    const { refineMedia } = await import('@/services/media-refinement-service');
    const result = await refineMedia({
      mediaUrl: 'https://example.com/original.jpg',
      mediaType: 'image',
      action: 'enhance',
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.category).toBe('rate_limit');
    }
  });
});

// ─── Persistence Service Tests (mocked fetch) ────────────────────────────────

describe('saveMedia', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns auth error when userId is missing', async () => {
    const { saveMedia } = await import('@/services/media-persistence-service');
    const result = await saveMedia({
      userId: '',
      mediaUrl: 'https://example.com/photo.jpg',
      mediaType: 'image',
      filename: 'photo.jpg',
      source: 'generation',
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.category).toBe('auth');
    }
  });

  it('returns validation error when mediaUrl is missing', async () => {
    const { saveMedia } = await import('@/services/media-persistence-service');
    const result = await saveMedia({
      userId: 'user-1',
      mediaUrl: '',
      mediaType: 'image',
      filename: 'photo.jpg',
      source: 'generation',
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.category).toBe('validation');
    }
  });

  it('sends correct save request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'media-1',
        created_at: '2025-01-01T00:00:00Z',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { saveMedia } = await import('@/services/media-persistence-service');
    const result = await saveMedia({
      userId: 'user-1',
      mediaUrl: 'https://example.com/photo.jpg',
      mediaType: 'image',
      filename: 'photo.jpg',
      prompt: 'A sunset',
      source: 'generation',
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data.id).toBe('media-1');
      expect(result.data.userId).toBe('user-1');
      expect(result.data.source).toBe('generation');
    }
  });

  it('returns error on server failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'DB error' }),
    }));

    const { saveMedia } = await import('@/services/media-persistence-service');
    const result = await saveMedia({
      userId: 'user-1',
      mediaUrl: 'https://example.com/photo.jpg',
      mediaType: 'image',
      filename: 'photo.jpg',
      source: 'generation',
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.category).toBe('server');
    }
  });
});

describe('listUserMedia', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns auth error when userId is empty', async () => {
    const { listUserMedia } = await import('@/services/media-persistence-service');
    const result = await listUserMedia('');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.category).toBe('auth');
    }
  });

  it('returns media records on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        media: [
          {
            id: 'rec-1',
            user_id: 'user-1',
            public_url: 'https://example.com/photo.jpg',
            media_type: 'image',
            filename: 'photo.jpg',
            created_at: '2025-01-01T00:00:00Z',
          },
          {
            id: 'rec-2',
            user_id: 'user-1',
            public_url: 'https://example.com/video.mp4',
            media_type: 'video',
            filename: 'video.mp4',
            created_at: '2025-01-02T00:00:00Z',
          },
        ],
      }),
    }));

    const { listUserMedia } = await import('@/services/media-persistence-service');
    const result = await listUserMedia('user-1');

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].mediaType).toBe('image');
      expect(result.data[1].mediaType).toBe('video');
    }
  });
});
