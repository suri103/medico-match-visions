import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lock, ShieldCheck, Zap } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { isRazorpayConfigured, razorpayKeyId, openRazorpayCheckout } from '@/lib/razorpay';
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  redeemActivationToken,
  isCheckoutServerConfigured,
  storeActivationToken,
  CheckoutError,
} from '@/services/checkout';
import { refreshLocalPlanFromServer } from '@/services/api';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceName: string;
  amount: number;
  /** Server-side catalog sku (e.g. "premium"). The server validates the amount against its price catalog. */
  sku: string;
  /** Optional plan identifier appended to the success redirect (e.g. "Premium"). */
  plan?: string;
  /** Called after a verified (or clearly-labelled sandbox) payment. Receives the redeemed sku when a server token flow completed. */
  onSuccess?: (sku?: string) => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  serviceName,
  amount,
  sku,
  plan,
  onSuccess,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card'>('upi');
  const razorpayConfigured = isRazorpayConfigured();

  const redirectWithSuccess = () => {
    const origin = window.location.origin;
    const path = window.location.pathname;
    const successParams = new URLSearchParams({ checkout: 'success' });
    if (plan) successParams.set('plan', plan);
    window.location.assign(`${origin}${path}?${successParams.toString()}`);
  };

  // No Razorpay key configured (e.g. local development): run the payment
  // through the checkout server in its simulation mode, so plan activation
  // still flows through a server-issued entitlement token. If no server is
  // configured either, complete locally WITHOUT a token (nothing activates).
  const handleSimulatedPayment = async () => {
    if (!isCheckoutServerConfigured()) {
      // No checkout server at all. This instant-success path must never ship
      // to production: a prod build without VITE_API_BASE_URL would otherwise
      // hand every visitor a free "Pay → Premium activated" flow (H7).
      if (!import.meta.env.DEV) {
        toast({
          title: "Payments unavailable",
          description: "Online payments are not configured. Please contact support.",
          variant: "destructive",
        });
        return;
      }
      setIsProcessing(true);
      setTimeout(() => {
        setIsProcessing(false);
        onClose();
        if (onSuccess) onSuccess();
        else redirectWithSuccess();
      }, 800);
      return;
    }

    setIsProcessing(true);
    try {
      const order = await createRazorpayOrder({
        sku,
        serviceName: `${serviceName} (SANDBOX)`,
        amount,
        currency: 'INR',
      });
      const verification = await verifyRazorpayPayment({
        orderId: order.id,
        paymentId: `pay_sim_${Date.now()}`,
        signature: 'simulated',
        sku,
      });
      if (!verification.verified || !verification.activation) {
        throw new CheckoutError('The sandbox payment could not be verified by the server.');
      }
      onClose();
      // Same contract as the live path below: a failed immediate redemption
      // must persist the PAID token and say so — never drop it silently (C2).
      const purchasedSku = await redeemActivationToken(verification.activation.token);
      if (!purchasedSku) {
        storeActivationToken(verification.activation.token);
        // M-2: try the authoritative /api/quota before alarming the user -
        // verify-time grants usually landed server-side already.
        const recoveredSandbox = await refreshLocalPlanFromServer().catch(() => null);
        if (recoveredSandbox) {
          toast({
            title: 'Purchase activated',
            description: `Your ${recoveredSandbox} membership is active.`,
          });
        } else {
          toast({
            title: 'Activation pending',
            description:
              "Your payment was verified but couldn't be activated right now. Sign in with your account and reopen this page — your purchase stays valid. If it persists, contact support with your payment id.",
            variant: 'destructive',
          });
        }
      }
      if (onSuccess && purchasedSku) onSuccess(purchasedSku);
      else if (!onSuccess) redirectWithSuccess();
    } catch (err) {
      toast({
        title: 'Sandbox payment failed',
        description: err instanceof CheckoutError ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isProcessing) return;

    if (!razorpayConfigured) {
      handleSimulatedPayment();
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Create an order on the server (the KEY SECRET stays server-side).
      const order = await createRazorpayOrder({
        sku,
        serviceName: `${serviceName} (${paymentMethod.toUpperCase()})`,
        amount,
        currency: 'INR',
      });

      if (!order.id) {
        throw new CheckoutError("The payment server did not return an order id.");
      }

      // 2. Open the Razorpay Checkout modal (UPI, Cards, NetBanking, Wallets).
      const payment = await openRazorpayCheckout({
        key: razorpayKeyId,
        amount: order.amount,
        currency: order.currency || 'INR',
        order_id: order.id,
        name: 'MedicoMatch',
        description: serviceName,
        theme: { color: '#0165c6' },
      });

      if (!payment) {
        // User dismissed the modal — treat as cancelled, no charge.
        toast({
          title: "Payment cancelled",
          description: "You closed the payment window — no charges were made.",
        });
        setIsProcessing(false);
        return;
      }

      // 3. Verify the payment signature server-side before granting access.
      const verification = await verifyRazorpayPayment({
        orderId: payment.razorpay_order_id,
        paymentId: payment.razorpay_payment_id,
        signature: payment.razorpay_signature,
        sku,
      });

      if (!verification.verified) {
        toast({
          title: "Payment could not be verified",
          description: "We couldn't confirm your payment. If you were charged, contact support.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // 4. Complete the entitlement: with no redirect to follow, redeem the
      // single-use token here; otherwise store it for the post-redirect
      // useCheckoutResult hook to redeem.
      let purchasedSku: string | null = null;
      if (verification.activation) {
        if (onSuccess) {
          purchasedSku = await redeemActivationToken(verification.activation.token);
          if (!purchasedSku) {
            // Redemption failed HERE (e.g. a demo session has no account to
            // attach the entitlement to, or a transient network error). The
            // PAID token must never be dropped silently (audit C2): persist it
            // so the post-reload flow can redeem it, and tell the user.
            storeActivationToken(verification.activation.token);
            // M-2: the grant usually landed server-side already (verify-time
            // recordCapturedPayment). Refresh the local plan from /api/quota
            // before showing an alarming message.
            const recoveredPlan = await refreshLocalPlanFromServer().catch(() => null);
            if (recoveredPlan) {
              toast({
                title: "Purchase activated",
                description: `Your ${recoveredPlan} membership is active.`,
              });
            } else {
              toast({
                title: "Activation pending",
                description:
                  "Your payment was verified but couldn't be activated right now. Sign in with your account and reopen this page — your purchase stays valid. If it persists, contact support with your payment id.",
                variant: "destructive",
              });
            }
          }
        } else {
          storeActivationToken(verification.activation.token);
        }
      }

      onClose();
      // Audit M8: only tell the caller a plan activated when the server ACTUALLY
      // redeemed it. A verified-but-not-redeemed payment already got a precise
      // "Activation pending" toast above — calling onSuccess(undefined) here made
      // PlanPage believe it was the sandbox and toast a contradictory success.
      if (onSuccess && purchasedSku) {
        onSuccess(purchasedSku);
      } else if (!onSuccess) {
        redirectWithSuccess();
      }
    } catch (err) {
      console.error("Payment start failed:", err);
      toast({
        title: "Payment could not be completed",
        description:
          err instanceof CheckoutError
            ? err.message
            : "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isProcessing) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle>Complete Your Payment</DialogTitle>
          <DialogDescription>
            You're paying for: {serviceName} (₹{amount.toFixed(2)})
            <br />
            <span className="font-semibold text-slate-700">Total (incl. GST): ₹{amount.toFixed(2)}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {razorpayConfigured ? (
              <div className="flex items-start text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <Lock className="mr-2 h-4 w-4 mt-0.5 shrink-0 text-mediblue-600" />
                <span>
                  You'll be taken to a secure <strong>Razorpay</strong> checkout to pay via UPI,
                  Cards, NetBanking, or Wallets. Access is granted only after signature verification.
                </span>
              </div>
            ) : (
              <div className="flex items-start text-xs text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200">
                <Zap className="mr-2 h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                <span>
                  <strong>Sandbox / Test Mode</strong>: Completing this payment will immediately activate your
                  membership and test GST invoice. (Add <code>VITE_RAZORPAY_KEY_ID</code> to enable live India payments.)
                </span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">Select Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('upi')}
                  className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all ${
                    paymentMethod === 'upi'
                      ? 'border-mediblue-600 bg-mediblue-50/50 ring-1 ring-mediblue-600'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-900">UPI / QR Code</span>
                  <span className="text-[11px] text-slate-500">GPay, PhonePe, Paytm</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all ${
                    paymentMethod === 'card'
                      ? 'border-mediblue-600 bg-mediblue-50/50 ring-1 ring-mediblue-600'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-900">Cards / NetBanking</span>
                  <span className="text-[11px] text-slate-500">Credit, Debit & RuPay</span>
                </button>
              </div>
            </div>

            <div className="flex items-start text-xs text-slate-500">
              <Lock className="mr-2 h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {razorpayConfigured
                  ? "Payments are processed by Razorpay (RBI-regulated). Your card and UPI details never touch our servers."
                  : "Razorpay checkout simulator with instant sandbox fulfillment."}
              </span>
            </div>

            <div className="flex items-center text-xs text-slate-500">
              <ShieldCheck className="mr-2 h-4 w-4 shrink-0 text-emerald-600" />
              <span>PCI-DSS compliant, encrypted end-to-end. GST invoice generated automatically.</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={isProcessing}>
              Cancel
            </Button>
            <Button type="submit" disabled={isProcessing} className="bg-mediblue-600 hover:bg-mediblue-700 text-white">
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Processing...
                </>
              ) : (
                `Pay ₹${amount.toFixed(2)}`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;