
import React from 'react';
import Header from '@/components/Header';
import { Calendar, Filter, MapPin, Users, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const EventsPage = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">Meets & Events</h1>
              <p className="text-gray-500">Connect with other medical professionals in person</p>
            </div>
            <div className="mt-4 md:mt-0 flex space-x-2">
              <Button variant="outline" className="flex items-center">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button className="bg-mediblue-600 text-white hover:bg-mediblue-700">
                <Calendar className="h-4 w-4 mr-2" />
                Create Event
              </Button>
            </div>
          </div>
          
          <Tabs defaultValue="upcoming" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
              <TabsTrigger value="myevents">My Events</TabsTrigger>
            </TabsList>
            
            <TabsContent value="upcoming" className="space-y-6">
              {[1, 2, 3].map((item) => (
                <div key={item} className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    <div className="md:w-1/3 h-48 md:h-auto bg-mediblue-100 relative">
                      <div className="absolute top-0 left-0 bg-mediblue-600 text-white px-3 py-1 rounded-br-lg">
                        <p className="text-sm font-medium">
                          {item === 1 ? 'May 15' : item === 2 ? 'May 28' : 'Jun 10'}
                        </p>
                      </div>
                      <div className="w-full h-full flex items-center justify-center">
                        <Calendar className="h-16 w-16 text-mediblue-600" />
                      </div>
                    </div>
                    <div className="p-6 md:w-2/3">
                      <h3 className="text-xl font-bold mb-2">
                        {item === 1 ? 'Medical Professionals Mixer' : 
                         item === 2 ? 'Healthcare Innovation Summit' : 
                         'Wellness Retreat for Doctors'}
                      </h3>
                      <div className="flex flex-wrap gap-3 mb-3">
                        <div className="flex items-center text-sm text-gray-600">
                          <Clock className="h-4 w-4 mr-1" />
                          <span>
                            {item === 1 ? '7:00 PM' : item === 2 ? '9:00 AM' : '10:00 AM'}
                          </span>
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="h-4 w-4 mr-1" />
                          <span>
                            {item === 1 ? 'Boston, MA' : item === 2 ? 'New York, NY' : 'San Francisco, CA'}
                          </span>
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <Users className="h-4 w-4 mr-1" />
                          <span>{(item * 15) + 10} Attendees</span>
                        </div>
                      </div>
                      <p className="text-gray-600 mb-4">
                        {item === 1 ? 'Join us for an evening of networking with fellow medical professionals. Refreshments will be served.' : 
                         item === 2 ? 'A full-day summit focusing on the latest innovations in healthcare technology and practice.' : 
                         'A weekend retreat focused on mental health and wellbeing for medical professionals.'}
                      </p>
                      <div className="flex space-x-2">
                        <Button className="bg-mediblue-600 text-white hover:bg-mediblue-700">
                          RSVP
                        </Button>
                        <Button variant="outline">
                          Learn More
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>
            
            <TabsContent value="past">
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-700 mb-2">No Past Events</h3>
                <p className="text-gray-500 mb-4">You haven't attended any events yet</p>
                <Button className="bg-mediblue-600 text-white hover:bg-mediblue-700">
                  Browse Upcoming Events
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="myevents">
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-700 mb-2">No Events Created</h3>
                <p className="text-gray-500 mb-4">You haven't created any events yet</p>
                <Button className="bg-mediblue-600 text-white hover:bg-mediblue-700">
                  Create Your First Event
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default EventsPage;
