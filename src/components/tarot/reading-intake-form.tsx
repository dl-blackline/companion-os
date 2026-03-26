import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { intakeFormSchema, type IntakeFormValues } from '@/lib/validation/reading';

interface ReadingIntakeFormProps {
  onSubmit: (values: IntakeFormValues) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function ReadingIntakeForm({ onSubmit, isLoading, error }: ReadingIntakeFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<IntakeFormValues>({
    resolver: zodResolver(intakeFormSchema),
  });

  // Max DOB: today (must be at least 13)
  const maxDob = new Date();
  maxDob.setFullYear(maxDob.getFullYear() - 13);
  const maxDobStr = maxDob.toISOString().split('T')[0];

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
      aria-label="Reading intake form"
      noValidate
    >
      <div className="space-y-1.5">
        <label
          htmlFor="tarot-first-name"
          className="block text-sm font-medium text-neutral-300 tracking-wide"
        >
          First Name
        </label>
        <input
          id="tarot-first-name"
          type="text"
          autoComplete="given-name"
          placeholder="Enter your first name"
          disabled={isLoading}
          {...register('firstName')}
          className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/60 transition disabled:opacity-50"
          aria-describedby={errors.firstName ? 'tarot-first-name-error' : undefined}
        />
        {errors.firstName && (
          <p id="tarot-first-name-error" className="text-sm text-red-400" role="alert">
            {errors.firstName.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="tarot-dob"
          className="block text-sm font-medium text-neutral-300 tracking-wide"
        >
          Date of Birth
        </label>
        <input
          id="tarot-dob"
          type="date"
          max={maxDobStr}
          disabled={isLoading}
          {...register('dateOfBirth')}
          className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/60 transition disabled:opacity-50 scheme-dark"
          aria-describedby={errors.dateOfBirth ? 'tarot-dob-error' : undefined}
        />
        {errors.dateOfBirth && (
          <p id="tarot-dob-error" className="text-sm text-red-400" role="alert">
            {errors.dateOfBirth.message}
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400 text-center" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-4 px-6 rounded-lg bg-linear-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-semibold tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-black"
      >
        {isLoading ? 'Preparing your reading…' : 'Reveal My Reading'}
      </button>

      <p className="text-xs text-center text-neutral-500">
        Your name is used only for personalization. Your date of birth is used only to derive your zodiac sign.
      </p>
    </form>
  );
}
