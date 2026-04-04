/**
 * app-shell/animated-section.tsx — Reusable animated section wrapper.
 *
 * Wraps section content with AnimatePresence + motion.div + Suspense
 * for consistent animated transitions throughout the app shell.
 */

import { Suspense, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { SectionFallback } from './section-registry';

interface AnimatedSectionProps {
  /** Unique key that triggers the enter/exit animation on change */
  sectionKey: string;
  children: ReactNode;
  className?: string;
}

export function AnimatedSection({ sectionKey, children, className = 'h-full' }: AnimatedSectionProps) {
  const reduceMotion = useReducedMotion();
  const y = reduceMotion ? 0 : 8;
  const duration = reduceMotion ? 0.08 : 0.22;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={sectionKey}
        initial={{ opacity: 0, y }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -y }}
        transition={{ duration, ease: 'easeInOut' }}
        className={className}
      >
        <Suspense fallback={<SectionFallback />}>
          {children}
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}
