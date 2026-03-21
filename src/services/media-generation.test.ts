import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Image Generation Response Parsing ────────────────────────────────────────

describe('generateImage response parsing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('unwraps ok() envelope and extracts resultUrl from data.url', async () => {
    // Simulate the ok() response wrapper: { success: true, data: { ... } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          type: 'image',
          url: 'https://example.com/generated-image.png',
          model: 'gpt-image-1',
          provider: 'openai',
          prompt: 'A beautiful sunset',
        },
      }),
    }));
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' });

    const { generateImage } = await import('@/services/image-service');
    const result = await generateImage({
      prompt: 'A beautiful sunset',
      style: 'photorealistic',
      aspectRatio: '1:1',
      enhancePrompt: false,
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data.resultUrl).toBe('https://example.com/generated-image.png');
      expect(result.data.model).toBe('gpt-image-1');
      expect(result.data.provider).toBe('openai');
      expect(result.data.type).toBe('image');
    }
  });

  it('handles response with resultUrl field instead of url', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          type: 'image',
          resultUrl: 'https://example.com/image-result.png',
          model: 'dall-e-3',
          provider: 'openai',
        },
      }),
    }));
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-5678' });

    const { generateImage } = await import('@/services/image-service');
    const result = await generateImage({
      prompt: 'A forest scene',
      style: 'artistic',
      aspectRatio: '16:9',
      enhancePrompt: false,
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data.resultUrl).toBe('https://example.com/image-result.png');
    }
  });

  it('returns error when response has no media URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          type: 'image',
          model: 'gpt-image-1',
          provider: 'openai',
          // No url or resultUrl
        },
      }),
    }));

    const { generateImage } = await import('@/services/image-service');
    const result = await generateImage({
      prompt: 'A mountain',
      style: 'cinematic',
      aspectRatio: '1:1',
      enhancePrompt: false,
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.message).toContain('no image URL');
    }
  });

  it('returns error on HTTP failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' }),
    }));

    const { generateImage } = await import('@/services/image-service');
    const result = await generateImage({
      prompt: 'A cityscape',
      style: 'cinematic',
      aspectRatio: '1:1',
      enhancePrompt: false,
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.message).toContain('Server error');
      expect(result.error.retryable).toBe(true);
    }
  });

  it('returns error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network timeout')));

    const { generateImage } = await import('@/services/image-service');
    const result = await generateImage({
      prompt: 'A beach',
      style: 'lifestyle',
      aspectRatio: '1:1',
      enhancePrompt: false,
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.category).toBe('network');
      expect(result.error.retryable).toBe(true);
    }
  });
});

// ─── Video Generation Response Parsing ────────────────────────────────────────

describe('generateVideo response parsing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('unwraps ok() envelope and extracts resultUrl from data.url', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          type: 'video',
          url: 'https://example.com/generated-video.mp4',
          model: 'sora',
          provider: 'openai',
          prompt: 'Ocean waves at sunset',
        },
      }),
    }));
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-vid-1' });

    const { generateVideo } = await import('@/services/video-service');
    const result = await generateVideo({
      prompt: 'Ocean waves at sunset',
      style: 'cinematic',
      durationSeconds: 10,
      model: 'sora',
      enhancePrompt: false,
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data.resultUrl).toBe('https://example.com/generated-video.mp4');
      expect(result.data.model).toBe('sora');
      expect(result.data.provider).toBe('openai');
      expect(result.data.type).toBe('video');
    }
  });

  it('detects async job from ok() wrapped response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          job_id: 'job-abc-123',
          status: 'pending',
        },
      }),
    }));

    const { generateVideo } = await import('@/services/video-service');
    const result = await generateVideo({
      prompt: 'A cityscape timelapse',
      style: 'cinematic',
      durationSeconds: 15,
      model: 'sora',
      enhancePrompt: false,
    });

    expect(result.status).toBe('processing');
    if (result.status === 'processing') {
      expect(result.jobId).toBe('job-abc-123');
    }
  });

  it('detects async job from taskId in response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          taskId: 'task-xyz-789',
        },
      }),
    }));

    const { generateVideo } = await import('@/services/video-service');
    const result = await generateVideo({
      prompt: 'Fireworks display',
      style: 'cinematic',
      durationSeconds: 5,
      model: 'sora',
      enhancePrompt: false,
    });

    expect(result.status).toBe('processing');
    if (result.status === 'processing') {
      expect(result.jobId).toBe('task-xyz-789');
    }
  });

  it('returns error when response has no video URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          type: 'video',
          model: 'sora',
          provider: 'openai',
          // No url, resultUrl, taskId, or job_id
        },
      }),
    }));

    const { generateVideo } = await import('@/services/video-service');
    const result = await generateVideo({
      prompt: 'A quiet meadow',
      style: 'lifestyle',
      durationSeconds: 10,
      model: 'sora',
      enhancePrompt: false,
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.message).toContain('no video URL');
    }
  });

  it('returns error on HTTP failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: 'Rate limited' }),
    }));

    const { generateVideo } = await import('@/services/video-service');
    const result = await generateVideo({
      prompt: 'A waterfall',
      style: 'photorealistic',
      durationSeconds: 10,
      model: 'sora',
      enhancePrompt: false,
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.category).toBe('rate_limit');
    }
  });

  it('returns error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));

    const { generateVideo } = await import('@/services/video-service');
    const result = await generateVideo({
      prompt: 'A stormy sea',
      style: 'cinematic',
      durationSeconds: 10,
      model: 'sora',
      enhancePrompt: false,
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.category).toBe('network');
      expect(result.error.retryable).toBe(true);
    }
  });
});
