// Minimal typings for the Razorpay Checkout script (loaded at runtime from
// https://checkout.razorpay.com/v1/checkout.js). See src/lib/razorpay.ts.

import type { RazorpayCheckoutOptions, RazorpayPaymentResponse } from "@/lib/razorpay";

export {};

declare global {
  interface Window {
    /** Set by the Razorpay Checkout script once it has loaded. */
    Razorpay?: new (options: RazorpayCheckoutOptions) => {
      open: () => void;
      close?: () => void;
    };
  }
}

declare module "@/lib/razorpay" {
  interface RazorpayCheckoutOptions {
    handler?: (response: RazorpayPaymentResponse) => void;
    modal?: { ondismiss?: () => void };
  }
}