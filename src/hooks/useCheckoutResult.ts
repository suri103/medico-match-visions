import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { redeemActivationToken, takeActivationToken } from "@/services/checkout";
import { refreshLocalPlanFromServer } from "@/services/api";

/**
 * Consumes the ?checkout=success|cancelled query param that a checkout flow
 * appends when redirecting back into the app.
 *
 * SECURITY: a successful payment activates a plan ONLY by redeeming a
 * single-use, server-issued entitlement token (stored at verification time in
 * sessionStorage). A bare `?checkout=success&plan=...` URL grants nothing —
 * the query string is never trusted for entitlements, and never toasts a fake
 * "Payment successful" (audit L6).
 *
 * Audit M9: the effect is StrictMode-safe. `processingRef` guarantees the
 * redirect is handled exactly once even under React's dev double-invoke, and
 * the in-flight redemption is never cancelled by effect cleanup — a discarded
 * effect previously consumed the token and silently dropped the redemption.
 */
export const useCheckoutResult = (onSuccess?: (plan?: string) => void) => {
  const [searchParams, setSearchParams] = useSearchParams();
  // Latest callback, readable from the effect without re-subscribing on every
  // render (which would restart the redirect handling).
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const processingTokenRef = useRef(false);

  const clearParams = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("checkout");
    next.delete("plan");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const status = searchParams.get("checkout");
    if (!status) return;

    if (status === "success") {
      // Only the first invocation of a StrictMode double-invoke may proceed.
      if (processingTokenRef.current) return;
      const token = takeActivationToken();
      if (token) {
        processingTokenRef.current = true;
        redeemActivationToken(token)
          .then(async (plan) => {
            processingTokenRef.current = false;
            if (plan) {
              onSuccessRef.current?.(plan);
            } else {
              // M-2: try the authoritative quota endpoint before alarming the
              // user - webhook/verify grants often landed already.
              const recovered = await refreshLocalPlanFromServer().catch(() => null);
              if (recovered) {
                toast({
                  title: "Purchase activated",
                  description: `Your ${recovered} membership is active. (It was verified moments ago.)`,
                });
                onSuccessRef.current?.(recovered);
              } else {
                toast({
                  title: "Activation pending",
                  description:
                    "Your payment was recorded but the activation token could not be redeemed (it may have expired or been used). Please contact support with your payment id.",
                  variant: "destructive",
                });
              }
            }
          })
          .catch(() => {
            processingTokenRef.current = false;
            toast({
              title: "Activation pending",
              description:
                "We couldn't reach the activation service. Your purchase is secure — reopen this page to retry.",
              variant: "destructive",
            });
          })
          .finally(() => clearParams());
        return;
      }
      // No token (e.g. an external success redirect without our flow): never
      // claim success — nothing was activated. Just clear the param (audit L6).
      clearParams();
      return;
    }

    if (status === "cancelled") {
      toast({
        title: "Payment cancelled",
        description: "You cancelled the payment — no charges were made.",
      });
    }
    clearParams();
  }, [searchParams, clearParams]);
};
