import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MemoryCandidate } from '@/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<MemoryCandidate> = {}): MemoryCandidate {
  return {
    id: 'candidate-1',
    user_id: 'user-123',
    media_id: 'media-1',
    title: 'User has a golden retriever named Max',
    content: 'The user shared a photo of their dog, a golden retriever named Max.',
    category: 'episodic',
    confidence: 0.85,
    privacy_level: 'private',
    tags: ['pet', 'dog'],
    status: 'pending',
    decided_at: null,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── analyzeMedia service contract ────────────────────────────────────────────
// These tests validate that the media-memory-service analyzeMedia call
// sends the correct shape expected by the backend.

describe('analyzeMedia request shape', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends all required fields for an image analysis', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          media_record: {
            id: 'media-1',
            user_id: 'user-123',
            storage_path: '/uploads/photo.jpg',
            public_url: 'https://cdn.example.com/photo.jpg',
            filename: 'photo.jpg',
            media_type: 'image',
            mime_type: 'image/jpeg',
            file_size_bytes: 1024,
            user_title: null,
            user_note: null,
            processing_state: 'done',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          analysis_record: {
            id: 'analysis-1',
            media_id: 'media-1',
            summary: 'A photo of a golden retriever',
            description: 'A happy golden retriever in a park',
            extracted_text: null,
            transcript: null,
            tags: ['dog', 'park'],
            entities: [],
            emotional_cues: ['happy'],
            timestamped_moments: [],
            model_used: 'gpt-4.1',
            created_at: '2024-01-01T00:00:00Z',
          },
          candidates: [makeCandidate()],
          knowledge_entry: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const { analyzeMedia } = await import('@/services/media-memory-service');
    const result = await analyzeMedia({
      user_id: 'user-123',
      public_url: 'https://cdn.example.com/photo.jpg',
      storage_path: '/uploads/photo.jpg',
      filename: 'photo.jpg',
      media_type: 'image',
      mime_type: 'image/jpeg',
      file_size_bytes: 1024,
      user_title: 'My Dog Max',
      user_note: 'Taken at the park',
    });

    expect(result.status).toBe('success');
    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.action).toBe('analyze');
    expect(capturedBody!.user_id).toBe('user-123');
    expect(capturedBody!.public_url).toBe('https://cdn.example.com/photo.jpg');
    expect(capturedBody!.filename).toBe('photo.jpg');
    expect(capturedBody!.media_type).toBe('image');
    expect(capturedBody!.user_title).toBe('My Dog Max');
    expect(capturedBody!.user_note).toBe('Taken at the park');
  });

  it('returns success with candidates when analysis succeeds', async () => {
    const candidate = makeCandidate();

    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          media_record: {
            id: 'media-1',
            user_id: 'user-123',
            storage_path: '/uploads/photo.jpg',
            public_url: 'https://cdn.example.com/photo.jpg',
            filename: 'photo.jpg',
            media_type: 'image',
            mime_type: 'image/jpeg',
            file_size_bytes: 1024,
            user_title: null,
            user_note: null,
            processing_state: 'done',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          analysis_record: null,
          candidates: [candidate],
          knowledge_entry: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const { analyzeMedia } = await import('@/services/media-memory-service');
    const result = await analyzeMedia({
      user_id: 'user-123',
      public_url: 'https://cdn.example.com/photo.jpg',
      filename: 'photo.jpg',
      media_type: 'image',
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data.candidates).toHaveLength(1);
      expect(result.data.candidates[0].title).toBe(candidate.title);
    }
  });

  it('returns an error when analysis fails with a server error', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ error: 'Vision model unavailable' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const { analyzeMedia } = await import('@/services/media-memory-service');
    const result = await analyzeMedia({
      user_id: 'user-123',
      public_url: 'https://cdn.example.com/photo.jpg',
      filename: 'photo.jpg',
      media_type: 'image',
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.message).toContain('Vision model unavailable');
      expect(result.error.retryable).toBe(true);
    }
  });

  it('returns a network error when fetch throws', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('Network unavailable');
    });

    const { analyzeMedia } = await import('@/services/media-memory-service');
    const result = await analyzeMedia({
      user_id: 'user-123',
      public_url: 'https://cdn.example.com/photo.jpg',
      filename: 'photo.jpg',
      media_type: 'image',
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.message).toContain('Network unavailable');
      expect(result.error.retryable).toBe(true);
    }
  });
});

// ─── approveCandidate service contract ────────────────────────────────────────

describe('approveCandidate service', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends correct fields to the backend', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({ approved: true, memory_type: 'episodic' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const { approveCandidate } = await import('@/services/media-memory-service');
    const result = await approveCandidate({
      user_id: 'user-123',
      candidate_id: 'candidate-1',
    });

    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.action).toBe('approve');
    expect(capturedBody!.user_id).toBe('user-123');
    expect(capturedBody!.candidate_id).toBe('candidate-1');

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data.approved).toBe(true);
      expect(result.data.memory_type).toBe('episodic');
    }
  });

  it('forwards optional title_override and content_override', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({ approved: true, memory_type: 'relationship' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const { approveCandidate } = await import('@/services/media-memory-service');
    await approveCandidate({
      user_id: 'user-123',
      candidate_id: 'candidate-1',
      title_override: 'Custom title',
      content_override: 'Custom content',
    });

    expect(capturedBody!.title_override).toBe('Custom title');
    expect(capturedBody!.content_override).toBe('Custom content');
  });

  it('returns an error when the backend rejects the request', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ error: 'Candidate not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const { approveCandidate } = await import('@/services/media-memory-service');
    const result = await approveCandidate({
      user_id: 'user-123',
      candidate_id: 'nonexistent-id',
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.message).toContain('Candidate not found');
    }
  });
});

