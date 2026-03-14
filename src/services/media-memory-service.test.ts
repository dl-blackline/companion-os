import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  UploadedMedia,
  MemoryCandidate,
  MediaProcessingState,
  MemoryCandidateStatus,
  UploadedMediaRow,
  MediaAnalysisRow,
  MemoryCandidateRow,
  MediaKnowledgeEntryRow,
  MediaMemoryLinkRow,
  CreateUploadedMediaPayload,
  UpdateMediaStatePayload,
} from '@/types';
import {
  MEDIA_TABLE_NAMES,
} from '@/services/media-memory-service';

// ─── Table Name Constants ─────────────────────────────────────────────────────

describe('MEDIA_TABLE_NAMES', () => {
  it('contains all required table names', () => {
    expect(MEDIA_TABLE_NAMES.UPLOADED_MEDIA).toBe('uploaded_media');
    expect(MEDIA_TABLE_NAMES.MEDIA_ANALYSIS).toBe('media_analysis');
    expect(MEDIA_TABLE_NAMES.MEMORY_CANDIDATES).toBe('memory_candidates');
    expect(MEDIA_TABLE_NAMES.MEDIA_MEMORY_LINKS).toBe('media_memory_links');
    expect(MEDIA_TABLE_NAMES.MEDIA_KNOWLEDGE_ENTRIES).toBe('media_knowledge_entries');
    expect(MEDIA_TABLE_NAMES.USER_MEMORY_PREFERENCES).toBe('user_memory_preferences');
  });

  it('has all six expected tables', () => {
    expect(Object.keys(MEDIA_TABLE_NAMES)).toHaveLength(6);
  });
});

// ─── Database Row Type Conformance ────────────────────────────────────────────

describe('Database Row Types', () => {
  it('UploadedMediaRow has correct shape', () => {
    const row: UploadedMediaRow = {
      id: 'uuid-1',
      user_id: 'user-1',
      storage_path: '/uploads/img.jpg',
      public_url: 'https://cdn.example.com/img.jpg',
      filename: 'img.jpg',
      media_type: 'image',
      mime_type: 'image/jpeg',
      file_size_bytes: 1024,
      user_title: 'My Photo',
      user_note: 'A nice photo',
      processing_state: 'done',
      deleted_at: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };
    expect(row.id).toBe('uuid-1');
    expect(row.processing_state).toBe('done');
    expect(row.deleted_at).toBeNull();
  });

  it('MediaAnalysisRow has correct shape', () => {
    const row: MediaAnalysisRow = {
      id: 'analysis-1',
      media_id: 'uuid-1',
      user_id: 'user-1',
      summary: 'A photo of a dog',
      description: 'A golden retriever in a park',
      extracted_text: null,
      transcript: null,
      tags: ['dog', 'park'],
      entities: [{ name: 'golden retriever', type: 'object', confidence: 0.9 }],
      emotional_cues: ['happy'],
      timestamped_moments: [],
      model_used: 'gpt-4.1',
      embedding: null,
      created_at: '2024-01-01T00:00:00Z',
    };
    expect(row.id).toBe('analysis-1');
    expect(row.tags).toHaveLength(2);
  });

  it('MemoryCandidateRow has correct shape', () => {
    const row: MemoryCandidateRow = {
      id: 'candidate-1',
      user_id: 'user-1',
      media_id: 'uuid-1',
      title: 'User has a dog',
      content: 'The user has a golden retriever',
      category: 'identity',
      confidence: 0.85,
      privacy_level: 'private',
      tags: ['pet'],
      status: 'pending',
      decided_at: null,
      created_at: '2024-01-01T00:00:00Z',
    };
    expect(row.status).toBe('pending');
    expect(row.confidence).toBeGreaterThan(0);
  });

  it('MediaKnowledgeEntryRow has correct shape', () => {
    const row: MediaKnowledgeEntryRow = {
      id: 'knowledge-1',
      user_id: 'user-1',
      media_id: 'uuid-1',
      title: 'Photo: Dog in park',
      content: 'A golden retriever playing in the park',
      item_type: 'media',
      category: 'image',
      tags: ['dog', 'park'],
      summary: 'Dog photo',
      embedding: null,
      deleted_at: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };
    expect(row.item_type).toBe('media');
    expect(row.deleted_at).toBeNull();
  });

  it('MediaMemoryLinkRow has correct shape', () => {
    const row: MediaMemoryLinkRow = {
      id: 'link-1',
      user_id: 'user-1',
      media_id: 'uuid-1',
      memory_type: 'episodic',
      memory_id: 'memory-1',
      created_at: '2024-01-01T00:00:00Z',
    };
    expect(row.memory_type).toBe('episodic');
    expect(['episodic', 'relationship', 'summary']).toContain(row.memory_type);
  });
});

