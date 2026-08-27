
import React, { useEffect, useRef, useState } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { demoModeEnabled } from '@/lib/devAuth';
import { astrologyEnabled } from '@/lib/features';
import {
  Calendar,
  MessageSquare,
  History,
  Bell,
  Clock,
  Calendar as CalendarIcon,
  Phone,
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '@/components/Header';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import VideoDateInvites from '@/components/VideoDateInvites';
import VideoDateHistory from '@/components/VideoDateHistory';
import { Separator } from '@/components/ui/separator';
import {
  hasServerSession, listVideoDates as serverListVideoDates,
  createVideoDate as serverCreateVideoDate, cancelVideoDate as serverCancelVideoDate,
  createConsultation as serverCreateConsultation,
  browseProfiles, type ServerVideoDate,
} from '@/services/api';
import { usePlan } from '@/hooks/usePlan';
import { acceptInviteToScheduled, ensureRecording, loadScheduled, saveScheduled } from '@/lib/videoStore';
import RecordingPlayer from '@/components/RecordingPlayer';

// TypeScript interfaces for VideoDateInvite and VideoDateHistoryItem
interface VideoDateInvite {
  id: string;
  senderId: string;
  senderName: string;
  senderImage: string;
  message: string;
  proposedDate: Date;
  duration: number;
  status: "pending" | "accepted" | "declined" | "rescheduled";
}

interface VideoDateHistoryItem {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorImage: string;
  specialty: string;
  date: Date;
  duration: number;
  status: "completed" | "missed" | "cancelled";
  rating?: number;
  notes?: string;
}

// Sample data
// Sample data (audit C3: demo-only — blank in production).
const upcomingDates = demoModeEnabled ? [
  {
    id: '1',
    doctorName: 'Dr. Priya Sharma',
    doctorSpecialty: 'Cardiologist',
    doctorImage: 'https://randomuser.me/api/portraits/women/44.jpg',
    date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2), // 2 days from now
    duration: 30,
  },
  {
    id: '2',
    doctorName: 'Dr. Rajiv Mehta',
    doctorSpecialty: 'Neurologist',
    doctorImage: 'https://randomuser.me/api/portraits/men/42.jpg',
    date: new Date(Date.now() + 1000 * 60 * 60 * 48), // 48 hours from now
    duration: 45,
  },
] : [];

const pendingInvites: VideoDateInvite[] = demoModeEnabled ? [
  {
    id: '1',
    senderId: '101',
    senderName: 'Dr. Ananya Patel',
    senderImage: 'https://randomuser.me/api/portraits/women/67.jpg',
    message: "I'd like to discuss your medical history in more detail. Are you available for a video consultation?",
    proposedDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3), // 3 days from now
    duration: 30,
    status: "pending"
  },
  {
    id: '2',
    senderId: '102',
    senderName: 'Dr. Vikram Singh',
    senderImage: 'https://randomuser.me/api/portraits/men/79.jpg',
    message: "Let's schedule a follow-up video date to discuss your test results.",
    proposedDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5), // 5 days from now
    duration: 20,
    status: "pending"
  },
  {
    id: '3',
    senderId: '103',
    senderName: 'Dr. Shreya Gupta',
    senderImage: 'https://randomuser.me/api/portraits/women/90.jpg',
    message: "I have a slot available next week for a video consultation. Would you like to discuss your recent symptoms?",
    proposedDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days from now
    duration: 45,
    status: "pending"
  }
] : [];

const dateHistory: VideoDateHistoryItem[] = demoModeEnabled ? [
  {
    id: '1',
    doctorId: '201',
    doctorName: 'Dr. Arjun Kapoor',
    doctorImage: 'https://randomuser.me/api/portraits/men/32.jpg',
    specialty: 'Psychiatrist',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
    duration: 60,
    status: "completed",
    rating: 5,
    notes: "Great consultation! Dr. Kapoor was very attentive and provided helpful advice."
  },
  {
    id: '2',
    doctorId: '202',
    doctorName: 'Dr. Sarah Johnson',
    doctorImage: 'https://randomuser.me/api/portraits/women/22.jpg',
    specialty: 'Oncologist',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days ago
    duration: 45,
    status: "completed",
    rating: 4,
    notes: "Dr. Johnson explained everything clearly. Would consult again."
  },
  {
    id: '3',
    doctorId: '203',
    doctorName: 'Dr. David Chen',
    doctorImage: 'https://randomuser.me/api/portraits/men/53.jpg',
    specialty: 'General Practitioner',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10), // 10 days ago
    duration: 30,
    status: "missed"
  }
] : [];

