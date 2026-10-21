/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { Doctor } from "@/features/matches/types";
import { doctorProfiles } from "@/features/matches/data/sampleData";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useAuthSessionKey } from "@/hooks/useAuthSessionKey";
import { usePlan } from "@/hooks/usePlan";
import { demoModeEnabled } from "@/lib/devAuth";
import { localAvatar } from "@/lib/avatar";
import {
  hasServerSession, listInterests as serverListInterests,
  sendInterest as serverSendInterest, withdrawInterest as serverWithdrawInterest,
  respondInterest as serverRespondInterest,
  blockUser as serverBlockUser, unblockUser as serverUnblockUser,
  listFavoriteIds, addFavoriteRemote, removeFavoriteRemote,
  listShortlistIds, addShortlistRemote, removeShortlistRemote,
  listBlockedUsers,
  listMyPhotos,
} from "@/services/api";

export type ConnectionStatus = 'pending' | 'matched' | 'passed' | 'blocked';

/**
 * The outcome of sending an interest.
 *
 * Audit H-6: `sendInterest` used to return a plain `boolean` synchronously
 * while the server call ran in a detached IIFE, so callers toasted success
 * before the server had accepted the send. It now resolves with the real
 * outcome, so a caller can only claim success when the server agreed.
 */
export interface InterestSendResult {
  ok: boolean;
  error: string | null;
}

export interface Connection {
  doctorId: string;
  status: ConnectionStatus;
  updatedAt: string;
}
export type ShortlistId = string;
export interface InterestItem {
  id: string;
  doctor: Doctor;
  note: string;
  createdAt: Date;
}

