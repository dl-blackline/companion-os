import { z } from 'zod';

const MIN_AGE_YEARS = 13;
const MAX_AGE_YEARS = 120;

function minAgeDate(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - MIN_AGE_YEARS);
  return d;
}

function maxAgeDate(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - MAX_AGE_YEARS);
  return d;
}

export const intakeFormSchema = z.object({
  firstName: z
    .string()
    .min(1, 'Please enter your first name.')
    .max(50, 'First name must be 50 characters or fewer.')
    .regex(/^[a-zA-Z\s'-]+$/, 'Please enter a valid first name.'),

  dateOfBirth: z
    .string()
    .min(1, 'Please enter your date of birth.')
    .refine((val) => {
      const d = new Date(val);
      return !isNaN(d.getTime());
    }, 'Please enter a valid date.')
    .refine((val) => {
      const d = new Date(val);
      return d <= minAgeDate();
    }, `You must be at least ${MIN_AGE_YEARS} years old to use this service.`)
    .refine((val) => {
      const d = new Date(val);
      return d >= maxAgeDate();
    }, 'Please enter a valid date of birth.'),
});

export type IntakeFormValues = z.infer<typeof intakeFormSchema>;

export const emailLeadSchema = z.object({
  email: z
    .string()
    .min(1, 'Please enter your email address.')
    .email('Please enter a valid email address.'),
  firstName: z.string().optional(),
  sessionId: z.string().optional(),
});

export type EmailLeadValues = z.infer<typeof emailLeadSchema>;
