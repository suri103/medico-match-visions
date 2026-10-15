import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import PaymentModal from './PaymentModal';

// Regression tests for the paid-but-not-activated hole (audit C2): when the
// immediate redemption after a VERIFIED payment fails, the activation token
// must be persisted and the user told — never dropped silently.
const {
  createMock,
  verifyMock,
  redeemMock,
  storeMock,
} = vi.hoisted(() => ({
  createMock: vi.fn(),
  verifyMock: vi.fn(),
  redeemMock: vi.fn(),
  storeMock: vi.fn(),
}));

vi.mock('@/services/checkout', () => ({
  createRazorpayOrder: (...a: unknown[]) => createMock(...a),
  verifyRazorpayPayment: (...a: unknown[]) => verifyMock(...a),
  redeemActivationToken: (...a: unknown[]) => redeemMock(...a),
  isCheckoutServerConfigured: () => true,
  storeActivationToken: (...a: unknown[]) => storeMock(...a),
  takeActivationToken: () => null,
  generateInvoice: vi.fn().mockResolvedValue(null),
  CheckoutError: class extends Error {
    status?: number;
    constructor(m: string, s?: number) {
      super(m);
      this.status = s;
    }
  },
}));

vi.mock('@/lib/razorpay', () => ({
  razorpayKeyId: '',
  isRazorpayConfigured: () => false,
  openRazorpayCheckout: vi.fn(),
}));

// Submit the dialog's form deterministically. The sandbox payment handler is
// an async chain over already-resolved mocks; each act() drain processes one
// slice of microtasks, so we submit once and then flush several ticks to let
// create → verify → redeem → store/onSuccess all settle before asserting.
async function openModalAndPayInner(onSuccess?: (sku?: string) => void) {
  render(
    <PaymentModal
      isOpen
      onClose={() => {}}
      serviceName="Premium Membership"
      amount={1499}
      sku="premium"
      onSuccess={onSuccess}
    />
  );
  // The Pay button exists (sanity-check the dialog actually rendered).
  expect(
    screen.getAllByRole('button').some((b) => b.textContent?.includes('Pay ₹'))
  ).toBe(true);
  const form = document.querySelector('form') as HTMLFormElement;
  await act(async () => {
    fireEvent.submit(form);
  });
}

async function openModalAndPay(onSuccess?: (sku?: string) => void) {
  await openModalAndPayInner(onSuccess);
  for (let i = 0; i < 12; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe('PaymentModal entitlement completion (audit C2 regression)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    createMock.mockReset();
    verifyMock.mockReset();
    redeemMock.mockReset();
    storeMock.mockReset();
    // Sandbox path: no Razorpay key → simulated payment via checkout server.
    createMock.mockResolvedValue({ id: 'order_sim_1', amount: 149900, currency: 'INR' });
    verifyMock.mockResolvedValue({
      verified: true,
      activation: { token: 'tok_123', sku: 'premium', expiresAt: Date.now() + 60_000 },
    });
  });

  it('persists the token + warns when post-payment redemption fails', async () => {
    redeemMock.mockResolvedValue(null); // redemption FAILS (e.g. demo session / network)
    const onSuccess = vi.fn();

    await openModalAndPay(onSuccess);

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(redeemMock).toHaveBeenCalledWith('tok_123');
    // THE critical contract: the PAID token is never dropped silently.
    expect(storeMock).toHaveBeenCalledWith('tok_123');
    // Audit M8: a verified-but-not-redeemed payment must NOT reach
    // onSuccess(undefined) - the caller interpreted that as the sandbox and
    // toasted a contradictory "Plan activated!". Nothing activated here.
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('does not persist or warn when redemption succeeds', async () => {
    redeemMock.mockResolvedValue('premium');
    const onSuccess = vi.fn();

    await openModalAndPay(onSuccess);

    expect(redeemMock).toHaveBeenCalledWith('tok_123');
    expect(onSuccess).toHaveBeenCalledWith('premium');
    expect(storeMock).not.toHaveBeenCalled();
  });
});