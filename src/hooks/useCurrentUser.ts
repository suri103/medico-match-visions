import { useAuth } from "@/hooks/useAuth";
import { usePersistedState } from "@/hooks/usePersistedState";
import { EMPTY_PROFILE } from "@/lib/profile";

interface ProfilePhoto {
  id: number;
  url: string;
  isPrimary: boolean;
}

/**
 * The app's view of the current user's identity.
 *
 * Priority:
 *  1. Auth identity (signed-in user — name + photo from the account/session).
 *  2. The stored doctor profile (`mm:profileData` / `mm:profilePhotos`).
 *
 * This keeps the header (and anything else that renders "me") in sync with
 * the profile created/edited on /profile.
 */
export function useCurrentUser() {
  const { user: authUser, isSignedIn } = useAuth();
  const [profile] = usePersistedState("mm:profileData", EMPTY_PROFILE);
  const [photos] = usePersistedState<ProfilePhoto[]>("mm:profilePhotos", []);

  const fullName = (profile.name || authUser?.fullName || "").trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const profileFirstName = nameParts[0] || "";
  const profileLastName = nameParts.slice(1).join(" ");

  const firstName = authUser?.firstName || profileFirstName || null;
  const lastName = authUser?.lastName || profileLastName || null;

  const primaryPhoto = photos.find((p) => p.isPrimary)?.url || photos[0]?.url;
  const imageUrl = authUser?.imageUrl || primaryPhoto || undefined;

  const initials =
    ((firstName?.[0] || "") + (lastName?.[0] || "")).trim().toUpperCase() ||
    "MM";

  return {
    user: { firstName, lastName, imageUrl },
    initials,
    isSignedIn: Boolean(isSignedIn),
  };
}
