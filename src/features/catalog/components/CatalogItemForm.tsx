/**
 * CatalogItemForm — Comprehensive form for creating/editing catalog items manually.
 *
 * Not for decoded items (use DecodedItemReviewForm for that). Includes all core
 * fields plus embedded DimensionsWeightFields and ListingReadinessCard.
 */

import { useCallback, useState } from 'react';
import { Card } from '@/components/ui/card';
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
} from '@/types/catalog';

/* ── Props ───────────────────────────────────────────────────── */

export interface CatalogItemFormProps {
  initialData?: Partial<CatalogItem>;
  imageCount?: number;
  onSave: (item: Partial<CatalogItem>) => void;
  onCancel?: () => void;
  saving?: boolean;
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

export function CatalogItemForm({
  initialData,
  imageCount = 0,
  onSave,
  onCancel,
  saving = false,
}: CatalogItemFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [category, setCategory] = useState(initialData?.category ?? '');
  const [brand, setBrand] = useState(initialData?.brand ?? '');
  const [model, setModel] = useState(initialData?.model ?? '');
  const [condition, setCondition] = useState<CatalogItemCondition | null>(
    initialData?.condition ?? null,
  );
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [quantity, setQuantity] = useState(initialData?.quantity ?? 1);
  const [askingPrice, setAskingPrice] = useState<number | null>(
    initialData?.asking_price ?? null,
  );
  const [internalNotes, setInternalNotes] = useState(initialData?.internal_notes ?? '');

  const [dimensions, setDimensions] = useState<CatalogDimensions>({
    height_value: initialData?.height_value ?? null,
    width_value: initialData?.width_value ?? null,
    length_value: initialData?.length_value ?? null,
    dimension_unit: initialData?.dimension_unit ?? 'in',
    dimensions_source: initialData?.dimensions_source ?? null,
    dimensions_confirmed: initialData?.dimensions_confirmed ?? false,
  });

  const [weight, setWeight] = useState<CatalogWeight>({
    weight_value: initialData?.weight_value ?? null,
    weight_unit: initialData?.weight_unit ?? 'lb',
    weight_source: initialData?.weight_source ?? null,
    weight_confirmed: initialData?.weight_confirmed ?? false,
  });

  const buildItem = useCallback((): CatalogItem => {
    return {
      id: initialData?.id ?? '',
      user_id: initialData?.user_id ?? '',
      slug: initialData?.slug ?? null,
      title: title || null,
      category: category || null,
      subcategory: initialData?.subcategory ?? null,
      brand: brand || null,
      model: model || null,
      variant: initialData?.variant ?? null,
      condition,
      description: description || null,
      internal_notes: internalNotes || null,
      quantity,
      sku: initialData?.sku ?? null,
      asking_price: askingPrice,
      currency: initialData?.currency ?? 'USD',
      estimated_low_value: initialData?.estimated_low_value ?? null,
      estimated_high_value: initialData?.estimated_high_value ?? null,
      estimated_likely_value: initialData?.estimated_likely_value ?? null,
      ai_confidence_score: initialData?.ai_confidence_score ?? null,
      ai_summary: initialData?.ai_summary ?? null,
      ...dimensions,
      ...weight,
      status: initialData?.status ?? 'draft',
      publish_status: initialData?.publish_status ?? 'hidden',
      listing_readiness_status: initialData?.listing_readiness_status ?? 'incomplete',
      created_at: initialData?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }, [
    title, category, brand, model, condition, description,
    internalNotes, askingPrice, quantity, dimensions, weight, initialData,
  ]);

  const currentItem = buildItem();
  const readiness = evaluateListingReadiness(currentItem, imageCount);
  const canSaveAsReady = readiness.overallStatus !== 'incomplete';

  const handleSave = () => {
    onSave({
      ...currentItem,
      status: canSaveAsReady ? 'ready_to_price' : 'draft',
      listing_readiness_status: readiness.overallStatus,
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* ── Core fields ─────────────────────────────────────────── */}
      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold">Item Details</h3>

        <FieldRow label="Title">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Item title"
            className="h-8 text-xs"
          />
        </FieldRow>

        <FieldRow label="Category">
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category"
            className="h-8 text-xs"
          />
        </FieldRow>

        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Brand">
            <Input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Brand"
              className="h-8 text-xs"
            />
          </FieldRow>
          <FieldRow label="Model">
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Model"
              className="h-8 text-xs"
            />
          </FieldRow>
        </div>

        <FieldRow label="Condition">
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

        <FieldRow label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Item description"
            rows={3}
            className="w-full text-xs rounded-md border bg-background px-3 py-2 resize-none"
          />
        </FieldRow>

        <div className="grid grid-cols-2 gap-3">
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
          <FieldRow label="Asking Price">
            <Input
              type="number"
              min={0}
              step={0.01}
              value={askingPrice ?? ''}
              onChange={(e) =>
                setAskingPrice(e.target.value ? Number(e.target.value) : null)
              }
              placeholder="$0.00"
              className="h-8 text-xs"
            />
          </FieldRow>
        </div>

        <FieldRow label="Internal Notes">
          <textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            placeholder="Private notes (not shown on listings)"
            rows={2}
            className="w-full text-xs rounded-md border bg-background px-3 py-2 resize-none"
          />
        </FieldRow>
      </Card>

      {/* ── Dimensions & Weight ─────────────────────────────────── */}
      <DimensionsWeightFields
        dimensions={dimensions}
        weight={weight}
        onDimensionsChange={setDimensions}
        onWeightChange={setWeight}
      />

      {/* ── Listing Readiness ───────────────────────────────────── */}
      <ListingReadinessCard item={currentItem} imageCount={imageCount} />

      {/* ── Actions ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving
            ? 'Saving…'
            : canSaveAsReady
              ? 'Save — Ready to Price'
              : 'Save as Draft'}
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

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
