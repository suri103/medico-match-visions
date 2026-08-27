import type { Doctor } from '@/features/matches/types';
import type { ProfileData } from '@/lib/profile';
import { computeKundaliMilan } from '@/lib/kundaliMatching';

export function computeMatchScore(doctor: Doctor, me: ProfileData, myInterests: string[]): number {
  let score = 45;
  if (me.specialty && doctor.specialty.toLowerCase() === me.specialty.toLowerCase()) score += 10;
  if (me.location) {
    const loc = me.location.toLowerCase();
    if (doctor.city.toLowerCase().includes(loc) || loc.includes(doctor.city.toLowerCase())) score += 8;
    else if (doctor.state.toLowerCase().includes(loc) || loc.includes(doctor.state.toLowerCase())) score += 4;
  }
  const overlap = doctor.interests.filter(i => myInterests.map(s => s.toLowerCase()).includes(i.toLowerCase())).length;
  score += Math.min(overlap * 3, 9);
  if (doctor.isOnline) score += 3;
  const prefMin = parseInt(me.prefAgeMin || '24', 10);
  const prefMax = parseInt(me.prefAgeMax || '36', 10);
  if (doctor.age >= prefMin && doctor.age <= prefMax) score += 7;
  else if (Math.abs(doctor.age - (prefMin + prefMax) / 2) <= 5) score += 3;
  const prefLoc = (me.prefLocation || '').toLowerCase().trim();
  if (prefLoc) {
    if (doctor.city.toLowerCase().includes(prefLoc) || prefLoc.includes(doctor.city.toLowerCase())) score += 6;
    else if (doctor.state.toLowerCase().includes(prefLoc) || prefLoc.includes(doctor.state.toLowerCase())) score += 3;
  }
  if (me.religion && doctor.religion && doctor.religion.toLowerCase() === me.religion.toLowerCase()) {
    score += 4;
  }
  if (me.caste && (doctor.caste || doctor.cast) && (doctor.caste || doctor.cast)!.toLowerCase() === me.caste.toLowerCase()) {
    score += 4;
  }
  if (me.subcaste && doctor.subcaste && doctor.subcaste.toLowerCase().includes(me.subcaste.toLowerCase())) {
    score += 3;
  }
  if (me.prefGotra && me.prefGotra !== 'No preference' && doctor.gotra && doctor.gotra.toLowerCase() === me.prefGotra.toLowerCase()) {
    score += 3;
  }
  if (me.motherTongue && doctor.motherTongue && doctor.motherTongue.toLowerCase() === me.motherTongue.toLowerCase()) {
    score += 4;
  }
  
  if (me.degree && doctor.degree) {
    const myDegs = me.degree.toLowerCase().split(/[,\s/]+/).filter(Boolean);
    const docDegs = doctor.degree.toLowerCase().split(/[,\s/]+/).filter(Boolean);
    if (myDegs.some(d => docDegs.includes(d))) {
      score += 4;
    }
  }
  
  // Kundali Ashta Koota compatibility
  if (me.rashi || me.nakshatra) {
    const kundali = computeKundaliMilan(me, doctor);
    if (kundali.totalPoints >= 28) score += 6;
    else if (kundali.totalPoints >= 18) score += 3;
    else if (kundali.nadiDosha) score -= 3;
  } else if (doctor.kundaliGunas && doctor.kundaliGunas >= 28) {
    score += 4;
  }

  if (doctor.isVerified) score += 3;
  // Deterministic per-doctor jitter (0-2). Use a string hash instead of
  // parsing the last ID character: IDs may be non-numeric (e.g. "me-*"
  // profile IDs), in which case parseInt returns NaN and poisons the score.
  let hash = 0;
  for (let i = 0; i < doctor.id.length; i++) {
    hash = (hash * 31 + doctor.id.charCodeAt(i)) | 0;
  }
  return Math.max(30, Math.min(99, score + (Math.abs(hash) % 3)));
}

export function matchReasons(doctor: Doctor, me: ProfileData, myInterests: string[]): string[] {
  const reasons: string[] = [];
  if (doctor.degree) reasons.push(`${doctor.degree} Degree`);
  if (me.specialty && doctor.specialty.toLowerCase() === me.specialty.toLowerCase()) reasons.push('Same specialty');
  const overlap = doctor.interests.filter(i => myInterests.map(s => s.toLowerCase()).includes(i.toLowerCase()));
  if (overlap.length) reasons.push(`Shared interests: ${overlap.slice(0, 2).join(', ')}`);
  const prefMin = parseInt(me.prefAgeMin || '24', 10);
  const prefMax = parseInt(me.prefAgeMax || '36', 10);
  if (doctor.age >= prefMin && doctor.age <= prefMax) reasons.push('Within preferred age range');
  if (me.prefLocation && doctor.city.toLowerCase().includes(me.prefLocation.toLowerCase())) reasons.push('Preferred location match');
  
  if (me.caste && (doctor.caste || doctor.cast) && (doctor.caste || doctor.cast)!.toLowerCase() === me.caste.toLowerCase()) {
    reasons.push(`${doctor.caste}${doctor.subcaste ? ` (${doctor.subcaste})` : ''} community`);
  } else if (me.religion && doctor.religion && doctor.religion.toLowerCase() === me.religion.toLowerCase()) {
    reasons.push(`${doctor.religion} community`);
  }
  
  if (me.motherTongue && doctor.motherTongue && doctor.motherTongue.toLowerCase() === me.motherTongue.toLowerCase()) {
    reasons.push(`${doctor.motherTongue} Mother Tongue`);
  }

  if (doctor.kundaliGunas && doctor.kundaliGunas >= 28) {
    reasons.push(`High Guna Match (${doctor.kundaliGunas}/36)`);
  }

  if (doctor.isOnline) reasons.push('Online now');
  if (doctor.isVerified) reasons.push('Verified profile');
  return reasons.slice(0, 3);
}

export const computeCompatibilityReasons = matchReasons;
