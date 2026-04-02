import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import {
  generateIdentityVariants,
  getActiveIdentityProfile,
  getUserInitials,
  selectActiveIdentityVariant,
  uploadIdentitySourceImage,
  validateIdentityImageFile,
  type IdentityStyle,
  type UserIdentityProfile,
} from '@/services/user-identity-service';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { Image as ImageIcon } from '@phosphor-icons/react/Image';
import { Smiley } from '@phosphor-icons/react/Smiley';
import { Sparkle } from '@phosphor-icons/react/Sparkle';
import { Spinner } from '@phosphor-icons/react/Spinner';
import { UploadSimple } from '@phosphor-icons/react/UploadSimple';
import { WarningCircle } from '@phosphor-icons/react/WarningCircle';

const DEFAULT_VARIATION_COUNT = 3;

export function UserIdentityCard() {
  const { user, configured } = useAuth();
  const { prefs, updatePreferences } = useSettings();

  const [identity, setIdentity] = useState<UserIdentityProfile | null>(null);
  const [style, setStyle] = useState<IdentityStyle>('avatar');
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const initials = getUserInitials(prefs.display_name, user?.email);

  useEffect(() => {
    let cancelled = false;

    async function loadActive() {
      if (!configured || !user?.id) return;
      setIsLoading(true);
      try {
        const active = await getActiveIdentityProfile();
        if (!cancelled && active) {
          setIdentity(active);
          if (Number.isInteger(active.selected_variant_index)) {
            setSelectedVariantIndex(active.selected_variant_index);
          }
          setStyle(active.style_type);
        }
      } catch {
        // Keep this silent so account settings do not show a false-error state.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadActive();

    return () => {
      cancelled = true;
      if (sourcePreviewUrl) {
        URL.revokeObjectURL(sourcePreviewUrl);
      }
    };
  }, [configured, user?.id]);

  const variants = identity?.variants ?? [];
  const selectedVariantUrl =
    selectedVariantIndex != null ? variants[selectedVariantIndex]?.url : null;
  const activeAvatarUrl = selectedVariantUrl || identity?.selected_variant_url || prefs.avatar_url || null;

  const canGenerate = Boolean(configured && user?.id && sourceFile) && !isGenerating;
  const canSave = Boolean(identity && selectedVariantIndex != null && variants[selectedVariantIndex]?.url) && !isSaving;

  const stateLabel = useMemo(() => {
    if (isGenerating) return 'generating';
    if (error) return 'error';
    if (savedMessage) return 'saved';
    if (identity && variants.length > 0) return 'selection';
    return 'empty';
  }, [error, identity, isGenerating, savedMessage, variants.length]);

  const handleFileChange = (file: File | null) => {
    setError(null);
    setSavedMessage(null);
    if (!file) return;

    const validation = validateIdentityImageFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Please upload a valid image file.');
      return;
    }

    if (sourcePreviewUrl) {
      URL.revokeObjectURL(sourcePreviewUrl);
    }

    setSourceFile(file);
    setSourcePreviewUrl(URL.createObjectURL(file));
  };

  const handleGenerate = async () => {
    if (!user?.id || !sourceFile) {
      setError('Please upload a photo before generating identity variants.');
      return;
    }

    setError(null);
    setSavedMessage(null);
    setIsGenerating(true);

    try {
      const uploaded = await uploadIdentitySourceImage(user.id, sourceFile);
      const generated = await generateIdentityVariants({
        style,
        originalImageUrl: uploaded.publicUrl,
        originalStoragePath: uploaded.storagePath,
        originalFilename: sourceFile.name,
        variationCount: DEFAULT_VARIATION_COUNT,
      });

      const nextSelected = generated.selected_variant_index ?? (generated.variants.length > 0 ? 0 : null);
      setIdentity(generated);
      setSelectedVariantIndex(nextSelected);
    } catch (err) {
      setError((err as Error).message || 'Failed to generate identity variants.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveActive = async () => {
    if (!identity || selectedVariantIndex == null) {
      setError('Please choose a variant before saving.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSavedMessage(null);

    try {
      const updated = await selectActiveIdentityVariant(identity.id, selectedVariantIndex);
      setIdentity(updated);
      const selectedUrl = updated.selected_variant_url || updated.variants?.[selectedVariantIndex]?.url;
      if (selectedUrl) {
        await updatePreferences({
          avatar_url: selectedUrl,
          avatar_style: updated.style_type,
          active_identity_id: updated.id,
        });
      }
      setSavedMessage('Identity saved and now active across Vuk OS.');
    } catch (err) {
      setError((err as Error).message || 'Failed to save active identity.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Visual Identity</h3>
          <p className="text-sm text-muted-foreground">
            Upload a photo and generate stylized avatar or emojicon identity variants.
          </p>
        </div>
        <Avatar className="size-12 border border-border/60">
          {activeAvatarUrl && <AvatarImage src={activeAvatarUrl} alt="Active identity" />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </div>

      {!configured && (
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-300">
          Authentication is not configured. Enable Supabase auth to generate and save identity.
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size={16} className="animate-spin" />
          Loading your saved identity…
        </div>
      )}

      <div className="space-y-3">
        <Label className="text-sm font-medium">Style</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setStyle('avatar')}
            className={cn(
              'rounded-lg border p-3 text-left transition-colors',
              style === 'avatar' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
            )}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <ImageIcon size={16} className="text-primary" /> Avatar
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Polished, modern, premium portrait with strong likeness.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setStyle('emojicon')}
            className={cn(
              'rounded-lg border p-3 text-left transition-colors',
              style === 'emojicon' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
            )}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <Smiley size={16} className="text-primary" /> Emojicon
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Simplified, expressive, iconic identity while staying recognizable.
            </p>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Source Photo</Label>
        <div className="rounded-lg border border-dashed border-border p-4">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
            disabled={!configured || isGenerating || isSaving}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Accepted: JPG, PNG, GIF, WebP (max 10 MB)
          </p>
          {sourcePreviewUrl && (
            <img
              src={sourcePreviewUrl}
              alt="Source preview"
              className="mt-3 h-28 w-28 rounded-lg border border-border object-cover"
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleGenerate} disabled={!canGenerate} className="gap-2">
          {isGenerating ? (
            <>
              <Spinner size={16} className="animate-spin" /> Generating…
            </>
          ) : (
            <>
              <Sparkle size={16} /> Generate 3 Variations
            </>
          )}
        </Button>
        {identity && (
          <Button
            variant="outline"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="gap-2"
          >
            <UploadSimple size={16} /> Regenerate
          </Button>
        )}
      </div>

      {stateLabel === 'empty' && !isLoading && (
        <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
          Upload a clear portrait photo and generate your identity options.
        </div>
      )}

      {isGenerating && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
          Generating profile-ready variants… this may take a few moments.
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
          <WarningCircle size={16} className="mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {variants.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Choose a Variant</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {variants.map((variant, index) => {
              const selected = selectedVariantIndex === index;
              return (
                <button
                  key={`${variant.url}-${index}`}
                  type="button"
                  onClick={() => setSelectedVariantIndex(index)}
                  className={cn(
                    'relative rounded-xl border overflow-hidden transition-all',
                    selected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'
                  )}
                >
                  <img src={variant.url} alt={`Identity variant ${index + 1}`} className="h-28 w-full object-cover" />
                  {selected && (
                    <div className="absolute top-1.5 right-1.5 rounded-full bg-primary text-primary-foreground p-1">
                      <CheckCircle size={14} weight="fill" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <Button onClick={handleSaveActive} disabled={!canSave} className="gap-2">
            {isSaving ? (
              <>
                <Spinner size={16} className="animate-spin" /> Saving…
              </>
            ) : (
              <>
                <CheckCircle size={16} /> Save as Active Identity
              </>
            )}
          </Button>
        </div>
      )}

      {savedMessage && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          {savedMessage}
        </div>
      )}
    </Card>
  );
}
