import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useCheckoutResult } from './useCheckoutResult';

// Regression tests for the entitlement trust chain (audit C4):
// a plan may only be activated by redeeming a server-issued token —
// never from ?checkout=success&plan=... URL parameters.

const { redeemMock } = vi.hoisted(() => ({ redeemMock: vi.fn() }));

vi.mock('@/services/checkout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/checkout')>();
  return { ...actual, redeemActivationToken: redeemMock };
});

const Harness = ({ onSuccess }: { onSuccess?: (plan?: string | null) => void }) => {
  useCheckoutResult(onSuccess);
  return null;
};

describe('useCheckoutResult entitlement gating', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    redeemMock.mockReset().mockResolvedValue(null);
  });

  it('never activates a plan from a bare ?checkout=success&plan= URL', async () => {
    const onSuccess = vi.fn();
    render(
      <MemoryRouter initialEntries={['/plan?checkout=success&plan=Platinum']}>
        <Harness onSuccess={onSuccess} />
      </MemoryRouter>
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('does not activate when the token fails to redeem', async () => {
    sessionStorage.setItem('mm:checkoutToken', 'some-token');
    const onSuccess = vi.fn();
    render(
      <MemoryRouter initialEntries={['/plan?checkout=success']}>
        <Harness onSuccess={onSuccess} />
      </MemoryRouter>
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(redeemMock).toHaveBeenCalledWith('some-token');
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('activates the server-returned plan when the token redeems successfully', async () => {
    redeemMock.mockResolvedValue('premium');
    sessionStorage.setItem('mm:checkoutToken', 'valid-token');

    const onSuccess = vi.fn();
    render(
      <MemoryRouter initialEntries={['/plan?checkout=success']}>
        <Harness onSuccess={onSuccess} />
      </MemoryRouter>
    );

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    // The plan comes from the SERVER response, not from the URL.
    expect(onSuccess).toHaveBeenCalledWith('premium');
    // The single-use token is consumed either way.
    expect(sessionStorage.getItem('mm:checkoutToken')).toBeNull();
  });
});
