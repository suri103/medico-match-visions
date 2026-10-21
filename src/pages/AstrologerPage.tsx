import { useState } from 'react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PaymentModal from '@/components/PaymentModal';
import Chat from '@/components/Chat';
import VideoCall from '@/components/VideoCall';
import { useToast } from '@/hooks/use-toast';
import { useCheckoutResult } from '@/hooks/useCheckoutResult';
import { usePersistedState } from '@/hooks/usePersistedState';
import { Star, MessageSquare, Info, ChevronRight, Video, Calendar as CalendarIcon, Clock, Sparkles, HeartHandshake } from 'lucide-react';
import { doctorProfiles } from '@/features/matches/data/sampleData';
import { rashiList, nakshatraList, manglikList } from '@/features/matches/data/constants';
import { computeKundaliMilan } from '@/lib/kundaliMatching';
import { useNavigate } from 'react-router-dom';

export interface AstrologerBooking {
  id: string;
  astrologerId: string;
  astrologerName: string;
  astrologerImage: string;
  specialty: string;
  date: string;
  timeSlot: string;
  birthDetails: string;
  specificQuestions?: string;
  amount: number;
  status: 'confirmed' | 'completed' | 'cancelled';
  bookedAt: string;
}

// Sample data for astrologers
const astrologers = [
  {
    id: '1',
    name: 'Acharya Vikram',
    specialty: 'Vedic Astrology Expert',
    experience: 15,
    rating: 4.9,
    reviews: 324,
    price: 1499,
    description: "Specializes in matchmaking compatibility analysis using traditional Vedic astrology principles. Helps medical professionals find their perfect match through astrological alignments and planetary positions.",
    imageUrl: 'https://randomuser.me/api/portraits/men/72.jpg',
    languages: ['English', 'Hindi', 'Sanskrit'],
    available: true
  },
  {
    id: '2',
    name: 'Dr. Meera Sharma',
    specialty: 'Medical Astrology', 
    experience: 12,
    rating: 4.8,
    reviews: 256,
    price: 1699,
    description: "Combines modern psychology with ancient astrological wisdom to provide relationship compatibility insights. Specializes in helping healthcare professionals navigate their unique relationship challenges.",
    imageUrl: 'https://randomuser.me/api/portraits/women/53.jpg',
    languages: ['English', 'Hindi'],
    available: true
  },
  {
    id: '3',
    name: 'Pandit Rajesh Joshi',
    specialty: 'Relationship Astrology',
    experience: 20,
    rating: 4.9,
    reviews: 412,
    price: 1999,
    description: "Expert in analyzing birth charts for compatibility matching. Provides detailed insights into relationship dynamics, potential challenges, and harmonious aspects of partnerships.",
    imageUrl: 'https://randomuser.me/api/portraits/men/54.jpg',
    languages: ['English', 'Hindi', 'Gujarati'],
    available: false
  }
];

const AstrologerPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [selectedAstrologer, setSelectedAstrologer] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [activeView, setActiveView] = useState<'list' | 'astrologer-profile' | 'chat' | 'video-call'>('list');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>('11:00 AM');
  const [birthDetails, setBirthDetails] = useState('');
  const [specificQuestions, setSpecificQuestions] = useState('');
  const [bookings, setBookings] = usePersistedState<AstrologerBooking[]>('mm:astrologerBookings', []);
  const [mainTab, setMainTab] = useState<'experts' | 'kundali-milan' | 'my-consultations'>('experts');
  
  const meProfile = (() => {
    try { return JSON.parse(localStorage.getItem('mm:profileData') || 'null'); } catch { return null; }
  })();
  const [myRashi, setMyRashi] = useState<string>(meProfile?.rashi || 'Vrishabha (Taurus)');
  const [myNakshatra, setMyNakshatra] = useState<string>(meProfile?.nakshatra || 'Rohini');
  const [myManglik, setMyManglik] = useState<string>(meProfile?.manglik || 'Non-Manglik');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(doctorProfiles[6].id);
  
  const recordBooking = (astrologer: typeof astrologers[0]) => {
    const newBooking: AstrologerBooking = {
      id: `ab-${Date.now()}`,
      astrologerId: astrologer.id,
      astrologerName: astrologer.name,
      astrologerImage: astrologer.imageUrl,
      specialty: astrologer.specialty,
      date: (date || new Date()).toISOString(),
      timeSlot: selectedTimeSlot || '11:00 AM',
      birthDetails: birthDetails || 'Date & time of birth provided',
      specificQuestions: specificQuestions || undefined,
      amount: astrologer.price,
      status: 'confirmed',
      bookedAt: new Date().toISOString(),
    };
    setBookings(prev => [newBooking, ...prev]);
    toast({
      title: "Consultation booked! 🎉",
      description: `Your consultation with ${astrologer.name} for ${selectedTimeSlot || '11:00 AM'} is confirmed.`,
    });
    try {
      const raw = localStorage.getItem('mm:notifications');
      const arr = raw ? JSON.parse(raw) : [];
      arr.unshift({
        id: Date.now().toString(),
        type: 'video_request',
        from: astrologer.name,
        content: `Your astrology consultation with ${astrologer.name} is confirmed for ${selectedTimeSlot || '11:00 AM'}.`,
        timestamp: new Date().toISOString(),
        read: false,
        imageUrl: astrologer.imageUrl,
        specialty: astrologer.specialty,
      });
      localStorage.setItem('mm:notifications', JSON.stringify(arr.slice(0, 50)));
      window.dispatchEvent(new CustomEvent('mm:persisted-state-changed', { detail: { key: 'mm:notifications' } }));
    } catch { /* ignore */ }
    setActiveView('list');
    setMainTab('my-consultations');
  };

  const handleSelectAstrologer = (id: string) => {
    setSelectedAstrologer(id);
    setActiveView('astrologer-profile');
  };
  
  const handleBookConsultation = () => {
    if (!selectedTimeSlot) {
      toast({
        title: "Select a time slot",
        description: "Please choose a time slot before booking your consultation.",
        variant: "destructive",
      });
      return;
    }
    setIsPaymentModalOpen(true);
  };
  
  // After a checkout redirect, confirm the booking only when the server
  // actually redeemed an astrologer-consultation entitlement — then hand the
  // user to the scheduler to book their session slot.
  useCheckoutResult((sku) => {
    setIsPaymentModalOpen(false);
    if (!sku || !sku.startsWith('astrologer')) return;
    const astrologer = astrologers.find(a => a.id === selectedAstrologer) || astrologers[0];
    if (astrologer) {
      recordBooking(astrologer);
    }
    toast({
      title: "Last step: pick your time",
      description: "Choose a slot for your consultation on the Video Dates page.",
    });
    void navigate('/video-dates?mode=consultation');
  });
  
  const handleStartChat = () => {
    setActiveView('chat');
  };
  
  const handleStartVideoCall = () => {
    setActiveView('video-call');
  };

  const handleCancelBooking = (bookingId: string) => {
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'cancelled' as const } : b));
    toast({
      title: "Consultation cancelled",
      description: "Your session has been cancelled. Contact support to request a refund — refunds are not issued automatically.",
    });
  };
  
  const selectedAstrologerData = selectedAstrologer
    ? astrologers.find(a => a.id === selectedAstrologer)
    : null;
    
  // Generate time slots for the selected date
  const timeSlots = ['10:00 AM', '11:00 AM', '12:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM'];
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      {activeView === 'list' && (
        <main className="flex-grow p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-indigo-900 mb-3">
                Astrological Insights for Your Love Journey
              </h1>
              <p className="text-base text-gray-600 max-w-3xl mx-auto">
                Connect with our expert astrologers who specialize in medical professionals' relationships and get personalized compatibility readings.
              </p>
            </div>

            <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'experts' | 'kundali-milan' | 'my-consultations')} className="w-full mb-8">
              <div className="flex justify-center">
                <TabsList className="grid w-full max-w-xl grid-cols-1 sm:grid-cols-3 bg-white border border-slate-200 shadow-sm h-auto p-1.5 gap-1.5 rounded-xl">
                  <TabsTrigger value="experts" className="text-xs sm:text-sm py-2">
                    Astrologers ({astrologers.length})
                  </TabsTrigger>
                  <TabsTrigger value="kundali-milan" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm py-2">
                    <Sparkles size={14} className="text-amber-500 shrink-0" />
                    <span>Kundali Milan (36 Gunas)</span>
                  </TabsTrigger>
                  <TabsTrigger value="my-consultations" className="text-xs sm:text-sm py-2">
                    Consultations {bookings.length > 0 && `(${bookings.length})`}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="experts" className="mt-6">
                <div className="grid md:grid-cols-3 gap-6">
                  {astrologers.map((astrologer) => (
                    <Card 
                      key={astrologer.id} 
                      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer bg-white"
                      onClick={() => handleSelectAstrologer(astrologer.id)}
                    >
                      <div className="relative">
                        <div className="h-48 bg-gradient-to-r from-slate-900 via-mediblue-900 to-indigo-950 flex justify-center items-center">
                          <div className="relative">
                            <Avatar className="w-28 h-28 border-4 border-white">
                              <img src={astrologer.imageUrl} alt={astrologer.name} className="object-cover" />
                            </Avatar>
                            {astrologer.available && (
                              <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                            )}
                          </div>
                        </div>
                        <div className="absolute top-4 right-4">
                          <Badge className="bg-indigo-500 text-white">
                            ₹{astrologer.price}/session
                          </Badge>
                        </div>
                      </div>
                      
                      <CardContent className="p-6">
                        <div className="text-center mb-4">
                          <h3 className="text-xl font-bold text-gray-900">{astrologer.name}</h3>
                          <p className="text-indigo-600 font-medium text-sm">{astrologer.specialty}</p>
                          <div className="flex items-center justify-center mt-2">
                            <div className="flex">
                              {[...Array(5)].map((_, i) => (
                                <Star 
                                  key={i} 
                                  size={16} 
                                  className={i < Math.floor(astrologer.rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-300"} 
                                />
                              ))}
                            </div>
                            <span className="text-sm font-medium text-gray-600 ml-2">
                              {astrologer.rating} ({astrologer.reviews})
                            </span>
                          </div>
                        </div>
                        
                        <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                          {astrologer.description}
                        </p>
                        
                        <div className="border-t pt-4">
                          <div className="flex justify-between items-center text-sm mb-4">
                            <span className="text-gray-500">Experience:</span>
                            <span className="font-semibold text-gray-800">{astrologer.experience} years</span>
                          </div>
                          
                          <div className="flex flex-wrap gap-1 mb-4">
                            {astrologer.languages.map((language) => (
                              <Badge key={language} variant="outline" className="text-xs">
                                {language}
                              </Badge>
                            ))}
                          </div>
                          
                          <div className="flex gap-2">
                            <Button 
                              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectAstrologer(astrologer.id);
                              }}
                            >
                              Book Consultation
                            </Button>
                            <Button 
                              variant="outline" 
                              className="flex-1 text-xs h-9"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAstrologer(astrologer.id);
                                setActiveView('astrologer-profile');
                              }}
                            >
                              View Profile
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="kundali-milan" className="mt-6">
                {(() => {
                  const partnerDoctor = doctorProfiles.find(d => d.id === selectedDoctorId) || doctorProfiles[6];
                  const kundali = computeKundaliMilan(
                    { rashi: myRashi, nakshatra: myNakshatra, manglik: myManglik },
                    { rashi: partnerDoctor.rashi, nakshatra: partnerDoctor.nakshatra, manglik: partnerDoctor.manglik }
                  );

                  return (
                    <div className="max-w-6xl mx-auto space-y-6">
                      <div className="bg-gradient-to-r from-amber-500/10 via-sky-500/10 to-indigo-500/10 border border-amber-200/60 rounded-2xl p-6 text-center">
                        <h2 className="text-2xl font-bold text-slate-900 flex items-center justify-center gap-2">
                          <Sparkles className="text-amber-500" />
                          Vedic Ashta Koota Kundali Milan (36 Gunas)
                        </h2>
                        <p className="text-sm text-slate-600 max-w-2xl mx-auto mt-1">
                          Calculates authentic planetary harmony, temperament, physical affinity, and biological compatibility between doctors according to ancient Jyotish principles.
                        </p>
                      </div>

                      <div className="grid md:grid-cols-12 gap-6">
                        <div className="md:col-span-4 space-y-4">
                          <Card className="bg-white border-slate-200 shadow-sm">
                            <CardContent className="p-5 space-y-4">
                              <h3 className="font-bold text-slate-800 text-sm border-b pb-2">1. Your Astrological Chart</h3>
                              <div>
                                <Label className="text-xs">Your Rashi (Moon Sign)</Label>
                                <Select value={myRashi} onValueChange={setMyRashi}>
                                  <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {rashiList.map(r => (
                                      <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Your Nakshatra (Birth Star)</Label>
                                <Select value={myNakshatra} onValueChange={setMyNakshatra}>
                                  <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {nakshatraList.map(n => (
                                      <SelectItem key={n} value={n} className="text-xs">{n}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Your Manglik Status</Label>
                                <Select value={myManglik} onValueChange={setMyManglik}>
                                  <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {manglikList.map(m => (
                                      <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-white border-slate-200 shadow-sm">
                            <CardContent className="p-5 space-y-4">
                              <h3 className="font-bold text-slate-800 text-sm border-b pb-2">2. Select Prospective Match</h3>
                              <div>
                                <Label className="text-xs">Select Doctor</Label>
                                <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                                  <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {doctorProfiles.map(d => (
                                      <SelectItem key={d.id} value={d.id} className="text-xs">
                                        Dr. {d.name} ({d.specialty}, {d.city})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="bg-slate-50 rounded-xl p-3 border text-xs space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    <img src={partnerDoctor.imageUrl} alt={partnerDoctor.name} />
                                  </Avatar>
                                  <div>
                                    <div className="font-semibold text-slate-800">Dr. {partnerDoctor.name}</div>
                                    <div className="text-slate-500 text-[11px]">{partnerDoctor.specialty}</div>
                                  </div>
                                </div>
                                <div className="pt-2 border-t text-[11px] text-slate-600 space-y-0.5">
                                  <div><span className="font-medium">Rashi:</span> {partnerDoctor.rashi || 'Kanya (Virgo)'}</div>
                                  <div><span className="font-medium">Nakshatra:</span> {partnerDoctor.nakshatra || 'Hasta'}</div>
                                  <div><span className="font-medium">Manglik:</span> {partnerDoctor.manglik || 'Non-Manglik'}</div>
                                  <div><span className="font-medium">Gotra:</span> {partnerDoctor.gotra || 'Vashistha'}</div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        <div className="md:col-span-8 space-y-4">
                          <Card className="bg-white border-slate-200 shadow-sm">
                            <CardContent className="p-6 space-y-6">
                              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-gradient-to-r from-indigo-50 via-sky-50 to-amber-50 rounded-2xl border border-indigo-100">
                                <div className="text-center sm:text-left">
                                  <div className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Guna Milan Score</div>
                                  <div className="text-4xl font-extrabold text-slate-900 mt-1">
                                    {kundali.totalPoints} <span className="text-lg font-normal text-slate-500">/ 36 Gunas</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge className={kundali.isAuspicious ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}>
                                      {kundali.grade}
                                    </Badge>
                                    <span className="text-xs text-slate-600">
                                      {kundali.isAuspicious ? '✓ Auspicious for Matrimony' : '⚠️ Astrological Remediation Recommended'}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right space-y-1">
                                  <div className="text-xs font-medium text-slate-600">
                                    Manglik: <span className="font-bold text-slate-800">{kundali.manglikCompatibility}</span>
                                  </div>
                                  <div className="text-xs font-medium text-slate-600">
                                    Nadi Status: <span className={`font-bold ${kundali.nadiDosha ? 'text-red-600' : 'text-emerald-600'}`}>{kundali.nadiDosha ? 'Nadi Dosha Present' : 'Dosha Mukt (Harmonious)'}</span>
                                  </div>
                                </div>
                              </div>

                              <p className="text-sm text-slate-700 bg-slate-50 p-3.5 rounded-xl border">
                                💡 <span className="font-semibold">Match Assessment:</span> {kundali.summary}
                              </p>

                              <div>
                                <h4 className="text-sm font-bold text-slate-900 mb-3">8-Fold Ashta Koota Breakdown</h4>
                                <div className="border rounded-xl overflow-hidden text-xs">
                                  <div className="grid grid-cols-12 bg-slate-100 font-semibold p-2.5 text-slate-700 border-b">
                                    <div className="col-span-5">Koota (Factor)</div>
                                    <div className="col-span-2 text-center">Score</div>
                                    <div className="col-span-5">Astrological Significance</div>
                                  </div>
                                  {kundali.kootas.map((k, i) => (
                                    <div key={k.name} className={`grid grid-cols-12 p-2.5 items-center ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'} border-b last:border-b-0`}>
                                      <div className="col-span-5 font-medium text-slate-800">{k.name}</div>
                                      <div className="col-span-2 text-center font-bold text-indigo-700">
                                        {k.obtainedPoints} / {k.maxPoints}
                                      </div>
                                      <div className="col-span-5 text-slate-600 text-[11px] leading-tight">{k.description}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-3 pt-2">
                                <Button 
                                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                                  onClick={() => {
                                    setMainTab('experts');
                                    setSelectedAstrologer('1');
                                    setActiveView('astrologer-profile');
                                  }}
                                >
                                  <HeartHandshake className="h-4 w-4 mr-2" />
                                  Consult Acharya Vikram on this Kundali
                                </Button>
                                <Button 
                                  variant="outline" 
                                  className="flex-1"
                                  onClick={() => navigate('/messages', { state: { openChatId: partnerDoctor.id } })}
                                >
                                  <MessageSquare className="h-4 w-4 mr-2" />
                                  Chat with Dr. {partnerDoctor.name}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </TabsContent>

              <TabsContent value="my-consultations" className="mt-6">
                {bookings.length === 0 ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center max-w-xl mx-auto">
                    <CalendarIcon className="mx-auto h-12 w-12 text-indigo-400 mb-3" />
                    <h3 className="text-lg font-semibold text-slate-800 mb-1">No Consultations Booked Yet</h3>
                    <p className="text-sm text-slate-500 mb-6">Choose an expert astrologer to book your personalized compatibility consultation.</p>
                    <Button onClick={() => setMainTab('experts')} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                      Browse Astrologers
                    </Button>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    {bookings.map((b) => (
                      <Card key={b.id} className="overflow-hidden border border-slate-200/80 bg-white">
                        <div className="p-5 flex items-start gap-4">
                          <Avatar className="h-14 w-14 border-2 border-indigo-100 shrink-0">
                            <img src={b.astrologerImage} alt={b.astrologerName} className="object-cover" />
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h3 className="font-bold text-slate-900 truncate">{b.astrologerName}</h3>
                              <Badge className={b.status === 'confirmed' ? 'bg-emerald-500 text-white' : 'bg-slate-400 text-white'}>
                                {b.status === 'confirmed' ? 'Confirmed' : 'Cancelled'}
                              </Badge>
                            </div>
                            <p className="text-xs text-indigo-600 font-medium">{b.specialty}</p>
                            <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                              <div className="flex items-center gap-1.5">
                                <CalendarIcon size={13} className="text-indigo-500 shrink-0" />
                                <span>{new Date(b.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock size={13} className="text-indigo-500 shrink-0" />
                                <span>{b.timeSlot} (30-45 mins)</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="px-5 py-3 bg-slate-50 border-t flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Button size="sm" className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-xs" onClick={() => {
                              setSelectedAstrologer(b.astrologerId);
                              setActiveView('video-call');
                            }} disabled={b.status === 'cancelled'}>
                              <Video size={13} className="mr-1" /> Join Call
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => {
                              setSelectedAstrologer(b.astrologerId);
                              setActiveView('chat');
                            }}>
                              <MessageSquare size={13} className="mr-1" /> Chat
                            </Button>
                          </div>
                          {b.status === 'confirmed' && (
                            <Button size="sm" variant="ghost" className="h-8 text-xs text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleCancelBooking(b.id)}>
                              Cancel
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
            
            <div className="mt-16 bg-indigo-50 rounded-2xl p-8">
              <div className="flex flex-col md:flex-row items-center">
                <div className="md:w-1/2 mb-6 md:mb-0 md:pr-8">
                  <h2 className="text-2xl font-bold text-indigo-900 mb-4">How Astrological Insights Help You</h2>
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="w-6 h-6 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center mr-3">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                      <p className="text-gray-700 text-sm">Understand compatibility beyond surface-level interactions</p>
                    </li>
                    <li className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="w-6 h-6 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center mr-3">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                      <p className="text-gray-700 text-sm">Get insights about potential relationship challenges</p>
                    </li>
                    <li className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="w-6 h-6 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center mr-3">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                      <p className="text-gray-700 text-sm">Discover your astrological compatibility with potential matches</p>
                    </li>
                    <li className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="w-6 h-6 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center mr-3">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                      <p className="text-gray-700 text-sm">Learn about favorable timing for relationship milestones</p>
                    </li>
                  </ul>
                </div>
                <div className="md:w-1/2">
                  <img 
                    src="https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2076&q=80" 
                    alt="Astrology chart" 
                    className="rounded-xl shadow-lg"
                  />
                </div>
              </div>
            </div>
          </div>
        </main>
      )}
      
      {activeView === 'astrologer-profile' && selectedAstrologerData && (
        <main className="flex-grow p-4 md:p-8">
          <div className="max-w-5xl mx-auto">
            <Card className="overflow-hidden bg-white">
              <div className="bg-gradient-to-r from-slate-900 via-mediblue-900 to-indigo-950 text-white p-8">
                <div className="flex flex-col md:flex-row items-center md:items-start">
                  <Avatar className="w-32 h-32 border-4 border-white mb-4 md:mb-0 md:mr-6">
                    <img src={selectedAstrologerData.imageUrl} alt={selectedAstrologerData.name} className="object-cover" />
                  </Avatar>
                  <div className="text-center md:text-left">
                    <h1 className="text-3xl font-bold mb-2">{selectedAstrologerData.name}</h1>
                    <p className="text-indigo-200 text-lg mb-4">{selectedAstrologerData.specialty}</p>
                    <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
                      {selectedAstrologerData.languages.map((language) => (
                        <Badge key={language} className="bg-white/20 text-white hover:bg-white/30">
                          {language}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-center md:justify-start">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i}
                            className={`h-5 w-5 ${i < Math.floor(selectedAstrologerData.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-white/30'}`}
                          />
                        ))}
                      </div>
                      <span className="ml-2">
                        {selectedAstrologerData.rating} ({selectedAstrologerData.reviews} reviews)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <CardContent className="p-0">
                <Tabs defaultValue="about">
                  <TabsList className="w-full justify-start px-4 sm:px-6 pt-3 h-auto p-1 flex flex-wrap gap-1 border-b">
                    <TabsTrigger value="about" className="text-xs sm:text-sm py-2">About</TabsTrigger>
                    <TabsTrigger value="book" className="text-xs sm:text-sm py-2">Book Consultation</TabsTrigger>
                    <TabsTrigger value="reviews" className="text-xs sm:text-sm py-2">Reviews</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="about" className="p-6">
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-3">About {selectedAstrologerData.name}</h3>
                        <p className="text-gray-700">
                          {selectedAstrologerData.description}
                        </p>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-3">Expertise</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="bg-indigo-50 p-4 rounded-lg">
                            <h4 className="font-medium text-indigo-800 mb-2">Relationship Compatibility</h4>
                            <p className="text-gray-700 text-sm">Analyzes birth charts to determine relationship dynamics and compatibility factors.</p>
                          </div>
                          
                          <div className="bg-indigo-50 p-4 rounded-lg">
                            <h4 className="font-medium text-indigo-800 mb-2">Medical Professionals' Charts</h4>
                            <p className="text-gray-700 text-sm">Specializes in readings for doctors and healthcare workers, understanding their unique challenges.</p>
                          </div>
                          
                          <div className="bg-indigo-50 p-4 rounded-lg">
                            <h4 className="font-medium text-indigo-800 mb-2">Future Predictions</h4>
                            <p className="text-gray-700 text-sm">Provides insights into favorable periods for relationship milestones and personal growth.</p>
                          </div>
                          
                          <div className="bg-indigo-50 p-4 rounded-lg">
                            <h4 className="font-medium text-indigo-800 mb-2">Remedial Measures</h4>
                            <p className="text-gray-700 text-sm">Suggests remedies to overcome relationship challenges indicated in your astrological chart.</p>
                          </div>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-3">Consultation Details</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center">
                            <div className="text-indigo-600 font-bold text-2xl">{selectedAstrologerData.experience}+</div>
                            <div className="text-gray-600 text-sm">Years Experience</div>
                          </div>
                          <div className="text-center">
                            <div className="text-indigo-600 font-bold text-2xl">30-45</div>
                            <div className="text-gray-600 text-sm">Minutes Per Session</div>
                          </div>
                          <div className="text-center">
                            <div className="text-indigo-600 font-bold text-2xl">₹{selectedAstrologerData.price}</div>
                            <div className="text-gray-600 text-sm">Per Consultation</div>
                          </div>
                          <div className="text-center">
                            <div className="text-indigo-600 font-bold text-2xl">{selectedAstrologerData.languages.length}</div>
                            <div className="text-gray-600 text-sm">Languages Spoken</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between">
                        <Button 
                          variant="outline"
                          onClick={() => setActiveView('list')}
                        >
                          Back to List
                        </Button>
                        
                        <div className="space-x-3">
                          <Button 
                            variant="outline"
                            className="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                            onClick={handleStartChat}
                          >
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Chat Now
                          </Button>
                          <Button
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={handleBookConsultation}
                          >
                            Book Consultation
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="book" className="p-6">
                    <div className="grid md:grid-cols-2 gap-8">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-4">Select Date & Time</h3>
                        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border">
                          <Calendar
                            mode="single"
                            selected={date}
                            onSelect={setDate}
                            className="mx-auto"
                            disabled={(date: Date) => date < new Date() || date > new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)}
                          />
                        </div>
                        
                        <div className="mb-6">
                          <h4 className="font-medium mb-3 text-sm text-slate-800">Available Time Slots</h4>
                          <div className="grid grid-cols-3 gap-2">
                            {timeSlots.map((time) => (
                              <button
                                key={time}
                                type="button"
                                className={`py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
                                  selectedTimeSlot === time
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                                onClick={() => setSelectedTimeSlot(time)}
                              >
                                {time}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-4">Consultation Details</h3>
                        
                        <div className="bg-indigo-50 rounded-2xl p-5 mb-6 border border-indigo-100">
                          <div className="flex items-start mb-4">
                            <Avatar className="w-14 h-14 mr-4 border-2 border-indigo-200">
                              <img src={selectedAstrologerData.imageUrl} alt={selectedAstrologerData.name} className="object-cover" />
                            </Avatar>
                            <div>
                              <h4 className="font-bold text-gray-900">{selectedAstrologerData.name}</h4>
                              <p className="text-sm text-indigo-600">{selectedAstrologerData.specialty}</p>
                              <div className="flex mt-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star 
                                    key={i}
                                    className={`h-3 w-3 ${i < Math.floor(selectedAstrologerData.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-2.5 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Date:</span>
                              <span className="font-medium">
                                {date ? date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Select a date'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Time:</span>
                              <span className="font-medium">{selectedTimeSlot || 'Select a time'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Duration:</span>
                              <span className="font-medium">30-45 minutes</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Language:</span>
                              <span className="font-medium">{selectedAstrologerData.languages[0]}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between font-medium">
                              <span>Total Amount:</span>
                              <span className="text-indigo-600 font-bold text-base">₹{selectedAstrologerData.price}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="birth-details">Your Birth Details</Label>
                            <Input 
                              id="birth-details" 
                              placeholder="e.g. 14 Aug 1994, 08:30 AM, Mumbai" 
                              value={birthDetails}
                              onChange={(e) => setBirthDetails(e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="specific-questions">Specific Questions (Optional)</Label>
                            <Input 
                              id="specific-questions" 
                              placeholder="Any specific questions regarding compatibility" 
                              value={specificQuestions}
                              onChange={(e) => setSpecificQuestions(e.target.value)}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center mt-4 mb-6 bg-blue-50 p-3 rounded-lg border border-blue-100">
                          <Info className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0" />
                          <p className="text-xs text-blue-700">
                            Your birth details are essential for accurate astrological readings.
                          </p>
                        </div>
                        
                        <Button 
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 text-base font-semibold"
                          onClick={handleBookConsultation}
                          disabled={!date || !selectedTimeSlot}
                        >
                          Proceed to Payment
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="reviews" className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">Client Reviews</h3>
                    
                    <div className="flex items-center mb-8">
                      <div className="text-center mr-8">
                        <div className="text-5xl font-bold text-gray-900">{selectedAstrologerData.rating}</div>
                        <div className="flex justify-center my-2">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i}
                              className={`h-5 w-5 ${i < Math.floor(selectedAstrologerData.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                            />
                          ))}
                        </div>
                        <div className="text-gray-500 text-sm">{selectedAstrologerData.reviews} reviews</div>
                      </div>
                      
                      <div className="flex-grow">
                        <div className="space-y-2">
                          {[5, 4, 3, 2, 1].map((rating) => (
                            <div key={rating} className="flex items-center">
                              <div className="w-16 text-sm text-gray-600 flex items-center">
                                {rating} <Star className="h-3 w-3 text-gray-400 ml-1" />
                              </div>
                              <div className="flex-grow mx-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-yellow-400 rounded-full"
                                  style={{
                                    width: rating === 5 ? '75%' : 
                                          rating === 4 ? '20%' : 
                                          rating === 3 ? '5%' : 
                                          rating === 2 ? '0%' : '0%'
                                  }}
                                ></div>
                              </div>
                              <div className="w-10 text-sm text-gray-600">
                                {rating === 5 ? '75%' : 
                                 rating === 4 ? '20%' : 
                                 rating === 3 ? '5%' : 
                                 rating === 2 ? '0%' : '0%'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <ScrollArea className="h-[360px] pr-4">
                      <div className="space-y-6">
                        {[
                          {
                            name: "Dr. Ravi Kumar",
                            profession: "Cardiologist",
                            rating: 5,
                            time: "2 weeks ago",
                            text: "The reading was incredibly accurate. The astrologer provided insights about my relationship patterns that I had never considered before. The compatibility analysis with my match was spot on!"
                          },
                          {
                            name: "Dr. Anjali Desai",
                            profession: "Pediatrician",
                            rating: 5,
                            time: "1 month ago",
                            text: "Very professional and knowledgeable. Helped me understand why I was facing certain challenges in my relationships. The remedies suggested have been quite helpful."
                          },
                          {
                            name: "Dr. Sanjay Mehta",
                            profession: "Neurologist",
                            rating: 4,
                            time: "2 months ago",
                            text: "Good insights and detailed analysis. Would have liked a bit more time for questions, but overall a very valuable session."
                          },
                          {
                            name: "Dr. Priya Shah",
                            profession: "Dermatologist",
                            rating: 5,
                            time: "3 months ago",
                            text: "Incredible experience! The compatibility analysis helped me understand my relationship with another doctor so much better. Highly recommended for medical professionals."
                          }
                        ].map((review, index) => (
                          <div key={index} className="border-b pb-6 last:border-b-0">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center">
                                <div className="font-medium text-gray-900">{review.name}</div>
                                <div className="text-sm text-gray-500 ml-2">• {review.profession}</div>
                              </div>
                              <div className="text-sm text-gray-500">{review.time}</div>
                            </div>
                            <div className="flex mb-3">
                              {[...Array(5)].map((_, i) => (
                                <Star 
                                  key={i}
                                  className={`h-4 w-4 ${i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                                />
                              ))}
                            </div>
                            <p className="text-gray-700 text-sm">{review.text}</p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </main>
      )}
      
      {activeView === 'chat' && selectedAstrologerData && (
        <div className="flex-grow p-4">
          <div className="max-w-4xl mx-auto h-[80vh]">
            <Chat 
              doctorId={selectedAstrologerData.id}
              doctorName={selectedAstrologerData.name}
              doctorImage={selectedAstrologerData.imageUrl}
              onStartVideoCall={handleStartVideoCall}
              onClose={() => setActiveView('astrologer-profile')}
            />
          </div>
        </div>
      )}
      
      {activeView === 'video-call' && selectedAstrologerData && (
        <div className="flex-grow">
          <VideoCall 
            doctorId={selectedAstrologerData.id}
            doctorName={selectedAstrologerData.name}
            doctorImage={selectedAstrologerData.imageUrl}
            onEndCall={() => setActiveView('astrologer-profile')}
          />
        </div>
      )}
      
      {/* Payment Modal */}
      {selectedAstrologerData && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          serviceName={`Consultation with ${selectedAstrologerData.name}`}
          amount={selectedAstrologerData.price}
          // Audit M7: one SKU per astrologer tier — the server prices by SKU,
          // so a coerced amount can no longer get the ₹1,999 expert for ₹1,499.
          sku={`astrologer-consultation-${selectedAstrologerData.price}`}
          onSuccess={(sku) => {
            // Record only when the server redeemed an astrologer entitlement
            // (sku undefined = local sandbox with no payment server).
            if (!sku || sku.startsWith('astrologer')) {
              recordBooking(selectedAstrologerData);
            }
          }}
        />
      )}
    </div>
  );
};

export default AstrologerPage;
