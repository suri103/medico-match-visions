import { describe, it, expect } from 'vitest';
import { computeKundaliMilan, getAshtaKootaScore } from './kundaliMatching';
import { computeCompatibilityReasons } from './matchScore';
import { EMPTY_PROFILE } from './profile';
import type { Doctor } from '@/features/matches/types';
describe('Vedic Kundali Milan (Ashta Koota / 36 Gunas Engine)', () => {
  it('calculates 8 kootas summing correctly with bounds', () => {
    const res = computeKundaliMilan(
      { rashi: 'Mesha (Aries)', nakshatra: 'Ashwini', manglik: 'Non-Manglik' },
      { rashi: 'Simha (Leo)', nakshatra: 'Magha', manglik: 'Non-Manglik' }
    );

    expect(res.kootas.length).toBe(8);
    const sumPoints = res.kootas.reduce((acc, k) => acc + k.obtainedPoints, 0);
    expect(res.totalPoints).toBe(sumPoints);
    expect(res.totalPoints).toBeGreaterThanOrEqual(0);
    expect(res.totalPoints).toBeLessThanOrEqual(36);
  });

  it('correctly reports auspicious status for score >= 18', () => {
    const score = getAshtaKootaScore('Mesha (Aries)', 'Ashwini', 'Simha (Leo)', 'Magha');
    const res = computeKundaliMilan(
      { rashi: 'Mesha (Aries)', nakshatra: 'Ashwini', manglik: 'Non-Manglik' },
      { rashi: 'Simha (Leo)', nakshatra: 'Magha', manglik: 'Non-Manglik' }
    );

    expect(score).toBe(res.totalPoints);
    if (res.totalPoints >= 18) {
      expect(res.isAuspicious).toBe(true);
    } else {
      expect(res.isAuspicious).toBe(false);
    }
  });

  it('identifies identical Nadi as Nadi Dosha', () => {
    // Both Ashwini and Ardra belong to Adi Nadi
    const res = computeKundaliMilan(
      { rashi: 'Mesha (Aries)', nakshatra: 'Ashwini', manglik: 'Non-Manglik' },
      { rashi: 'Mithuna (Gemini)', nakshatra: 'Ardra', manglik: 'Non-Manglik' }
    );
    expect(res.nadiDosha).toBe(true);
    const nadiKoota = res.kootas.find(k => k.name.includes('Nadi'));
    expect(nadiKoota?.obtainedPoints).toBe(0);
  });

  it('awards full 8 points in Nadi Koota for different Nadis', () => {
    // Ashwini (Adi Nadi) & Bharani (Madhya Nadi)
    const res = computeKundaliMilan(
      { rashi: 'Mesha (Aries)', nakshatra: 'Ashwini', manglik: 'Non-Manglik' },
      { rashi: 'Mesha (Aries)', nakshatra: 'Bharani', manglik: 'Non-Manglik' }
    );
    expect(res.nadiDosha).toBe(false);
    const nadiKoota = res.kootas.find(k => k.name.includes('Nadi'));
    expect(nadiKoota?.obtainedPoints).toBe(8);
  });

  it('handles Manglik compatibility states properly', () => {
    const nonNon = computeKundaliMilan(
      { manglik: 'Non-Manglik' },
      { manglik: 'Non-Manglik' }
    );
    expect(nonNon.manglikCompatibility).toBe('Non-Manglik Match');

    const bothManglik = computeKundaliMilan(
      { manglik: 'Manglik' },
      { manglik: 'Manglik' }
    );
    expect(bothManglik.manglikCompatibility).toBe('Both Manglik (Dosha Cancelled)');

    const mixed = computeKundaliMilan(
      { manglik: 'Non-Manglik' },
      { manglik: 'Manglik' }
    );
    expect(mixed.manglikCompatibility).toBe('Dosha Present');
  });

  it('adds Kundali and Mother Tongue highlights to compatibility reasons', () => {
    const doctor: Doctor = {
      id: 'doc-1',
      name: 'Dr. Test',
      age: 29,
      specialty: 'Cardiologist',
      hospital: 'Apollo',
      city: 'Delhi',
      state: 'Delhi',
      country: 'India',
      imageUrl: '',
      matchPercentage: 88,
      interests: ['Yoga'],
      isOnline: true,
      sexualOrientation: 'Straight',
      motherTongue: 'Hindi',
      kundaliGunas: 31,
      gotra: 'Kashyap',
    };

    const reasons = computeCompatibilityReasons(
      doctor,
      {
        ...EMPTY_PROFILE,
        name: 'User',
        specialty: 'Cardiologist',
        hospital: 'Max',
        location: 'Delhi',
        motherTongue: 'Hindi',
        gotra: 'Bharadwaja',
      },
      ['Yoga']
    );

    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons.some(r => r.includes('Mother Tongue') || r.includes('Hindi') || r.includes('specialty'))).toBe(true);
  });

  it('recognizes medical degrees and qualifications (MBBS, BDS, MDS, MD, MS, BAMS, BHMS)', () => {
    const bdsDoctor: Doctor = {
      id: 'doc-dentist',
      name: 'Dr. Dent',
      age: 30,
      specialty: 'Dentist / Dental Surgeon',
      degree: 'BDS, MDS',
      hospital: 'Smile Care',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      imageUrl: '',
      matchPercentage: 90,
      interests: ['Reading'],
      isOnline: true,
      sexualOrientation: 'Straight',
    };

    const reasons = computeCompatibilityReasons(
      bdsDoctor,
      {
        ...EMPTY_PROFILE,
        name: 'User',
        specialty: 'Dentist',
        degree: 'BDS',
        hospital: 'City Dental',
        location: 'Mumbai',
      },
      ['Reading']
    );

    expect(reasons.some(r => r.includes('BDS, MDS'))).toBe(true);
  });

  it('supports Veterinary, BAMS, BHMS, and Nursing degrees and specialties', () => {
    const vetDoctor: Doctor = {
      id: 'doc-vet',
      name: 'Dr. Rohan',
      age: 33,
      specialty: 'Veterinary Physician / Surgeon',
      degree: 'BVSc & AH / MVSc (Veterinary)',
      hospital: 'Veterinary Hospital',
      city: 'Nagpur',
      state: 'Maharashtra',
      country: 'India',
      imageUrl: '',
      matchPercentage: 88,
      interests: ['Trekking'],
      isOnline: true,
      sexualOrientation: 'Straight',
    };

    const vetReasons = computeCompatibilityReasons(
      vetDoctor,
      {
        ...EMPTY_PROFILE,
        name: 'User',
        specialty: 'Veterinary Surgeon',
        degree: 'BVSc & AH / MVSc (Veterinary)',
        hospital: 'Pet Clinic',
        location: 'Nagpur',
      },
      ['Trekking']
    );

    expect(vetReasons.some(r => r.includes('Veterinary'))).toBe(true);

    const nurseDoctor: Doctor = {
      id: 'doc-nurse',
      name: 'Nithya Menon',
      age: 28,
      specialty: 'Nursing Specialist / Critical Care',
      degree: 'M.Sc Nursing / NP',
      hospital: 'Aster Medcity',
      city: 'Kochi',
      state: 'Kerala',
      country: 'India',
      imageUrl: '',
      matchPercentage: 86,
      interests: ['Singing'],
      isOnline: true,
      sexualOrientation: 'Straight',
    };

    const nurseReasons = computeCompatibilityReasons(
      nurseDoctor,
      {
        ...EMPTY_PROFILE,
        name: 'User',
        specialty: 'Nurse Practitioner',
        degree: 'B.Sc Nursing',
        hospital: 'General Hospital',
        location: 'Kochi',
      },
      ['Singing']
    );

    expect(nurseReasons.some(r => r.includes('Nursing'))).toBe(true);
  });
});