const notifications = [
  {
    id: '1',
    type: 'reminder',
    title: 'Upcoming Video Date',
    message: 'Your video date with Dr. Priya Sharma is in 1 hour.',
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    isRead: false,
    relatedId: '1' // references upcomingDates[0].id
  },
  {
    id: '2',
    type: 'invite',
    title: 'New Video Date Request',
    message: 'Dr. Ananya Patel has invited you for a video date.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3), // 3 hours ago
    isRead: true,
    relatedId: '1' // references pendingInvites[0].id
  },
  {
    id: '3',
    type: 'reschedule',
    title: 'Date Rescheduled',
    message: 'Your video date with Dr. Rajiv Mehta has been rescheduled.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    isRead: false,
    relatedId: '2' // references upcomingDates[1].id
  }
];

// Map a doctor display name to the matching "Schedule a New Video Date" select value.
const doctorSelectValueFor = (name: string): string => {
  const known: Array<[string, string]> = [
    ['Dr. Priya Sharma', '1'],
    ['Dr. Rajiv Mehta', '2'],
    ['Dr. Ananya Patel', '3'],
    ['Dr. Vikram Singh', '4'],
  ];
  const hit = known.find(([n]) => n === name || n.includes(name) || name.includes(n));
  return hit ? hit[1] : '';
};

// Inverse of doctorSelectValueFor: select value -> display name, so stored
// requests show a name instead of the raw select value ("1").
const doctorDisplayNameFor = (value: string): string => {
  const known: Record<string, string> = {
    '1': 'Dr. Priya Sharma',
    '2': 'Dr. Rajiv Mehta',
    '3': 'Dr. Ananya Patel',
    '4': 'Dr. Vikram Singh',
  };
  return known[value] || value;
};

const VideoDatePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('upcoming');
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // ?mode=consultation → book against the purchased astrologer entitlement.
  // Feature-flagged: unreachable (false) until the astrology feature launches.
  const isConsultationMode = astrologyEnabled && searchParams.get('mode') === 'consultation';
  const { planName, quota, usedThisMonth, videoDatesLeft, consumeVideoDate, refundVideoDate } = usePlan();
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [duration, setDuration] = useState<string>('30');
  const [message, setMessage] = useState<string>('');
  const [invites, setInvites] = usePersistedState<VideoDateInvite[]>('mm:videoInvites', pendingInvites);
  const [sentRequests, setSentRequests] = usePersistedState<Array<{ id: string; doctorName: string; date: string; duration: string }>>('mm:sentVideoRequests', []);
  const scheduled = loadScheduled();
  // Bumped when the raw `scheduled` storage is mutated directly, so the list
  // re-renders (loadScheduled() alone is a plain per-render read).
  const [scheduledVersion, setScheduledVersion] = useState(0);
  void scheduledVersion;

  // ---- Wired backend sync: real video dates + profile-id resolution ----
  const [serverDates, setServerDates] = useState<ServerVideoDate[]>([]);
  const profileIdByNameRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!hasServerSession()) return;
    let cancelled = false;
    (async () => {
      const rows = await serverListVideoDates();
      if (rows && !cancelled) setServerDates(rows);
      const profiles = await browseProfiles({ limit: 200 });
      if (profiles && !cancelled) {
        const map: Record<string, string> = {};
        for (const p of profiles) {
          map[p.name.toLowerCase()] = p.id;
          map[`dr. ${p.name}`.toLowerCase()] = p.id;
        }
        profileIdByNameRef.current = map;
      }
    })().catch(() => {
      /* offline — local/demo behaviour remains */
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const [viewingRecording, setViewingRecording] = React.useState<import('@/lib/videoStore').VideoRecording | null>(null);

  const handleAcceptInvite = (inviteId: string) => {
    // Accepting an invite books a video date — it must pass the same quota
    // gate as scheduling one (audit H3).
    if (!consumeVideoDate()) {
      toast({
        title: "Video date limit reached",
        description: `Your ${planName} plan's monthly video date limit is reached. Upgrade for more.`,
        variant: "destructive"
      });
      return;
    }
    const invite = invites.find(i => i.id === inviteId);
    setInvites(prev => prev.map(iv => (iv.id === inviteId ? { ...iv, status: 'accepted' as const } : iv)));
    if (invite) {
      const scheduled = loadScheduled();
      scheduled.push(acceptInviteToScheduled({ ...invite, proposedDate: (invite.proposedDate as unknown as string) } as unknown as import('@/lib/videoStore').VideoInvite));
      saveScheduled(scheduled);
    }
    toast({ title: "Video Date Accepted", description: "The video date has been added to your calendar." });
    try {
      const raw = localStorage.getItem('mm:notifications');
      const arr = raw ? JSON.parse(raw) : [];
      arr.unshift({ id: Date.now().toString(), type: 'video_request', from: 'Video Date', content: 'You accepted a video date invitation.', timestamp: new Date().toISOString(), read: false, imageUrl: 'https://randomuser.me/api/portraits/women/44.jpg' });
      localStorage.setItem('mm:notifications', JSON.stringify(arr.slice(0, 50)));
      window.dispatchEvent(new CustomEvent('mm:persisted-state-changed', { detail: { key: 'mm:notifications' } }));
    } catch { /* ignore */ }
  };

  const handleDeclineInvite = (inviteId: string) => {
    setInvites(prev => prev.map(iv => (iv.id === inviteId ? { ...iv, status: 'declined' as const } : iv)));
    toast({ title: "Video Date Declined", description: "The invitation has been declined." });
  };

  const handleRescheduleInvite = (inviteId: string) => {
    setInvites(prev => prev.map(iv => (iv.id === inviteId ? { ...iv, status: 'rescheduled' as const } : iv)));
    toast({ title: "Reschedule Requested", description: "A new time has been suggested for this video date." });
    setActiveTab('new');
  };

  const handleRebook = (doctorId: string) => {
    toast({ title: "Booking Reopened", description: `Scheduling a new video date with Dr. ${doctorId}.` });
    setActiveTab('upcoming');
  };

  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    
    if (!selectedDoctor) {
      toast({
        title: "Error",
        description: "Please select a doctor",
        variant: "destructive"
      });
      return;
    }
    
    if (!selectedDate) {
      toast({
        title: "Error",
        description: "Please select a date and time",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    if (!consumeVideoDate()) {
      toast({
        title: "Video date limit reached",
        description: `Your ${planName} plan allows ${quota === Infinity ? 'unlimited' : quota} video date${quota === 1 ? '' : 's'} per month. Upgrade your plan for more.`,
        variant: "destructive"
      });
      setSubmitting(false);
      return;
    }
    
    toast({
      title: "Success",
      description: "Video date request has been sent!",
    });
    
    setSentRequests(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        doctorName: doctorDisplayNameFor(selectedDoctor),
        date: selectedDate ? new Date(selectedDate).toISOString() : '',
        duration,
      },
    ]);

    // Durable record on the wired backend — the server re-enforces its own
    // quota atomically; a failure here degrades to local-only with a notice.
    if (hasServerSession() && selectedDate) {
      const displayName = doctorDisplayNameFor(selectedDoctor);
      const pid = profileIdByNameRef.current[String(displayName).toLowerCase()];
      // Consultation mode (?mode=consultation): books against the purchased
      // astrologer entitlement — no video-date quota consumed.
      if (isConsultationMode) {
        void serverCreateConsultation(new Date(selectedDate).toISOString(), Number(duration) || 45)
          .then((r0) => {
            if (!r0.ok && r0.error) toast({ title: 'Booking not confirmed', description: r0.error, variant: 'destructive' });
          })
          .catch(() => {});
      } else if (pid) {
        void serverCreateVideoDate(pid, new Date(selectedDate).toISOString(), Number(duration) || 30)
          .then((r0) => {
            if (!r0.ok && r0.error) toast({ title: 'Not synced', description: r0.error, variant: 'destructive' });
          })
          .catch(() => {});
      }
    }

    setSelectedDoctor('');
    setSelectedDate(null);
    setDuration('30');
    setMessage('');
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8">
            {/* Left column - Video Date Management */}
            <div className="w-full md:w-2/3">
              <h1 className="text-2xl md:text-3xl font-bold text-blue-800 mb-6">
                Video Date Management
              </h1>
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-2 sm:grid-cols-4 mb-6 h-auto p-1.5 gap-1 bg-white border border-slate-200 shadow-sm rounded-xl">
                  <TabsTrigger value="upcoming" className="flex items-center justify-center gap-1.5 text-xs py-2">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Upcoming</span>
                  </TabsTrigger>
                  <TabsTrigger value="invites" className="flex items-center justify-center gap-1.5 text-xs py-2">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Invites</span>
                    {invites.filter(i => i.status === 'pending').length > 0 && (
                      <Badge className="ml-1 px-1.5 py-0 text-[10px] bg-blue-500">{invites.filter(i => i.status === 'pending').length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex items-center justify-center gap-1.5 text-xs py-2">
                    <History className="h-3.5 w-3.5" />
                    <span>History</span>
                  </TabsTrigger>
                  <TabsTrigger value="notifications" className="flex items-center justify-center gap-1.5 text-xs py-2">
                    <Bell className="h-3.5 w-3.5" />
                    <span>Alerts</span>
                    {notifications.filter(n => !n.isRead).length > 0 && (
                      <Badge className="ml-1 px-1.5 py-0 text-[10px] bg-red-500">
                        {notifications.filter(n => !n.isRead).length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="upcoming" className="space-y-4">
                  <h2 className="text-xl font-semibold mb-4">Upcoming Video Dates</h2>
                  {[...serverDates.map(d => ({ id: d.id, doctorName: d.profile.name, doctorSpecialty: 'Match', doctorImage: d.profile.imageUrl || '', date: new Date(d.scheduledFor), duration: d.durationMinutes, _src: 'server' as const })), ...upcomingDates.map(u => ({ ...u, _src: 'static' as const })), ...scheduled.map(s => ({ id: s.id, doctorName: s.doctorName, doctorSpecialty: s.doctorSpecialty, doctorImage: s.doctorImage, date: new Date(s.date), duration: s.duration, _src: 'scheduled' as const }))].length > 0 ? (
                    <div className="space-y-4">
                      {[...serverDates.map(d => ({ id: d.id, doctorName: d.profile.name, doctorSpecialty: 'Match', doctorImage: d.profile.imageUrl || '', date: new Date(d.scheduledFor), duration: d.durationMinutes, _src: 'server' as const })), ...upcomingDates.map(u => ({ ...u, _src: 'static' as const })), ...scheduled.map(s => ({ id: s.id, doctorName: s.doctorName, doctorSpecialty: s.doctorSpecialty, doctorImage: s.doctorImage, date: new Date(s.date), duration: s.duration, _src: 'scheduled' as const }))].map(date => (
                        <Card key={date.id}>
                          <CardHeader className="flex flex-row items-center gap-4 pb-2">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={date.doctorImage} alt={date.doctorName} />
                              <AvatarFallback>{date.doctorName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                            </Avatar>
                            <div>
                              <CardTitle className="text-lg">{date.doctorName}</CardTitle>
                              <CardDescription>{date.doctorSpecialty}</CardDescription>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="flex flex-col sm:flex-row justify-between gap-4">
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4 text-blue-600" />
                                <span className="font-medium">{format(date.date, 'EEEE, MMMM d, yyyy')}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-blue-600" />
                                <span>{format(date.date, 'h:mm a')} ({date.duration} minutes)</span>
                              </div>
                            </div>
                          </CardContent>
                          <CardFooter className="flex flex-col sm:flex-row gap-3 pt-2">
                            <Button className="w-full sm:w-auto flex items-center gap-2 bg-mediblue-600 hover:bg-mediblue-700 text-white" onClick={() => {
                              // Joining an ALREADY-BOOKED date is free: the slot was
                              // charged when the date was scheduled or accepted.
                              // Charging again here double-billed the same event (audit M1).
                              toast({ title: "Joining Video Date", description: `Connecting live video call with ${date.doctorName}...` });
                              navigate('/video-match');
                            }}>
                              <Phone className="h-4 w-4" />
                              Join Video Date
                            </Button>
                            <Button variant="outline" className="w-full sm:w-auto" onClick={() => { setSelectedDoctor(doctorSelectValueFor(date.doctorName)); setActiveTab('new'); toast({ title: "Reschedule", description: `Pick a new time for ${date.doctorName}.` }); }}>Reschedule</Button>
                            <Button variant="ghost" className="w-full sm:w-auto text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => {
                              if ((date as { _src?: string })._src === 'server') {
                                // Server-backed date: the DB refunds the quota
                                // atomically with the cancellation (M1/M5 fix).
                                void serverCancelVideoDate(date.id).then((ok) => {
                                  if (!ok) toast({ title: 'Could not cancel', description: 'Please try again.', variant: 'destructive' });
                                }).catch(() => {});
                                setServerDates(prev => prev.filter(d => d.id !== date.id));
                              } else {
                                if (date._src === 'scheduled') {
                                  saveScheduled(loadScheduled().filter(s => s.id !== date.id));
                                }
                                // A cancelled upcoming date does not spend quota —
                                // refund the slot it consumed when scheduled/accepted
                                // (product default; audit M1).
                                refundVideoDate();
                              }
                              // Force a re-render so the cancelled date disappears immediately.
                              setScheduledVersion(v => v + 1);
                              toast({ title: "Date cancelled", description: `Video date with ${date.doctorName} has been cancelled. Your video date quota was refunded.` });
                            }}>Cancel</Button>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <Calendar className="h-12 w-12 text-gray-400 mb-3" />
                        <p className="text-lg text-center text-gray-500">No upcoming video dates</p>
                        <p className="text-sm text-gray-400 text-center mt-1 max-w-md">
                          When you schedule video dates with doctors, they will appear here
                        </p>
                        <Button 
                          className="mt-4"
                          onClick={() => setActiveTab('new')}
                        >
                          Schedule a New Video Date
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
                
                <TabsContent value="invites">
                  <VideoDateInvites 
                    invites={invites}
                    onAccept={handleAcceptInvite}
                    onDecline={handleDeclineInvite}
                    onReschedule={handleRescheduleInvite}
                  />
                </TabsContent>
                
                <TabsContent value="history">
                  <VideoDateHistory 
                    history={dateHistory} 
                    onRebook={handleRebook}
                    onViewRecording={(sessionId) => {
                    const item = dateHistory.find((d) => d.id === sessionId);
                    if (!item) return;
                    setViewingRecording(ensureRecording({ id: item.id, doctorName: item.doctorName, doctorImage: item.doctorImage, duration: item.duration }));
                  }}
                  />
                </TabsContent>
                
                <TabsContent value="notifications">
                  <h2 className="text-xl font-semibold mb-4">Notifications</h2>
                  <div className="space-y-3">
                    {notifications.map(notification => (
                      <Card key={notification.id} className="overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3">
                              <div className={`p-2 rounded-full ${
                                notification.type === 'reminder' ? 'bg-blue-100 text-blue-600' :
                                notification.type === 'invite' ? 'bg-green-100 text-green-600' :
                                'bg-amber-100 text-amber-600'
                              }`}>
                                {notification.type === 'reminder' ? 
                                  <Clock className="h-5 w-5" /> : 
                                  notification.type === 'invite' ? 
                                  <MessageSquare className="h-5 w-5" /> :
                                  <Calendar className="h-5 w-5" />}
                              </div>
                              <div>
                                <p className={`font-medium ${!notification.isRead ? 'text-gray-900' : 'text-gray-600'}`}>
                                  {notification.title}
                                </p>
                                <p className={`text-sm ${!notification.isRead ? 'text-gray-700' : 'text-gray-500'}`}>
                                  {notification.message}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {format(notification.timestamp, 'PPp')}
                                </p>
                              </div>
                            </div>
                            {!notification.isRead && (
                              <Badge className="bg-blue-500">New</Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
                
                <TabsContent value="new">
                  <h2 className="text-xl font-semibold mb-4">Schedule a New Video Date</h2>
                  <Card>
                    <CardContent className="pt-6">
                      <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                          <Label htmlFor="doctor">Select Doctor</Label>
                          <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                            <SelectTrigger id="doctor">
                              <SelectValue placeholder="Choose a doctor" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Dr. Priya Sharma (Cardiologist)</SelectItem>
                              <SelectItem value="2">Dr. Rajiv Mehta (Neurologist)</SelectItem>
                              <SelectItem value="3">Dr. Ananya Patel (Pediatrician)</SelectItem>
                              <SelectItem value="4">Dr. Vikram Singh (Orthopedic Surgeon)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="date">Preferred Date & Time</Label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                              type="datetime-local"
                              id="date"
                              min={(() => {
                                // datetime-local values are in the user's local
                                // timezone — a UTC toISOString() min can forbid
                                // today's valid local times.
                                const now = new Date();
                                const pad = (n: number) => String(n).padStart(2, '0');
                                return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
                              })()}
                              onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : null)}
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Duration</Label>
                          <RadioGroup defaultValue="30" value={duration} onValueChange={setDuration}>
                            <div className="flex flex-wrap gap-4">
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="15" id="r1" />
                                <Label htmlFor="r1">15 minutes</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="30" id="r2" />
                                <Label htmlFor="r2">30 minutes</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="45" id="r3" />
                                <Label htmlFor="r3">45 minutes</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="60" id="r4" />
                                <Label htmlFor="r4">60 minutes</Label>
                              </div>
                            </div>
                          </RadioGroup>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="message">Message (Optional)</Label>
                          <Textarea 
                            id="message" 
                            placeholder="Brief description of what you'd like to discuss"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={3}
                          />
                        </div>
                        
                        <div className="pt-2 flex items-center justify-between gap-3 flex-col sm:flex-row">
                          <p className="text-sm text-gray-500">
                            Video dates used this month: {usedThisMonth} of {quota === Infinity ? 'unlimited' : quota}
                            {quota !== Infinity && videoDatesLeft === 0 && ' — none left'}
                            <span className="capitalize"> ({planName} plan)</span>
                          </p>
                          <div className="flex gap-3 w-full sm:w-auto">
                          <Button type="submit" className="w-full sm:w-auto">
                            Send Request
                          </Button>
                          <Button type="button" variant="outline" className="w-full sm:w-auto"
                            onClick={() => setActiveTab('upcoming')}>
                            Cancel
                          </Button>
                          </div>
                        </div>
                      </form>
                    </CardContent>
                  </Card>

                  {sentRequests.length > 0 && (
                    <div className="bg-white rounded-lg shadow-sm p-4 mt-4">
                      <h3 className="font-semibold mb-3">Pending Requests ({sentRequests.length})</h3>
                      <ul className="space-y-2">
                        {sentRequests.slice().reverse().map((req) => (
                          <li key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-sm border-b pb-2">
                            <span className="font-medium">{req.doctorName}</span>
                            <span className="text-gray-500">
                              {req.date ? format(new Date(req.date), 'PPP') : 'TBD'} · {req.duration} min
                            </span>
                            <button
                              type="button"
                              className="text-red-500 hover:underline text-left"
                              onClick={() => setSentRequests(prev => prev.filter(r => r.id !== req.id))}
                            >
                              Cancel request
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
            
            {/* Right column - Video Date Tips */}
            <div className="w-full md:w-1/3 mt-6 md:mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Video Date Tips</CardTitle>
                  <CardDescription>Make the most of your video dates</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg bg-blue-50 p-4">
                    <h3 className="font-semibold text-blue-700 mb-2">Before Your Date</h3>
                    <ul className="space-y-2 text-sm text-blue-800">
                      <li className="flex items-start gap-2">
                        <div className="bg-blue-200 rounded-full p-1 mt-0.5">
                          <span className="block h-1.5 w-1.5 rounded-full bg-blue-600" />
                        </div>
                        <span>Test your camera and microphone 10 minutes before the scheduled time</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="bg-blue-200 rounded-full p-1 mt-0.5">
                          <span className="block h-1.5 w-1.5 rounded-full bg-blue-600" />
                        </div>
                        <span>Find a quiet, well-lit space with minimal background noise</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="bg-blue-200 rounded-full p-1 mt-0.5">
                          <span className="block h-1.5 w-1.5 rounded-full bg-blue-600" />
                        </div>
                        <span>Prepare your questions or discussion points in advance</span>
                      </li>
                    </ul>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="font-semibold mb-2">Technical Requirements</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Make sure your device meets these requirements:
                    </p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center">
                        <span className={cn("mr-2 h-2 w-2 rounded-full", navigator.onLine ? "bg-green-500" : "bg-red-500")} />
                        Internet connection: {navigator.onLine ? "Online" : "Offline"}
                      </li>
                      <li className="flex items-center">
                        <span className="mr-2 h-2 w-2 rounded-full bg-green-500" />
                        Supported browser: Chrome, Firefox, Safari
                      </li>
                      <li className="flex items-center">
                        <span className="mr-2 h-2 w-2 rounded-full bg-green-500" />
                        Camera and microphone access
                      </li>
                    </ul>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="font-semibold mb-2">Need Help?</h3>
                    <p className="text-sm text-gray-600">
                      If you experience any technical issues during your video date:
                    </p>
                    <Button variant="link" className="p-0 h-auto text-blue-600 mt-1" onClick={() => navigate('/help')}>
                      Contact Technical Support
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        <RecordingPlayer recording={viewingRecording} open={Boolean(viewingRecording)} onClose={() => setViewingRecording(null)} />
      </main>
    </div>
  );
};

export default VideoDatePage;
