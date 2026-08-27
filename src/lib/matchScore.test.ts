import { describe, it, expect } from 'vitest';
import { computeMatchScore } from './matchScore';
import { EMPTY_PROFILE } from './profile';
import type { Doctor } from '@/features/matches/types';

const base: Doctor = {
  id: '1', name: 'A', age: 30, specialty: 'Cardiologist', hospital: 'H', city: 'Mumbai', state: 'Maharashtra', country: 'India',
  imageUrl: '', matchPercentage: 50, interests: ['Yoga', 'Travel'], isOnline: false, sexualOrientation: 'Straight',
};

const emptyProfile = { ...EMPTY_PROFILE };

describe('computeMatchScore', () => {
  it('boosts score for same specialty + interest + city', () => {
    const score = computeMatchScore(base, { ...EMPTY_PROFILE, name: 'Me', specialty: 'Cardiologist', location: 'Mumbai' }, ['Yoga']);
    expect(score).toBeGreaterThan(50);
  });

  it('enforces score floor of 30', () => {
    const score = computeMatchScore({ ...base, isOnline: true }, emptyProfile, []);
    expect(score).toBeGreaterThanOrEqual(30);
  });

  it('enforces score ceiling of 99', () => {
    const score = computeMatchScore(base, emptyProfile, []);
    expect(score).toBeLessThanOrEqual(99);
  });
});
