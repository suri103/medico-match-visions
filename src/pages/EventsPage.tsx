import React, { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { Calendar, Filter, MapPin, Users, Clock, Check, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useToast } from '@/hooks/use-toast';

export interface EventItem {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  attendees: number;
  description: string;
}

const INITIAL_EVENTS: EventItem[] = [
  {
    id: 'e1',
    title: 'Medical Professionals Mixer',
    date: 'May 15',
    time: '7:00 PM',
    location: 'Boston, MA',
    attendees: 25,
    description: 'Join us for an evening of networking with fellow medical professionals. Refreshments and dinner will be served.'
  },
  {
    id: 'e2',
    title: 'Healthcare Innovation Summit & Gala',
    date: 'May 28',
    time: '9:00 AM',
    location: 'New York, NY',
    attendees: 40,
    description: 'A full-day summit focusing on the latest innovations in healthcare technology, clinical trials, and practice management.'
  },
  {
    id: 'e3',
    title: 'Wellness & Mindfulness Retreat for Doctors',
    date: 'Jun 10',
    time: '10:00 AM',
    location: 'San Francisco, CA',
    attendees: 55,
    description: 'A weekend retreat focused on mental wellbeing, burnout prevention, and social connection for healthcare practitioners.'
  },
  {
    id: 'e4',
    title: 'Delhi Medico Evening & Networking Dinner',
    date: 'Jun 22',
    time: '6:30 PM',
    location: 'Delhi, India',
    attendees: 32,
    description: 'An exclusive networking evening in New Delhi for physicians, residents, and specialists across major hospitals.'
  },
  {
    id: 'e5',
    title: 'Mumbai Doctors & Specialists Meet',
    date: 'Jul 05',
    time: '7:00 PM',
    location: 'Mumbai, India',
    attendees: 45,
    description: 'Connect with medical peers over an evening of interactive discussions, dinner, and professional networking in BKC.'
  }
];

const EventsPage = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('upcoming');
  const [registeredIds, setRegisteredIds] = usePersistedState<string[]>('mm:eventsRegistered', []);
  const [customEvents, setCustomEvents] = usePersistedState<EventItem[]>('mm:customEvents', []);
  const [serverEvents, setServerEvents] = useState<EventItem[] | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState('all');
  const [showFilter, setShowFilter] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    time: '6:00 PM',
    location: 'Mumbai, India',
    attendees: 20,
    description: '',
  });

  const allEvents = [...(serverEvents ?? INITIAL_EVENTS), ...customEvents];

  // P0-6: real server events replace fixtures when the backend is wired.
  // Fixtures remain the offline fallback so the page never goes empty.
  useEffect(() => { void (async () => {
    try {
      const { listServerEvents } = await import('@/services/api');
      const rows = await listServerEvents();
      if (rows && rows.length > 0) {
        setServerEvents(rows.map((r) => ({ id: r.id, title: r.title, date: r.date, time: r.time, location: r.location, attendees: 0, description: r.description })));
      }
    } catch { /* offline: fixtures stand */ }
  })(); }, []);

  const isRegistered = (id: string) => registeredIds.includes(id);

  const toggleRsvp = (event: EventItem) => {
    if (isRegistered(event.id)) {
      setRegisteredIds(prev => prev.filter(id => id !== event.id));
      toast({ title: "RSVP cancelled", description: `You are no longer registered for ${event.title}.` });
    } else {
      setRegisteredIds(prev => [...prev, event.id]);
      // P0-6: durable server RSVP when wired (best-effort; local state is truth for UI).
      void (async () => {
        try {
          const { rsvpEvent, hasServerSession } = await import('@/services/api');
          if (hasServerSession() && !event.id.startsWith('ce-') && !INITIAL_EVENTS.some((e) => e.id === event.id)) {
            await rsvpEvent(event.id);
          }
        } catch { /* local RSVP stands */ }
      })();
      toast({ title: "You're in! 🎉", description: `You have registered for ${event.title} on ${event.date}.` });
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title.trim() || !newEvent.date.trim() || !newEvent.location.trim()) {
      toast({ title: "Missing fields", description: "Please fill in title, date, and location.", variant: "destructive" });
      return;
    }
    const created: EventItem = {
      id: `ce-${Date.now()}`,
      title: newEvent.title.trim(),
      date: newEvent.date.trim(),
      time: newEvent.time.trim(),
      location: newEvent.location.trim(),
      attendees: Number(newEvent.attendees) || 15,
      description: newEvent.description.trim() || 'Community event hosted by fellow healthcare professionals.',
    };
    setCustomEvents(prev => [created, ...prev]);
    setRegisteredIds(prev => [...prev, created.id]);
    setIsCreateOpen(false);
    setNewEvent({ title: '', date: '', time: '6:00 PM', location: 'Mumbai, India', attendees: 20, description: '' });
    toast({
      title: "Event Published! 🎉",
      description: `"${created.title}" has been created and added to upcoming events. You are automatically registered!`,
    });
  };

  const filteredEvents = locationFilter === 'all'
    ? allEvents
    : allEvents.filter(e => e.location.toLowerCase().includes(locationFilter.toLowerCase()));

  const upcoming = filteredEvents;

  const locations = Array.from(new Set(allEvents.map(e => e.location)));

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Meets & Events</h1>
              <p className="text-slate-500 text-sm">Connect with fellow medical professionals and potential matches in person</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" className="flex-1 sm:flex-initial flex items-center justify-center" onClick={() => setShowFilter(!showFilter)}>
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button className="flex-1 sm:flex-initial bg-mediblue-600 text-white hover:bg-mediblue-700 flex items-center justify-center" onClick={() => setIsCreateOpen(true)}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Create Event
              </Button>
            </div>
          </div>
          
          {showFilter && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 mb-6 max-w-sm">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-slate-700">Filter by location</label>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {locations.map(loc => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 mb-8 bg-white border border-slate-200 shadow-sm h-auto p-1.5 gap-1.5 rounded-xl">
              <TabsTrigger value="upcoming" className="text-xs sm:text-sm py-2">Upcoming ({upcoming.length})</TabsTrigger>
              <TabsTrigger value="myevents" className="text-xs sm:text-sm py-2">My Events ({registeredIds.length})</TabsTrigger>
              <TabsTrigger value="past" className="text-xs sm:text-sm py-2">Past</TabsTrigger>
            </TabsList>
            
            <TabsContent value="upcoming" className="space-y-6">
              {upcoming.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center">
                  <Calendar className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-800 mb-1">No events match your filter</h3>
                  <p className="text-sm text-slate-500 mb-4">Try clearing the location filter or create your own meetup event.</p>
                  <Button variant="outline" onClick={() => { setLocationFilter('all'); }}>Clear filter</Button>
                </div>
              ) : upcoming.map((event) => (
                <div key={event.id} className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden hover:shadow-md transition-shadow">
                  <div className="flex flex-col md:flex-row">
                    <div className="md:w-1/4 min-h-[160px] bg-gradient-to-br from-mediblue-600 to-mediblue-800 text-white relative flex flex-col items-center justify-center p-6 text-center">
                      <div className="absolute top-3 left-3 bg-white/20 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-full text-xs font-semibold">
                        {event.date}
                      </div>
                      <Calendar className="h-10 w-10 text-white/80 mb-2 mt-4" />
                      <p className="text-xs font-medium text-mediblue-100">{event.time}</p>
                    </div>
                    <div className="p-6 md:w-3/4 flex flex-col justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">{event.title}</h3>
                        <div className="flex flex-wrap gap-4 mb-3">
                          <div className="flex items-center text-xs font-medium text-slate-600">
                            <Clock className="h-3.5 w-3.5 mr-1.5 text-mediblue-600" />
                            <span>{event.time}</span>
                          </div>
                          <div className="flex items-center text-xs font-medium text-slate-600">
                            <MapPin className="h-3.5 w-3.5 mr-1.5 text-mediblue-600" />
                            <span>{event.location}</span>
                          </div>
                          <div className="flex items-center text-xs font-medium text-slate-600">
                            <Users className="h-3.5 w-3.5 mr-1.5 text-mediblue-600" />
                            <span>{event.attendees + (isRegistered(event.id) ? 1 : 0)} Attending</span>
                          </div>
                        </div>
                        <p className="text-slate-600 text-sm leading-relaxed mb-3">{event.description}</p>
                        {expandedIds.includes(event.id) && (
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-600 mb-3 space-y-1">
                            <p><strong>Venue Details:</strong> Full venue address and agenda are sent to verified attendees 24 hours prior.</p>
                            <p><strong>Dress Code:</strong> Smart Casual / Professional.</p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 pt-2">
                        <Button
                          className={isRegistered(event.id)
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "bg-mediblue-600 text-white hover:bg-mediblue-700"}
                          onClick={() => toggleRsvp(event)}
                        >
                          {isRegistered(event.id) ? (<><Check className="h-4 w-4 mr-1.5" /> Registered</>) : 'RSVP Now'}
                        </Button>
                        <Button variant="outline" onClick={() => toggleExpand(event.id)}>
                          {expandedIds.includes(event.id) ? 'Show Less' : 'Learn More'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>
            
            <TabsContent value="myevents">
              {registeredIds.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center">
                  <Calendar className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-800 mb-1">No Events Registered</h3>
                  <p className="text-sm text-slate-500 mb-4">RSVP to an upcoming mixer or summit to see it here.</p>
                  <Button className="bg-mediblue-600 text-white hover:bg-mediblue-700" onClick={() => setActiveTab('upcoming')}>
                    Browse Upcoming Events
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {allEvents.filter(e => isRegistered(e.id)).map((event) => (
                    <div key={event.id} className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-900">{event.title}</h3>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Registered
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{event.date} · {event.time} · {event.location}</p>
                      </div>
                      <Button variant="outline" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => toggleRsvp(event)}>
                        Cancel RSVP
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="past">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center">
                <Calendar className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-800 mb-1">No Past Events</h3>
                <p className="text-sm text-slate-500 mb-4">Completed events will appear in this archive.</p>
                <Button className="bg-mediblue-600 text-white hover:bg-mediblue-700" onClick={() => setActiveTab('upcoming')}>
                  Browse Upcoming Events
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Create Event Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle>Host a Medico Meetup</DialogTitle>
            <DialogDescription>
              Create and publish an event for medical professionals in your area.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateEvent} className="space-y-4 py-2">
            <div>
              <Label htmlFor="ev-title" className="text-xs font-semibold text-slate-700 mb-1 block">Event Title</Label>
              <Input
                id="ev-title"
                placeholder="e.g. Hyderabad Surgeons & Residents Coffee Meet"
                value={newEvent.title}
                onChange={(e) => setNewEvent(n => ({ ...n, title: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ev-date" className="text-xs font-semibold text-slate-700 mb-1 block">Date</Label>
                <Input
                  id="ev-date"
                  placeholder="e.g. Aug 28"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent(n => ({ ...n, date: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="ev-time" className="text-xs font-semibold text-slate-700 mb-1 block">Time</Label>
                <Input
                  id="ev-time"
                  placeholder="e.g. 6:30 PM"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent(n => ({ ...n, time: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ev-loc" className="text-xs font-semibold text-slate-700 mb-1 block">Location / City</Label>
                <Input
                  id="ev-loc"
                  placeholder="e.g. Bangalore, India"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent(n => ({ ...n, location: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="ev-att" className="text-xs font-semibold text-slate-700 mb-1 block">Expected Capacity</Label>
                <Input
                  id="ev-att"
                  type="number"
                  placeholder="25"
                  value={newEvent.attendees}
                  onChange={(e) => setNewEvent(n => ({ ...n, attendees: Number(e.target.value) }))}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="ev-desc" className="text-xs font-semibold text-slate-700 mb-1 block">Description & Agenda</Label>
              <Textarea
                id="ev-desc"
                rows={3}
                placeholder="Describe the meetup purpose, venue type, and topics..."
                value={newEvent.description}
                onChange={(e) => setNewEvent(n => ({ ...n, description: e.target.value }))}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-mediblue-600 hover:bg-mediblue-700 text-white">
                Publish Event
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventsPage;
