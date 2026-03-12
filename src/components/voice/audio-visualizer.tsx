import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AudioVisualizerProps {
  active: boolean;
  barCount?: number;
  color?: string;
  colorEnd?: string;
  height?: number;
  className?: string;
}

export function AudioVisualizer({
  active,
  barCount = 32,
  color = 'oklch(0.65 0.20 230)',
  colorEnd,
  height = 48,
  className,
}: AudioVisualizerProps) {
  return (
    <div
      className={cn('flex items-center justify-center gap-[2px]', className)}
      style={{ height }}
    >
      {Array.from({ length: barCount }).map((_, i) => {
        const t = barCount > 1 ? i / (barCount - 1) : 0;
        // Interpolate color via gradient if colorEnd is provided
        const barColor = colorEnd
          ? `color-mix(in oklch, ${color} ${Math.round((1 - t) * 100)}%, ${colorEnd})`
          : color;

        return (
          <motion.div
            key={i}
            className="rounded-full origin-bottom"
            style={{
              width: 3,
              height,
              background: barColor,
            }}
            animate={
              active
                ? {
                    scaleY: [
                      0.1,
                      Math.random() * 0.6 + 0.35,
                      Math.random() * 0.4 + 0.1,
                      Math.random() * 0.8 + 0.2,
                      0.1,
                    ],
                  }
                : { scaleY: 0.1 }
            }
            transition={
              active
                ? {
                    duration: 0.5 + Math.random() * 0.5,
                    repeat: Infinity,
                    repeatType: 'loop',
                    delay: (i * 0.035) % 0.5,
                    ease: 'easeInOut',
                  }
                : { duration: 0.4, ease: 'easeOut' }
            }
          />
        );
      })}
    </div>
  );
}