// ─── Processing State Lifecycle ───────────────────────────────────────────────

describe('MediaProcessingState lifecycle', () => {
  const validStates: MediaProcessingState[] = ['pending', 'processing', 'done', 'failed'];

  it('all valid processing states are recognized', () => {
    for (const state of validStates) {
      const row: UploadedMediaRow = {
        id: 'x', user_id: 'u', storage_path: '/p', public_url: null,
        filename: 'f', media_type: 'image', mime_type: null,
        file_size_bytes: null, user_title: null, user_note: null,
        processing_state: state, deleted_at: null,
        created_at: '', updated_at: '',
      };
      expect(validStates).toContain(row.processing_state);
    }
  });
});

describe('MemoryCandidateStatus lifecycle', () => {
  const validStatuses: MemoryCandidateStatus[] = ['pending', 'approved', 'rejected'];

  it('all valid candidate statuses are recognized', () => {
    for (const status of validStatuses) {
      const row: MemoryCandidateRow = {
        id: 'x', user_id: 'u', media_id: null, title: 't',
        content: 'c', category: 'knowledge', confidence: 0.5,
        privacy_level: 'private', tags: [], status,
        decided_at: null, created_at: '',
      };
      expect(validStatuses).toContain(row.status);
    }
  });
});

// ─── Create Payload Types ─────────────────────────────────────────────────────

describe('Create / Update Payloads', () => {
  it('CreateUploadedMediaPayload accepts required fields only', () => {
    const payload: CreateUploadedMediaPayload = {
      user_id: 'user-1',
      storage_path: '/path/to/file.jpg',
      filename: 'file.jpg',
      media_type: 'image',
    };
    expect(payload.user_id).toBe('user-1');
    expect(payload.processing_state).toBeUndefined();
  });

  it('CreateUploadedMediaPayload accepts all optional fields', () => {
    const payload: CreateUploadedMediaPayload = {
      user_id: 'user-1',
      storage_path: '/path/to/file.jpg',
      public_url: 'https://cdn.example.com/file.jpg',
      filename: 'file.jpg',
      media_type: 'video',
      mime_type: 'video/mp4',
      file_size_bytes: 5_000_000,
      user_title: 'Demo video',
      user_note: 'Taken at home',
      processing_state: 'pending',
    };
    expect(payload.processing_state).toBe('pending');
    expect(payload.file_size_bytes).toBe(5_000_000);
  });

  it('UpdateMediaStatePayload accepts processing state', () => {
    const payload: UpdateMediaStatePayload = {
      processing_state: 'done',
      updated_at: '2024-01-01T00:00:00Z',
    };
    expect(payload.processing_state).toBe('done');
  });
});

// ─── UploadedMedia with Joins ─────────────────────────────────────────────────

