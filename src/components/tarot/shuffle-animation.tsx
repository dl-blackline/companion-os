import { motion } from 'framer-motion';

interface ShuffleAnimationProps {
  isShuffling: boolean;
}

const CARD_COUNT = 7;

export function ShuffleAnimation({ isShuffling }: ShuffleAnimationProps) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ height: 220, width: 160 }}
      aria-live="polite"
      aria-label={isShuffling ? 'Shuffling your tarot deck…' : 'Tarot deck'}
    >
      {Array.from({ length: CARD_COUNT }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-xl border border-amber-400/20 bg-gradient-to-br from-neutral-800 to-neutral-900 shadow-2xl"
          style={{ width: 110, height: 190 }}
          initial={{ rotate: (i - 3) * 4, y: (i - 3) * 2 }}
          animate={
            isShuffling
              ? {
                  rotate: [
                    (i - 3) * 4,
                    (i - 3) * 4 + (i % 2 === 0 ? 25 : -25),
                    (i - 3) * 4,
                  ],
                  y: [
                    (i - 3) * 2,
                    (i - 3) * 2 + (i % 2 === 0 ? -30 : 30),
                    (i - 3) * 2,
                  ],
                  x: [0, (i % 2 === 0 ? -20 : 20), 0],
                }
              : { rotate: (i - 3) * 4, y: (i - 3) * 2 }
          }
          transition={{
            duration: 0.9,
            repeat: isShuffling ? Infinity : 0,
            delay: i * 0.07,
            ease: 'easeInOut',
          }}
        >
          {/* Card back pattern */}
          <div className="w-full h-full rounded-xl overflow-hidden flex items-center justify-center">
            <div
              className="w-[85%] h-[87%] rounded-lg border border-amber-400/30"
              style={{
                background:
                  'repeating-linear-gradient(45deg, rgba(212,175,55,0.06) 0px, rgba(212,175,55,0.06) 1px, transparent 1px, transparent 8px)',
              }}
            />
          </div>
        </motion.div>
      ))}

      {/* Glow underneath */}
      <motion.div
        className="absolute rounded-full blur-2xl"
        style={{
          width: 80,
          height: 40,
          bottom: -10,
          background: 'rgba(212,175,55,0.15)',
        }}
        animate={isShuffling ? { opacity: [0.3, 0.7, 0.3] } : { opacity: 0.3 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}
