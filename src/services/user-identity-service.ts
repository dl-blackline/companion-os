import { supabase, supabaseConfigured } from '@/lib/supabase-client';
import { validateImageFile } from '@/services/image-service';
import type { FileValidationResult } from '@/types/media';

const API_BASE = '/.netlify/functions/user-identity';

export type IdentityStyle = 'avatar' | 'emojicon';

export interface IdentityVariant {
  index: number;
  url: string;
  prompt: string;
  model: string | null;
  provider: string | null;
  created_at: string;
}

export interface UserIdentityProfile {
  id: string;
  user_id: string;
  original_image_url: string;
  original_storage_path: string | null;
  original_filename: string | null;
  style_type: IdentityStyle;
  variants: IdentityVariant[];
  selected_variant_index: number | null;
  selected_variant_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface IdentityEnvelope {
  success?: boolean;
  data?: {
    identity?: UserIdentityProfile | null;
    generated_count?: number;
    active_avatar_url?: string;
  };
  error?: string;
}

async function getAuthToken(): Promise<string | null> {
  if (!supabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function post(body: Record<string, unknown>): Promise<IdentityEnvelope> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as IdentityEnvelope;
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Identity request failed (${res.status})`);
  }
  return json;
}

export function validateIdentityImageFile(file: File): FileValidationResult {
  return validateImageFile(file);
}

export async function uploadIdentitySourceImage(userId: string, file: File): Promise<{ publicUrl: string; storagePath: string }> {
  if (!supabaseConfigured) {
    throw new Error('Supabase is not configured. Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY).');
  }

  const ext = file.name.split('.').pop() || 'png';
  const storagePath = `${userId}/identity/original-${crypto.randomUUID()}.${ext}`;

  const { data, error } = await supabase.storage
    .from('media_uploads')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (error || !data?.path) {
    throw new Error(error?.message || 'Failed to upload source image');
  }

  const { data: publicData } = supabase.storage.from('media_uploads').getPublicUrl(data.path);
  if (!publicData?.publicUrl) {
    throw new Error('Failed to resolve uploaded image URL');
  }

  return {
    publicUrl: publicData.publicUrl,
    storagePath: data.path,
  };
}

export async function generateIdentityVariants(input: {
  style: IdentityStyle;
  originalImageUrl: string;
  originalStoragePath?: string;
  originalFilename?: string;
  variationCount?: number;
}): Promise<UserIdentityProfile> {
  const json = await post({
    action: 'generate',
    style: input.style,
    original_image_url: input.originalImageUrl,
    original_storage_path: input.originalStoragePath,
    original_filename: input.originalFilename,
    variation_count: input.variationCount ?? 3,
  });

  const identity = json.data?.identity;
  if (!identity) {
    throw new Error('No identity variants were returned');
  }
  return identity;
}

export async function selectActiveIdentityVariant(identityId: string, variantIndex: number): Promise<UserIdentityProfile> {
  const json = await post({
    action: 'select',
    identity_id: identityId,
    variant_index: variantIndex,
  });

  const identity = json.data?.identity;
  if (!identity) {
    throw new Error('Failed to save active identity');
  }
  return identity;
}

export async function getActiveIdentityProfile(): Promise<UserIdentityProfile | null> {
  const json = await post({ action: 'get_active' });
  return json.data?.identity ?? null;
}

export function getUserInitials(displayName?: string, fallbackEmail?: string): string {
  const source = (displayName || fallbackEmail || 'U').trim();
  if (!source) return 'U';
  return source
    .split(/\s+/)
    .map((chunk) => chunk[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
