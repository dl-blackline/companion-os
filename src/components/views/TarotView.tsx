import { motion, AnimatePresence } from 'framer-motion';
import { useReadingStore } from '@/store/reading-store';
import { ReadingIntakeForm } from '@/components/tarot/reading-intake-form';
import { ZodiacBadge } from '@/components/tarot/zodiac-badge';
import { ShuffleAnimation } from '@/components/tarot/shuffle-animation';
import { SpreadLayout } from '@/components/tarot/spread-layout';
import { TarotCardDisplay } from '@/components/tarot/tarot-card-display';
import { InterpretationPanel } from '@/components/tarot/interpretation-panel';
import { ReadingSummary } from '@/components/tarot/reading-summary';
import { OfferGrid } from '@/components/tarot/offer-grid';
import { EmailCapture } from '@/components/tarot/email-capture';
import { FooterDisclaimer } from '@/components/tarot/footer-disclaimer';
import { READING_PREAMBLE } from '@/lib/copy/disclaimers';
import { ArrowLeft } from '@phosphor-icons/react';

export function TarotView() {
  const store = useReadingStore();

  return (
    <div className="flex flex-col min-h-full bg-neutral-950">
      {/* Hero / Landing */}
      <AnimatePresence mode="wait">
        {store.phase === 'idle' && (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center flex-1 px-4 py-16 text-center space-y-10"
          >
            {/* Ambient glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              aria-hidden="true"
              style={{
                background:
                  'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(212,175,55,0.08) 0%, transparent 70%)',
              }}
            />

            {/* Symbol */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="relative"
            >
              <div className="text-6xl select-none" aria-hidden="true">✦</div>
              <div
                className="absolute inset-0 blur-2xl opacity-30"
                style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.6) 0%, transparent 70%)' }}
              />
            </motion.div>

            {/* Heading */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="space-y-4 max-w-md"
            >
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
                Tarot AI
              </h1>
              <p className="text-lg text-neutral-400 leading-relaxed">
                A premium tarot reading experience — immersive, cinematic, and attuned to your
                spirit.
              </p>
            </motion.div>

            {/* How it works */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="grid grid-cols-3 gap-4 max-w-sm text-center"
              aria-label="How it works"
            >
              {[
                { step: '1', label: 'Enter your name & birth date' },
                { step: '2', label: 'The deck shuffles and draws your spread' },
                { step: '3', label: 'Receive your personalized reading' },
              ].map(({ step, label }) => (
                <div key={step} className="space-y-2">
                  <div className="w-8 h-8 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-400 text-sm font-semibold flex items-center justify-center mx-auto">
                    {step}
                  </div>
                  <p className="text-xs text-neutral-500 leading-snug">{label}</p>
                </div>
              ))}
            </motion.div>

            {/* Preamble */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="text-xs text-neutral-600 max-w-xs text-center leading-relaxed"
            >
              {READING_PREAMBLE}
            </motion.p>

            {/* CTA */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.6 }}
              onClick={store.startIntake}
              className="px-10 py-4 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold tracking-wide text-base transition-all duration-200 shadow-xl shadow-amber-500/25 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-neutral-950"
              aria-label="Begin your tarot reading"
            >
              Begin Your Reading
            </motion.button>

            <FooterDisclaimer />
          </motion.div>
        )}

        {/* Intake form */}
        {store.phase === 'intake' && (
          <motion.div
            key="intake"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center flex-1 px-4 py-12"
          >
            <div className="w-full max-w-sm space-y-8">
              <button
                onClick={store.reset}
                className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition focus:outline-none focus:underline"
                aria-label="Go back to landing"
              >
                <ArrowLeft size={14} />
                Back
              </button>

              <div className="text-center space-y-2">
                <div className="text-3xl mb-3 select-none" aria-hidden="true">✦</div>
                <h2 className="text-2xl font-bold text-white">Your Reading Awaits</h2>
                <p className="text-sm text-neutral-400">
                  Enter your details to begin the reading chamber.
                </p>
              </div>

              <ReadingIntakeForm
                onSubmit={store.submitIntake}
                isLoading={store.phase === 'shuffling'}
                error={store.error}
              />

              <FooterDisclaimer />
            </div>
          </motion.div>
        )}

        {/* Shuffle animation */}
        {store.phase === 'shuffling' && (
          <motion.div
            key="shuffling"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center flex-1 px-4 py-16 space-y-10"
          >
            <ShuffleAnimation isShuffling />

            <div className="text-center space-y-2">
              <p className="text-lg font-semibold text-white animate-pulse">
                The deck is being shuffled for you…
              </p>
              <p className="text-sm text-neutral-500">
                Breathe. The cards are finding their way to you.
              </p>
            </div>
          </motion.div>
        )}

        {/* Reading — reveal phase */}
        {(store.phase === 'revealing' || store.phase === 'complete') && store.session && (
          <motion.div
            key="reading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col flex-1 px-4 py-8 max-w-2xl mx-auto w-full space-y-10"
          >
            {/* User & zodiac header */}
            <div className="flex flex-col items-center text-center space-y-3">
              <p className="text-sm text-neutral-400">
                A reading for{' '}
                <span className="text-white font-semibold">{store.session.firstName}</span>
              </p>
              <ZodiacBadge
                zodiac={{
                  sign: store.session.zodiacSign,
                  symbol: store.session.zodiacSymbol,
                  element: store.session.zodiacElement as 'Fire' | 'Earth' | 'Air' | 'Water',
                }}
              />
            </div>

            {/* Spread */}
            <div className="space-y-4">
              <p className="text-xs font-semibold tracking-widest uppercase text-center text-neutral-500">
                Past · Present · Future
              </p>
              <div className="flex flex-col sm:flex-row items-start justify-center gap-6">
                {store.session.cards.map((drawnCard, index) => (
                  <TarotCardDisplay
                    key={drawnCard.card.id}
                    drawnCard={drawnCard}
                    isRevealed={index < store.revealedCardCount}
                    onClick={
                      index === store.revealedCardCount - 1
                        ? store.revealNextCard
                        : undefined
                    }
                    isSelected={index < store.revealedCardCount}
                  />
                ))}
              </div>
            </div>

            {/* Auto-reveal first card */}
            {store.revealedCardCount === 0 && (
              <div className="text-center">
                <button
                  onClick={store.revealNextCard}
                  className="px-8 py-3 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 text-amber-300 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  Reveal Your Cards
                </button>
              </div>
            )}

            {/* Interpretation panels */}
            <div className="space-y-4">
              {store.session.cards.map((card, index) => (
                <InterpretationPanel
                  key={card.card.id}
                  card={card}
                  isVisible={index < store.revealedCardCount}
                />
              ))}
            </div>

            {/* Reading summary */}
            <ReadingSummary
              session={store.session}
              isVisible={store.phase === 'complete'}
            />

            {/* Post-reading section */}
            <AnimatePresence>
              {store.phase === 'complete' && (
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.7 }}
                  className="space-y-8 pt-4 border-t border-white/6"
                >
                  {/* Email capture */}
                  <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
                    <EmailCapture
                      sessionId={store.session.id}
                      firstName={store.session.firstName}
                    />
                  </div>

                  {/* Offers */}
                  <OfferGrid />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Reset */}
            {store.phase === 'complete' && (
              <div className="text-center pb-4">
                <button
                  onClick={store.reset}
                  className="text-xs text-neutral-600 hover:text-neutral-400 transition focus:outline-none focus:underline"
                >
                  Begin a new reading
                </button>
              </div>
            )}

            <FooterDisclaimer className="pb-4" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
