/**
 * Profile completeness engine (onboarding gap-fix #2).
 *
 * Mirrors how the big matrimony platforms drive profile completion: a WEIGHTED
 * score over the fields that actually matter for matching, surfaced as a
 * persistent nudge with per-section deep links. Weights are chosen so the two
 * highest-signal items (a real photo, partner preferences) carry the most
 * weight — that's what makes a profile usable to others.
 *
 * Deliberately client-side and pure: no network, no storage. The server
 * validates every field it receives anyway, so this is a UX meter, not a
 * security boundary.
 */

export interface CompletenessInput {
  /** The stored profile (mm:profileData shape). */
  profile: Record<string, unknown>;
  /** Gallery rows (mm:profilePhotos shape). */
  photos?: Array<{ url?: string } | null> | null;
  /** mm:profileCreated flag. */
  created?: boolean;
  /** mm:profileInterests list. */
  interests?: string[] | null;
}

export interface CompletenessItem {
  /** Stable id for the checklist/analytics. */
  id: string;
  label: string;
  /** How much this item is worth (weights sum to 100). */
  weight: number;
  /** True when the underlying data is present. */
  done: boolean;
  /** Where to send the member to fix it. */
  href: string;
  /** Compact call-to-action label. */
  cta: string;
}

export interface CompletenessResult {
  /** 0-100, rounded. */
  percent: number;
  items: CompletenessItem[];
  /** Only the unfinished items, highest weight first. */
  missing: CompletenessItem[];
  /** True once the profile is usable enough to interact (identity + photo). */
  canInteract: boolean;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

/** A photo counts only when it is a real upload — generated initial avatars
 * (inline SVG data URIs from lib/avatar) must not satisfy completion, or every
 * account would start "photographed". */
export const isRealPhoto = (url: unknown): boolean => {
  const u = str(url);
  if (!u) return false;
  if (u.startsWith("data:image/svg")) return false;
  return true;
};

export const hasRealProfilePhoto = (photos?: CompletenessInput["photos"]): boolean =>
  Array.isArray(photos) && photos.some((p) => isRealPhoto(p?.url));

const EDIT = "/profile/edit";
const ONBOARD = "/onboarding";

interface ItemDef {
  id: string;
  label: string;
  weight: number;
  href: string;
  cta: string;
  done: (i: CompletenessInput) => boolean;
}

const ITEMS: ItemDef[] = [
  {
    id: "identity",
    label: "Your name, gender and date of birth",
    weight: 15,
    href: `${ONBOARD}?step=identity`,
    cta: "Add basics",
    done: (i) => Boolean(str(i.profile.name) && str(i.profile.gender) && str(i.profile.dob)),
  },
  {
    id: "career",
    label: "Specialty, degree and where you practise",
    weight: 15,
    href: `${ONBOARD}?step=career`,
    cta: "Add career",
    done: (i) =>
      Boolean(str(i.profile.specialty) && str(i.profile.degree) && (str(i.profile.hospital) || str(i.profile.location))),
  },
  {
    id: "photo",
    label: "A real profile photo",
    weight: 20,
    href: `${ONBOARD}?step=photo`,
    cta: "Add photo",
    done: (i) => hasRealProfilePhoto(i.photos),
  },
  {
    id: "horoscope",
    label: "Horoscope details (rashi / nakshatra)",
    weight: 10,
    href: `${ONBOARD}?step=horoscope`,
    cta: "Add horoscope",
    done: (i) => Boolean(str(i.profile.rashi) || str(i.profile.nakshatra) || str(i.profile.birthDate)),
  },
  {
    id: "preferences",
    label: "Partner preferences (age, location)",
    weight: 15,
    href: `${ONBOARD}?step=preferences`,
    cta: "Set preferences",
    done: (i) =>
      Boolean(
        (str(i.profile.prefAgeMin) && str(i.profile.prefAgeMax)) ||
          str(i.profile.prefLocation) ||
          (Array.isArray(i.interests) && i.interests.length > 0)
      ),
  },
  {
    id: "about",
    label: "A short introduction and what you look for",
    weight: 10,
    href: `${ONBOARD}?step=about`,
    cta: "Write intro",
    done: (i) => Boolean(str(i.profile.about) && str(i.profile.lookingFor)),
  },
  {
    id: "family",
    label: "Family and lifestyle details",
    weight: 5,
    href: `${ONBOARD}?step=family`,
    cta: "Add details",
    done: (i) => Boolean(str(i.profile.familyType) || str(i.profile.diet)),
  },
  {
    id: "contact",
    label: "Contact details (shared only on reveal)",
    weight: 5,
    href: `${EDIT}?section=contact`,
    cta: "Add contact",
    done: (i) => Boolean(str(i.profile.phone) || str(i.profile.email)),
  },
  {
    id: "verification",
    label: "Council verification submitted",
    weight: 5,
    href: "/account",
    cta: "Get verified",
    done: (i) => ["pending", "verified"].includes(str(i.profile.verificationStatus).toLowerCase()),
  },
];

export function computeCompleteness(input: CompletenessInput): CompletenessResult {
  const items: CompletenessItem[] = ITEMS.map((def) => ({
    id: def.id,
    label: def.label,
    weight: def.weight,
    href: def.href,
    cta: def.cta,
    done: Boolean(def.done(input)),
  }));

  const total = items.reduce((sum, it) => sum + it.weight, 0) || 1;
  const earned = items.reduce((sum, it) => (it.done ? sum + it.weight : sum), 0);
  const percent = Math.round((earned / total) * 100);

  const missing = items.filter((it) => !it.done).sort((a, b) => b.weight - a.weight);

  // Interactable = identity present AND a real photo. Mirrors the incumbents'
  // rule that photoless profiles are effectively not marketable.
  const identity = items.find((it) => it.id === "identity")?.done ?? false;
  const photo = items.find((it) => it.id === "photo")?.done ?? false;

  return { percent, items, missing, canInteract: Boolean(identity && photo) };
}

/** Threshold below which we nag prominently (platforms typically use 70-80%). */
export const COMPLETENESS_TARGET = 70;

export const needsCompletionPush = (r: CompletenessResult): boolean => r.percent < COMPLETENESS_TARGET;