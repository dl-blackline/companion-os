import { SHORT_DISCLAIMER } from '@/lib/copy/disclaimers';

interface FooterDisclaimerProps {
  className?: string;
}

export function FooterDisclaimer({ className = '' }: FooterDisclaimerProps) {
  return (
    <p
      className={`text-xs text-center text-neutral-600 leading-relaxed ${className}`}
      role="note"
    >
      {SHORT_DISCLAIMER}
    </p>
  );
}