interface FavoritesContextValue {
  favorites: Doctor[];
  shortlist: Doctor[];
  likedBy: Doctor[];
  interestedInYou: InterestItem[];
  interests: InterestItem[];
  connections: Connection[];
  blockedIds: string[];
  viewedIds: string[];
  isFavorite: (id: string) => boolean;
  isInterestSent: (doctorId: string) => boolean;
  isShortlisted: (id: string) => boolean;
  isMatched: (doctorId: string) => boolean;
  isBlocked: (doctorId: string) => boolean;
  canMessage: (doctorId: string) => boolean;
  canVideoCall: (doctorId: string) => boolean;
  canViewContact: (doctorId: string, quotaLeft: number) => boolean;
  addFavorite: (doctor: Doctor) => void;
  removeFavorite: (id: string) => void;
  toggleFavorite: (doctor: Doctor) => void;
  addFavoriteById: (id: string) => void;
  shortlistDoctor: (doctor: Doctor) => void;
  unshortlistDoctor: (id: string) => void;
  sendInterest: (doctor: Doctor) => Promise<InterestSendResult>;
  withdrawInterest: (doctorId: string) => void;
  passInterest: (id: string) => void;
  likeFromInterested: (id: string) => void;
  blockDoctor: (doctorId: string) => void;
  unblockDoctor: (doctorId: string) => void;
  markViewed: (id: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

// People who have liked your profile. Fabricated engagement is DEMO-ONLY
// content: real users must never be shown invented admirers (audit M2).
const demoLikedBy: Doctor[] = [
  {
    id: "like1",
    name: "James Wilson",
    age: 38,
    specialty: "Orthopedic Surgeon",
    hospital: "Cleveland Clinic",
    city: "Cleveland",
    state: "Ohio",
    country: "United States",
    imageUrl: "https://randomuser.me/api/portraits/men/52.jpg",
    matchPercentage: 87,
    interests: ["Sports Medicine", "Running", "Jazz"],
    isOnline: false,
    sexualOrientation: "Straight",
  },
  {
    id: "like2",
    name: "Emily Rodriguez",
    age: 34,
    specialty: "Dermatologist",
    hospital: "Massachusetts General Hospital",
    city: "Boston",
    state: "Massachusetts",
    country: "United States",
    imageUrl: "https://randomuser.me/api/portraits/women/28.jpg",
    matchPercentage: 91,
    interests: ["Cosmetic Procedures", "Travel", "Cooking"],
    isOnline: true,
    sexualOrientation: "Lesbian",
  },
];
const seedLikedBy: Doctor[] = demoModeEnabled ? demoLikedBy : [];

const seedInterestDoctors = doctorProfiles.filter((d) =>
  ["2", "4", "6", "8"].includes(d.id)
);

const seedInterested: InterestItem[] = demoModeEnabled
  ? seedInterestDoctors.map((doctor, i) => ({
      id: `int${i + 1}`,
      doctor,
      note:
        ["Showed interest 2 hours ago", "Sent you a like yesterday", "Viewed your profile 3 times", "Wants to connect with you"][i] ||
        "Showed interest in your profile",
      createdAt: new Date(),
    }))
  : [];

// People YOU have shown interest in (seeded so the My Interests page has
// content before the user likes anyone) — demo builds only.
const demoMyInterests: InterestItem[] = doctorProfiles
  .filter((d) => ["1", "3", "7"].includes(d.id))
  .map((doctor, i) => ({
    id: `myint${i + 1}`,
    doctor,
    note: "You showed interest in this profile",
    createdAt: new Date(),
  }));
const seedMyInterests: InterestItem[] = demoModeEnabled ? demoMyInterests : [];

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { consumeInterest } = usePlan();

  const [favorites, setFavorites] = usePersistedState<Doctor[]>("mm:favorites", []);
  const [shortlist, setShortlist] = usePersistedState<Doctor[]>("mm:shortlist", []);
  const [likedBy, _setLikedBy] = usePersistedState<Doctor[]>("mm:likedBy", seedLikedBy);
  const [interestedInYou, setInterestedInYou] = usePersistedState<InterestItem[]>(
    "mm:interestedInYou",
    seedInterested
  );
  const [interests, setInterests] = usePersistedState<InterestItem[]>(
    "mm:interests",
    seedMyInterests
  );
  const [connections, setConnections] = usePersistedState<Connection[]>("mm:connections", []);
  const [blockedIds, setBlockedIds] = usePersistedState<string[]>("mm:blockedIds", []);
  const [viewedIds, setViewedIds] = usePersistedState<string[]>("mm:viewedIds", []);

  // ---- Wired backend sync (real accounts against a DB-backed server) ----
  // Local state remains the immediate UI source (works offline/demo); the
  // server is the durable record. Server ids are kept in refs so mutations
  // can target the right interest rows.
  const sentServerIdsRef = useRef<Record<string, string>>({});
  // Audit H7: the "does this member have a real photo?" answer from the SERVER
  // gallery. null = not hydrated yet (unknown), true/false = known.
  const hasServerPhotoRef = useRef<boolean | null>(null);
  const recvServerIdsRef = useRef<Record<string, string>>({});
  const ownerUserIdsRef = useRef<Record<string, string>>({});

  // Audit H6: key server sync on the session identity. Account switches that
  // happen WITHOUT a full reload (sign-in after sign-out in the same tab) must
  // never leak one user's server-id mappings into another's actions.
  const sessionKey = useAuthSessionKey();
  const prevSessionKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevSessionKeyRef.current !== sessionKey) {
      prevSessionKeyRef.current = sessionKey;
      sentServerIdsRef.current = {};
      recvServerIdsRef.current = {};
      ownerUserIdsRef.current = {};
    }
  }, [sessionKey]);

  // M-9: hydrate favorites from the durable store once per session, then
  // mirror mutations. Local state remains the immediate UI source.
  useEffect(() => {
    if (!hasServerSession()) return;
    let cancelled = false;
    listFavoriteIds().then((ids) => {
      if (!ids || cancelled || ids.length === 0) return;
      setFavorites((prev) => {
        const have = new Set(prev.map((x) => x.id));
        const merged = prev.map((d) => ({ ...d }));
        for (const id of ids) {
          if (have.has(id)) continue;
          // Details resolve lazily: sample pool first, otherwise an id-only
          // stub that renders with fallbacks until the profile is browsed.
          const doc = doctorProfiles.find((x) => x.id === id);
          merged.push((doc ? { ...doc } : { id, name: `Profile ${id}`, age: 0, specialty: "", degree: "", hospital: "", city: "", state: "", country: "India", imageUrl: localAvatar(`Profile ${id}`), matchPercentage: 0, interests: [], isOnline: false, sexualOrientation: "Straight" }) as Doctor);
        }
        return merged;
      });
    }).catch(() => {});

    listShortlistIds().then((ids) => {
      if (!ids || cancelled || ids.length === 0) return;
      setShortlist((prev) => {
        const have = new Set(prev.map((x) => x.id));
        const merged = prev.map((d) => ({ ...d }));
        for (const id of ids) {
          if (have.has(id)) continue;
          const doc = doctorProfiles.find((x) => x.id === id);
          merged.push((doc ? { ...doc } : { id, name: `Profile ${id}`, age: 0, specialty: "", degree: "", hospital: "", city: "", state: "", country: "India", imageUrl: localAvatar(`Profile ${id}`), matchPercentage: 0, interests: [], isOnline: false, sexualOrientation: "Straight" }) as Doctor);
        }
        return merged;
      });
    }).catch(() => {});

    listBlockedUsers().then((blocked) => {
      if (!blocked || cancelled || blocked.length === 0) return;
      setBlockedIds((prev) => {
        const merged = new Set([...prev, ...blocked.map((b) => b.id)]);
        return Array.from(merged);
      });
    }).catch(() => {});

    // Audit H7: cache the authoritative "has a real photo" answer. mm:profilePhotos
    // is only written when the member opens /profile/edit, so the interest gate
    // below used to refuse a fully-curated member on any fresh device.
    listMyPhotos().then((photos) => {
      if (cancelled) return;
      hasServerPhotoRef.current = photos.some(
        (p) => Boolean((p?.url || '').trim()) && !String(p.url).startsWith('data:image/svg')
      );
    }).catch(() => { /* leave unknown — the gate falls back to localStorage */ });

    (async () => {
      const data = await serverListInterests();
      if (!data || cancelled) return;
      const slimToDoctor = (p: {
        id: string; name: string; age?: number | null; specialty?: string | null;
        city?: string | null; imageUrl?: string | null;
      }): Doctor => ({
        id: p.id,
        name: String(p.name || "").replace(/^Dr\.\s*/i, ""),
        age: p.age ?? 30,
        specialty: p.specialty || "Physician",
        hospital: "",
        city: p.city || "",
        state: "",
        country: "India",
        imageUrl: p.imageUrl || localAvatar(String(p.name || "")),
        matchPercentage: 80,
        interests: [],
        isOnline: false,
        sexualOrientation: "Straight",
      });
      setConnections((prev) => {
        const map = new Map(prev.map((c) => [c.doctorId, c]));
        for (const m of data.matched) {
          if ((m.profile as { ownerUserId?: string }).ownerUserId) {
            ownerUserIdsRef.current[m.profile.id] = (m.profile as { ownerUserId?: string }).ownerUserId!;
          }
          map.set(m.profile.id, { doctorId: m.profile.id, status: "matched", updatedAt: m.createdAt });
        }
        return Array.from(map.values());
      });
      setInterests(
        data.sent.map((s) => ({
          id: `srv-${s.id}`,
          doctor: slimToDoctor(s.profile),
          note: s.note || "Interest sent",
          createdAt: new Date(s.createdAt),
        }))
      );
      data.sent.forEach((s) => {
        sentServerIdsRef.current[s.profile.id] = s.id;
        if ((s.profile as { ownerUserId?: string }).ownerUserId) {
          ownerUserIdsRef.current[s.profile.id] = (s.profile as { ownerUserId?: string }).ownerUserId!;
        }
      });
      setInterestedInYou(
        data.received.map((r0) => ({
          id: `srv-${r0.id}`,
          doctor: slimToDoctor(r0.profile),
          note: r0.note || "Showed interest in your profile",
          createdAt: new Date(r0.createdAt),
        }))
      );
      data.received.forEach((r0) => {
        recvServerIdsRef.current[r0.profile.id] = r0.id;
        if ((r0.profile as { ownerUserId?: string }).ownerUserId) {
          ownerUserIdsRef.current[r0.profile.id] = (r0.profile as { ownerUserId?: string }).ownerUserId!;
        }
      });
    })().catch(() => {
      /* offline — demo/local state remains */
    });
    return () => {
      cancelled = true;
    };
    // Refetch whenever the session identity changes so a new account's rows
    // replace the previous one; setters are stable (audit H6).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);

  const isFavorite = useCallback((id: string) => favorites.some((d) => d.id === id), [favorites]);
  const isInterestSent = useCallback((doctorId: string) => {
    return connections.some(c => c.doctorId === doctorId && (c.status === 'pending' || c.status === 'matched')) ||
      interests.some(i => i.doctor.id === doctorId);
  }, [connections, interests]);
  const isShortlisted = useCallback((id: string) => shortlist.some((d) => d.id === id), [shortlist]);
  const isMatched = useCallback((doctorId: string) => connections.some(c => c.doctorId === doctorId && c.status === 'matched'), [connections]);
  const isBlocked = useCallback((doctorId: string) => blockedIds.includes(doctorId), [blockedIds]);
  const canMessage = useCallback((doctorId: string) => connections.some(c => c.doctorId === doctorId && c.status === 'matched'), [connections]);
  const canVideoCall = useCallback((doctorId: string) => connections.some(c => c.doctorId === doctorId && c.status === 'matched'), [connections]);
  const canViewContact = useCallback((doctorId: string, quotaLeft: number) => {
    if (isMatched(doctorId)) return true;
    return quotaLeft > 0;
  }, [isMatched]);

  const addFavorite = useCallback(
    (doctor: Doctor) => {
      setFavorites((prev) =>
        prev.some((d) => d.id === doctor.id) ? prev : [...prev, { ...doctor, isFavorite: true }]
      );
    },
    [setFavorites]
  );

  // Audit H-17: removing a favourite NEVER reached the server — only
  // toggleFavorite called the remote, so the row stayed in the `favorites`
  // table and the hydrate effect (which merges server -> local as a union)
  // brought it straight back on the next mount. The member removed a
  // favourite, was told it was removed, and it reappeared.
  const removeFavorite = useCallback(
    (id: string) => {
      setFavorites((prev) => prev.filter((d) => d.id !== id));
      if (hasServerSession()) {
        queueMicrotask(() => {
          void removeFavoriteRemote(id)
            .then((res) => {
              if (res.ok) return;
              // Roll the local state back — the server still holds the row.
              setFavorites((prev) => {
                const doctor =
                  likedBy.find((d) => d.id === id) || doctorProfiles.find((d) => d.id === id);
                if (!doctor) return prev;
                return prev.some((d) => d.id === id) ? prev : [...prev, { ...doctor, isFavorite: true }];
              });
              toast({
                title: "Could not remove favourite",
                description:
                  res.error || "The change did not reach the server. Please try again.",
                variant: "destructive",
              });
            })
            .catch(() => {
              toast({
                title: "Could not remove favourite",
                description: "The change did not reach the server. Please try again.",
                variant: "destructive",
              });
            });
        });
      }
    },
    [setFavorites, likedBy]
  );

  const toggleFavorite = useCallback(
    (doctor: Doctor) => {
      let nowAdded = false;
      setFavorites((prev) => {
        if (prev.some((d) => d.id === doctor.id)) {
          nowAdded = false;
          return prev.filter((d) => d.id !== doctor.id);
        }
        nowAdded = true;
        return [...prev, { ...doctor, isFavorite: true }];
      });
      // Durable mirror on the wired backend (best-effort; audit M-9).
      if (hasServerSession()) {
        queueMicrotask(() => {
          void (nowAdded ? addFavoriteRemote(doctor.id) : removeFavoriteRemote(doctor.id)).catch(() => {});
        });
      }
    },
    [setFavorites]
  );

  const addFavoriteById = useCallback(
    (id: string) => {
      const doctor = likedBy.find((d) => d.id === id) || doctorProfiles.find((d) => d.id === id);
      if (doctor) addFavorite(doctor);
    },
    [likedBy, addFavorite]
  );

  const shortlistDoctor = useCallback((doctor: Doctor) => {
    setShortlist(prev => prev.some(d => d.id === doctor.id) ? prev : [...prev, doctor]);
    if (hasServerSession()) {
      queueMicrotask(() => {
        void addShortlistRemote(doctor.id).catch(() => {});
      });
    }
  }, [setShortlist]);
  const unshortlistDoctor = useCallback((id: string) => {
    setShortlist(prev => prev.filter(d => d.id !== id));
    if (hasServerSession()) {
      queueMicrotask(() => {
        void removeShortlistRemote(id).catch(() => {});
      });
    }
  }, [setShortlist]);

  const sendInterest = useCallback(
    async (doctor: Doctor): Promise<InterestSendResult> => {
      if (blockedIds.includes(doctor.id)) return { ok: false, error: "You have blocked this profile." };
      // Duplicate check BEFORE consuming quota: a resend must neither burn an
      // interest slot nor double-append (the ledger never refunds).
      if (interests.some((i) => i.doctor.id === doctor.id)) return { ok: true, error: null };

      // Photo gate (onboarding gap-fix #3): a generated initials avatar must
      // never represent a real member on a matrimonial platform. When the
      // sender has no real photo, refuse the interest and send them to the
      // photo step. A soft gate — it never blocks browsing or shortlisting.
      // Audit H7: consult BOTH sources. The local mirror alone blocked curated
      // members on a fresh device/browser (it is only written by /profile/edit),
      // and when the server answer is not in yet we allow the send rather than
      // guess — this is an advisory nudge, not a server rule.
      try {
        const stored = JSON.parse(localStorage.getItem('mm:profilePhotos') || '[]') as Array<{ url?: string }>;
        const localHasReal = stored.some((p) => {
          const u = (p?.url || '').trim();
          return Boolean(u) && !u.startsWith('data:image/svg');
        });
        const serverPhoto = hasServerPhotoRef.current;
        const hasReal = localHasReal || serverPhoto === true;
        if (!hasReal && serverPhoto === false) {
          toast({
            title: 'Add a profile photo first',
            description: 'Profiles without a real photo cannot send interests — photoless profiles are also ranked last in search.',
          });
          window.setTimeout(() => {
            window.location.assign('/onboarding?step=photo');
          }, 600);
          return { ok: false, error: "Add a profile photo before sending an interest." };
        }
      } catch { /* storage unavailable — proceed (server still validates) */ }

      // Wired mode: optimistic UI with server-authoritative reconciliation and
      // rollback (audit C-1: optimistic UI must cleanly rollback on quota/server error).
      if (hasServerSession()) {
        const tempId = `myint${Date.now()}`;
        setConnections(prev => {
          const existing = prev.find(c => c.doctorId === doctor.id);
          if (existing?.status === 'matched' || existing?.status === 'blocked') return prev;
          const theyLikedMe = interestedInYou.some(i => i.doctor.id === doctor.id);
          const nextStatus: ConnectionStatus = theyLikedMe ? 'matched' : 'pending';
          if (existing) return prev.map(c => c.doctorId === doctor.id ? { ...c, status: nextStatus, updatedAt: new Date().toISOString() } : c);
          return [...prev, { doctorId: doctor.id, status: nextStatus, updatedAt: new Date().toISOString() }];
        });
        setInterests(prev => prev.some(i => i.doctor.id === doctor.id) ? prev : [...prev, { id: tempId, doctor, note: "You showed interest in this profile", createdAt: new Date() }]);

        // Audit H-6: the server call is AWAITED and its result is returned.
        // It used to run in a detached IIFE while `sendInterest` returned
        // `true` immediately, so every caller toasted "Interest sent!" BEFORE
        // the server had accepted it — and the member then saw a second,
        // contradictory "Interest not sent" toast when the server rejected the
        // send (quota, the 24h resend cooldown, a block, a 5xx).
        //
        // The rollback + the honest error toast stay here (this is where the
        // optimistic state lives); the caller now toasts SUCCESS only when
        // this resolves ok.
        try {
          const r = await serverSendInterest(doctor.id);
          if (!r.ok) {
            // C-NEW-2: only "ok" guarantees the server recorded the interest.
            // Rollback optimistic state AND do NOT burn the local quota unit
            // (the server may have rejected for quota / auth / never received
            //  the request at all — the local ledger was never a binding
            // counter).
            setConnections(prev => prev.filter(c => c.doctorId !== doctor.id || c.status === 'matched' || c.status === 'blocked'));
            setInterests(prev => prev.filter(i => i.doctor.id !== doctor.id));
            setFavorites(prev => prev.filter(d => d.id !== doctor.id));
            toast({
              title: "Interest not sent",
              description: r.error || "Please try again.",
              variant: "destructive",
            });
            return { ok: false, error: r.error };
          }
          consumeInterest();
          // Audit H8: remember the durable server id so withdrawInterest can
          // actually delete the proposal. Previously the id was discarded and
          // "withdraw" only removed the local row.
          if (r.interestId) {
            sentServerIdsRef.current[doctor.id] = r.interestId;
          }
          if (r.alreadyInterested) {
            // `alreadyInterested` means the server already holds a live proposal
            // for this pair — refresh our id map from the authoritative list
            // instead of throwing the response away.
            void serverListInterests().then((data) => {
              for (const s of data?.sent ?? []) {
                if (s.profile?.id) sentServerIdsRef.current[s.profile.id] = s.id;
              }
            });
          }
          return { ok: true, error: null };
        } catch {
          setConnections(prev => prev.filter(c => c.doctorId !== doctor.id || c.status === 'matched' || c.status === 'blocked'));
          setInterests(prev => prev.filter(i => i.doctor.id !== doctor.id));
          setFavorites(prev => prev.filter(d => d.id !== doctor.id));
          toast({
            title: "Interest not sent",
            description: "We could not reach the server. Please try again.",
            variant: "destructive",
          });
          return { ok: false, error: "network" };
        }
      }

      // Local/demo mode: quota before mutation (single source = usePlan).
      if (!consumeInterest()) return { ok: false, error: "Interest limit reached." };
      setConnections(prev => {
        const existing = prev.find(c => c.doctorId === doctor.id);
        if (existing?.status === 'matched' || existing?.status === 'blocked') return prev;
        const theyLikedMe = interestedInYou.some(i => i.doctor.id === doctor.id);
        const nextStatus: ConnectionStatus = theyLikedMe ? 'matched' : 'pending';
        if (existing) return prev.map(c => c.doctorId === doctor.id ? { ...c, status: nextStatus, updatedAt: new Date().toISOString() } : c);
        return [...prev, { doctorId: doctor.id, status: nextStatus, updatedAt: new Date().toISOString() }];
      });
      setInterests((prev) => {
        if (prev.some((i) => i.doctor.id === doctor.id)) return prev;
        return [...prev, { id: `myint${Date.now()}`, doctor, note: "You showed interest in this profile", createdAt: new Date() }];
      });
      return { ok: true, error: null };
    },
    [blockedIds, interests, interestedInYou, setConnections, setInterests, setFavorites, consumeInterest]
  );

  const withdrawInterest = useCallback(
    (doctorId: string) => {
      setInterests((prev) => prev.filter((i) => i.doctor.id !== doctorId));
      setConnections(prev => prev.filter(c => c.doctorId !== doctorId));
      const serverId = sentServerIdsRef.current[doctorId];
      if (serverId) void serverWithdrawInterest(serverId).catch(() => {});
    },
    [setInterests, setConnections]
  );

  const passInterest = useCallback(
    (id: string) => {
      const item = interestedInYou.find(i => i.id === id);
      if (item) {
        setConnections(prev => {
          if (prev.some(c => c.doctorId === item.doctor.id)) return prev.map(c => c.doctorId === item.doctor.id ? { ...c, status: 'passed' as const, updatedAt: new Date().toISOString() } : c);
          return [...prev, { doctorId: item.doctor.id, status: 'passed' as const, updatedAt: new Date().toISOString() }];
        });
        const serverId = recvServerIdsRef.current[item.doctor.id];
        if (serverId) void serverRespondInterest(serverId, "decline").catch(() => {});
      }
      setInterestedInYou((prev) => prev.filter((i) => i.id !== id));
    },
    [interestedInYou, setConnections, setInterestedInYou]
  );

  const likeFromInterested = useCallback(
    (id: string) => {
      const item = interestedInYou.find((i) => i.id === id);
      if (item) {
        setConnections(prev => {
          const existing = prev.find(c => c.doctorId === item.doctor.id);
          if (existing) return prev.map(c => c.doctorId === item.doctor.id ? { ...c, status: 'matched' as const, updatedAt: new Date().toISOString() } : c);
          return [...prev, { doctorId: item.doctor.id, status: 'matched' as const, updatedAt: new Date().toISOString() }];
        });
        setInterests(prev => prev.some(x => x.doctor.id === item.doctor.id) ? prev : [...prev, { id: `myint${Date.now()}`, doctor: item.doctor, note: "You liked back — it's a match!", createdAt: new Date() }]);
        setFavorites(prev => prev.some(x => x.id === item.doctor.id) ? prev : [...prev, { ...item.doctor, isFavorite: true }]);
        const serverId = recvServerIdsRef.current[item.doctor.id];
        if (serverId) void serverRespondInterest(serverId, "accept").catch(() => {});
      }
      setInterestedInYou((prev) => prev.filter((i) => i.id !== id));
    },
    [interestedInYou, setConnections, setInterests, setInterestedInYou, setFavorites]
  );

  // Audit H-5: a block is a SAFETY action. It used to be fire-and-forget —
  // the local state updated instantly and the server write's result was
  // discarded — so a failed POST left the peer able to browse, view and
  // message the member, and still holding their contact row, while the modal
  // asserted "has been blocked".
  //
  // Now the local state is rolled back and the member is told when the block
  // did not reach the server.
  const blockDoctor = useCallback((doctorId: string) => {
    setBlockedIds(prev => prev.includes(doctorId) ? prev : [...prev, doctorId]);
    setConnections(prev => {
      const existing = prev.find(c => c.doctorId === doctorId);
      if (existing) return prev.map(c => c.doctorId === doctorId ? { ...c, status: 'blocked' as const, updatedAt: new Date().toISOString() } : c);
      return [...prev, { doctorId, status: 'blocked' as const, updatedAt: new Date().toISOString() }];
    });
    setFavorites(prev => prev.filter(d => d.id !== doctorId));
    setShortlist(prev => prev.filter(d => d.id !== doctorId));
    setInterests(prev => prev.filter(i => i.doctor.id !== doctorId));
    setInterestedInYou(prev => prev.filter(i => i.doctor.id !== doctorId));
    const ownerId = ownerUserIdsRef.current[doctorId];
    if (!hasServerSession()) return;
    void serverBlockUser(ownerId || doctorId, doctorId)
      .then((res) => {
        if (res.ok) return;
        setBlockedIds(prev => prev.filter(id => id !== doctorId));
        setConnections(prev => prev.filter(c => !(c.doctorId === doctorId && c.status === 'blocked')));
        toast({
          title: "Could not block this profile",
          description:
            res.error || "The block did not reach the server, so it is NOT active. Please try again.",
          variant: "destructive",
        });
      })
      .catch(() => {
        setBlockedIds(prev => prev.filter(id => id !== doctorId));
        setConnections(prev => prev.filter(c => !(c.doctorId === doctorId && c.status === 'blocked')));
        toast({
          title: "Could not block this profile",
          description: "The block did not reach the server, so it is NOT active. Please try again.",
          variant: "destructive",
        });
      });
  }, [setBlockedIds, setConnections, setFavorites, setShortlist, setInterests, setInterestedInYou]);

  const unblockDoctor = useCallback((doctorId: string) => {
    setBlockedIds(prev => prev.filter(id => id !== doctorId));
    setConnections(prev => prev.filter(c => !(c.doctorId === doctorId && c.status === 'blocked')));
    const ownerId = ownerUserIdsRef.current[doctorId];
    if (!hasServerSession()) return;
    void serverUnblockUser(ownerId || doctorId, doctorId)
      .then((res) => {
        if (res.ok) return;
        setBlockedIds(prev => (prev.includes(doctorId) ? prev : [...prev, doctorId]));
        toast({
          title: "Could not unblock this profile",
          description: res.error || "The change did not reach the server. Please try again.",
          variant: "destructive",
        });
      })
      .catch(() => {
        setBlockedIds(prev => (prev.includes(doctorId) ? prev : [...prev, doctorId]));
        toast({
          title: "Could not unblock this profile",
          description: "The change did not reach the server. Please try again.",
          variant: "destructive",
        });
      });
  }, [setBlockedIds, setConnections]);

  const markViewed = useCallback((id: string) => {
    setViewedIds(prev => prev.includes(id) ? prev : [...prev.slice(-199), id]);
  }, [setViewedIds]);

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        shortlist,
        likedBy,
        interestedInYou,
        interests,
        connections,
        blockedIds,
        viewedIds,
        isFavorite,
        isInterestSent,
        isShortlisted,
        isMatched,
        isBlocked,
        canMessage,
        canVideoCall,
        canViewContact,
        addFavorite,
        removeFavorite,
        toggleFavorite,
        addFavoriteById,
        shortlistDoctor,
        unshortlistDoctor,
        sendInterest,
        withdrawInterest,
        passInterest,
        likeFromInterested,
        blockDoctor,
        unblockDoctor,
        markViewed,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavoritesContext = () => {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error("useFavoritesContext must be used within a <FavoritesProvider>");
  }
  return ctx;
};
