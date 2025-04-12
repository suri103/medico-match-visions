
import React, { useState } from 'react';
import {
  Calendar,
  MessageSquare,
  UserRound,
  History,
  Bell,
  Clock,
  Calendar as CalendarIcon,
  Phone,
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
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
import { VideoDateInvites } from '@/components/VideoDateInvites';
import { VideoDateHistory } from '@/components/VideoDateHistory';
import { VideoDateNotification } from '@/components/VideoDateNotification';
import { Separator } from '@/components/ui/separator';

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
const upcomingDates = [
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
];

const pendingInvites: VideoDateInvite[] = [
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
];

const dateHistory: VideoDateHistoryItem[] = [
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
];

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

const VideoDatePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('upcoming');
  const { toast } = useToast();
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [duration, setDuration] = useState<string>('30');
  const [message, setMessage] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
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
    
    toast({
      title: "Success",
      description: "Video date request has been sent!",
    });
    
    setSelectedDoctor('');
    setSelectedDate(null);
    setDuration('30');
    setMessage('');
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
                <TabsList className="grid grid-cols-4 mb-6">
                  <TabsTrigger value="upcoming" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span className="hidden sm:inline">Upcoming</span>
                  </TabsTrigger>
                  <TabsTrigger value="invites" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span className="hidden sm:inline">Invites</span>
                    {pendingInvites.length > 0 && (
                      <Badge className="ml-1 bg-blue-500">{pendingInvites.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    <span className="hidden sm:inline">History</span>
                  </TabsTrigger>
                  <TabsTrigger value="notifications" className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    <span className="hidden sm:inline">Notifications</span>
                    {notifications.filter(n => !n.isRead).length > 0 && (
                      <Badge className="ml-1 bg-red-500">
                        {notifications.filter(n => !n.isRead).length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="upcoming" className="space-y-4">
                  <h2 className="text-xl font-semibold mb-4">Upcoming Video Dates</h2>
                  {upcomingDates.length > 0 ? (
                    <div className="space-y-4">
                      {upcomingDates.map(date => (
                        <Card key={date.id}>
                          <CardHeader className="flex flex-row items-center gap-4 pb-2">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={date.doctorImage} alt={date.doctorName} />
                              <AvatarFallback>{date.doctorName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                            </Avatar>
                            <div>
                              <CardTitle>{date.doctorName}</CardTitle>
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
                            <Button className="w-full sm:w-auto flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              Join Video Date
                            </Button>
                            <Button variant="outline" className="w-full sm:w-auto">Reschedule</Button>
                            <Button variant="ghost" className="w-full sm:w-auto text-red-600">Cancel</Button>
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
                  <VideoDateInvites invites={pendingInvites} />
                </TabsContent>
                
                <TabsContent value="history">
                  <VideoDateHistory historyItems={dateHistory} />
                </TabsContent>
                
                <TabsContent value="notifications">
                  <h2 className="text-xl font-semibold mb-4">Notifications</h2>
                  <div className="space-y-3">
                    {notifications.map(notification => (
                      <VideoDateNotification
                        key={notification.id}
                        id={notification.id}
                        type={notification.type}
                        title={notification.title}
                        message={notification.message}
                        timestamp={notification.timestamp}
                        isRead={notification.isRead}
                        onMarkAsRead={() => {}}
                      />
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
                              min={new Date().toISOString().slice(0, 16)}
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
                        
                        <div className="pt-2 flex flex-col sm:flex-row gap-3">
                          <Button type="submit" className="w-full sm:w-auto">
                            Send Request
                          </Button>
                          <Button type="button" variant="outline" className="w-full sm:w-auto"
                            onClick={() => setActiveTab('upcoming')}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
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
                    <Button variant="link" className="p-0 h-auto text-blue-600 mt-1">
                      Contact Technical Support
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default VideoDatePage;
