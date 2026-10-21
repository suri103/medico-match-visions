import { useCallback, useEffect, useState } from 'react';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  adminMe, adminStats, listAdminReports, resolveAdminReport,
  listAdminUsers, setUserSuspended,
  listAdminProfiles, patchAdminProfile,
  listAdminPayments, adminRefund,
  promoteAdmin, demoteAdmin,
  listAuditLog, setSamplesHidden,
  listVerifications, reviewVerification, warnAdminUser,
  triggerRenewalReminders,
  type VerificationDocRow, type AdminStats,
  type AdminReport, type AdminUserRow, type AdminProfileRow, type AdminPaymentRow,
} from '@/services/api';
import ErrorState from '@/components/ErrorState';

type Tab = 'dashboard' | 'reports' | 'users' | 'profiles' | 'payments' | 'audit' | 'trust';

/**
 * Admin & moderation console (/admin).
 * Access requires a session whose account is flagged is_admin on the server
 * (bootstrap via the ADMIN_EMAILS env var). Non-admins see a plain notice —
 * no data is fetched or rendered for them.
 */
const AdminPage = () => {
  const { toast } = useToast();
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRoot, setIsRoot] = useState(false);
  // Launch-gap fix #3: dashboard is the default tab (most valuable at a glance).
  const [tab, setTab] = useState<Tab>('dashboard');

  // Dashboard counts (launch-gap fix #3).
  const [stats, setStats] = useState<AdminStats | null>(null);

  const loadStats = useCallback(async () => {
    setStats(await adminStats());
  }, []);

  const [reports, setReports] = useState<AdminReport[]>([]);
  const [reportStatus, setReportStatus] = useState<'open' | 'resolved' | 'all'>('open');
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [profiles, setProfiles] = useState<AdminProfileRow[]>([]);
  const [profileQuery, setProfileQuery] = useState('');
  const [payments, setPayments] = useState<AdminPaymentRow[]>([]);
  const [audit, setAudit] = useState<{ id: string; adminEmail: string; action: string; target: string; details: string; createdAt: string }[]>([]);
  // P0-2/P0-8 trust queue.
  const [docs, setDocs] = useState<VerificationDocRow[]>([]);

  const loadReports = useCallback(async (status: typeof reportStatus) => {
    setReports((await listAdminReports(status === 'all' ? 'all' : status)) ?? []);
  }, []);
  const loadUsers = useCallback(async (q?: string) => {
    setUsers((await listAdminUsers(q ?? '')) ?? []);
  }, []);
  const loadProfiles = useCallback(async (q?: string) => {
    setProfiles((await listAdminProfiles(q ?? '')) ?? []);
  }, []);
  const loadPayments = useCallback(async () => {
    setPayments((await listAdminPayments()) ?? []);
  }, []);

  useEffect(() => {
    void (async () => {
      const me = await adminMe();
      if (me?.admin) {
        setIsAdmin(true);
        setIsRoot(Boolean((me as { root?: boolean }).root));
      }
      setChecked(true);
    })();
  }, []);

  // Fetch on tab/status change only — NOT on every keystroke. userQuery /
  // profileQuery update onChange; explicit Search buttons / Enter call the
  // loaders. Previously each keystroke fired a fetch with no debounce/cancel.
  useEffect(() => {
    if (!isAdmin) return;
    if (tab === 'dashboard') void loadStats();
    if (tab === 'reports') void loadReports(reportStatus);
    if (tab === 'users') void loadUsers();
    if (tab === 'profiles') void loadProfiles();
    if (tab === 'payments') void loadPayments();
    if (tab === 'audit') void listAuditLog().then((rows) => setAudit(rows ?? []));
    if (tab === 'trust') void listVerifications('pending').then((rows) => setDocs(rows ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, tab, reportStatus]);

  const act = async (
    fn: () => Promise<{ ok: boolean; error: string | null }>,
    reload: () => void,
    label: string
  ) => {
    const r = await fn();
    if (r.ok) {
      toast({ title: label, description: 'Done.' });
      reload();
    } else {
      toast({ title: `${label} failed`, description: r.error || undefined, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">Admin Console</h1>
          <p className="text-slate-500 text-sm mb-6">Moderation, verification and billing operations. Every action here is audit-logged.</p>

          {!checked ? (
            <p className="text-slate-500 text-sm">Checking access…</p>
          ) : !isAdmin ? (
            // Launch-gap fix #6: the 403-forbidden state is a reusable component
            // (also used for expired sessions and failed fetches), not ad-hoc text.
            <ErrorState
              variant="forbidden"
              title="Access denied"
              description="This console is restricted to administrators. Ask an operator to add your account email to the server's ADMIN_EMAILS list."
              actionLabel="Back to home"
              actionTo="/"
            />
          ) : (
            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
              <TabsList>
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="reports">Reports</TabsTrigger>
                <TabsTrigger value="users">Users</TabsTrigger>
                <TabsTrigger value="profiles">Profiles</TabsTrigger>
                <TabsTrigger value="payments">Payments</TabsTrigger>
                <TabsTrigger value="audit">Audit log</TabsTrigger>
                <TabsTrigger value="trust">Trust & safety</TabsTrigger>
              </TabsList>
              {/* Dashboard — launch-gap fix #3: the overview that matters most. */}
              <TabsContent value="dashboard" className="mt-4 space-y-3">
                {!stats ? (
                  <p className="text-sm text-slate-500">Loading stats…</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {([
                        ["Total users", stats.total_users],
                        ["New (30 days)", stats.new_users_30d],
                        ["Verified doctors", stats.verified_doctors],
                        ["Pending verifications", stats.pending_verifications],
                        ["Active memberships", stats.active_memberships],
                        ["Open reports", stats.open_reports],
                        ["Interests sent", stats.interests_sent],
                        ["Failed payments", stats.failed_payments],
                        ["Refunds", stats.refunds],
                      ] as [string, number][]).map(([label, value]) => (
                        <Card key={label}>
                          <CardContent className="p-4">
                            <p className="text-2xl font-bold text-slate-900">{value ?? 0}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    {(stats.open_reports > 0 || stats.pending_verifications > 0) && (
                      <Card className="border-amber-200 bg-amber-50">
                        <CardContent className="p-3 text-xs text-amber-900">
                          Needs attention: {stats.open_reports} open report{stats.open_reports === 1 ? '' : 's'} and {stats.pending_verifications} pending verification{stats.pending_verifications === 1 ? '' : 's'}.
                          <span className="ml-2">
                            <Button size="sm" variant="outline" onClick={() => setTab('reports')}>Review reports</Button>
                            <Button size="sm" variant="outline" className="ml-2" onClick={() => setTab('trust')}>Review verifications</Button>
                          </span>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </TabsContent>
              {/* Reports */}
              <TabsContent value="reports" className="mt-4 space-y-3">
                <div className="flex gap-2 items-center">
                  {(['open', 'resolved', 'all'] as const).map((s) => (
                    <Button key={s} size="sm" variant={reportStatus === s ? 'default' : 'outline'}
                      onClick={() => { setReportStatus(s); void loadReports(s); }}>
                      {s}
                    </Button>
                  ))}
                </div>
                {reports.length === 0 && <p className="text-sm text-slate-500">No reports.</p>}
                {reports.map((r) => (
                  <Card key={r.id}>
                    <CardHeader className="pb-1">
                      <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                        <Badge variant={r.status === 'open' ? 'destructive' : 'secondary'}>{r.status}</Badge>
                        <span>{r.reason}</span>
                        <span className="text-slate-400 font-normal">· {r.reportedName || r.reportedProfileUserId}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-slate-600 space-y-2">
                      {r.details && <p>&ldquo;{r.details}&rdquo;</p>}
                      <p className="text-slate-400">{new Date(r.createdAt).toLocaleString()}</p>
                      {r.status === 'open' && (
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" onClick={() => void act(() => resolveAdminReport(r.id, 'resolved'), () => loadReports(reportStatus), 'Resolved')}>
                            Mark resolved
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void act(() => resolveAdminReport(r.id, 'dismissed'), () => loadReports(reportStatus), 'Dismissed')}>
                            Dismiss
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Users */}
              <TabsContent value="users" className="mt-4 space-y-3">
                <div className="flex gap-2 max-w-md">
                  <Input placeholder="Search email or name…" value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void loadUsers(userQuery); }} />
                  <Button size="sm" onClick={() => void loadUsers(userQuery)}>Search</Button>
                </div>
                {users.length === 0 && <p className="text-sm text-slate-500">No users match.</p>}
                {users.map((u) => (
                  <Card key={u.id}>
                    <CardContent className="p-4 text-xs flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800">
                          {u.profileName || `${u.firstName} ${u.lastName}`}
                          {u.isRoot && <Badge variant="default" className="ml-2 bg-purple-600">root</Badge>}
                          {!u.isRoot && u.isAdmin && <Badge variant="outline" className="ml-2">admin</Badge>}
                          {u.suspended && <Badge variant="destructive" className="ml-2">SUSPENDED</Badge>}
                        </p>
                        <p className="text-slate-500">{u.email} · plan {u.plan}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {isRoot && !u.isRoot && !u.isAdmin && (
                          <Button size="sm" variant="outline"
                            onClick={() => void act(() => promoteAdmin(u.id), () => loadUsers(userQuery), 'Admin granted')}>
                            Make admin
                          </Button>
                        )}
                        {isRoot && u.isAdmin && !u.suspended && (
                          <Button size="sm" variant="outline"
                            onClick={() => void act(() => demoteAdmin(u.id), () => loadUsers(userQuery), 'Admin revoked')}>
                            Revoke admin
                          </Button>
                        )}
                        {(isRoot || !u.isAdmin) && (
                          <Button size="sm"
                            variant={u.suspended ? 'outline' : 'destructive'}
                            onClick={() => {
                              // Audit L10: suspending severs access — require an
                              // explicit confirmation before the destructive action.
                              if (!u.suspended && !window.confirm(
                                `Suspend ${u.email}? They lose access to their account immediately until unsuspended.`
                              )) return;
                              void act(
                                () => setUserSuspended(u.id, !u.suspended, u.suspended ? '' : 'Policy violation'),
                                () => loadUsers(userQuery),
                                u.suspended ? 'Unsuspended' : 'Suspended'
                              );
                            }}>
                            {u.suspended ? 'Unsuspend' : 'Suspend'}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Profiles */}
              <TabsContent value="profiles" className="mt-4 space-y-3">
                <div className="flex gap-2 max-w-md">
                  <Input placeholder="Search name / city / specialty / email…" value={profileQuery}
                    onChange={(e) => setProfileQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void loadProfiles(profileQuery); }} />
                  <Button size="sm" onClick={() => void loadProfiles(profileQuery)}>Search</Button>
                  <Button size="sm" variant="outline"
                    onClick={() => void act(() => setSamplesHidden(true), () => loadProfiles(profileQuery), 'Sample catalog hidden')}>
                    Hide samples
                  </Button>
                  <Button size="sm" variant="ghost"
                    onClick={() => void act(() => setSamplesHidden(false), () => loadProfiles(profileQuery), 'Sample catalog restored')}>
                    Show
                  </Button>
                </div>
                {profiles.length === 0 && <p className="text-sm text-slate-500">No profiles match.</p>}
                {profiles.map((p) => (
                  <Card key={p.id}>
                    <CardContent className="p-4 text-xs flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800">
                          Dr. {p.name}
                          {p.visibility === 'hidden' && <Badge variant="secondary" className="ml-2">hidden</Badge>}
                          {!p.isSample && <Badge variant="outline" className="ml-2">member</Badge>}
                        </p>
                        <p className="text-slate-500">
                          {[p.specialty, p.city].filter(Boolean).join(', ') || '—'}
                          {(p.phone || p.email) && ` · ${[p.phone, p.email].filter(Boolean).join(' · ')}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant={p.isVerified ? 'outline' : 'default'}
                          onClick={() => void act(
                            () => patchAdminProfile(p.id, { is_verified: !p.isVerified }),
                            () => loadProfiles(profileQuery),
                            p.isVerified ? 'Verification removed' : 'Verified'
                          )}>
                          {p.isVerified ? 'Unverify' : 'Verify'}
                        </Button>
                        <Button size="sm" variant={p.visibility === 'hidden' ? 'outline' : 'ghost'}
                          onClick={() => void act(
                            () => patchAdminProfile(p.id, { profile_visibility: p.visibility === 'hidden' ? 'public' : 'hidden' }),
                            () => loadProfiles(profileQuery),
                            p.visibility === 'hidden' ? 'Made public' : 'Hidden'
                          )}>
                          {p.visibility === 'hidden' ? 'Unhide' : 'Hide'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Payments */}
              <TabsContent value="payments" className="mt-4 space-y-3">
                {payments.length === 0 && <p className="text-sm text-slate-500">No payments recorded yet.</p>}
                {payments.map((t) => (
                  <Card key={t.paymentId}>
                    <CardContent className="p-4 text-xs flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800">₹{t.amountRupees?.toFixed(2)} · {t.sku}</p>
                        <p className="text-slate-500">
                          {t.userEmail || t.userId || '—'} · {t.source} · {new Date(t.createdAt).toLocaleString()}
                          {t.refunded && ' · REFUNDED'}
                        </p>
                        <p className="text-slate-400 font-mono">{t.paymentId}</p>
                      </div>
                      {!t.refunded && t.status === 'captured' && (
                        <Button size="sm" variant="destructive"
                          onClick={() => {
                            // Audit L10: refunds move real money — require an
                            // explicit confirmation before issuing.
                            if (!window.confirm(
                              `Refund ₹${t.amountRupees?.toFixed(2)} for ${t.sku}? The member is downgraded to basic immediately and a Razorpay refund is issued.`
                            )) return;
                            void act(
                              () => adminRefund(t.paymentId, undefined, 'admin refund from console'),
                              () => loadPayments(),
                              'Refund issued'
                            );
                          }}>
                          Refund
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Audit log */}
              <TabsContent value="audit" className="mt-4 space-y-2">
                {audit.length === 0 && <p className="text-sm text-slate-500">No admin actions recorded yet.</p>}
                {audit.map((a) => (
                  <Card key={a.id}>
                    <CardContent className="p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p><span className="font-semibold text-slate-800">{a.action}</span> → <span className="font-mono text-slate-600">{a.target || '—'}</span></p>
                        <p className="text-slate-500">{a.adminEmail} · {new Date(a.createdAt).toLocaleString()}{a.details ? ` · ${a.details}` : ''}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* P0-2/P0-8 Trust & safety: verification queue, warn ladder, renewals. */}
              <TabsContent value="trust" className="mt-4 space-y-3">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void (async () => {
                    const r = await triggerRenewalReminders();
                    toast({ title: r ? `Renewal reminders sent (${r.sent}/${r.total})` : "Reminders unavailable", description: r ? undefined : "Server unreachable." });
                  })}>
                    Send renewal reminders
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void listVerifications('pending').then((rows) => setDocs(rows ?? []))}>
                    Refresh queue
                  </Button>
                </div>
                {docs.length === 0 && <p className="text-sm text-slate-500">No pending verifications.</p>}
                {docs.map((d) => (
                  <Card key={d.id}>
                    <CardContent className="p-4 text-xs flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-800">{d.docType} · {d.userEmail}</p>
                        <p className="text-slate-500 font-mono break-all">{d.url.slice(0, 120)}</p>
                        <p className="text-slate-400">{new Date(d.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => void act(() => reviewVerification(d.id, 'approved'), () => listVerifications('pending').then((r) => setDocs(r ?? [])), 'Document approved')}>Approve</Button>
                        <Button size="sm" variant="destructive" onClick={() => void act(() => reviewVerification(d.id, 'rejected', 'Unclear document'), () => listVerifications('pending').then((r) => setDocs(r ?? [])), 'Document rejected')}>Reject</Button>
                        <Button size="sm" variant="outline" onClick={() => void (async () => {
                          const r = await warnAdminUser(d.userId, 'Verification document issue');
                          toast({ title: r.ok ? `Warned (${r.strikes}/3${r.autoSuspend ? ', auto-suspended' : ''})` : 'Warn failed', description: r.error || undefined, variant: r.ok ? undefined : 'destructive' });
                        })}>Warn user</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminPage;