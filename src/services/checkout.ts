// Client-side Razorpay checkout API. Orders are created and payment signatures
// are verified on the server (server/src/index.mjs) which holds the KEY SECRET —
// it never ships in the frontend bundle. Point VITE_API_BASE_URL at that server.

// Resolved lazily so tests can stub the env per-case.
const getApiBaseUrl = (): string => (import.meta.env.VITE_API_BASE_URL as string | undefined) || "";

export { getApiBaseUrl };

// Attach the server session token when present, so redeemed entitlements are
// persisted to the signed-in user's account.
const authBearer = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem("mm:authSession");
    const session = raw ? JSON.parse(raw) : null;
    return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
  } catch {
    return {};
  }
};

export interface CreateRazorpayOrderRequest {
  /** Server-side catalog sku, e.g. "premium", "platinum-annual". The server validates the amount against it. */
  sku: string;
  serviceName: string;
  amount: number; // in major currency units, e.g. 1499 for ₹1,499
  currency?: string; // default: "INR"
  receipt?: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrder {
  id: string;
  entity?: string;
  amount: number; // in paise
  amount_paid?: number;
  amount_due?: number;
  currency: string;
  receipt?: string;
  status?: string;
  simulated?: boolean;
}

export interface RazorpayActivation {
  token: string;
  sku: string;
  expiresAt: number;
}

export interface RazorpayVerificationResult {
  verified: boolean;
  simulated?: boolean;
  paymentId?: string;
  activation?: RazorpayActivation;
}

export const isCheckoutServerConfigured = (): boolean => Boolean(getApiBaseUrl());

export class CheckoutError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "CheckoutError";
    this.status = status;
  }
}

const json = async (res: Response) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

/** Create a payment order server-side. */
export const createRazorpayOrder = async (
  payload: CreateRazorpayOrderRequest
): Promise<RazorpayOrder> => {
  if (!getApiBaseUrl()) {
    throw new CheckoutError(
      "Checkout is not configured. Set VITE_API_BASE_URL to your payment server and VITE_RAZORPAY_KEY_ID to your Razorpay key."
    );
  }

  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}/api/razorpay/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authBearer() },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new CheckoutError("Could not reach the payment server. Please try again in a moment.");
  }

  const body = await json(res);
  if (!res.ok) {
    throw new CheckoutError(
      body?.error?.description || body?.error || `Payment could not be started (${res.status}).`,
      res.status
    );
  }
  if (!body?.id) {
    throw new CheckoutError("The payment server did not return an order id.");
  }
  return body as RazorpayOrder;
};

/** Verify a Razorpay payment signature server-side. */
export const verifyRazorpayPayment = async (payload: {
  orderId: string;
  paymentId: string;
  signature: string;
  sku: string;
}): Promise<RazorpayVerificationResult> => {
  if (!getApiBaseUrl()) {
    throw new CheckoutError("Checkout is not configured. Set VITE_API_BASE_URL to your payment server.");
  }

  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}/api/razorpay/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authBearer() },
      body: JSON.stringify({
        razorpay_order_id: payload.orderId,
        razorpay_payment_id: payload.paymentId,
        razorpay_signature: payload.signature,
        sku: payload.sku,
      }),
    });
  } catch {
    throw new CheckoutError("Could not reach the payment server. Please try again in a moment.");
  }

  const body = await json(res);
  if (!res.ok || !body) {
    return { verified: false };
  }
  return body as RazorpayVerificationResult;
};

/**
 * Redeem a single-use entitlement token issued by the payment server after a
 * verified payment. Plans are activated ONLY through this call — never from
 * URL parameters.
 * Resolves with the purchased plan sku, or null if the token was
 * invalid/expired/already used.
 */
export const redeemActivationToken = async (token: string): Promise<string | null> => {
  if (!getApiBaseUrl() || !token) return null;

  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}/api/razorpay/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authBearer() },
      body: JSON.stringify({ token }),
    });
  } catch {
    return null;
  }

  const body = await json(res);
  if (!res.ok || !body || typeof body.plan !== "string") return null;
  return body.plan;
};

export const CHECKOUT_TOKEN_KEY = "mm:checkoutToken";

/** Store the activation token for the post-redirect redemption. */
export const storeActivationToken = (token: string) => {
  try {
    sessionStorage.setItem(CHECKOUT_TOKEN_KEY, token);
  } catch {
    // Storage unavailable — redemption after redirect will not be possible.
  }
};

export const takeActivationToken = (): string | null => {
  try {
    const token = sessionStorage.getItem(CHECKOUT_TOKEN_KEY);
    if (token) sessionStorage.removeItem(CHECKOUT_TOKEN_KEY);
    return token;
  } catch {
    return null;
  }
};