describe('UploadedMedia (with optional joins)', () => {
  it('can include media_analysis and memory_candidates joins', () => {
    const media: UploadedMedia = {
      id: 'uuid-1',
      user_id: 'user-1',
      storage_path: '/uploads/photo.png',
      public_url: 'https://cdn.example.com/photo.png',
      filename: 'photo.png',
      media_type: 'image',
      mime_type: 'image/png',
      file_size_bytes: 2048,
      user_title: null,
      user_note: null,
      processing_state: 'done',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      media_analysis: [
        {
          id: 'a-1',
          media_id: 'uuid-1',
          summary: 'A landscape',
          description: 'Mountain scene',
          extracted_text: null,
          transcript: null,
          tags: ['landscape'],
          entities: [],
          emotional_cues: ['serene'],
          timestamped_moments: [],
          model_used: 'gpt-4.1',
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
      memory_candidates: [
        {
          id: 'c-1',
          user_id: 'user-1',
          media_id: 'uuid-1',
          title: 'User likes mountains',
          content: 'User shared a mountain landscape photo',
          category: 'episodic',
          confidence: 0.8,
          privacy_level: 'private',
          tags: ['landscape'],
          status: 'pending',
          decided_at: null,
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
    };

    expect(media.media_analysis).toHaveLength(1);
    expect(media.memory_candidates).toHaveLength(1);
    expect(media.media_analysis![0].summary).toBe('A landscape');
    expect(media.memory_candidates![0].status).toBe('pending');
  });

  it('works without optional joins', () => {
    const media: UploadedMedia = {
      id: 'uuid-2',
      user_id: 'user-1',
      storage_path: '/uploads/vid.mp4',
      public_url: null,
      filename: 'vid.mp4',
      media_type: 'video',
      mime_type: 'video/mp4',
      file_size_bytes: null,
      user_title: null,
      user_note: null,
      processing_state: 'pending',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    expect(media.media_analysis).toBeUndefined();
    expect(media.memory_candidates).toBeUndefined();
  });
});

// ─── MemoryCandidate with Joined Media ────────────────────────────────────────

describe('MemoryCandidate with uploaded_media join', () => {
  it('includes joined uploaded_media data', () => {
    const candidate: MemoryCandidate = {
      id: 'c-1',
      user_id: 'user-1',
      media_id: 'uuid-1',
      title: 'Test memory',
      content: 'Test content',
      category: 'knowledge',
      confidence: 0.7,
      privacy_level: 'private',
      tags: [],
      status: 'pending',
      decided_at: null,
      created_at: '2024-01-01T00:00:00Z',
      uploaded_media: {
        id: 'uuid-1',
        public_url: 'https://cdn.example.com/photo.jpg',
        filename: 'photo.jpg',
        media_type: 'image',
        user_title: null,
      },
    };

    expect(candidate.uploaded_media?.filename).toBe('photo.jpg');
    expect(candidate.uploaded_media?.media_type).toBe('image');
  });
});

// ─── analyzeImage Service Fix ─────────────────────────────────────────────────

describe('analyzeImage service', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends correct fields to the backend API', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          analysis_record: {
            summary: 'test',
            description: 'test desc',
            extractedText: null,
            transcript: null,
            tags: [],
            entities: [],
            emotionalCues: [],
            objects: [],
            scenes: [],
            contentClassification: { primaryCategory: 'test', subcategories: [], isSafe: true, sensitivityFlags: [] },
            qualityScore: 0.8,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const { analyzeImage } = await import('@/services/image-service');
    await analyzeImage('https://example.com/img.jpg', 'user-123', 'test.jpg', 'standard');

    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.action).toBe('analyze');
    expect(capturedBody!.user_id).toBe('user-123');
    expect(capturedBody!.public_url).toBe('https://example.com/img.jpg');
    expect(capturedBody!.filename).toBe('test.jpg');
    expect(capturedBody!.media_type).toBe('image');
    // Verify old incorrect field is NOT sent
    expect(capturedBody!.media_url).toBeUndefined();
  });

  it('returns validation error when user_id is missing', async () => {
    const { analyzeImage } = await import('@/services/image-service');
    const result = await analyzeImage('https://example.com/img.jpg', '', 'test.jpg');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.message).toContain('user_id');
    }
  });

  it('returns validation error when filename is missing', async () => {
    const { analyzeImage } = await import('@/services/image-service');
    const result = await analyzeImage('https://example.com/img.jpg', 'user-123', '');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.message).toContain('filename');
    }
  });
});

// ─── analyzeVideo Service Fix ─────────────────────────────────────────────────

describe('analyzeVideo service', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends correct fields to the backend API', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          analysis_record: {
            summary: 'test video',
            description: 'test video desc',
            extractedText: null,
            transcript: 'hello world',
            tags: ['video'],
            entities: [],
            emotionalCues: [],
            objects: [],
            scenes: [],
            contentClassification: { primaryCategory: 'test', subcategories: [], isSafe: true, sensitivityFlags: [] },
            qualityScore: 0.8,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const { analyzeVideo } = await import('@/services/video-service');
    await analyzeVideo('https://example.com/vid.mp4', 'user-456', 'clip.mp4', 'standard');

    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.action).toBe('analyze');
    expect(capturedBody!.user_id).toBe('user-456');
    expect(capturedBody!.public_url).toBe('https://example.com/vid.mp4');
    expect(capturedBody!.filename).toBe('clip.mp4');
    expect(capturedBody!.media_type).toBe('video');
    // Verify old incorrect field is NOT sent
    expect(capturedBody!.media_url).toBeUndefined();
  });

  it('returns validation error when user_id is missing', async () => {
    const { analyzeVideo } = await import('@/services/video-service');
    const result = await analyzeVideo('https://example.com/vid.mp4', '', 'clip.mp4');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.message).toContain('user_id');
    }
  });

  it('returns validation error when filename is missing', async () => {
    const { analyzeVideo } = await import('@/services/video-service');
    const result = await analyzeVideo('https://example.com/vid.mp4', 'user-456', '');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.message).toContain('filename');
    }
  });
});
