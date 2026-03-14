import { describe, it, expect } from 'vitest';
import { intakeFormSchema, emailLeadSchema } from '@/lib/validation/reading';

describe('intakeFormSchema', () => {
  const validData = {
    firstName: 'Luna',
    dateOfBirth: '1990-06-15',
  };

  it('accepts valid input', () => {
    const result = intakeFormSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('rejects empty first name', () => {
    const result = intakeFormSchema.safeParse({ ...validData, firstName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects first name that is too long', () => {
    const result = intakeFormSchema.safeParse({
      ...validData,
      firstName: 'A'.repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it('rejects first name with invalid characters', () => {
    const result = intakeFormSchema.safeParse({
      ...validData,
      firstName: 'Luna123',
    });
    expect(result.success).toBe(false);
  });

  it('accepts names with hyphens and apostrophes', () => {
    const result = intakeFormSchema.safeParse({
      ...validData,
      firstName: "O'Brien-Smith",
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty date of birth', () => {
    const result = intakeFormSchema.safeParse({ ...validData, dateOfBirth: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid date strings', () => {
    const result = intakeFormSchema.safeParse({
      ...validData,
      dateOfBirth: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });

  it('rejects dates less than 13 years ago', () => {
    const recent = new Date();
    recent.setFullYear(recent.getFullYear() - 5);
    const result = intakeFormSchema.safeParse({
      ...validData,
      dateOfBirth: recent.toISOString().split('T')[0],
    });
    expect(result.success).toBe(false);
  });

  it('accepts a date exactly 13 years ago or more', () => {
    const old = new Date();
    old.setFullYear(old.getFullYear() - 20);
    const result = intakeFormSchema.safeParse({
      ...validData,
      dateOfBirth: old.toISOString().split('T')[0],
    });
    expect(result.success).toBe(true);
  });
});

describe('emailLeadSchema', () => {
  it('accepts a valid email', () => {
    const result = emailLeadSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty email', () => {
    const result = emailLeadSchema.safeParse({ email: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email format', () => {
    const result = emailLeadSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('accepts optional fields when provided', () => {
    const result = emailLeadSchema.safeParse({
      email: 'test@test.com',
      firstName: 'Luna',
      sessionId: 'abc-123',
    });
    expect(result.success).toBe(true);
  });
});
