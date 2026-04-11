/**
 * DecodedItemReviewForm — Seller review form after AI decode.
 *
 * Shows all decoded fields with confidence indicators and allows the seller
 * to review, edit, and confirm values. Prominently surfaces missing
 * dimensions and weight with required prompts when the item targets
 * marketplace channels that need shipping data.
 *
 * Key behaviors:
 *   - Fields prefilled from decoder output
 *   - Confidence badge per major field
 *   - AI follow-up questions surfaced in-line
 *   - DimensionsWeightFields embedded with required state
 *   - ListingReadinessCard shown at bottom
 *   - Blocks "Save as marketplace-ready" when required fields are missing
 */

import { useCallback, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DimensionsWeightFields } from './DimensionsWeightFields';
import { ListingReadinessCard } from './ListingReadinessCard';
import { evaluateListingReadiness } from '@/services/catalog-service';
import type {
  CatalogDimensions,
  CatalogItem,
  CatalogItemCondition,
  CatalogWeight,
  DecoderOutput,
  MarketplaceChannel,
} from '@/types/catalog';

/* ── Props ───────────────────────────────────────────────────── */

export interface DecodedItemReviewFormProps {
  decoderOutput: DecoderOutput;
  existingItem?: Partial<CatalogItem>;
  imageCount?: number;
  targetChannels?: MarketplaceChannel[];
  onSave: (item: Partial<CatalogItem>, questions: { question: string; answer: string }[]) => void;
  onCancel?: () => void;
  saving?: boolean;
}

/* ── Confidence color helper ─────────────────────────────────── */

function confidenceBadge(score: number): { label: string; variant: 'default' | 'secondary' | 'destructive' } {
  if (score >= 0.8) return { label: 'High', variant: 'default' };
  if (score >= 0.5) return { label: 'Medium', variant: 'secondary' };
  return { label: 'Low', variant: 'destructive' };
}

/* ── Condition options ───────────────────────────────────────── */

const CONDITIONS: { value: CatalogItemCondition; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'for_parts', label: 'For Parts' },
];

/* ── Component ───────────────────────────────────────────────── */

