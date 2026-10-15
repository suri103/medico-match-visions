import { describe, it, expect, vi, beforeEach } from 'vitest';

// Unit tests for the wired-backend client: request shaping, Doctor-compatible
// mapping inputs, graceful nulls offline, and quota-error surfacing.

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

// Deterministic "signed in with an API base URL" environment.
vi.mock('@/services/checkout', () => ({
  getApiBaseUrl: () => 'https://api.test',
}));

import {
  browseProfiles,
  sendInterest,
  revealContact,
  listInterests,
  cancelVideoDate,
  hasServerSession,
  sendSupportMessage,
  serverProfileToDoctor,
  blockUser,
  openEventStream,
} from './api';

describe('wired backend client (services/api)', () => {
  beforeEach(() => {
    localStorage.setItem(
      'mm:authSession',
      JSON.stringify({ user: { id: 'u1' }, token: 'tok', signedInAt: new Date().toISOString() })
    );
    fetchMock.mockReset();
  });

  it('hasServerSession is true with token + base url', () => {
    expect(hasServerSession()).toBe(true);
  });

  it('browseProfiles hits /api/profiles with filters and returns rows', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ profiles: [{ id: '9', name: 'Dr. Aditya Sharma', interests: [], isVerified: true, isOnline: true }] }), { status: 200 })
    );
    const rows = await browseProfiles({ city: 'Mumbai', verifiedOnly: true });
    expect(rows).not.toBeNull();
    expect(rows![0].id).toBe('9');
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/profiles');
    expect(url.searchParams.get('city')).toBe('Mumbai');
    expect(url.searchParams.get('verified')).toBe('1');
    // Bearer token attached for the session.
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('returns null on network failure (demo fallback path)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const rows = await browseProfiles();
    expect(rows).toBeNull();
  });

  it('sendInterest surfaces quota errors from the server', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Interest limit reached for your plan.', code: 'quota' }), { status: 429 })
    );
    const out = await sendInterest('7');
    expect(out.ok).toBe(false);
    expect(out.error).toContain('Interest limit');
  });

  it('sendInterest posts profileId + note with bearer auth', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ interestId: 'i1', alreadyInterested: false, plan: 'basic', used: 1, limit: 5 }), { status: 201 })
    );
    const out = await sendInterest('7', 'Hello');
    expect(out.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.test/api/interests');
    expect(JSON.parse(init!.body as string)).toEqual({ profileId: '7', note: 'Hello' });
  });

  it('revealContact returns contact data only via the metered endpoint', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ phone: '+91 90000 00000', email: 'doc@x.in', shared: true, quota: { plan: 'premium', videoDates: { used: 0, limit: 5, left: 5 }, interests: { used: 0, limit: 30, left: 30 }, contactViews: { used: 1, limit: 10, left: 9 }, period: '2026-08' } }), { status: 200 })
    );
    const r = await revealContact('9');
    expect(r.ok).toBe(true);
    expect(r.phone).toContain('+91');
    expect(r.quotaLeft).toBe(9);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.test/api/contact-reveal');
  });

  it('listInterests maps nothing fancy — passthrough of typed payload', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        sent: [{ id: 's1', status: 'pending', note: '', createdAt: '2026-08-22T00:00:00Z', profile: { id: '9', name: 'A' } }],
        received: [], matched: [],
      }), { status: 200 })
    );
    const data = await listInterests();
    expect(data!.sent).toHaveLength(1);
    expect(data!.sent[0].profile.id).toBe('9');
  });

  it('cancelVideoDate returns false when the server rejects', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'not cancellable' }), { status: 404 }));
    expect(await cancelVideoDate('v1')).toBe(false);
  });

  // H1 regression: Shaadi-style advanced filters must reach SQL query params.
  it('browseProfiles forwards religion/caste/gotra/motherTongue/minGunas', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ profiles: [] }), { status: 200 })
    );
    await browseProfiles({ religion: 'Hindu', caste: 'Brahmin', gotra: 'Kashyap', motherTongue: 'Hindi', orientation: 'Straight', ethnicity: 'Asian', minGunas: 18 });
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('religion')).toBe('Hindu');
    expect(url.searchParams.get('caste')).toBe('Brahmin');
    expect(url.searchParams.get('gotra')).toBe('Kashyap');
    expect(url.searchParams.get('motherTongue')).toBe('Hindi');
    expect(url.searchParams.get('orientation')).toBe('Straight');
    expect(url.searchParams.get('ethnicity')).toBe('Asian');
    expect(url.searchParams.get('minGunas')).toBe('18');
  });

  // M6 regression: support inbox posts to the real server endpoint.
  it('sendSupportMessage posts to /api/support', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const r = await sendSupportMessage({ name: 'A', email: 'a@x.in', subject: 'Hi', message: 'Need help with my profile please' });
    expect(r.ok).toBe(true);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.test/api/support');
  });

  it('serverProfileToDoctor preserves userId and structured properties', () => {
    const doc = serverProfileToDoctor({
      id: 'p-1',
      userId: 'u-123',
      name: 'Dr. Priya Sharma',
      isSample: false,
      interests: ['Reading'],
      isOnline: true,
      isVerified: true,
      familyType: 'Nuclear',
      familyStatus: 'Middle Class',
      incomeBand: '25-50L',
      diet: 'Vegetarian',
      careerStage: 'Consultant',
    } as unknown as Parameters<typeof serverProfileToDoctor>[0]);
    expect(doc.id).toBe('p-1');
    expect(doc.userId).toBe('u-123');
    expect(doc.name).toBe('Priya Sharma');
    expect(doc.familyType).toBe('Nuclear');
    expect(doc.familyStatus).toBe('Middle Class');
    expect(doc.incomeBand).toBe('25-50L');
    expect(doc.diet).toBe('Vegetarian');
    expect(doc.careerStage).toBe('Consultant');
  });

  it('blockUser posts userId and profileId to /api/blocks', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ blocked: true }), { status: 200 }));
    const ok = await blockUser('u-456', 'p-789');
    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.test/api/blocks');
    expect(JSON.parse(init!.body as string)).toEqual({ userId: 'u-456', profileId: 'p-789' });
  });

  it('openEventStream connects with credentials include on ticket request', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ticket: 'test-ticket-xyz' }), { status: 200 }));
    const close = openEventStream({});
    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.test/api/events/ticket');
    expect(init?.credentials).toBe('include');
    close();
  });
});