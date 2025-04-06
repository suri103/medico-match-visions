
import React, { useState } from 'react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import VideoCall from '@/components/VideoCall';
import VideoDateInvites from '@/components/VideoDateInvites';
import VideoDateHistory from '@/components/VideoDateHistory';
import { Calendar, Clock, Video, Calendar as CalendarIcon, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

// Sample data for upcoming and past video dates
const videoDatesList = {
  upcoming: [
    {
      id: '1',
      doctorName: 'Priya Sharma',
      doctorSpecialty: 'Cardiologist',
      doctorImage: 'https://randomuser.me/api/portraits/women/44.jpg',
      date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2), // 2 days from now
      duration: 30,
      status: 'confirmed'
    },
    {
      id: '2',
      doctorName: 'Rajiv Mehta', 
      doctorSpecialty: 'Neurologist',
      doctorImage: 'https://randomuser.me/api/portraits/men/42.jpg',
      date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5), // 5 days from now
      duration: 45,
      status: 'confirmed'
    }
  ],
  past: [
    {
      id: '3',
      doctorName: 'Ananya Patel',
      doctorSpecialty: 'Pediatrician',
      doctorImage: 'https://randomuser.me/api/portraits/women/67.jpg',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
      duration: 30,
      status: 'completed',
      rating: 5
    },
    {
      id: '4',
      doctorName: 'Vikram Singh',
      doctorSpecialty: 'Orthopedic Surgeon',
      doctorImage: 'https://randomuser.me/api/portraits/men/79.jpg',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10), // 10 days ago
      duration: 45,
      status: 'completed',
      rating: 4
    }
  ]
};

// Sample data for invites
const invitesList = [
  {
    id: 'inv1',
    senderId: '7',
    senderName: 'Sarah Johnson',
    senderImage: 'https://randomuser.me/api/portraits/women/22.jpg',
    message: 'I would love to discuss my research on cardiac health. Are you available for a video call?',
    proposedDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3), // 3 days from now
    duration: 30,
    status: 'pending'
  },
  {
    id: 'inv2',
    senderId: '8',
    senderName: 'David Chen',
    senderImage: 'https://randomuser.me/api/portraits/men/53.jpg',
    message: 'I saw your profile and would like to connect to discuss our mutual interests in preventive medicine.',
    proposedDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4), // 4 days from now
    duration: 45,
    status: 'pending'
  }
];

// Video date history
const historyData = [
  {
    id: 'hist1',
    doctorId: '3',
    doctorName: 'Ananya Patel',
    doctorImage: 'https://randomuser.me/api/portraits/women/67.jpg',
    specialty: 'Pediatrician',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
    duration: 30,
    status: 'completed',
    rating: 5,
    notes: 'Great discussion about pediatric care approaches. She provided valuable insights.'
  },
  {
    id: 'hist2',
    doctorId: '4',
    doctorName: 'Vikram Singh',
    doctorImage: 'https://randomuser.me/api/portraits/men/79.jpg',
    specialty: 'Orthopedic Surgeon',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10), // 10 days ago
    duration: 45,
    status: 'completed',
    rating: 4,
    notes: 'Shared interesting research on minimally invasive surgical techniques.'
  },
  {
    id: 'hist3',
    doctorId: '6',
    doctorName: 'Arjun Kapoor',
    doctorImage: 'https://randomuser.me/api/portraits/men/32.jpg',
    specialty: 'Psychiatrist',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15), // 15 days ago
    duration: 30,
    status: 'missed'
  },
  {
    id: 'hist4',
    doctorId: '5',
    doctorName: 'Meera Reddy',
    doctorImage: 'https://randomuser.me/api/portraits/women/22.jpg',
    specialty: 'Dermatologist',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20), // 20 days ago
    duration: 30,
    status: 'cancelled'
  }
];

// Available time slots for scheduling
const timeSlots = [
  '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
  '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
  '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
  '5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM',
  '7:00 PM', '7:30 PM', '8:00 PM'
];

// Sample doctors data
const availableDoctors = [
  {
    id: '1',
    name: 'Priya Sharma',
    specialty: 'Cardiologist',
    imageUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
  },
  {
    id: '2',
    name: 'Rajiv Mehta',
    specialty: 'Neurologist',
    imageUrl: 'https://randomuser.me/api/portraits/men/42.jpg',
  },
  {
    id: '3',
    name: 'Ananya Patel',
    specialty: 'Pediatrician',
    imageUrl: 'https://randomuser.me/api/portraits/women/67.jpg',
  },
  {
    id: '4',
    name: 'Sanjay Kumar',
    specialty: 'Orthopedic Surgeon',
    imageUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
  },
  {
    id: '5',
    name: 'Meera Reddy',
    specialty: 'Dermatologist',
    imageUrl: 'https://randomuser.me/api/portraits/women/22.jpg',
  }
];

