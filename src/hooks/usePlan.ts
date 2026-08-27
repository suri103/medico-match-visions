import { usePersistedState } from "@/hooks/usePersistedState";

export type PlanName = "basic" | "premium" | "platinum";

interface ActivePlan {
  name: PlanName;
  activatedAt: string; // ISO date
}

export type GatedFeature = "seeWhoLikedYou" | "advancedFilters";

// Quotas per plan per month.
const VIDEO_DATE_QUOTAS: Record<PlanName, number> = {
  basic: 1,
  premium: 5,
  platinum: Infinity,
};
const INTEREST_QUOTAS: Record<PlanName, number> = {
  basic: 5,
  premium: 30,
  platinum: Infinity,
};
const CONTACT_VIEW_QUOTAS: Record<PlanName, number> = {
  basic: 2,
  premium: 10,
  platinum: Infinity,
};

// Local-time month key (not UTC): quotas reset on the user's calendar month.
const monthKeyOf = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

// Rank each plan for easy comparison.
const PLAN_RANK: Record<PlanName, number> = { basic: 0, premium: 1, platinum: 2 };

// Minimum plan required to unlock each gated feature.
const FEATURE_MIN_PLAN: Record<GatedFeature, PlanName> = {
  seeWhoLikedYou: "premium",
  advancedFilters: "premium",
};

const VIDEO_DATES_KEY = "mm:videoDatesUsed";
const INTEREST_LEDGER_KEY = "mm:interestLedger";
const CONTACT_VIEWS_KEY = "mm:contactViewsByMonth";

/**
 * Atomic (synchronous) check-and-consume against a `{ "YYYY-MM": count }`
 * ledger in localStorage. The read-modify-write happens within one tick, so
 * two rapid calls can never both pass the quota check (audit H4), and it
 * fails CLOSED when storage is unavailable.
 */
const consumeFromLedger = (key: string, monthKey: string, quota: number): boolean => {
  if (quota === Infinity) return true;
  try {
    const raw = localStorage.getItem(key);
    const ledger: Record<string, number> = raw ? JSON.parse(raw) : {};
    const used = Number(ledger[monthKey]) || 0;
    if (used >= quota) return false;
    ledger[monthKey] = used + 1;
    // Drop stale months so the ledger never grows unbounded.
    for (const k of Object.keys(ledger)) {
      if (k !== monthKey) delete ledger[k];
    }
    localStorage.setItem(key, JSON.stringify(ledger));
    window.dispatchEvent(
      new CustomEvent("mm:persisted-state-changed", { detail: { key } })
    );
    return true;
  } catch {
    return false;
  }
};

const readLedger = (key: string, monthKey: string): number => {
  try {
    const raw = localStorage.getItem(key);
    const ledger = raw ? JSON.parse(raw) : {};
    return Number(ledger[monthKey]) || 0;
  } catch {
    return 0;
  }
};

export const usePlan = () => {
  const [activePlan, setActivePlan] = usePersistedState<ActivePlan | null>(
    "mm:activePlan",
    null
  );

  const planName: PlanName = activePlan?.name ?? "basic";

  // Unlock features according to the plan required by each gated feature.
  const canUse = (feature: GatedFeature): boolean =>
    PLAN_RANK[planName] >= PLAN_RANK[FEATURE_MIN_PLAN[feature]];

  const activate = (name: PlanName) => {
    setActivePlan({ name, activatedAt: new Date().toISOString() });
  };

  const monthKey = monthKeyOf();
  const quota = VIDEO_DATE_QUOTAS[planName];
  const usedThisMonth = readLedger(VIDEO_DATES_KEY, monthKey);
  const videoDatesLeft =
    quota === Infinity ? Infinity : Math.max(0, quota - usedThisMonth);

  const consumeVideoDate = (): boolean =>
    consumeFromLedger(VIDEO_DATES_KEY, monthKey, quota);

  // Refund one video-date slot from this month's ledger — used when cancelling
  // an upcoming scheduled date before it happens (product default: a cancelled
  // date does not spend quota). Clamped at zero, same ledger as consumption.
  const refundVideoDate = (): void => {
    if (quota === Infinity) return;
    try {
      const raw = localStorage.getItem(VIDEO_DATES_KEY);
      const ledger: Record<string, number> = raw ? JSON.parse(raw) : {};
      const used = Number(ledger[monthKey]) || 0;
      ledger[monthKey] = Math.max(0, used - 1);
      // Drop stale months so the ledger never grows unbounded.
      for (const k of Object.keys(ledger)) {
        if (k !== monthKey) delete ledger[k];
      }
      localStorage.setItem(VIDEO_DATES_KEY, JSON.stringify(ledger));
      window.dispatchEvent(
        new CustomEvent("mm:persisted-state-changed", { detail: { key: VIDEO_DATES_KEY } })
      );
    } catch {
      // Storage unavailable — nothing to refund.
    }
  };

  // Interests are metered on a dedicated ledger that is only ever
  // incremented: withdrawing an interest does NOT refund the monthly quota
  // (send → withdraw → resend could otherwise bypass the cap entirely).
  const consumeInterest = (): boolean =>
    consumeFromLedger(INTEREST_LEDGER_KEY, monthKey, INTEREST_QUOTAS[planName]);

  const interestQuota = INTEREST_QUOTAS[planName];
  const interestsUsed = readLedger(INTEREST_LEDGER_KEY, monthKey);
  const interestLeft =
    interestQuota === Infinity ? Infinity : Math.max(0, interestQuota - interestsUsed);

  const contactQuota = CONTACT_VIEW_QUOTAS[planName];
  const contactUsed = readLedger(CONTACT_VIEWS_KEY, monthKey);
  const contactLeft =
    contactQuota === Infinity ? Infinity : Math.max(0, contactQuota - contactUsed);
  const consumeContactView = (): boolean =>
    consumeFromLedger(CONTACT_VIEWS_KEY, monthKey, contactQuota);

  const isPremium = planName === 'premium' || planName === 'platinum';
  const isPlatinum = planName === 'platinum';

  return {
    planName,
    isPremium,
    isPlatinum,
    canUse,
    activate,
    quota,
    usedThisMonth,
    videoDatesLeft,
    consumeVideoDate,
    refundVideoDate,
    interestQuota,
    interestsUsed,
    interestLeft,
    consumeInterest,
    contactQuota,
    contactUsed,
    contactLeft,
    consumeContactView,
  };
};
