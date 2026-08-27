import { describe, it, expect } from 'vitest';
import { EMPTY_PROFILE, profileToDoctor } from './profile';

/**
 * Audit C2 regression: a brand-new/edited profile must NEVER present itself as
 * council-verified. EMPTY_PROFILE previously shipped a fabricated registration
 * number ("MCI-2018-87492"), a fabricated document name and
 * verificationStatus: "verified" - which profileToDoctor mapped onto a public
 * Verified badge on a matrimonial platform.
 */
describe('profileToDoctor verification truthfulness (audit C2)', () => {
  it('EMPTY_PROFILE defaults to unverified with blank credentials', () => {
    expect(EMPTY_PROFILE.verificationStatus).toBe('unverified');
    expect(EMPTY_PROFILE.registrationNumber).toBe('');
    expect(EMPTY_PROFILE.councilName).toBe('');
    expect(EMPTY_PROFILE.verificationDocumentName).toBe('');
  });

  it('maps the empty default profile to an unverified doctor with NO fabricated council data', () => {
    const doc = profileToDoctor(EMPTY_PROFILE, 'img.png');
    expect(doc).not.toBeNull();
    expect(doc!.isVerified).toBe(false);
    expect(doc!.verificationStatus).not.toBe('verified');
    expect(doc!.registrationNumber).toBeUndefined();
    expect(doc!.councilName).toBeUndefined();
    expect(doc!.verificationDocumentName).toBeUndefined();
  });

  it('only reports verified when the profile genuinely says verified', () => {
    const verified = profileToDoctor(
      { ...EMPTY_PROFILE, verificationStatus: 'verified', councilName: 'NMC', registrationNumber: 'REG-1' },
      'img.png'
    );
    expect(verified!.isVerified).toBe(true);
    expect(verified!.registrationNumber).toBe('REG-1');

    const pending = profileToDoctor({ ...EMPTY_PROFILE, verificationStatus: 'pending' }, 'img.png');
    expect(pending!.isVerified).toBe(false);
  });
});