import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';

interface DynamicIconProps {
  icon: PhosphorIcon;
  isActive?: boolean;
  size?: number;
  className?: string;
  glowColor?: string;
  onClick?: () => void;
}

/**
 * Reusable animated icon wrapper with:
 * • hover scale animation
 * • active state animation (filled weight + glow)
 * • glow pulse when active
 * • smooth color transitions via framer-motion
 */
export function DynamicIcon({
  icon: IconComponent,
  isActive = false,
  size = 20,
  className,
  glowColor = 'var(--primary)',
  onClick,
}: DynamicIconProps) {
  return (
    <motion.div
      className={cn('relative inline-flex items-center justify-center', className)}
      whileHover={{ scale: 1.18 }}
      whileTap={{ scale: 0.92 }}
      animate={isActive ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={
        isActive
          ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
          : { type: 'spring', stiffness: 400, damping: 20 }
      }
      onClick={onClick}
    >
      {/* Glow pulse layer (visible only when active) */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
          filter: 'blur(8px)',
        }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={
          isActive
            ? { opacity: [0.35, 0.55, 0.35], scale: [1, 1.35, 1] }
            : { opacity: 0, scale: 0.6 }
        }
        transition={
          isActive
            ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.25 }
        }
      />

      {/* Icon with smooth color transition */}
      <motion.div
        className="relative z-10"
        animate={{ color: isActive ? 'var(--primary-foreground)' : 'currentColor' }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <IconComponent
          size={size}
          weight={isActive ? 'fill' : 'regular'}
        />
      </motion.div>
    </motion.div>
  );
}
