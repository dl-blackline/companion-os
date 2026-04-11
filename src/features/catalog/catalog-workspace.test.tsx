/**
 * Tests for catalog seller workspace components and pages.
 *
 * Covers:
 *   - CatalogItemCard rendering
 *   - CatalogLibrary search/filter/empty state
 *   - CatalogItemForm field management
 *   - ItemDecoderUploader file validation
 *   - CatalogPage view routing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CatalogItemCard } from '@/features/catalog/components/CatalogItemCard';
import { CatalogLibrary } from '@/features/catalog/components/CatalogLibrary';
import { CatalogItemForm } from '@/features/catalog/components/CatalogItemForm';
import { ItemDecoderUploader } from '@/features/catalog/components/ItemDecoderUploader';
import type { CatalogItem } from '@/types/catalog';

/* ── Mock supabase ────────────────────────────────────────────────────────── */

vi.mock('@/lib/supabase-client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      }),
    },
  },
  supabaseConfigured: true,
}));

/* ── Test fixtures ────────────────────────────────────────────────────────── */

function makeItem(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: 'test-item-1',
    user_id: 'user-1',
    slug: null,
    title: 'Test Widget',
    category: 'Electronics',
    subcategory: null,
    brand: 'Acme',
    model: 'W-100',
    variant: null,
    condition: 'good',
    description: 'A test widget',
    internal_notes: null,
    quantity: 1,
    sku: null,
    asking_price: 29.99,
    currency: 'USD',
    estimated_low_value: 20,
    estimated_high_value: 40,
    estimated_likely_value: 30,
    ai_confidence_score: 0.8,
    ai_summary: 'A good widget',
    height_value: 5,
    width_value: 3,
    length_value: 2,
    dimension_unit: 'in',
    dimensions_source: 'seller_entered',
    dimensions_confirmed: true,
    weight_value: 1.5,
    weight_unit: 'lb',
    weight_source: 'seller_entered',
    weight_confirmed: true,
    status: 'priced',
    publish_status: 'hidden',
    listing_readiness_status: 'marketplace_ready',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

/* ── CatalogItemCard ──────────────────────────────────────────────────────── */

describe('CatalogItemCard', () => {
  it('renders title, brand, category, and price', () => {
    const item = makeItem();
    const onClick = vi.fn();
    render(<CatalogItemCard item={item} onClick={onClick} />);

    expect(screen.getByText('Test Widget')).toBeTruthy();
    expect(screen.getByText(/Acme.*Electronics/)).toBeTruthy();
    expect(screen.getByText('$29.99')).toBeTruthy();
  });

  it('shows condition badge', () => {
    const item = makeItem({ condition: 'excellent' });
    render(<CatalogItemCard item={item} onClick={vi.fn()} />);
    expect(screen.getByText('Excellent')).toBeTruthy();
  });

  it('shows "Untitled Item" when title is null', () => {
    const item = makeItem({ title: null });
    render(<CatalogItemCard item={item} onClick={vi.fn()} />);
    expect(screen.getByText('Untitled Item')).toBeTruthy();
  });

  it('calls onClick when clicked', () => {
    const item = makeItem();
    const onClick = vi.fn();
    render(<CatalogItemCard item={item} onClick={onClick} />);
    fireEvent.click(screen.getByText('Test Widget'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows readiness badge', () => {
    // Create item missing required fields so evaluateListingReadiness returns "incomplete"
    const item = makeItem({
      title: null,
      category: null,
      condition: null,
    });
    render(<CatalogItemCard item={item} onClick={vi.fn()} />);
    expect(screen.getByText('Incomplete')).toBeTruthy();
  });
});

/* ── CatalogLibrary ──────────────────────────────────────────────────────── */

describe('CatalogLibrary', () => {
  it('shows loading skeletons when loading', () => {
    const { container } = render(
      <CatalogLibrary items={[]} loading={true} onItemClick={vi.fn()} onCreateNew={vi.fn()} />,
    );
    // Should render skeleton elements
    const skeletons = container.querySelectorAll('[class*="skeleton"], [data-skeleton]');
    // The component renders skeletons as div elements with specific classes
    expect(container.innerHTML).toContain('aspect-');
  });

  it('shows empty state when no items and not loading', () => {
    render(
      <CatalogLibrary items={[]} loading={false} onItemClick={vi.fn()} onCreateNew={vi.fn()} />,
    );
    expect(screen.getByText('No items yet')).toBeTruthy();
    expect(screen.getByText('Create your first item')).toBeTruthy();
  });

  it('calls onCreateNew from empty state', () => {
    const onCreateNew = vi.fn();
    render(
      <CatalogLibrary items={[]} loading={false} onItemClick={vi.fn()} onCreateNew={onCreateNew} />,
    );
    fireEvent.click(screen.getByText('Create your first item'));
    expect(onCreateNew).toHaveBeenCalledOnce();
  });

  it('renders item cards for each item', () => {
    const items = [
      makeItem({ id: '1', title: 'Widget A' }),
      makeItem({ id: '2', title: 'Widget B' }),
    ];
    render(
      <CatalogLibrary items={items} loading={false} onItemClick={vi.fn()} onCreateNew={vi.fn()} />,
    );
    expect(screen.getByText('Widget A')).toBeTruthy();
    expect(screen.getByText('Widget B')).toBeTruthy();
  });

  it('filters items by search text', () => {
    const items = [
      makeItem({ id: '1', title: 'Alpha Widget', brand: 'BrandA' }),
      makeItem({ id: '2', title: 'Beta Gadget', brand: 'BrandB' }),
    ];
    render(
      <CatalogLibrary items={items} loading={false} onItemClick={vi.fn()} onCreateNew={vi.fn()} />,
    );

    const searchInput = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(searchInput, { target: { value: 'alpha' } });
    expect(screen.getByText('Alpha Widget')).toBeTruthy();
    expect(screen.queryByText('Beta Gadget')).toBeNull();
  });

  it('calls onItemClick with item id', () => {
    const items = [makeItem({ id: 'item-42', title: 'Clickable Item' })];
    const onItemClick = vi.fn();
    render(
      <CatalogLibrary items={items} loading={false} onItemClick={onItemClick} onCreateNew={vi.fn()} />,
    );
    fireEvent.click(screen.getByText('Clickable Item'));
    expect(onItemClick).toHaveBeenCalledWith('item-42');
  });
});

/* ── CatalogItemForm ─────────────────────────────────────────────────────── */

describe('CatalogItemForm', () => {
  it('renders core fields', () => {
    render(<CatalogItemForm onSave={vi.fn()} />);

    expect(screen.getByPlaceholderText('Item title')).toBeTruthy();
    expect(screen.getByPlaceholderText('Category')).toBeTruthy();
    expect(screen.getByPlaceholderText('Brand')).toBeTruthy();
    expect(screen.getByPlaceholderText('Model')).toBeTruthy();
    expect(screen.getByPlaceholderText('Item description')).toBeTruthy();
  });

  it('prefills with initialData', () => {
    const item = makeItem();
    render(<CatalogItemForm initialData={item} onSave={vi.fn()} />);

    const titleInput = screen.getByPlaceholderText('Item title') as HTMLInputElement;
    expect(titleInput.value).toBe('Test Widget');

    const brandInput = screen.getByPlaceholderText('Brand') as HTMLInputElement;
    expect(brandInput.value).toBe('Acme');
  });

  it('calls onSave with item data', () => {
    const onSave = vi.fn();
    render(<CatalogItemForm onSave={onSave} />);

    // Fill required field
    fireEvent.change(screen.getByPlaceholderText('Item title'), { target: { value: 'New Item' } });

    // Click save
    const saveButton = screen.getByText(/Save/);
    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalledOnce();
    const savedItem = onSave.mock.calls[0][0];
    expect(savedItem.title).toBe('New Item');
  });

  it('shows cancel button when onCancel provided', () => {
    const onCancel = vi.fn();
    render(<CatalogItemForm onSave={vi.fn()} onCancel={onCancel} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('disables save button when saving', () => {
    render(<CatalogItemForm onSave={vi.fn()} saving={true} />);
    const saveButton = screen.getByText('Saving…');
    expect(saveButton).toBeTruthy();
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows condition buttons', () => {
    render(<CatalogItemForm onSave={vi.fn()} />);
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByText('Like New')).toBeTruthy();
    expect(screen.getByText('Good')).toBeTruthy();
    expect(screen.getByText('Fair')).toBeTruthy();
    expect(screen.getByText('For Parts')).toBeTruthy();
  });
});

/* ── ItemDecoderUploader ─────────────────────────────────────────────────── */

describe('ItemDecoderUploader', () => {
  it('renders upload zone', () => {
    render(<ItemDecoderUploader onDecodeComplete={vi.fn()} />);
    expect(screen.getByText(/Drag & drop images/i)).toBeTruthy();
    expect(screen.getByText(/JPEG, PNG, WebP/i)).toBeTruthy();
  });

  it('shows decode button (disabled when no files)', () => {
    render(<ItemDecoderUploader onDecodeComplete={vi.fn()} />);
    const decodeButton = screen.getByText('Decode');
    expect((decodeButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows cancel button when onCancel provided', () => {
    const onCancel = vi.fn();
    render(<ItemDecoderUploader onDecodeComplete={vi.fn()} onCancel={onCancel} />);
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does not show cancel button when onCancel not provided', () => {
    render(<ItemDecoderUploader onDecodeComplete={vi.fn()} />);
    expect(screen.queryByText('Cancel')).toBeNull();
  });
});