// ─── rejectCandidate service contract ─────────────────────────────────────────

describe('rejectCandidate service', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends correct fields to the backend', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({ rejected: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const { rejectCandidate } = await import('@/services/media-memory-service');
    const result = await rejectCandidate('user-123', 'candidate-1');

    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.action).toBe('reject');
    expect(capturedBody!.user_id).toBe('user-123');
    expect(capturedBody!.candidate_id).toBe('candidate-1');

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data.rejected).toBe(true);
    }
  });
});

// ─── MemoryCandidate status lifecycle ─────────────────────────────────────────

describe('MemoryCandidate approval lifecycle types', () => {
  it('pending candidate can be approved', () => {
    const candidate = makeCandidate({ status: 'pending' });
    const approved: MemoryCandidate = { ...candidate, status: 'approved' };
    expect(approved.status).toBe('approved');
  });

  it('pending candidate can be rejected', () => {
    const candidate = makeCandidate({ status: 'pending' });
    const rejected: MemoryCandidate = { ...candidate, status: 'rejected' };
    expect(rejected.status).toBe('rejected');
  });

  it('candidate with media origin retains media_id link after approval', () => {
    const candidate = makeCandidate({ media_id: 'media-abc', status: 'pending' });
    const approved: MemoryCandidate = { ...candidate, status: 'approved' };
    expect(approved.media_id).toBe('media-abc');
  });

  it('standalone candidate (no media origin) has null media_id', () => {
    const candidate = makeCandidate({ media_id: null, status: 'pending' });
    expect(candidate.media_id).toBeNull();
  });
});

// ─── saveMemory service contract ──────────────────────────────────────────────
// Validates that saveMemory calls search-memory with the correct action and fields.

describe('saveMemory service', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends action=save and required fields to /.netlify/functions/search-memory', async () => {
    let capturedUrl: string | null = null;
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          memory: {
            id: 'mem-1',
            title: 'User has a dog named Max',
            content: 'The user shared a photo of their dog.',
            category: 'episodic',
            confidence: 0.85,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            source: 'media_analysis',
            privacyLevel: 'private',
            isPinned: false,
            tags: ['pet', 'dog'],
            relatedMemories: [],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const { saveMemory } = await import('@/services/memory-service');
    const result = await saveMemory({
      userId: 'user-123',
      content: 'The user shared a photo of their dog.',
      source: 'media_analysis',
      title: 'User has a dog named Max',
      category: 'episodic',
    });

    expect(capturedUrl).toContain('search-memory');
    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.action).toBe('save');
    expect(capturedBody!.user_id).toBe('user-123');
    expect(capturedBody!.content).toBe('The user shared a photo of their dog.');
    expect(capturedBody!.source).toBe('media_analysis');

    expect(result.status).toBe('success');
  });

  it('returns error when user_id is missing from response (server error)', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ error: 'Missing required field: user_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const { saveMemory } = await import('@/services/memory-service');
    const result = await saveMemory({
      userId: '',
      content: 'Test content',
      source: 'user_explicit',
    });

    expect(result.status).toBe('error');
  });
});

// ─── searchMemories service contract ──────────────────────────────────────────

describe('searchMemories service', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends action=search with user_id and query to search-memory', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({ results: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const { searchMemories } = await import('@/services/memory-service');
    const result = await searchMemories({
      userId: 'user-123',
      queryText: 'golden retriever pet',
      maxResults: 5,
    });

    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.action).toBe('search');
    expect(capturedBody!.user_id).toBe('user-123');
    expect(capturedBody!.query).toBe('golden retriever pet');

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data.results).toHaveLength(0);
    }
  });

  it('returns ranked results when memories are found', async () => {
    const mockMemory = {
      id: 'mem-1',
      title: 'User has a golden retriever',
      content: 'The user has a dog named Max.',
      category: 'episodic',
      confidence: 0.9,
      createdAt: Date.now() - 1000,
      updatedAt: Date.now() - 1000,
      source: 'media_analysis',
      privacyLevel: 'private',
      isPinned: false,
      tags: ['dog'],
      relatedMemories: [],
    };

    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          results: [{ memory: mockMemory, similarity: 0.92 }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const { searchMemories } = await import('@/services/memory-service');
    const result = await searchMemories({
      userId: 'user-123',
      queryText: 'dog pet',
      maxResults: 5,
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data.results).toHaveLength(1);
      expect(result.data.results[0].relevanceScore).toBe(0.92);
      expect(result.data.results[0].memory.title).toBe('User has a golden retriever');
      // userId from the query should propagate into the returned MemoryRecord
      expect(result.data.results[0].memory.userId).toBe('user-123');
    }
  });
});
