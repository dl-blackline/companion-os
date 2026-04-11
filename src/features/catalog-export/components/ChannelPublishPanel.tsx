/**
 * ChannelPublishPanel — Multi-channel publication tracking and actions.
 *
 * Shows the current publication status per channel for a catalog item.
 * Allows initiating CSV export to a channel or tracking direct API
 * publication status for future connector integrations.
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type {
  CatalogChannelPublication,
  CatalogItem,
  MarketplaceChannel,
} from '@/types/catalog';
import { evaluateListingReadiness, getChannelRequirements } from '@/services/catalog-service';

/* ── Props ───────────────────────────────────────────────────── */

export interface ChannelPublishPanelProps {
  item: CatalogItem;
  imageCount?: number;
  publications: CatalogChannelPublication[];
  onExport: (channel: MarketplaceChannel) => void;
  channels?: MarketplaceChannel[];
}

/* ── Channel display config ──────────────────────────────────── */

const CHANNEL_INFO: Record<
  string,
  { label: string; exportType: string; available: boolean }
> = {
  storefront: { label: 'Storefront', exportType: 'Direct', available: true },
  whatnot: { label: 'Whatnot', exportType: 'CSV Export', available: true },
  ebay: { label: 'eBay', exportType: 'CSV Export', available: true },
  facebook_marketplace: {
    label: 'Facebook Marketplace',
    exportType: 'Future',
    available: false,
  },
  custom: { label: 'Custom', exportType: 'CSV Export', available: true },
};

const PUB_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  exported: 'secondary',
  published: 'default',
  failed: 'destructive',
  withdrawn: 'outline',
};

/* ── Component ───────────────────────────────────────────────── */

export function ChannelPublishPanel({
  item,
  imageCount = 0,
  publications,
  onExport,
  channels = ['storefront', 'whatnot', 'ebay', 'facebook_marketplace'],
}: ChannelPublishPanelProps) {
  const readiness = evaluateListingReadiness(item, imageCount, channels);

  return (
    <Card className="p-4 space-y-4">
      <h3 className="text-sm font-semibold">Channel Publication</h3>

      <div className="space-y-2">
        {channels.map((ch) => {
          const info = CHANNEL_INFO[ch] ?? {
            label: ch,
            exportType: 'Unknown',
            available: false,
          };
          const pub = publications.find((p) => p.channel === ch);
          const channelChecks = readiness.channelChecks[ch] ?? [];
          const isReady = !channelChecks.some((c) => c.gate === 'blocked');
          const reqs = getChannelRequirements(ch);
          const missingFields = channelChecks
            .filter((c) => c.gate === 'blocked')
            .map((c) => c.label);

          return (
            <div
              key={ch}
              className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
            >
              {/* Channel name */}
              <div className="w-40 shrink-0">
                <p className="text-xs font-medium">{info.label}</p>
                <p className="text-[10px] text-muted-foreground">
                  {info.exportType} · {reqs.fields.length} fields
                </p>
              </div>

              {/* Status */}
              <div className="flex-1">
                {pub ? (
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={PUB_STATUS_VARIANT[pub.publication_status] ?? 'outline'}
                      className="text-[10px]"
                    >
                      {pub.publication_status}
                    </Badge>
                    {pub.last_synced_at && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(pub.last_synced_at).toLocaleDateString()}
                      </span>
                    )}
                    {pub.last_error && (
                      <span className="text-[10px] text-destructive truncate max-w-40">
                        {pub.last_error}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Not published</span>
                )}
                {!isReady && missingFields.length > 0 && (
                  <p className="text-[10px] text-destructive mt-0.5">
                    Missing: {missingFields.join(', ')}
                  </p>
                )}
              </div>

              {/* Action */}
              <Button
                size="sm"
                variant={isReady ? 'default' : 'outline'}
                className="h-7 text-[10px]"
                disabled={!info.available || !isReady}
                onClick={() => onExport(ch)}
              >
                {!info.available ? 'Coming Soon' : isReady ? 'Export' : 'Not Ready'}
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
