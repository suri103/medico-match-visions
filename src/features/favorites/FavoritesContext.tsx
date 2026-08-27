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
} from "@/services/api";

export type ConnectionStatus = 'pending' | 'matched' | 'passed' | 'blocked';
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
  sendInterest: (doctor: Doctor) => boolean;
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

  const removeFavorite = useCallback(
    (id: string) => {
      setFavorites((prev) => prev.filter((d) => d.id !== id));
    },
    [setFavorites]
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
  }, [setShortlist]);
  const unshortlistDoctor = useCallback((id: string) => {
    setShortlist(prev => prev.filter(d => d.id !== id));
  }, [setShortlist]);

  const sendInterest = useCallback(
    (doctor: Doctor): boolean => {
      if (blockedIds.includes(doctor.id)) return false;
      // Duplicate check BEFORE consuming quota: a resend must neither burn an
      // interest slot nor double-append (the ledger never refunds).
      if (interests.some((i) => i.doctor.id === doctor.id)) return true;

      // Wired mode: the SERVER is the awaited authority. Its verdict decides
      // both the optimistic UI and the local ledger charge (audit C-3: the old
      // fire-and-forget flow charged local quota even when the durable record
      // never landed). Demo/offline keeps the previous local-only behavior.
      if (hasServerSession()) {
        void (async () => {
          const r = await serverSendInterest(doctor.id);
          // Server-side rejection (quota/profile state): no local mutation at all.
          if (!r.ok && r.error !== "no-server" && r.error !== "network") {
            toast({ title: "Interest not sent", description: r.error || "Please try again.", variant: "destructive" });
            return;
          }
          // Optimistic UI + ledger charge only after an accepted send.
          consumeInterest();
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
          if (r.alreadyInterested) {
            // Reconcile server ids so withdraw/respond can target rows.
            void serverListInterests();
          }
        })().catch(() => {});
        return true;
      }

      // Local/demo mode: quota before mutation (single source = usePlan).
      if (!consumeInterest()) return false;
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
      return true;
    },
    [blockedIds, interests, interestedInYou, setConnections, setInterests, consumeInterest]
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
    if (ownerId) void serverBlockUser(ownerId).catch(() => {});
  }, [setBlockedIds, setConnections, setFavorites, setShortlist, setInterests, setInterestedInYou]);
  const unblockDoctor = useCallback((doctorId: string) => {
    setBlockedIds(prev => prev.filter(id => id !== doctorId));
    setConnections(prev => prev.filter(c => !(c.doctorId === doctorId && c.status === 'blocked')));
    const ownerId = ownerUserIdsRef.current[doctorId];
    if (ownerId) void serverUnblockUser(ownerId).catch(() => {});
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
