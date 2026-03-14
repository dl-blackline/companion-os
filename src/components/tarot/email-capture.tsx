import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { emailLeadSchema, type EmailLeadValues } from '@/lib/validation/reading';
import { saveEmailLead } from '@/services/tarot-service';
import { tarotTrack } from '@/lib/tarot/analytics';

interface EmailCaptureProps {
  sessionId?: string;
  firstName?: string;
  zodiacSign?: string;
  onSuccess?: () => void;
}

export function EmailCapture({ sessionId, firstName, zodiacSign, onSuccess }: EmailCaptureProps) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailLeadValues>({
    resolver: zodResolver(emailLeadSchema),
    defaultValues: { sessionId, firstName },
  });

  const onFocus = () => {
    if (!hasStarted) {
      setHasStarted(true);
      tarotTrack.emailCaptureStarted({ sessionId });
    }
  };

  const onSubmit = async (values: EmailLeadValues) => {
    setServerError(null);
    const result = await saveEmailLead({
      email: values.email,
      firstName: values.firstName || firstName,
      sessionId,
      zodiacSign,
    });

    if (result.success) {
      tarotTrack.emailCaptureSucceeded({ sessionId });
      setIsSubmitted(true);
      onSuccess?.();
    } else {
      tarotTrack.emailCaptureFailed({ sessionId, error: result.error });
      setServerError(result.error ?? 'Something went wrong. Please try again.');
    }
  };

  if (isSubmitted) {
    return (
      <div className="text-center space-y-2 py-4">
        <p className="text-lg font-medium text-white">Your reading is saved ✦</p>
        <p className="text-sm text-neutral-400">
          We'll send your reading details to your inbox.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-sm font-medium text-white">Save your reading</p>
        <p className="text-xs text-neutral-400 mt-0.5">
          Receive your full spread summary in your inbox to revisit anytime.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex gap-2" noValidate>
        <div className="flex-1">
          <input
            type="email"
            placeholder="your@email.com"
            disabled={isSubmitting}
            {...register('email')}
            onFocus={onFocus}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/60 transition disabled:opacity-50"
            aria-label="Email address"
            aria-describedby={errors.email ? 'email-error' : undefined}
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p id="email-error" className="mt-1 text-xs text-red-400" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold transition disabled:opacity-50 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-black"
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Saving…' : 'Save'}
        </button>
      </form>

      {serverError && (
        <p className="text-xs text-red-400 text-center" role="alert">
          {serverError}
        </p>
      )}
    </div>
  );
}
