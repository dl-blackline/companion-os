/**
 * ListingReadinessCard — Shows per-channel listing readiness status.
 *
 * Evaluates a catalog item against channel requirements and displays:
 *   - Overall readiness status badge
 *   - Per-channel readiness with blocked/warning/ready per field
 *   - Actionable guidance for missing fields (especially dimensions/weight)
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CatalogItem, MarketplaceChannel } from '@/types/catalog';
import { evaluateListingReadiness } from '@/services/catalog-service';
import type { ReadinessGate } from '@/services/catalog-service';

/* ── Props ───────────────────────────────────────────────────── */

export interface ListingReadinessCardProps {
  item: CatalogItem;
  imageCount?: number;
  channels?: MarketplaceChannel[];
}

/* ── Gate styling ────────────────────────────────────────────── */

const GATE_VARIANT: Record<ReadinessGate, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ready: 'default',
  warning: 'secondary',
  blocked: 'destructive',
};

const GATE_ICON: Record<ReadinessGate, string> = {
  ready: '✓',
  warning: '⚠',
  blocked: '✕',
};

const STATUS_LABEL: Record<string, string> = {
  incomplete: 'Incomplete',
  catalog_ready: 'Catalog Ready',
  marketplace_ready: 'Marketplace Ready',
  channel_ready: 'All Channels Ready',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  incomplete: 'destructive',
  catalog_ready: 'secondary',
  marketplace_ready: 'default',
  channel_ready: 'default',
};

const CHANNEL_LABEL: Record<string, string> = {
  storefront: 'Storefront',
  whatnot: 'Whatnot',
  ebay: 'eBay',
  facebook_marketplace: 'Facebook Marketplace',
  custom: 'Custom',
};

/* ── Component ───────────────────────────────────────────────── */

export function ListingReadinessCard({
  item,
  imageCount = 0,
  channels = ['storefront', 'whatnot', 'ebay'],
}: ListingReadinessCardProps) {
  const report = evaluateListingReadiness(item, imageCount, channels);

  return (
    <Card className="p-4 space-y-4">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Listing Readiness</h3>
        <Badge
          variant={STATUS_VARIANT[report.overallStatus] ?? 'outline'}
          className="text-[10px]"
        >
          {STATUS_LABEL[report.overallStatus] ?? report.overallStatus}
        </Badge>
      </div>

      {/* ── Catalog checks ────────────────────────────────────── */}
      <div className="space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Catalog Basics
        </p>
        <div className="grid gap-1">
          {report.catalogChecks.map((c) => (
            <div key={c.field} className="flex items-center gap-2 text-xs">
              <span className="w-4 text-center">{GATE_ICON[c.gate]}</span>
              <span className="flex-1">{c.label}</span>
              <Badge variant={GATE_VARIANT[c.gate]} className="text-[10px]">
                {c.gate}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* ── Channel checks ────────────────────────────────────── */}
      {channels.map((ch) => {
        const checks = report.channelChecks[ch];
        if (!checks) return null;
        const channelBlocked = checks.some((c) => c.gate === 'blocked');

        return (
          <div key={ch} className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                {CHANNEL_LABEL[ch] ?? ch}
              </p>
              <Badge
                variant={channelBlocked ? 'destructive' : 'default'}
                className="text-[10px]"
              >
                {channelBlocked ? 'Not Ready' : 'Ready'}
              </Badge>
            </div>
            <div className="grid gap-1">
              {checks
                .filter((c) => c.gate !== 'ready')
                .map((c) => (
                  <div key={c.field} className="flex items-center gap-2 text-xs">
                    <span className="w-4 text-center">{GATE_ICON[c.gate]}</span>
                    <span className="flex-1">{c.label}</span>
                    <span className="text-muted-foreground text-[10px]">{c.message}</span>
                  </div>
                ))}
              {checks.every((c) => c.gate === 'ready') && (
                <p className="text-[10px] text-muted-foreground">All fields present</p>
              )}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
