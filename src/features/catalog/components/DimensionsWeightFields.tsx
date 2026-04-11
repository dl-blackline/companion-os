/**
 * DimensionsWeightFields — Structured input fields for item dimensions and weight.
 *
 * Renders H / W / L / weight inputs with:
 *   - Unit selection (in/cm for dimensions, lb/oz/kg/g for weight)
 *   - Source badge (AI Detected, AI Estimated, Seller Entered, etc.)
 *   - Visual emphasis when values are missing and required
 *   - Confirmation toggle
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type {
  CatalogDimensions,
  CatalogWeight,
  DimensionUnit,
  MeasurementSource,
  WeightUnit,
} from '@/types/catalog';
import { getSourceLabel } from '@/services/catalog-service';

/* ── Props ───────────────────────────────────────────────────── */

export interface DimensionsWeightFieldsProps {
  dimensions: CatalogDimensions;
  weight: CatalogWeight;
  onDimensionsChange: (d: CatalogDimensions) => void;
  onWeightChange: (w: CatalogWeight) => void;
  required?: boolean;
  disabled?: boolean;
}

/* ── Source badge color ───────────────────────────────────────── */

function sourceBadgeVariant(source: MeasurementSource | null): 'default' | 'secondary' | 'outline' {
  if (!source) return 'outline';
  if (source === 'seller_confirmed' || source === 'seller_entered') return 'default';
  return 'secondary';
}

/* ── Unit selectors ──────────────────────────────────────────── */

const DIMENSION_UNITS: { value: DimensionUnit; label: string }[] = [
  { value: 'in', label: 'in' },
  { value: 'cm', label: 'cm' },
];

const WEIGHT_UNITS: { value: WeightUnit; label: string }[] = [
  { value: 'lb', label: 'lb' },
  { value: 'oz', label: 'oz' },
  { value: 'kg', label: 'kg' },
  { value: 'g', label: 'g' },
];

/* ── Component ───────────────────────────────────────────────── */