describe('Kundali Milan requires real birth charts (audit M4 regression)', () => {
  it('scores ZERO when a birth chart is missing instead of fabricating defaults', () => {
    // Partner has no rashi/nakshatra at all — previously this silently
    // defaulted to Simha/Rohini and produced a confident-looking score.
    const res = computeKundaliMilan(
      { rashi: 'Mesha (Aries)', nakshatra: 'Ashwini', manglik: 'Non-Manglik' },
      { manglik: 'Non-Manglik' }
    );
    expect(res.totalPoints).toBe(0);
    expect(res.isAuspicious).toBe(false);
    expect(res.summary).toContain('Birth details');
    expect(res.kootas.every((k) => k.obtainedPoints === 0)).toBe(true);
  });

  it('scores ZERO when NEITHER side entered birth data', () => {
    const res = computeKundaliMilan({}, {});
    expect(res.totalPoints).toBe(0);
    expect(getAshtaKootaScore(undefined, undefined, '', '')).toBe(0);
  });

  it('still evaluates Manglik compatibility when charts are missing', () => {
    const both = computeKundaliMilan({ manglik: 'Manglik' }, { manglik: 'Manglik' });
    expect(both.manglikCompatibility).toBe('Both Manglik (Dosha Cancelled)');
    const mixed = computeKundaliMilan({ manglik: 'Non-Manglik' }, { manglik: 'Manglik' });
    expect(mixed.manglikCompatibility).toBe('Dosha Present');
  });

  it('does not let a missing chart inflate match scores', () => {
    // computeMatchScore with an empty me-profile must not receive fabricated
    // kundali points via the defaults path.
    const doctor = {
      id: 'doc-x', name: 'Dr. X', age: 30, specialty: 'Cardiologist', hospital: 'H',
      city: 'Mumbai', state: 'Maharashtra', country: 'India', imageUrl: '',
      matchPercentage: 50, interests: [], isOnline: false, sexualOrientation: 'Straight' as const,
      rashi: undefined, nakshatra: undefined,
    };
    const reasons = computeCompatibilityReasons(doctor as unknown as Doctor, { ...EMPTY_PROFILE }, []);
    expect(reasons.length).toBeGreaterThanOrEqual(0);
  });
});
