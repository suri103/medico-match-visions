
import React, { useState } from 'react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import VideoCall from '@/components/VideoCall';
import { Calendar, Clock, Video, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

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

// Available time slots for scheduling
const timeSlots = [
  '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
  '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
  '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
  '5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM',
  '7:00 PM', '7:30 PM', '8:00 PM'
];

const VideoDatePage = () => {
  const [activeTab, setActiveTab] = useState('upcoming');
  const [inCall, setInCall] = useState(false);
  const [selectedVideoDate, setSelectedVideoDate] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);

  const handleJoinCall = (id: string) => {
    setSelectedVideoDate(id);
    setInCall(true);
  };

  const handleEndCall = () => {
    setInCall(false);
    setSelectedVideoDate(null);
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
          <h1 className="text-2xl md:text-3xl font-bold text-mediblue-800 mb-6">
            Video Dates
          </h1>
          
          <Tabs defaultValue="upcoming" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-8">
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
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
            
            <TabsContent value="past" className="space-y-6">
              {videoDatesList.past.length > 0 ? (
                videoDatesList.past.map((videoDate) => (
                  <Card key={videoDate.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex flex-col md:flex-row">
                        <div className="w-full md:w-1/4 bg-gray-100">
                          <img 
                            src={videoDate.doctorImage} 
                            alt={videoDate.doctorName} 
                            className="w-full h-48 md:h-full object-cover opacity-90"
                          />
                        </div>
                        <div className="flex-grow p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-xl font-bold text-mediblue-800">Dr. {videoDate.doctorName}</h3>
                              <p className="text-gray-600">{videoDate.doctorSpecialty}</p>
                            </div>
                            <Badge variant="outline" className="text-gray-500 border-gray-300">
                              Completed
                            </Badge>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row sm:space-x-8 mb-6">
                            <div className="flex items-center mb-2 sm:mb-0">
                              <Calendar className="h-5 w-5 text-gray-400 mr-2" />
                              <span className="text-gray-500">{format(videoDate.date, 'PPP')}</span>
                            </div>
                            <div className="flex items-center">
                              <Clock className="h-5 w-5 text-gray-400 mr-2" />
                              <span className="text-gray-500">{format(videoDate.date, 'h:mm a')} ({videoDate.duration} min)</span>
                            </div>
                          </div>
                          
                          {'rating' in videoDate && (
                            <div className="mt-2 mb-4">
                              <p className="text-sm text-gray-500 mb-1">Your rating:</p>
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <svg 
                                    key={i}
                                    className={`h-6 w-6 ${i < videoDate.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex space-x-4 mt-4">
                            <Button variant="outline" className="text-mediblue-600 border-mediblue-200">
                              Schedule Again
                            </Button>
                            <Button variant="ghost">
                              View Chat History
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
                  <h3 className="text-xl font-medium text-gray-900">No past video dates</h3>
                  <p className="text-gray-500 mt-2">Your completed video dates will appear here</p>
                </div>
              )}
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
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-4">Select a Doctor</h3>
                  <div className="space-y-4 mb-6">
                    {[...videoDatesList.upcoming, ...videoDatesList.past].map((doctor) => (
                      <div
                        key={doctor.id}
                        className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                      >
                        <img
                          src={doctor.doctorImage}
                          alt={doctor.doctorName}
                          className="w-12 h-12 rounded-full mr-4 object-cover"
                        />
                        <div>
                          <h4 className="font-medium">Dr. {doctor.doctorName}</h4>
                          <p className="text-sm text-gray-500">{doctor.doctorSpecialty}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <h3 className="text-lg font-semibold mb-4">Duration</h3>
                  <div className="flex space-x-4 mb-8">
                    <Button variant="outline" className="flex-1">30 minutes</Button>
                    <Button variant="outline" className="flex-1">45 minutes</Button>
                    <Button variant="outline" className="flex-1">60 minutes</Button>
                  </div>
                  
                  <Button className="w-full bg-mediblue-500 hover:bg-mediblue-600 py-6">
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
