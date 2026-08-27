import type { ProfileData } from '@/lib/profile';

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;
export const MARITAL_OPTIONS = ['Never Married', 'Divorced', 'Widowed', 'Awaiting Divorce'] as const;

export function profileCompleteness(p: Partial<ProfileData> & Record<string, string | undefined>, interests: string[], photos: { isPrimary: boolean }[]): number {
  const checks: boolean[] = [
    !!p.name?.trim(),
    !!p.specialty?.trim(),
    !!p.hospital?.trim(),
    !!p.location?.trim(),
    !!p.about?.trim(),
    !!p.lookingFor?.trim(),
    !!p.email?.trim(),
    !!p.phone?.trim(),
    interests.length >= 2,
    photos.some(x => x.isPrimary),
    !!(p as unknown as { dob?: string }).dob,
    !!(p as unknown as { gender?: string }).gender,
    !!(p as unknown as { heightCm?: string }).heightCm,
    !!(p as unknown as { maritalStatus?: string }).maritalStatus,
    !!(p as unknown as { motherTongue?: string }).motherTongue,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

export function asPartnerPrefs(p: Partial<ProfileData> & Record<string, string | undefined>) {
  return {
    ageMin: parseInt((p as Record<string, string | undefined>).prefAgeMin || '24', 10),
    ageMax: parseInt((p as Record<string, string | undefined>).prefAgeMax || '36', 10),
    location: (p as Record<string, string | undefined>).prefLocation || '',
  };
}