export function DimensionsWeightFields({
  dimensions,
  weight,
  onDimensionsChange,
  onWeightChange,
  required = false,
  disabled = false,
}: DimensionsWeightFieldsProps) {
  const [dimUnit, setDimUnit] = useState<DimensionUnit>(dimensions.dimension_unit);
  const [wUnit, setWUnit] = useState<WeightUnit>(weight.weight_unit);

  const missing = (val: number | null) => val == null || val === 0;
  const dimMissing =
    missing(dimensions.height_value) ||
    missing(dimensions.width_value) ||
    missing(dimensions.length_value);
  const wtMissing = missing(weight.weight_value);

  const updateDim = (patch: Partial<CatalogDimensions>) => {
    const updated: CatalogDimensions = { ...dimensions, ...patch };
    // When user edits a value, mark source as seller_entered if not already set
    if (
      patch.height_value !== undefined ||
      patch.width_value !== undefined ||
      patch.length_value !== undefined
    ) {
      if (!updated.dimensions_source || updated.dimensions_source === 'ai_estimated') {
        updated.dimensions_source = 'seller_entered';
      }
    }
    onDimensionsChange(updated);
  };

  const updateWeight = (patch: Partial<CatalogWeight>) => {
    const updated: CatalogWeight = { ...weight, ...patch };
    if (patch.weight_value !== undefined) {
      if (!updated.weight_source || updated.weight_source === 'ai_estimated') {
        updated.weight_source = 'seller_entered';
      }
    }
    onWeightChange(updated);
  };

  const handleDimUnitChange = (unit: DimensionUnit) => {
    setDimUnit(unit);
    updateDim({ dimension_unit: unit });
  };

  const handleWeightUnitChange = (unit: WeightUnit) => {
    setWUnit(unit);
    updateWeight({ weight_unit: unit });
  };

  return (
    <Card className="p-4 space-y-4">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Dimensions &amp; Weight</h3>
        {required && dimMissing && (
          <Badge variant="destructive" className="text-[10px]">
            Required for marketplace
          </Badge>
        )}
      </div>

      {/* ── Dimensions row ────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground w-20">Dimensions</span>
          <Badge variant={sourceBadgeVariant(dimensions.dimensions_source)} className="text-[10px]">
            {getSourceLabel(dimensions.dimensions_source)}
          </Badge>
          {dimensions.dimensions_confirmed && (
            <Badge variant="default" className="text-[10px]">Confirmed</Badge>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Height</label>
            <Input
              type="number"
              min={0}
              step={0.1}
              value={dimensions.height_value ?? ''}
              onChange={(e) =>
                updateDim({ height_value: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="H"
              disabled={disabled}
              className={`h-8 text-xs ${required && missing(dimensions.height_value) ? 'border-destructive' : ''}`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Width</label>
            <Input
              type="number"
              min={0}
              step={0.1}
              value={dimensions.width_value ?? ''}
              onChange={(e) =>
                updateDim({ width_value: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="W"
              disabled={disabled}
              className={`h-8 text-xs ${required && missing(dimensions.width_value) ? 'border-destructive' : ''}`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Length</label>
            <Input
              type="number"
              min={0}
              step={0.1}
              value={dimensions.length_value ?? ''}
              onChange={(e) =>
                updateDim({ length_value: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="L"
              disabled={disabled}
              className={`h-8 text-xs ${required && missing(dimensions.length_value) ? 'border-destructive' : ''}`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Unit</label>
            <div className="flex gap-1">
              {DIMENSION_UNITS.map((u) => (
                <Button
                  key={u.value}
                  size="sm"
                  variant={dimUnit === u.value ? 'default' : 'outline'}
                  className="h-8 px-2 text-xs flex-1"
                  onClick={() => handleDimUnitChange(u.value)}
                  disabled={disabled}
                >
                  {u.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {required && dimMissing && (
          <p className="text-[10px] text-destructive">
            Height, width, and length are required for marketplace listings. Please enter the missing values.
          </p>
        )}
      </div>

      {/* ── Weight row ────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground w-20">Weight</span>
          <Badge variant={sourceBadgeVariant(weight.weight_source)} className="text-[10px]">
            {getSourceLabel(weight.weight_source)}
          </Badge>
          {weight.weight_confirmed && (
            <Badge variant="default" className="text-[10px]">Confirmed</Badge>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="col-span-2 space-y-1">
            <label className="text-[10px] text-muted-foreground">Weight</label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={weight.weight_value ?? ''}
              onChange={(e) =>
                updateWeight({ weight_value: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="Weight"
              disabled={disabled}
              className={`h-8 text-xs ${required && wtMissing ? 'border-destructive' : ''}`}
            />
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-[10px] text-muted-foreground">Unit</label>
            <div className="flex gap-1">
              {WEIGHT_UNITS.map((u) => (
                <Button
                  key={u.value}
                  size="sm"
                  variant={wUnit === u.value ? 'default' : 'outline'}
                  className="h-8 px-2 text-xs flex-1"
                  onClick={() => handleWeightUnitChange(u.value)}
                  disabled={disabled}
                >
                  {u.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {required && wtMissing && (
          <p className="text-[10px] text-destructive">
            Weight is required for marketplace listings. Please enter the item weight.
          </p>
        )}
      </div>

      {/* ── Confirm toggle ────────────────────────────────────── */}
      {!disabled && (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant={dimensions.dimensions_confirmed ? 'default' : 'outline'}
            className="h-7 text-[10px]"
            onClick={() =>
              updateDim({
                dimensions_confirmed: !dimensions.dimensions_confirmed,
                dimensions_source: dimensions.dimensions_confirmed
                  ? dimensions.dimensions_source
                  : 'seller_confirmed',
              })
            }
          >
            {dimensions.dimensions_confirmed ? '✓ Dimensions Confirmed' : 'Confirm Dimensions'}
          </Button>
          <Button
            size="sm"
            variant={weight.weight_confirmed ? 'default' : 'outline'}
            className="h-7 text-[10px]"
            onClick={() =>
              updateWeight({
                weight_confirmed: !weight.weight_confirmed,
                weight_source: weight.weight_confirmed
                  ? weight.weight_source
                  : 'seller_confirmed',
              })
            }
          >
            {weight.weight_confirmed ? '✓ Weight Confirmed' : 'Confirm Weight'}
          </Button>
        </div>
      )}
    </Card>
  );
}
