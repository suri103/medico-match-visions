export const EMPTY_PROFILE = {
  name: "",
  specialty: "",
  // Audit M-23: a brand-new account must not be PERSISTED with a made-up
  // qualification. The old default ("MBBS") was written to the server by
  // EditProfilePage for any member who never chose a degree.
  degree: "",
  hospital: "",
  location: "",
  experience: "",
  about: "",
  lookingFor: "",
  email: "",
  phone: "",
  dob: "",
  gender: "",
  heightCm: "",
  // Matrimony kundali details (higher-fidelity matching + astro consults).
  birthDate: "",
  birthTime: "",
  birthCity: "",
  // Honest career stage — never forced "Dr./MBBS" for students.
  careerStage: "",
  councilName: "",
  registrationNumber: "",
  maritalStatus: "Never Married",
  motherTongue: "Hindi",
  // Audit M-23: religion is a matching fact — default it to the explicit
  // "No preference" the form already offers rather than asserting "Hindu".
  religion: "No preference",
  caste: "",
  subcaste: "",
  gotra: "",
  rashi: "",
  nakshatra: "",
  // Audit M-23: same principle for the horoscope attribute.
  manglik: "Don't Know",
  prefAgeMin: "24",
  prefAgeMax: "36",
  prefLocation: "",
  prefReligion: "No preference",
  prefCaste: "No preference",
  prefSubcaste: "No preference",
  prefGotra: "No preference",
  prefMotherTongue: [] as string[],
  prefDegree: [] as string[],
  excludeSameGotra: false,
  minGunas: 18,
  registrationYear: "",
  verificationStatus: "unverified" as 'unverified' | 'pending' | 'verified' | 'rejected',
  verificationDocumentName: "",
  verificationDocumentUrl: "",
  // Privacy (P-CONTROL): member-set visibility, synced to the server like every
  // other profile field. Income defaults to 'private' (owner-only display).
  profileVisibility: "public",
  incomeVisibility: "private",
};

export type ProfileData = typeof EMPTY_PROFILE;

function ageFromDob(dob: string): number {
  if (!dob) return 30;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return 30;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return Math.max(21, Math.min(65, age));
}

export function profileToDoctor(profile: ProfileData, imageUrl: string, userInterests?: string[]): import('@/features/matches/types').Doctor | null {
  const rawName = profile.name.trim() || 'User';
  const cleanIdName = rawName.replace(/^dr\.?\s+/i, '') || 'user';
  const specialty = profile.specialty.trim() || 'General Physician';
  const parts = (profile.location || '').split(',').map(s => s.trim()).filter(Boolean);
  // Audit M-23: no invented location either.
  const city = parts[0] || '';
  const state = parts[1] || '';
  return {
    id: `me-${cleanIdName.toLowerCase().replace(/\s+/g, '-')}`,
    name: rawName,
    age: ageFromDob(profile.dob),
    specialty,
    // Audit M-23: NEVER fabricate a member's own credentials, community or
    // horoscope. The old fallbacks invented "MBBS, MD", "Apollo Hospitals",
    // Hindu/Brahmin/Saraswat/Kashyap, Mesha (Aries)/Ashwini and a 28/36
    // kundali score for a member who had answered nothing — on a matrimonial
    // platform, where caste, gotra and horoscope are the facts people are
    // matching ON. An unset field is now simply unset; the UI renders
    // nothing rather than a confident fabrication.
    degree: profile.degree || '',
    hospital: profile.hospital || '',
    city,
    state,
    country: 'India',
    imageUrl,
    matchPercentage: 100,
    interests: userInterests && userInterests.length > 0 ? userInterests : [],
    isOnline: true,
    sexualOrientation: 'Straight',
    isVerified: profile.verificationStatus === 'verified',
    // Audit C2: never fabricate credentials. Empty/unverified input yields NO
    // council, NO registration number and a truthful status (the old fallbacks
    // here minted a fake "MCI-2018-87492" + a public Verified badge).
    councilName: profile.councilName || undefined,
    registrationNumber: profile.registrationNumber || undefined,
    registrationYear: profile.registrationYear ? parseInt(profile.registrationYear, 10) : undefined,
    verificationStatus: profile.verificationStatus || 'unverified',
    verificationDocumentName: profile.verificationDocumentName || undefined,
    aboutMe: profile.about || undefined,
    lookingFor: profile.lookingFor || undefined,
    prefAgeMin: profile.prefAgeMin ? parseInt(profile.prefAgeMin, 10) : 24,
    prefAgeMax: profile.prefAgeMax ? parseInt(profile.prefAgeMax, 10) : 36,
    prefLocation: profile.prefLocation || '',
    heightCm: profile.heightCm ? parseInt(profile.heightCm, 10) : 175,
    maritalStatus: profile.maritalStatus || '',
    motherTongue: profile.motherTongue || '',
    religion: profile.religion || '',
    caste: profile.caste || '',
    cast: profile.caste || '',
    subcaste: profile.subcaste || '',
    gotra: profile.gotra || '',
    rashi: profile.rashi || '',
    nakshatra: profile.nakshatra || '',
    manglik: profile.manglik || '',
    // 0 means "not provided" — the UI renders a dash rather than a score
    // the member never earned.
    kundaliGunas: profile.minGunas || 0,
  };
}

// A profile counts as "created" once the create flow has been completed
// (flag persisted in `mm:profileCreated`) OR when stored profile data
// already contains a name. This keeps existing users on the view/edit
// page while new users get the create flow.
export function hasCreatedProfile(): boolean {
  try {
    if (localStorage.getItem("mm:profileCreated") === "true") return true;
    const raw = localStorage.getItem("mm:profileData");
    if (raw) {
      const data = JSON.parse(raw) as Partial<ProfileData>;
      return Boolean(data && typeof data.name === "string" && data.name.trim());
    }
  } catch {
    // Corrupt or unavailable storage — treat as not created.
  }
  return false;
}
