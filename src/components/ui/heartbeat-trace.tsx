import { motion } from 'framer-motion';

interface HeartbeatTraceProps {
  className?: string;
  active?: boolean;
  duration?: number;
  color?: string;
}

export function HeartbeatTrace({
  className,
  active = true,
  duration = 1.2,
  color = 'currentColor',
}: HeartbeatTraceProps) {
  return (
    <div className={className} aria-hidden="true">
      <motion.div
        className="h-full w-[200%]"
        animate={active ? { x: ['0%', '-50%'] } : { x: '0%' }}
        transition={{ duration, repeat: Infinity, ease: 'linear' }}
      >
        <svg viewBox="0 0 200 40" className="h-full w-full" preserveAspectRatio="none">
          <path
            d="M0 20 H26 L34 20 L44 10 L56 30 L68 5 L82 20 H100 H126 L134 20 L144 10 L156 30 L168 5 L182 20 H200"
            fill="none"
            stroke={color}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </motion.div>
    </div>
  );
}