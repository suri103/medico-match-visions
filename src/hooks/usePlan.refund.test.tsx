import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlan } from './usePlan';

// Regression coverage for video-date quota accounting (audit M1):
// consumption must be finite and cancellation must refund the slot.
//
// NOTE: usePlan derives `videoDatesLeft`/`usedThisMonth` during render by
// reading the ledger directly, so tests call rerender() after each mutation
// to refresh the derived values (exactly what a real component re-render does).
describe('usePlan video-date ledger', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('basic plan gets exactly 1 video date and blocks the second', () => {
    const { result } = renderHook(() => usePlan());
    expect(result.current.quota).toBe(1); // basic plan default

    let first = false;
    let second = false;
    act(() => {
      first = result.current.consumeVideoDate();
    });
    act(() => {
      second = result.current.consumeVideoDate();
    });
    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('refundVideoDate restores a cancelled slot and never goes negative', () => {
    const { result, rerender } = renderHook(() => usePlan());

    act(() => {
      result.current.consumeVideoDate();
    });
    rerender();
    expect(result.current.videoDatesLeft).toBe(0);

    // Cancelling refunds exactly one slot.
    act(() => {
      result.current.refundVideoDate();
    });
    rerender();
    expect(result.current.videoDatesLeft).toBe(1);

    // Refunding with nothing consumed must not create phantom quota.
    act(() => {
      result.current.refundVideoDate();
      result.current.refundVideoDate();
    });
    rerender();
    expect(result.current.videoDatesLeft).toBe(1);
    expect(result.current.usedThisMonth).toBe(0);

    // The refunded slot is actually usable again.
    let usable = false;
    act(() => {
      usable = result.current.consumeVideoDate();
    });
    expect(usable).toBe(true);
  });
});