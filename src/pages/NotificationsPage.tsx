import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  listNotifications, markNotificationRead, markAllNotificationsRead,
  type NotificationRow,
} from '@/services/api';

const NotificationsPage = () => {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    listNotifications().then((d) => setRows(d?.notifications ?? [])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const unread = rows.filter((r) => !r.read).length;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
            {unread > 0 && (
              <Button size="sm" variant="outline" onClick={() => { void markAllNotificationsRead().then(load); }}>
                Mark all read ({unread})
              </Button>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : rows.length === 0 ? (
            <Card><CardContent className="p-6 text-sm text-slate-500">You're all caught up.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <Card key={r.id} className={r.read ? 'opacity-70' : 'border-mediblue-200'}>
                  <CardContent
                    className="p-4 text-sm cursor-pointer"
                    onClick={() => { if (!r.read) void markNotificationRead(r.id).then(load); }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`font-semibold ${r.read ? 'text-slate-600' : 'text-slate-900'}`}>{r.title}</p>
                        {r.body && <p className="text-slate-600 mt-0.5">{r.body}</p>}
                      </div>
                      {!r.read && <span className="mt-1 h-2 w-2 rounded-full bg-mediblue-500 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{new Date(r.createdAt).toLocaleString()}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default NotificationsPage;