
import React, { useState } from 'react';
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
import PaymentModal from '@/components/PaymentModal';
import Chat from '@/components/Chat';
import VideoCall from '@/components/VideoCall';
import { Star, MessageSquare, Video, Calendar as CalendarIcon, Phone, Clock, Info, ChevronRight } from 'lucide-react';

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
  const [selectedAstrologer, setSelectedAstrologer] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [activeView, setActiveView] = useState<'list' | 'astrologer-profile' | 'chat' | 'video-call'>('list');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  
  const handleSelectAstrologer = (id: string) => {
    setSelectedAstrologer(id);
    setActiveView('astrologer-profile');
  };
  
  const handleBookConsultation = () => {
    setIsPaymentModalOpen(true);
  };
  
  const handlePaymentSuccess = () => {
    setIsPaymentModalOpen(false);
    // In a real app, would update the database and show confirmation
    console.log("Payment successful for consultation with astrologer:", selectedAstrologer);
  };
  
  const handleStartChat = () => {
    setActiveView('chat');
  };
  
  const handleStartVideoCall = () => {
    setActiveView('video-call');
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
            <div className="text-center mb-12">
              <h1 className="text-3xl md:text-4xl font-bold text-indigo-900 mb-4">
                Astrological Insights for Your Love Journey
              </h1>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Connect with our expert astrologers who specialize in medical professionals' relationships and get personalized compatibility readings.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {astrologers.map((astrologer) => (
                <Card 
                  key={astrologer.id} 
                  className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleSelectAstrologer(astrologer.id)}
                >
                  <div className="relative">
                    <div className="h-48 bg-gradient-to-r from-purple-900 to-indigo-800 flex justify-center items-center">
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
                      <p className="text-indigo-600">{astrologer.specialty}</p>
                      <div className="flex items-center justify-center mt-2">
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i}
                              className={`h-4 w-4 ${i < Math.floor(astrologer.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-gray-600 ml-2">
                          {astrologer.rating} ({astrologer.reviews} reviews)
                        </span>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <p className="text-gray-600 text-sm line-clamp-3">{astrologer.description}</p>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm text-gray-600 mb-4">
                      <span>{astrologer.experience} years exp.</span>
                      <span>{astrologer.languages.join(', ')}</span>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button 
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAstrologer(astrologer.id);
                          handleBookConsultation();
                        }}
                      >
                        Book Now
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAstrologer(astrologer.id);
                          setActiveView('astrologer-profile');
                        }}
                      >
                        View Profile
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
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
                      <p className="text-gray-700">Understand compatibility beyond surface-level interactions</p>
                    </li>
                    <li className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="w-6 h-6 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center mr-3">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                      <p className="text-gray-700">Get insights about potential relationship challenges</p>
                    </li>
                    <li className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="w-6 h-6 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center mr-3">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                      <p className="text-gray-700">Discover your astrological compatibility with potential matches</p>
                    </li>
                    <li className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="w-6 h-6 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center mr-3">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                      <p className="text-gray-700">Learn about favorable timing for relationship milestones</p>
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
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-r from-purple-900 to-indigo-800 text-white p-8">
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
                  <TabsList className="w-full justify-start px-6 pt-4">
                    <TabsTrigger value="about">About</TabsTrigger>
                    <TabsTrigger value="book">Book Consultation</TabsTrigger>
                    <TabsTrigger value="reviews">Reviews</TabsTrigger>
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
                            className="bg-indigo-600 hover:bg-indigo-700"
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
                        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                          <Calendar
                            mode="single"
                            selected={date}
                            onSelect={setDate}
                            className="mx-auto"
                            disabled={(date) => date < new Date() || date > new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)}
                          />
                        </div>
                        
                        <div className="mb-6">
                          <h4 className="font-medium mb-3">Available Time Slots</h4>
                          <div className="grid grid-cols-3 gap-2">
                            {timeSlots.map((time) => (
                              <button
                                key={time}
                                className={`py-2 px-3 text-sm font-medium rounded-md ${
                                  selectedTimeSlot === time
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                        
                        <div className="bg-indigo-50 rounded-lg p-4 mb-6">
                          <div className="flex items-start mb-4">
                            <Avatar className="w-14 h-14 mr-4">
                              <img src={selectedAstrologerData.imageUrl} alt={selectedAstrologerData.name} className="object-cover" />
                            </Avatar>
                            <div>
                              <h4 className="font-medium text-gray-900">{selectedAstrologerData.name}</h4>
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
                          
                          <div className="space-y-3 text-sm">
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
                              <span className="text-indigo-600">₹{selectedAstrologerData.price}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="birth-details">Your Birth Details</Label>
                            <Input 
                              id="birth-details" 
                              placeholder="Date, time, and place of birth" 
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="specific-questions">Specific Questions (Optional)</Label>
                            <Input 
                              id="specific-questions" 
                              placeholder="Any specific questions for the astrologer" 
                              className="mt-1"
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center mt-4 mb-6 bg-blue-50 p-3 rounded-md">
                          <Info className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0" />
                          <p className="text-sm text-blue-700">
                            Your birth details are essential for accurate astrological readings. Please provide as much information as possible.
                          </p>
                        </div>
                        
                        <Button 
                          className="w-full bg-indigo-600 hover:bg-indigo-700 py-6"
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
                        <div className="text-gray-500">{selectedAstrologerData.reviews} reviews</div>
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
                    
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-6">
                        {/* Sample reviews */}
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
                            <p className="text-gray-700">{review.text}</p>
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
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

export default AstrologerPage;
