// Razorpay Checkout integration for Indian payments (INR / UPI / NetBanking / Cards).
//
// The KEY ID is safe to ship in the browser bundle (it is a publishable
// identifier). The KEY SECRET must NEVER leave the server — orders are created
// and signatures verified by the backend (server/src/index.mjs).

export const razorpayKeyId = (import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined) || "";

export const isRazorpayConfigured = (): boolean => Boolean(razorpayKeyId);

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayCheckoutOptions {
  key: string; // publishable key id
  amount: number; // in paise (1 INR = 100 paise)
  currency: string; // e.g. "INR"
  order_id: string; // created server-side
  name?: string;
  description?: string;
  image?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
}

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let checkoutPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (checkoutPromise) return checkoutPromise;
  checkoutPromise = new Promise<void>((resolve, reject) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      checkoutPromise = null; // allow retry on a later attempt
      reject(new Error("Could not load the Razorpay Checkout script. Check your connection."));
    };
    document.head.appendChild(script);
  });
  return checkoutPromise;
}

/**
 * Opens the Razorpay Checkout modal for the given server-created order.
 *
 * Resolves with the payment response once the user completes payment, or
 * `null` if the user dismisses/cancels the modal.
 */
export async function openRazorpayCheckout(
  options: RazorpayCheckoutOptions
): Promise<RazorpayPaymentResponse | null> {
  await loadCheckoutScript();
  const RazorpayCtor = typeof window !== "undefined" ? window.Razorpay : undefined;
  if (!RazorpayCtor) {
    throw new Error("Razorpay Checkout is not available on this device.");
  }

  return new Promise<RazorpayPaymentResponse | null>((resolve) => {
    let settled = false;
    const finish = (result: RazorpayPaymentResponse | null) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const checkout = new RazorpayCtor({
      ...options,
      modal: {
        ondismiss: () => finish(null),
        ...(options as unknown as { modal?: object }).modal,
      },
      handler: (response: RazorpayPaymentResponse) => finish(response),
    });
    checkout.open();
  });
}