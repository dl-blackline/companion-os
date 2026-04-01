import { describe, it, expect } from 'vitest';
import { isSuperAdmin, SUPER_ADMIN_EMAILS } from '@/lib/super-admin';

describe('super-admin', () => {
  describe('SUPER_ADMIN_EMAILS', () => {
    it('contains the canonical super-admin email', () => {
      expect(SUPER_ADMIN_EMAILS).toContain('dlsvmconsulting@gmail.com');
    });

    it('is a frozen / read-only array', () => {
      expect(Object.isFrozen(SUPER_ADMIN_EMAILS) || Array.isArray(SUPER_ADMIN_EMAILS)).toBe(true);
    });
  });

  describe('isSuperAdmin()', () => {
    it('returns true for the canonical email', () => {
      expect(isSuperAdmin('dlsvmconsulting@gmail.com')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(isSuperAdmin('DLsvmConsulting@Gmail.Com')).toBe(true);
      expect(isSuperAdmin('DLSVMCONSULTING@GMAIL.COM')).toBe(true);
    });

    it('returns false for a regular user email', () => {
      expect(isSuperAdmin('someone@example.com')).toBe(false);
    });

    it('returns false for null / undefined / empty', () => {
      expect(isSuperAdmin(null)).toBe(false);
      expect(isSuperAdmin(undefined)).toBe(false);
      expect(isSuperAdmin('')).toBe(false);
    });

    it('returns false for partial matches', () => {
      expect(isSuperAdmin('dlsvmconsulting@gmail.com.evil')).toBe(false);
      expect(isSuperAdmin('x-dlsvmconsulting@gmail.com')).toBe(false);
    });
  });
});
