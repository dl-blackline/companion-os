import { motion } from 'framer-motion';
import { OFFERS, type OfferItem } from '@/lib/copy/offer-copy';

interface OfferCardProps {
  offer: OfferItem;
  index: number;
}

function OfferCard({ offer, index }: OfferCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: 'easeOut' }}
      className="relative rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm p-5 flex flex-col gap-3 hover:border-amber-400/30 hover:bg-white/5 transition-all duration-300"
    >
      {/* Badge */}
      {offer.badge && (
        <span className="absolute top-4 right-4 text-[10px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300">
          {offer.badge}
        </span>
      )}

      {/* Category indicator */}
      <span className="text-[10px] font-semibold tracking-widest uppercase text-neutral-500">
        {offer.category}
      </span>

      {/* Title */}
      <div>
        <h3 className="text-base font-semibold text-white leading-snug">{offer.title}</h3>
        <p className="text-xs text-amber-400/70 mt-0.5">{offer.subtitle}</p>
      </div>

      {/* Description */}
      <p className="text-xs text-neutral-400 leading-relaxed flex-1">{offer.description}</p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-white/6">
        <span className="text-lg font-semibold text-white">{offer.price}</span>
        <button
          className="px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 hover:border-amber-400/50 text-amber-300 text-xs font-semibold tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-black"
          aria-label={`${offer.ctaLabel} — ${offer.title}`}
        >
          {offer.ctaLabel}
        </button>
      </div>
    </motion.div>
  );
}

interface OfferGridProps {
  className?: string;
}

export function OfferGrid({ className = '' }: OfferGridProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      <div className="text-center space-y-2">
        <p className="text-xs font-semibold tracking-widest uppercase text-amber-400/70">
          Continue Your Journey
        </p>
        <h2 className="text-xl font-semibold text-white">
          Deepen Your Exploration
        </h2>
        <p className="text-sm text-neutral-400 max-w-sm mx-auto">
          Each offering below has been curated to support the energies revealed in your reading.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {OFFERS.map((offer, i) => (
          <OfferCard key={offer.id} offer={offer} index={i} />
        ))}
      </div>
    </div>
  );
}
