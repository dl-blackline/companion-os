import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, X } from '@phosphor-icons/react';
import { OFFERS, type OfferItem } from '@/lib/copy/offer-copy';
import { tarotTrack } from '@/lib/tarot/analytics';

interface OfferGridProps {
  sessionId?: string;
  className?: string;
}

// ─── Offer Detail View ────────────────────────────────────────────────────────

interface OfferDetailProps {
  offer: OfferItem;
  sessionId?: string;
  onBack: () => void;
}

function OfferDetail({ offer, sessionId, onBack }: OfferDetailProps) {
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePurchaseOrWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setIsSubmitting(true);
    setEmailError('');
    try {
      await fetch('/.netlify/functions/tarot-email-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          sessionId,
          source: `offer-${offer.id}`,
        }),
      });
      setEmailSubmitted(true);
      tarotTrack.offerClicked({ offerId: offer.id, sessionId, offerTitle: offer.title });
    } catch {
      setEmailError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      key="offer-detail"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition focus:outline-none focus:underline"
        aria-label="Back to offers"
      >
        <ArrowLeft size={14} />
        Back to offers
      </button>

      <div className="rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-400/5 to-transparent p-6 space-y-4">
        {offer.badge && (
          <span className="inline-block text-[10px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300">
            {offer.badge}
          </span>
        )}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-neutral-500 mb-1">
            {offer.category}
          </p>
          <h2 className="text-2xl font-bold text-white">{offer.title}</h2>
          <p className="text-amber-400/70 text-sm mt-1">{offer.subtitle}</p>
        </div>
        <p className="text-sm text-neutral-300 leading-relaxed">{offer.description}</p>
        <p className="text-2xl font-semibold text-white">{offer.price}</p>
      </div>

      {emailSubmitted ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-1">
          <p className="text-white font-medium">You're on the list ✦</p>
          <p className="text-sm text-neutral-400">
            We'll reach out to {email} with next steps shortly.
          </p>
        </div>
      ) : (
        <form onSubmit={handlePurchaseOrWaitlist} className="space-y-3">
          <p className="text-sm text-neutral-400">
            Enter your email and we'll send you everything you need to get started.
          </p>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/60 transition disabled:opacity-50"
                aria-label="Email address"
              />
              {emailError && (
                <p className="mt-1 text-xs text-red-400" role="alert">{emailError}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold transition disabled:opacity-50 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-black"
              aria-busy={isSubmitting}
            >
              {isSubmitting ? 'Sending…' : offer.ctaLabel}
            </button>
          </div>
        </form>
      )}

      <p className="text-xs text-neutral-600 text-center">
        For entertainment and personal reflection only. Not professional advice.
      </p>
    </motion.div>
  );
}

// ─── Offer Card ───────────────────────────────────────────────────────────────

interface OfferCardProps {
  offer: OfferItem;
  index: number;
  sessionId?: string;
  onSelect: (offer: OfferItem) => void;
}

function OfferCard({ offer, index, sessionId, onSelect }: OfferCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Track impression when card enters the viewport
  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          tarotTrack.offerViewed({ offerId: offer.id, sessionId });
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [offer.id, sessionId]);

  const handleClick = () => {
    onSelect(offer);
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: 'easeOut' }}
      className="relative rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm p-5 flex flex-col gap-3 hover:border-amber-400/30 hover:bg-white/5 transition-all duration-300"
    >
      {offer.badge && (
        <span className="absolute top-4 right-4 text-[10px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300">
          {offer.badge}
        </span>
      )}

      <span className="text-[10px] font-semibold tracking-widest uppercase text-neutral-500">
        {offer.category}
      </span>

      <div>
        <h3 className="text-base font-semibold text-white leading-snug">{offer.title}</h3>
        <p className="text-xs text-amber-400/70 mt-0.5">{offer.subtitle}</p>
      </div>

      <p className="text-xs text-neutral-400 leading-relaxed flex-1">{offer.description}</p>

      <div className="flex items-center justify-between pt-2 border-t border-white/6">
        <span className="text-lg font-semibold text-white">{offer.price}</span>
        <button
          onClick={handleClick}
          className="px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 hover:border-amber-400/50 text-amber-300 text-xs font-semibold tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-black"
          aria-label={`${offer.ctaLabel} — ${offer.title}`}
        >
          {offer.ctaLabel}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Offer Grid ───────────────────────────────────────────────────────────────

export function OfferGrid({ sessionId, className = '' }: OfferGridProps) {
  const [selectedOffer, setSelectedOffer] = useState<OfferItem | null>(null);

  const handleSelect = (offer: OfferItem) => {
    setSelectedOffer(offer);
    // Click intent is tracked in OfferDetail when the user submits their email
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <AnimatePresence mode="wait">
        {selectedOffer ? (
          <OfferDetail
            key="detail"
            offer={selectedOffer}
            sessionId={sessionId}
            onBack={() => setSelectedOffer(null)}
          />
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
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
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  index={i}
                  sessionId={sessionId}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