export function DecodedItemReviewForm({
  decoderOutput,
  existingItem,
  imageCount = 0,
  targetChannels = ['storefront', 'whatnot', 'ebay'],
  onSave,
  onCancel,
  saving = false,
}: DecodedItemReviewFormProps) {
  // Merge decoder output with any existing item data
  const [title, setTitle] = useState(existingItem?.title ?? decoderOutput.title ?? '');
  const [category, setCategory] = useState(existingItem?.category ?? decoderOutput.category ?? '');
  const [brand, setBrand] = useState(existingItem?.brand ?? decoderOutput.brand ?? '');
  const [model, setModel] = useState(existingItem?.model ?? decoderOutput.model ?? '');
  const [condition, setCondition] = useState<CatalogItemCondition | null>(
    existingItem?.condition ?? decoderOutput.condition ?? null,
  );
  const [description, setDescription] = useState(
    existingItem?.description ?? decoderOutput.description ?? '',
  );
  const [askingPrice, setAskingPrice] = useState<number | null>(
    existingItem?.asking_price ?? null,
  );
  const [quantity, setQuantity] = useState(existingItem?.quantity ?? 1);

  const [dimensions, setDimensions] = useState<CatalogDimensions>({
    height_value: existingItem?.height_value ?? decoderOutput.height_value,
    width_value: existingItem?.width_value ?? decoderOutput.width_value,
    length_value: existingItem?.length_value ?? decoderOutput.length_value,
    dimension_unit: existingItem?.dimension_unit ?? decoderOutput.dimension_unit ?? 'in',
    dimensions_source: existingItem?.dimensions_source ?? decoderOutput.dimensions_source,
    dimensions_confirmed: existingItem?.dimensions_confirmed ?? false,
  });

  const [weight, setWeight] = useState<CatalogWeight>({
    weight_value: existingItem?.weight_value ?? decoderOutput.weight_value,
    weight_unit: existingItem?.weight_unit ?? decoderOutput.weight_unit ?? 'lb',
    weight_source: existingItem?.weight_source ?? decoderOutput.weight_source,
    weight_confirmed: existingItem?.weight_confirmed ?? false,
  });

  // Question answers state
  const [answers, setAnswers] = useState<Record<number, string>>({});

  // Build a mock CatalogItem for readiness evaluation
  const buildItem = useCallback((): CatalogItem => {
    return {
      id: existingItem?.id ?? '',
      user_id: existingItem?.user_id ?? '',
      slug: null,
      title: title || null,
      category: category || null,
      subcategory: null,
      brand: brand || null,
      model: model || null,
      variant: null,
      condition,
      description: description || null,
      internal_notes: null,
      quantity,
      sku: null,
      asking_price: askingPrice,
      currency: 'USD',
      estimated_low_value: decoderOutput.estimated_low_value,
      estimated_high_value: decoderOutput.estimated_high_value,
      estimated_likely_value: decoderOutput.estimated_likely_value,
      ai_confidence_score: decoderOutput.ai_confidence_score,
      ai_summary: decoderOutput.ai_summary,
      ...dimensions,
      ...weight,
      status: 'needs_review',
      publish_status: 'hidden',
      listing_readiness_status: 'incomplete',
      created_at: existingItem?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }, [
    title, category, brand, model, condition, description,
    askingPrice, quantity, dimensions, weight, decoderOutput, existingItem,
  ]);

  const currentItem = buildItem();
  const readiness = evaluateListingReadiness(currentItem, imageCount, targetChannels);
  const canSaveAsReady = readiness.overallStatus !== 'incomplete';

  const handleSave = () => {
    const questionAnswers = decoderOutput.questions
      .map((q, i) => ({ question: q, answer: answers[i] ?? '' }))
      .filter((qa) => qa.answer.trim() !== '');

    onSave(
      {
        ...currentItem,
        status: canSaveAsReady ? 'ready_to_price' : 'needs_review',
        listing_readiness_status: readiness.overallStatus,
      },
      questionAnswers,
    );
  };

  const fieldConf = (field: string) => {
    const fc = decoderOutput.field_confidence.find((f) => f.field === field);
    return fc ? confidenceBadge(fc.confidence) : null;
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* ── AI Summary ──────────────────────────────────────────── */}
      {decoderOutput.ai_summary && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">AI Decode Summary</h3>
            {(() => {
              const b = confidenceBadge(decoderOutput.ai_confidence_score);
              return (
                <Badge variant={b.variant} className="text-[10px]">
                  {b.label} confidence
                </Badge>
              );
            })()}
          </div>
          <p className="text-xs text-muted-foreground">{decoderOutput.ai_summary}</p>
        </Card>
      )}

      {/* ── Core fields ─────────────────────────────────────────── */}
      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold">Item Details</h3>

        <FieldRow label="Title" confidence={fieldConf('title')}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Item title"
            className="h-8 text-xs"
          />
        </FieldRow>

        <FieldRow label="Category" confidence={fieldConf('category')}>
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category"
            className="h-8 text-xs"
          />
        </FieldRow>

        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Brand" confidence={fieldConf('brand')}>
            <Input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Brand"
              className="h-8 text-xs"
            />
          </FieldRow>

          <FieldRow label="Model" confidence={fieldConf('model')}>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Model"
              className="h-8 text-xs"
            />
          </FieldRow>
        </div>

        <FieldRow label="Condition" confidence={fieldConf('condition')}>
          <div className="flex flex-wrap gap-1">
            {CONDITIONS.map((c) => (
              <Button
                key={c.value}
                size="sm"
                variant={condition === c.value ? 'default' : 'outline'}
                className="h-7 text-[10px]"
                onClick={() => setCondition(c.value)}
              >
                {c.label}
              </Button>
            ))}
          </div>
        </FieldRow>

        <FieldRow label="Description" confidence={fieldConf('description')}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Item description"
            rows={3}
            className="w-full text-xs rounded-md border bg-background px-3 py-2 resize-none"
          />
        </FieldRow>

        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Price">
            <Input
              type="number"
              min={0}
              step={0.01}
              value={askingPrice ?? ''}
              onChange={(e) =>
                setAskingPrice(e.target.value ? Number(e.target.value) : null)
              }
              placeholder="Asking price"
              className="h-8 text-xs"
            />
          </FieldRow>
          <FieldRow label="Quantity">
            <Input
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              className="h-8 text-xs"
            />
          </FieldRow>
        </div>

        {/* Value estimate */}
        {decoderOutput.estimated_likely_value != null && (
          <div className="bg-muted/50 rounded-md p-3 space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              AI Value Estimate
            </p>
            <div className="flex items-baseline gap-3 text-xs">
              <span>Low: ${decoderOutput.estimated_low_value ?? '—'}</span>
              <span className="font-semibold">
                Likely: ${decoderOutput.estimated_likely_value}
              </span>
              <span>High: ${decoderOutput.estimated_high_value ?? '—'}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              This is an estimate. Set your own asking price above.
            </p>
          </div>
        )}
      </Card>

      {/* ── Dimensions & Weight ─────────────────────────────────── */}
      <DimensionsWeightFields
        dimensions={dimensions}
        weight={weight}
        onDimensionsChange={setDimensions}
        onWeightChange={setWeight}
        required={true}
      />

      {/* ── AI Follow-up Questions ──────────────────────────────── */}
      {decoderOutput.questions.length > 0 && (
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold">AI Follow-up Questions</h3>
          <p className="text-[10px] text-muted-foreground">
            The AI needs more information to complete the decode. Please answer what you can.
          </p>
          {decoderOutput.questions.map((q, i) => (
            <div key={i} className="space-y-1">
              <p className="text-xs font-medium">{q}</p>
              <Input
                value={answers[i] ?? ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
                placeholder="Your answer"
                className="h-8 text-xs"
              />
            </div>
          ))}
        </Card>
      )}

      {/* ── Listing Readiness ───────────────────────────────────── */}
      <ListingReadinessCard
        item={currentItem}
        imageCount={imageCount}
        channels={targetChannels}
      />

      {/* ── Actions ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving
            ? 'Saving…'
            : canSaveAsReady
              ? 'Save — Ready to Price'
              : 'Save as Draft (Incomplete)'}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

/* ── Helper sub-component ────────────────────────────────────── */

function FieldRow({
  label,
  confidence,
  children,
}: {
  label: string;
  confidence?: { label: string; variant: 'default' | 'secondary' | 'destructive' } | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label className="text-[10px] font-medium text-muted-foreground">{label}</label>
        {confidence && (
          <Badge variant={confidence.variant} className="text-[10px]">
            {confidence.label}
          </Badge>
        )}
      </div>
      {children}
    </div>
  );
}
