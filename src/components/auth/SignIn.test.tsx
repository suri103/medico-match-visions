import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { MemoryRouter } from 'react-router-dom';
import SignIn from './SignIn';

// Hoisted mocks — the demo flag is mutable per-test so we can simulate both a
// production build (demoModeEnabled=false) and a dev build.
const { demoFlag, loginMock, configuredMock, serverMeMock } = vi.hoisted(() => ({
  demoFlag: { value: false },
  loginMock: vi.fn(),
  configuredMock: vi.fn(),
  serverMeMock: vi.fn().mockResolvedValue({ valid: true, source: 'network' as const }),
}));

vi.mock('@/lib/devAuth', () => ({
  devAuthBypass: false,
  get demoModeEnabled() {
    return demoFlag.value;
  },
}));

vi.mock('@/services/auth', () => ({
  isAuthServerConfigured: () => configuredMock(),
  loginWithServer: (...args: unknown[]) => loginMock(...args),
  forgotPassword: vi.fn(),
  serverMe: (...args: unknown[]) => serverMeMock(...args),
}));

const renderSignIn = () =>
  render(
    <MemoryRouter initialEntries={['/sign-in']}>
      <SignIn />
    </MemoryRouter>
  );

// Submit the login form deterministically: drive the CONTROLLED inputs through
// React (fireEvent.change), then fire submit inside act so every awaited
// promise in handleLogin settles before we assert.
const submitCredentials = async () => {
  const emailInput = document.querySelector('#email') as HTMLInputElement;
  const passwordInput = document.querySelector('#password') as HTMLInputElement;
  const form = emailInput.closest('form') as HTMLFormElement;

  await act(async () => {
    fireEvent.change(emailInput, { target: { value: 'doctor@hospital.in' } });
    fireEvent.change(passwordInput, { target: { value: 'Whatever@123' } });
  });
  await act(async () => {
    fireEvent.submit(form);
  });
};

// Drain any remaining awaited-mock ticks before asserting.
async function flushAsync(times = 8) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe('SignIn offline behaviour (audits H2/H3 regression)', () => {
  beforeEach(() => {
    localStorage.clear();
    loginMock.mockReset();
    configuredMock.mockReset();
  });

  it('FAILS CLOSED in production mode: unreachable server never creates a session', async () => {
    demoFlag.value = false; // production build
    configuredMock.mockReturnValue(true);
    loginMock.mockResolvedValue({ ok: false, status: 0, error: 'Could not reach the server.' });

    renderSignIn();
    await submitCredentials();
    await flushAsync();

    expect(loginMock).toHaveBeenCalledWith('doctor@hospital.in', 'Whatever@123');
    // No fallback session may exist in a production build. NOTE: the storage
    // layer writes JSON.stringify(null) ("null") rather than deleting the key,
    // so assert on the parsed session's USER, not key absence.
    const storedRaw = localStorage.getItem('mm:authSession');
    const storedSession = storedRaw ? JSON.parse(storedRaw) : null;
    expect(storedSession?.user ?? null).toBeNull();
  });

  it('demo fallback still exists in development builds', async () => {
    demoFlag.value = true; // dev build
    configuredMock.mockReturnValue(true);
    loginMock.mockResolvedValue({ ok: false, status: 0, error: 'Could not reach the server.' });

    renderSignIn();
    await submitCredentials();
    await flushAsync();

    expect(loginMock).toHaveBeenCalledWith('doctor@hospital.in', 'Whatever@123');
    const raw = localStorage.getItem('mm:authSession');
    expect(raw).not.toBeNull();
    const session = JSON.parse(raw!) as { user?: { email?: string }; token?: string };
    expect(session.user?.email).toBe('doctor@hospital.in');
    // Fallback sessions carry NO server token.
    expect(session.token).toBeUndefined();
  });

  it('wrong credentials on a reachable server never create a session', async () => {
    demoFlag.value = true;
    configuredMock.mockReturnValue(true);
    loginMock.mockResolvedValue({ ok: false, status: 401 });

    renderSignIn();
    await submitCredentials();
    await flushAsync();

    expect(loginMock).toHaveBeenCalledTimes(1);
    const storedRaw = localStorage.getItem('mm:authSession');
    const storedSession = storedRaw ? JSON.parse(storedRaw) : null;
    expect(storedSession?.user ?? null).toBeNull();
  });

  it('cookie-first login succeeds without a Bearer token in the body (H-1)', async () => {
    demoFlag.value = false;
    configuredMock.mockReturnValue(true);
    // Browser login: server sets httpOnly cookie, body token is null.
    loginMock.mockResolvedValue({ ok: true, status: 200, token: null, user: { id: 'u1', email: 'doctor@hospital.in', firstName: 'Doc' } });

    renderSignIn();
    await submitCredentials();
    await flushAsync();

    const raw = localStorage.getItem('mm:authSession');
    expect(raw).not.toBeNull();
    const session = JSON.parse(raw!) as { user?: { email?: string }; token?: string };
    expect(session.user?.email).toBe('doctor@hospital.in');
    // No Bearer copy may be persisted for the cookie-first web flow.
    expect(session.token).toBeUndefined();
  });
});