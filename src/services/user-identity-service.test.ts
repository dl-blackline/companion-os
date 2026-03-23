import { describe, expect, it } from 'vitest';
import { getUserInitials } from '@/services/user-identity-service';

describe('getUserInitials', () => {
  it('builds initials from display name', () => {
    expect(getUserInitials('Alex Rivers', 'alex@example.com')).toBe('AR');
  });

  it('falls back to email when display name is empty', () => {
    expect(getUserInitials('', 'alex@example.com')).toBe('A');
  });

  it('uses U as final fallback', () => {
    expect(getUserInitials('', '')).toBe('U');
  });
});
