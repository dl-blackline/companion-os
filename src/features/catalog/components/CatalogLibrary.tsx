/**
 * CatalogLibrary — Main library view showing a searchable, filterable grid
 * of CatalogItemCard components.
 */

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CatalogItemCard } from './CatalogItemCard';
import type { CatalogItem, CatalogItemStatus } from '@/types/catalog';

/* ── Props ───────────────────────────────────────────────────── */

export interface CatalogLibraryProps {
  items: CatalogItem[];
  loading: boolean;
  onItemClick: (id: string) => void;
  onCreateNew: () => void;
}

/* ── Status filter options ───────────────────────────────────── */

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'ready_to_price', label: 'Ready to Price' },
  { value: 'priced', label: 'Priced' },
  { value: 'published', label: 'Published' },
];

/* ── Component ───────────────────────────────────────────────── */

export function CatalogLibrary({ items, loading, onItemClick, onCreateNew }: CatalogLibraryProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = useMemo(() => {
    let result = items;

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((i) => i.status === (statusFilter as CatalogItemStatus));
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          (i.title ?? '').toLowerCase().includes(q) ||
          (i.brand ?? '').toLowerCase().includes(q) ||
          (i.category ?? '').toLowerCase().includes(q),
      );
    }

    return result;
  }, [items, search, statusFilter]);

  /* ── Loading skeleton ─────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  /* ── Empty state ──────────────────────────────────────────── */

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-10 py-12 space-y-4 max-w-sm">
          <p className="text-sm font-semibold text-foreground">No items yet</p>
          <p className="text-xs text-muted-foreground">
            Upload images to decode, or manually create your first catalog item.
          </p>
          <Button onClick={onCreateNew}>Create your first item</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="flex gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, brand, or category…"
          className="h-9 text-xs flex-1"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-9 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Grid ─────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          No items match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <CatalogItemCard
              key={item.id}
              item={item}
              onClick={() => onItemClick(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
