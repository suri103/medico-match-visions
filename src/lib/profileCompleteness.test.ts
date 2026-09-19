import { describe, it, expect } from 'vitest';
import {
  computeCompleteness,
  hasRealProfilePhoto,
  needsCompletionPush,
  COMPLETENESS_TARGET,
  type CompletenessInput,
} from './profileCompleteness';

/**
 * Regression tests for the profile-completeness engine (onboarding gap-fix #2).
 *
 * Invariants under test:
 * - Empty profile scores 0, full profile scores 100, weights total exactly 100.
 * - The generated initials avatar (inline SVG data URI) must NOT count as a
 *   real photo — otherwise every fresh account would start "photographed".
 * - canInteract = identity + real photo (the incumbents' minimum marketable bar).
 * - preferences counted satisfied via age band OR location OR interests.
 */

const BASE: CompletenessInput = {
  profile: {},
  photos: [],
  interests: [],
};

const fullProfile: Record<string, unknown> = {
  name: 'Jane Smith',
  gender: 'Female',
  dob: '1995-05-05',
  specialty: 'Cardiology',
  degree: 'MBBS',
  hospital: 'Apollo',
  location: 'Mumbai, Maharashtra',
  rashi: 'Mesha (Aries)',
  prefAgeMin: '24',
  prefAgeMax: '34',
  prefLocation: 'Mumbai',
  about: 'About me',
  lookingFor: 'Looking for',
  familyType: 'Nuclear',
  diet: 'Vegetarian',
  phone: '+91 90000 00000',
  verificationStatus: 'pending',
};

const realPhoto = { url: 'https://x.supabase.co/storage/v1/object/public/profile-photos/p.jpg' };

const full = (): CompletenessInput => ({
  profile: fullProfile,
  photos: [realPhoto],
  interests: ['Music'],
});

describe('profileCompleteness', () => {
  it('scores an empty profile at 0% with all items missing', () => {
    const r = computeCompleteness(BASE);
    expect(r.percent).toBe(0);
    expect(r.items.length).toBe(9);
    expect(r.missing.length).toBe(9);
    expect(r.canInteract).toBe(false);
  });

  it('scores a fully completed profile at 100% with nothing missing', () => {
    const r = computeCompleteness(full());
    expect(r.percent).toBe(100);
    expect(r.missing.length).toBe(0);
    expect(r.canInteract).toBe(true);
  });

  it('rejects generated SVG avatars as real photos', () => {
    expect(hasRealProfilePhoto([{ url: 'data:image/svg+xml;utf8,<svg/>' }])).toBe(false);
    expect(hasRealProfilePhoto([{ url: 'data:image/png;base64,iVBOR' }])).toBe(true);
    expect(hasRealProfilePhoto([{ url: 'https://x/p.jpg' }])).toBe(true);
    expect(hasRealProfilePhoto([])).toBe(false);
  });

  it('photo item only satisfied by a real photo, not an initials avatar', () => {
    const withAvatarOnly = computeCompleteness({
      profile: fullProfile,
      photos: [{ url: 'data:image/svg+xml;utf8,<svg/>' }],
    });
    const photoItem = withAvatarOnly.items.find((i) => i.id === 'photo');
    expect(photoItem?.done).toBe(false);
    expect(withAvatarOnly.percent).toBeLessThan(100);
  });

  it('canInteract requires identity AND real photo (photoless cannot interact)', () => {
    const identityOnly = computeCompleteness({
      profile: { name: 'Jane', gender: 'Female', dob: '1995-05-05' },
      photos: [],
    });
    expect(identityOnly.canInteract).toBe(false);

    const photoOnly = computeCompleteness({
      profile: {},
      photos: [realPhoto],
    });
    expect(photoOnly.canInteract).toBe(false);

    const both = computeCompleteness({
      profile: { name: 'Jane', gender: 'Female', dob: '1995-05-05' },
      photos: [realPhoto],
    });
    expect(both.canInteract).toBe(true);
  });

  it('preferences satisfied via interests alone (age band not required)', () => {
    const viaInterests = computeCompleteness({
      profile: {},
      interests: ['Music', 'Travel'],
    });
    const pref = viaInterests.items.find((i) => i.id === 'preferences');
    expect(pref?.done).toBe(true);

    const viaAgeBand = computeCompleteness({
      profile: { prefAgeMin: '24', prefAgeMax: '34' },
    });
    expect(viaAgeBand.items.find((i) => i.id === 'preferences')?.done).toBe(true);
  });

  it('verification counts pending as submitted (badge not required)', () => {
    const pending = computeCompleteness({ profile: { verificationStatus: 'pending' } });
    expect(pending.items.find((i) => i.id === 'verification')?.done).toBe(true);

    const unverified = computeCompleteness({ profile: { verificationStatus: 'unverified' } });
    expect(unverified.items.find((i) => i.id === 'verification')?.done).toBe(false);
  });

  it('missing items are sorted by weight (highest-impact first)', () => {
    const r = computeCompleteness(BASE);
    const weights = r.missing.map((m) => m.weight);
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i - 1]).toBeGreaterThanOrEqual(weights[i]);
    }
  });

  it('nag threshold matches the 70% target', () => {
    expect(COMPLETENESS_TARGET).toBe(70);
    expect(needsCompletionPush({ ...computeCompleteness(BASE), percent: 69 })).toBe(true);
    expect(needsCompletionPush({ ...computeCompleteness(BASE), percent: 70 })).toBe(false);
  });

  it('is robust to garbage input (no throws, sane output)', () => {
    const r = computeCompleteness({
      profile: { name: 123, gender: null, dob: {}, photos: 'garbage' } as unknown as Record<string, unknown>,
      photos: [null, undefined, { url: 42 }] as unknown as CompletenessInput['photos'],
      interests: 'not-an-array' as unknown as string[],
    });
    expect(r.percent).toBeGreaterThanOrEqual(0);
    expect(r.percent).toBeLessThanOrEqual(100);
    expect(r.missing.length).toBe(r.items.length - r.items.filter((i) => i.done).length);
  });
});