const VideoDatePage = () => {
  const [activeTab, setActiveTab] = useState('upcoming');
  const [inCall, setInCall] = useState(false);
  const [selectedVideoDate, setSelectedVideoDate] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<string>('30');
  const [personalMessage, setPersonalMessage] = useState('');
  const [invites, setInvites] = useState(invitesList);
  const [history, setHistory] = useState(historyData);
  const [notificationCount, setNotificationCount] = useState(2);

  const handleJoinCall = (id: string) => {
    setSelectedVideoDate(id);
    setInCall(true);
  };

  const handleEndCall = () => {
    setInCall(false);
    setSelectedVideoDate(null);
    // After ending the call, show rating dialog or redirect back
    toast({
      title: "Video Call Ended",
      description: "How would you rate this video date?",
    });
  };

  const handleScheduleVideoDate = () => {
    if (!selectedDoctor || !date || !selectedTimeSlot) {
      toast({
        title: "Incomplete Information",
        description: "Please select a doctor, date, and time slot.",
        variant: "destructive"
      });
      return;
    }

    const doctor = availableDoctors.find(d => d.id === selectedDoctor);
    
    toast({
      title: "Video Date Scheduled",
      description: `Your video date with Dr. ${doctor?.name} has been scheduled for ${format(date, 'PPP')} at ${selectedTimeSlot}.`,
    });

    // Update upcoming dates list
    const newVideoDate = {
      id: `new-${Date.now()}`,
      doctorName: doctor?.name || '',
      doctorSpecialty: doctor?.specialty || '',
      doctorImage: doctor?.imageUrl || '',
      date: date,
      duration: parseInt(selectedDuration),
      status: 'confirmed'
    };

    videoDatesList.upcoming.push(newVideoDate);
    
    // Reset form
    setSelectedDoctor('');
    setDate(new Date());
    setSelectedTimeSlot(null);
    setSelectedDuration('30');
    setPersonalMessage('');
    
    // Switch to upcoming tab
    setActiveTab('upcoming');
  };

  const handleAcceptInvite = (inviteId: string) => {
    // Find the invite
    const invite = invites.find(inv => inv.id === inviteId);
    if (!invite) return;
    
    // Add to upcoming video dates
    const newVideoDate = {
      id: `accepted-${Date.now()}`,
      doctorName: invite.senderName,
      doctorSpecialty: '',
      doctorImage: invite.senderImage,
      date: invite.proposedDate,
      duration: invite.duration,
      status: 'confirmed'
    };
    
    videoDatesList.upcoming.push(newVideoDate);
    
    // Update invites list - remove the accepted invite
    setInvites(invites.filter(inv => inv.id !== inviteId));
    setNotificationCount(prev => Math.max(0, prev - 1));
    
    // Switch to upcoming tab
    setActiveTab('upcoming');
  };

  const handleDeclineInvite = (inviteId: string) => {
    // Update invites list - remove the declined invite
    setInvites(invites.filter(inv => inv.id !== inviteId));
    setNotificationCount(prev => Math.max(0, prev - 1));
  };

  const handleRescheduleInvite = (inviteId: string) => {
    toast({
      title: "Reschedule Request",
      description: "A rescheduling request has been sent. You'll be notified when they respond.",
    });
    
    // In a real app, we would update the invite status
    setInvites(invites.map(inv => 
      inv.id === inviteId 
        ? { ...inv, status: 'rescheduled' as const } 
        : inv
    ));
  };

  const handleRebook = (doctorId: string) => {
    const doctor = availableDoctors.find(d => d.id === doctorId);
    if (doctor) {
      setSelectedDoctor(doctorId);
      setActiveTab('schedule');
      toast({
        title: "Schedule a new video date",
        description: `Select a date and time to schedule with Dr. ${doctor.name}`,
      });
    }
  };

  const handleViewRecording = (sessionId: string) => {
    toast({
      title: "Video Recording",
      description: "This feature is coming soon. Video recordings will be available in the future.",
    });
  };

  const selectedVideoDateData = selectedVideoDate
    ? [...videoDatesList.upcoming, ...videoDatesList.past].find(date => date.id === selectedVideoDate)
    : null;

  if (inCall && selectedVideoDateData) {
    return (
      <div className="min-h-screen flex flex-col">
        <VideoCall
          doctorId={selectedVideoDateData.id}
          doctorName={selectedVideoDateData.doctorName}
          doctorImage={selectedVideoDateData.doctorImage}
          onEndCall={handleEndCall}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-mediblue-800">
              Video Dates
            </h1>
            
            <Button 
              variant="outline" 
              className="flex items-center space-x-2 relative"
              onClick={() => setActiveTab('invites')}
            >
              <Bell size={16} />
              <span>Invites</span>
              {notificationCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {notificationCount}
                </span>
              )}
            </Button>
          </div>
          
          <Tabs defaultValue="upcoming" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-8">
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="invites">Invites</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="schedule">Schedule New</TabsTrigger>
            </TabsList>
            
            <TabsContent value="upcoming" className="space-y-6">
              {videoDatesList.upcoming.length > 0 ? (
                videoDatesList.upcoming.map((videoDate) => (
                  <Card key={videoDate.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-0">
                      <div className="flex flex-col md:flex-row">
                        <div className="w-full md:w-1/4">
                          <img 
                            src={videoDate.doctorImage} 
                            alt={videoDate.doctorName} 
                            className="w-full h-48 md:h-full object-cover"
                          />
                        </div>
                        <div className="flex-grow p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-xl font-bold text-mediblue-800">Dr. {videoDate.doctorName}</h3>
                              <p className="text-gray-600">{videoDate.doctorSpecialty}</p>
                            </div>
                            <Badge className={
                              videoDate.status === 'confirmed' ? 'bg-green-500' : 'bg-yellow-500'
                            }>
                              {videoDate.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                            </Badge>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row sm:space-x-8 mb-6">
                            <div className="flex items-center mb-2 sm:mb-0">
                              <Calendar className="h-5 w-5 text-mediblue-500 mr-2" />
                              <span>{format(videoDate.date, 'PPP')}</span>
                            </div>
                            <div className="flex items-center">
                              <Clock className="h-5 w-5 text-mediblue-500 mr-2" />
                              <span>{format(videoDate.date, 'h:mm a')} ({videoDate.duration} min)</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 mt-4">
                            <Button 
                              className="bg-mediblue-500 hover:bg-mediblue-600"
                              onClick={() => handleJoinCall(videoDate.id)}
                              disabled={new Date(videoDate.date).getTime() - Date.now() > 1000 * 60 * 10} // Disable if more than 10 minutes before the call
                            >
                              <Video className="mr-2 h-4 w-4" />
                              Join Video Call
                            </Button>
                            <Button variant="outline">Reschedule</Button>
                            <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-16">
                  <Video className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                  <h3 className="text-xl font-medium text-gray-900">No upcoming video dates</h3>
                  <p className="text-gray-500 mt-2">Schedule a new video date to connect with a match</p>
                  <Button className="mt-4" onClick={() => setActiveTab('schedule')}>Schedule Now</Button>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="invites" className="space-y-6">
              <VideoDateInvites 
                invites={invites}
                onAccept={handleAcceptInvite}
                onDecline={handleDeclineInvite}
                onReschedule={handleRescheduleInvite}
              />
            </TabsContent>
            
            <TabsContent value="history" className="space-y-6">
              <VideoDateHistory 
                history={history}
                onRebook={handleRebook}
                onViewRecording={handleViewRecording}
              />
            </TabsContent>
            
            <TabsContent value="schedule" className="bg-white p-6 rounded-xl shadow-sm">
              <h2 className="text-xl font-bold text-mediblue-800 mb-6">Schedule a New Video Date</h2>
              
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Select a Date</h3>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, 'PPP') : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={date}
                        onSelect={(newDate) => {
                          setDate(newDate);
                          setIsCalendarOpen(false);
                        }}
                        initialFocus
                        disabled={(date) => 
                          date < new Date(new Date().setHours(0, 0, 0, 0)) || 
                          date > new Date(new Date().setDate(new Date().getDate() + 30))
                        }
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-4">Select a Time</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {timeSlots.map((time) => (
                        <button
                          key={time}
                          className={cn(
                            "py-2 px-4 rounded-md text-sm font-medium",
                            selectedTimeSlot === time
                              ? "bg-mediblue-500 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          )}
                          onClick={() => setSelectedTimeSlot(time)}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-4">Add a Personal Message</h3>
                    <Textarea
                      placeholder="Add a message for the doctor you're scheduling with..."
                      className="min-h-[100px]"
                      value={personalMessage}
                      onChange={(e) => setPersonalMessage(e.target.value)}
                    />
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-4">Select a Doctor</h3>
                  <div className="space-y-4 mb-6">
                    {availableDoctors.map((doctor) => (
                      <div
                        key={doctor.id}
                        className={cn(
                          "flex items-center p-3 border rounded-lg cursor-pointer transition-colors",
                          selectedDoctor === doctor.id 
                            ? "bg-blue-50 border-blue-300" 
                            : "hover:bg-gray-50"
                        )}
                        onClick={() => setSelectedDoctor(doctor.id)}
                      >
                        <img
                          src={doctor.imageUrl}
                          alt={doctor.name}
                          className="w-12 h-12 rounded-full mr-4 object-cover"
                        />
                        <div>
                          <h4 className="font-medium">Dr. {doctor.name}</h4>
                          <p className="text-sm text-gray-500">{doctor.specialty}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <h3 className="text-lg font-semibold mb-4">Duration</h3>
                  <Select 
                    value={selectedDuration} 
                    onValueChange={setSelectedDuration}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button 
                    className="w-full bg-mediblue-500 hover:bg-mediblue-600 py-6 mt-8"
                    onClick={handleScheduleVideoDate}
                    disabled={!selectedDoctor || !date || !selectedTimeSlot}
                  >
                    Schedule Video Date
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default VideoDatePage;
