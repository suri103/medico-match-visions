import { describe, it, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import React from 'react';
import { usePersistedState } from './usePersistedState';

// The sign-out purge broadcasts key "*" after removing every mm:* entry.
// Mounted consumers MUST reset to their initial value — otherwise stale
// cross-account state lingers in memory and gets re-persisted by the next
// mutation on a shared device (audit M6).
const PURGE_EVENT = 'mm:persisted-state-changed';

const purgeAll = () => {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('mm:')) keys.push(k);
  }
  for (const k of keys) localStorage.removeItem(k);
  window.dispatchEvent(new CustomEvent(PURGE_EVENT, { detail: { key: '*' } }));
};

let renderCount = 0;
const Harness: React.FC = () => {
  const [value, setValue] = usePersistedState<{ name: string }[]>('mm:favorites', []);
  renderCount += 1;
  return (
    <div>
      <div data-testid="count">{value.length}</div>
      <button onClick={() => setValue([{ name: `doc-${renderCount}` }])}>add</button>
    </div>
  );
};

describe('usePersistedState purge semantics (audit M6 regression)', () => {
  beforeEach(() => {
    localStorage.clear();
    renderCount = 0;
  });

  it('resets mounted consumers to the initial value when the key is purged', () => {
    render(<Harness />);
    expect(screen.getByTestId('count').textContent).toBe('0');

    // User A favourites someone.
    act(() => {
      screen.getByText('add').click();
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(JSON.parse(localStorage.getItem('mm:favorites')!)).toHaveLength(1);

    // Sign-out wipes storage and broadcasts the purge.
    act(() => {
      purgeAll();
    });
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('a post-purge mutation does NOT resurrect the previous account’s data', () => {
    render(<Harness />);
    act(() => screen.getByText('add').click());
    act(() => purgeAll());

    // User B (next sign-in) triggers any mutation on the same key.
    act(() => screen.getByText('add').click());
    const stored = JSON.parse(localStorage.getItem('mm:favorites')!) as { name: string }[];
    expect(stored).toHaveLength(1);
    // Only the fresh entry — nothing carried over from the previous account.
    expect(stored.every((x) => x.name.startsWith('doc-'))).toBe(true);
  });
});