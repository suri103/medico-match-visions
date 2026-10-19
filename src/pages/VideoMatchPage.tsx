
import React, { useState } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import Header from '@/components/Header';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, Video, Users, Calendar as CalendarIcon, X, Check, MessageSquare } from 'lucide-react';
import DoctorCard from '@/components/DoctorCard';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { usePlan } from '@/hooks/usePlan';
import { demoModeEnabled } from '@/lib/devAuth';
import { Doctor } from '@/features/matches/types';
import { Separator } from '@/components/ui/separator';
import VideoCall from '@/components/VideoCall';
import { loadScheduled, saveScheduled } from '@/lib/videoStore';
import { useFavoritesContext } from '@/features/favorites/FavoritesContext';
import { useNavigate } from 'react-router-dom';

interface VideoMatchRequest {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorImage: string;
  doctorSpecialty: string;
  proposedDate: Date;
  message: string;
  status: 'pending' | 'accepted' | 'declined';
}

const VideoMatchPage: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { blockedIds, connections } = useFavoritesContext();
  const { planName, consumeVideoDate } = usePlan();
  const [activeTab, setActiveTab] = useState('explore');
  // Audit H9: fixtures are DEMO-ONLY (same gate every other surface uses). They
  // previously rendered in production, and "accepting" one decremented the real
  // monthly video-date quota for a counterparty who does not exist.
  const [pendingRequests, setPendingRequests] = useState<VideoMatchRequest[]>(() =>
    demoModeEnabled ? [
    {
      id: '1',
      doctorId: '101',
      doctorName: 'Dr. Suresh Kumar',
      doctorImage: 'https://randomuser.me/api/portraits/men/32.jpg',
      doctorSpecialty: 'Neurologist',
      proposedDate: new Date(Date.now() + 3600000 * 24 * 2),
      message: 'Would love to connect and discuss our common interests in neurology research.',
      status: 'pending'
    },
    {
      id: '2',
      doctorId: '102',
      doctorName: 'Dr. Anjali Desai',
      doctorImage: 'https://randomuser.me/api/portraits/women/44.jpg',
      doctorSpecialty: 'Pediatrician',
      proposedDate: new Date(Date.now() + 3600000 * 24 * 3),
      message: 'Hi there! I noticed we both enjoy hiking. Let\'s chat about work-life balance.',
      status: 'pending'
    }
  ] : []);
  
  const allMatchSuggestions: Doctor[] = demoModeEnabled ? [

    {
      id: '201',
      name: 'Dr. Ravi Patel',
      age: 32,
      specialty: 'Cardiologist',
      hospital: 'Apollo Hospitals',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      imageUrl: 'https://randomuser.me/api/portraits/men/22.jpg',
      matchPercentage: 92,
      interests: ['Music', 'Hiking', 'Photography'],
      isOnline: true,
      sexualOrientation: 'Straight'
    },
    {
      id: '202',
      name: 'Dr. Meera Sharma',
      age: 29,
      specialty: 'Dermatologist',
      hospital: 'Fortis Hospital',
      city: 'Delhi',
      state: 'Delhi',
      country: 'India',
      imageUrl: 'https://randomuser.me/api/portraits/women/28.jpg',
      matchPercentage: 88,
      interests: ['Travel', 'Cooking', 'Yoga'],
      isOnline: false,
      sexualOrientation: 'Straight'
    },
    {
      id: '203',
      name: 'Dr. Arun Verma',
      age: 35,
      specialty: 'Orthopedic Surgeon',
      hospital: 'Max Healthcare',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      imageUrl: 'https://randomuser.me/api/portraits/men/35.jpg',
      matchPercentage: 85,
      interests: ['Sports', 'Reading', 'Cinema'],
      isOnline: true,
      sexualOrientation: 'Straight'
    }
  ] : [];
  
  const dismissed = new Set([...blockedIds, ...connections.filter(c => c.status === 'passed').map(c => c.doctorId)]);
  const matchSuggestions = allMatchSuggestions.filter(d => !dismissed.has(d.id) && d.profileVisibility !== 'hidden' && d.profileVisibility !== 'private');

  const [inCallWith, setInCallWith] = useState<{id: string, name: string, image: string} | null>(null);
  const [sentIds, setSentIds] = usePersistedState<string[]>('mm:videoMatchSent', []);
  
  const handleSendRequest = (doctorId: string) => {
    if (sentIds.includes(doctorId)) {
      toast({ title: "Request Already Sent", description: "A request has already been sent for this doctor." });
      return;
    }
    setSentIds((prev) => [...prev, doctorId]);
    const doc = matchSuggestions.find((d) => d.id === doctorId);
    toast({
      title: "Request Sent",
      description: doc
        ? `Your video match request has been sent to ${doc.name}.`
        : "Your video match request has been sent successfully."
    });
  };
  
  const handleAcceptRequest = (requestId: string) => {
    // Accepting books a video date — same quota gate as scheduling one (audit H3).
    if (!consumeVideoDate()) {
      toast({
        title: "Video date limit reached",
        description: `Your ${planName} plan's monthly video date limit is reached. Upgrade for more.`,
        variant: "destructive"
      });
      return;
    }
    const req = pendingRequests.find(r => r.id === requestId);
    setPendingRequests(
      pendingRequests.map(r => 
        r.id === requestId ? {...r, status: 'accepted'} : r
      )
    );
    if (req) {
      const scheduled = loadScheduled();
      scheduled.push({ id: req.id, doctorId: req.doctorId, doctorName: req.doctorName, doctorImage: req.doctorImage, doctorSpecialty: req.doctorSpecialty, date: req.proposedDate.toISOString(), duration: 30, status: 'scheduled' });
      saveScheduled(scheduled);
    }
    toast({
      title: "Request Accepted",
      description: "You have accepted the video match request."
    });
  };
  
  const handleDeclineRequest = (requestId: string) => {
    setPendingRequests(
      pendingRequests.map(req => 
        req.id === requestId ? {...req, status: 'declined'} : req
      )
    );
    
    toast({
      title: "Request Declined",
      description: "You have declined the video match request."
    });
  };
  
  const startCall = (doctor: {id: string, name: string, image: string}) => {
    setInCallWith(doctor);
  };
  
  const endCall = () => {
    setInCallWith(null);
    toast({
      title: "Call Ended",
      description: "Your video call has ended."
    });
  };
  
  if (inCallWith) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="h-16 bg-black text-white flex items-center justify-between px-4">
          <div className="flex items-center">
            <Video className="h-5 w-5 mr-2" />
            <span>Video Call with {inCallWith.name}</span>
          </div>
          <Button variant="ghost" className="text-white" onClick={endCall}>
            <X className="h-5 w-5 mr-1" /> End Call
          </Button>
        </div>
        <div className="flex-grow">
          <VideoCall 
            doctorId={inCallWith.id}
            doctorName={inCallWith.name}
            doctorImage={inCallWith.image}
            onEndCall={endCall}
          />
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-mediblue-800 mb-4 md:mb-0">
              Video Match
            </h1>
            
            <Button className="flex items-center" onClick={() => setActiveTab('explore')}>
              <Video className="mr-2 h-4 w-4" />
              Schedule Video Date
            </Button>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-1 sm:grid-cols-3 mb-8 h-auto p-1.5 gap-1.5 bg-white border border-slate-200 shadow-sm rounded-xl">
              <TabsTrigger value="explore" className="text-xs sm:text-sm py-2 data-[state=active]:bg-mediblue-50 data-[state=active]:text-mediblue-600">
                <Users className="h-4 w-4 mr-2" />
                Explore Matches
              </TabsTrigger>
              <TabsTrigger value="requests" className="text-xs sm:text-sm py-2 data-[state=active]:bg-mediblue-50 data-[state=active]:text-mediblue-600">
                <MessageSquare className="h-4 w-4 mr-2" />
                Pending Requests
                {pendingRequests.filter(r => r.status === 'pending').length > 0 && (
                  <Badge className="ml-1.5 px-1.5 py-0 text-[10px] bg-mediblue-500">
                    {pendingRequests.filter(r => r.status === 'pending').length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="scheduled" className="text-xs sm:text-sm py-2 data-[state=active]:bg-mediblue-50 data-[state=active]:text-mediblue-600">
                <Calendar className="h-4 w-4 mr-2" />
                Scheduled Dates
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="explore" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Find Your Match</CardTitle>
                  <CardDescription>Discover compatible doctors for video dates based on your preferences</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {matchSuggestions.map(doctor => (
                      <div key={doctor.id} className="relative">
                        {sentIds.includes(doctor.id) && (
                          <span className="absolute top-2 right-2 z-10 bg-green-600 text-white text-xs font-medium px-2 py-1 rounded-full shadow">
                            &#10003; Request Sent
                          </span>
                        )}
                        <DoctorCard
                          id={doctor.id}
                          name={doctor.name.replace(/^Dr\.?\s*/i, '')}
                          age={doctor.age}
                          specialty={doctor.specialty}
                          hospital={doctor.hospital}
                          city={doctor.city}
                          imageUrl={doctor.imageUrl}
                          matchPercentage={doctor.matchPercentage}
                          interests={doctor.interests}
                          isOnline={doctor.isOnline}
                          variant="discover"
                          onLike={() => handleSendRequest(doctor.id)}
                          onVideo={() => handleSendRequest(doctor.id)}
                          onMessage={() => handleSendRequest(doctor.id)}
                        />
                      </div>
                    ))}
                    {matchSuggestions.length === 0 && (
                      <p className="text-sm text-slate-500 md:col-span-2 lg:col-span-3">
                        No video-match suggestions yet. They appear here once you and another
                        member have both shown interest — send an interest from Matches or Browse.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="requests" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Video Match Requests</CardTitle>
                  <CardDescription>Respond to video date requests you've received</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {pendingRequests.length > 0 ? (
                    <div className="space-y-4">
                      {pendingRequests.map(request => (
                        <Card key={request.id} className={`overflow-hidden ${
                          request.status === 'accepted' ? 'border-green-200 bg-green-50' : 
                          request.status === 'declined' ? 'border-red-200 bg-red-50' : ''
                        }`}>
                          <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row gap-4">
                              <Avatar className="w-16 h-16 rounded-full">
                                <AvatarImage src={request.doctorImage} alt={request.doctorName} />
                                <AvatarFallback>{request.doctorName.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                              </Avatar>
                              <div className="flex-grow">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <h3 className="font-semibold text-lg">{request.doctorName}</h3>
                                    <p className="text-sm text-gray-600">{request.doctorSpecialty}</p>
                                  </div>
                                  <div className="mt-2 sm:mt-0">
                                    <div className="flex items-center text-sm text-gray-600">
                                      <CalendarIcon className="h-4 w-4 mr-1 text-mediblue-500" />
                                      {format(request.proposedDate, 'MMM dd, yyyy')}
                                    </div>
                                    <div className="flex items-center text-sm text-gray-600">
                                      <Clock className="h-4 w-4 mr-1 text-mediblue-500" />
                                      {format(request.proposedDate, 'h:mm a')}
                                    </div>
                                  </div>
                                </div>
                                
                                <p className="text-sm mt-2 text-gray-700">"{request.message}"</p>
                                
                                {request.status === 'pending' ? (
                                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                                    <Button 
                                      className="sm:w-auto"
                                      onClick={() => {
                                        handleAcceptRequest(request.id);
                                        startCall({
                                          id: request.doctorId,
                                          name: request.doctorName,
                                          image: request.doctorImage
                                        });
                                      }}
                                    >
                                      <Check className="h-4 w-4 mr-1" />
                                      Accept & Join Now
                                    </Button>
                                    <Button variant="outline" className="sm:w-auto" onClick={() => { toast({ title: "Reschedule", description: "Pick a new time on the Video Dates page." }); navigate('/video-dates'); }}>
                                      Schedule for Later
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      className="text-red-600 sm:w-auto"
                                      onClick={() => handleDeclineRequest(request.id)}
                                    >
                                      <X className="h-4 w-4 mr-1" />
                                      Decline
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="mt-4">
                                    <Badge className={
                                      request.status === 'accepted' ? 'bg-green-500' : 'bg-red-500'
                                    }>
                                      {request.status === 'accepted' ? 'Accepted' : 'Declined'}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <MessageSquare className="mx-auto h-12 w-12 text-gray-300" />
                      <h3 className="mt-4 text-lg font-medium">No pending requests</h3>
                      <p className="mt-2 text-gray-500">When doctors send you video match requests, they will appear here</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="scheduled" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Scheduled Video Dates</CardTitle>
                  <CardDescription>Your upcoming video date appointments</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="text-center py-12">
                    <Calendar className="mx-auto h-12 w-12 text-gray-300" />
                    <h3 className="mt-4 text-lg font-medium">No scheduled dates</h3>
                    <p className="mt-2 text-gray-500">When you accept and schedule video dates, they will appear here</p>
                    <Button className="mt-4" onClick={() => setActiveTab('explore')}>Find Matches</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Video Match Tips</CardTitle>
              <CardDescription>Get the most out of your video dates</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-mediblue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-mediblue-700 mb-2">Before Your Date</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <div className="bg-mediblue-200 rounded-full p-1 mt-0.5">
                        <span className="block h-1.5 w-1.5 rounded-full bg-mediblue-600" />
                      </div>
                      <span>Choose a quiet, well-lit location</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="bg-mediblue-200 rounded-full p-1 mt-0.5">
                        <span className="block h-1.5 w-1.5 rounded-full bg-mediblue-600" />
                      </div>
                      <span>Test your camera and microphone</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="bg-mediblue-200 rounded-full p-1 mt-0.5">
                        <span className="block h-1.5 w-1.5 rounded-full bg-mediblue-600" />
                      </div>
                      <span>Prepare some conversation topics</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-mediteal-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-mediteal-700 mb-2">During Your Date</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <div className="bg-mediteal-200 rounded-full p-1 mt-0.5">
                        <span className="block h-1.5 w-1.5 rounded-full bg-mediteal-600" />
                      </div>
                      <span>Maintain eye contact by looking at the camera</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="bg-mediteal-200 rounded-full p-1 mt-0.5">
                        <span className="block h-1.5 w-1.5 rounded-full bg-mediteal-600" />
                      </div>
                      <span>Ask open-ended questions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="bg-mediteal-200 rounded-full p-1 mt-0.5">
                        <span className="block h-1.5 w-1.5 rounded-full bg-mediteal-600" />
                      </div>
                      <span>Be present and minimize distractions</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-amber-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-amber-700 mb-2">After Your Date</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <div className="bg-amber-200 rounded-full p-1 mt-0.5">
                        <span className="block h-1.5 w-1.5 rounded-full bg-amber-600" />
                      </div>
                      <span>Send a follow-up message</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="bg-amber-200 rounded-full p-1 mt-0.5">
                        <span className="block h-1.5 w-1.5 rounded-full bg-amber-600" />
                      </div>
                      <span>Schedule a second date if interested</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="bg-amber-200 rounded-full p-1 mt-0.5">
                        <span className="block h-1.5 w-1.5 rounded-full bg-amber-600" />
                      </div>
                      <span>Add them to your favorites list</span>
                    </li>
                  </ul>
                </div>
              </div>
              
              <Separator className="my-6" />
              
              <div className="text-center">
                <h3 className="font-medium mb-2">Ready to find your perfect match?</h3>
                <Button onClick={() => setActiveTab('explore')}>Explore Video Matches</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default VideoMatchPage;
