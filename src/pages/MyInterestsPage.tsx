
import React from 'react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Heart, Search } from 'lucide-react';

const MyInterestsPage = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">My Interests</h1>
              <p className="text-gray-500">People you've shown interest in</p>
            </div>
            <Button variant="outline" className="flex items-center">
              <Search className="h-4 w-4 mr-2" />
              Find More
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="h-40 bg-mediblue-50 relative">
                  <img 
                    src={`https://randomuser.me/api/portraits/${item % 2 === 0 ? 'women' : 'men'}/${item + 30}.jpg`} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2">
                    <Button size="sm" variant="default" className="bg-white text-rose-500 hover:bg-gray-100 p-1 h-8 w-8 rounded-full">
                      <Heart className="h-5 w-5 fill-rose-500" />
                    </Button>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-lg">Dr. {item % 2 === 0 ? 'Sarah' : 'Michael'} {['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'][item-1]}</h3>
                  <p className="text-gray-600 text-sm mb-2">{['Cardiologist', 'Neurologist', 'Pediatrician', 'Surgeon', 'Dermatologist'][item-1]}, {['34', '29', '42', '36', '31'][item-1]} years</p>
                  <div className="flex items-center text-sm text-gray-500 mb-3">
                    <span>{['Boston', 'New York', 'Chicago', 'San Francisco', 'Seattle'][item-1]}, {['MA', 'NY', 'IL', 'CA', 'WA'][item-1]}</span>
                    <span className="mx-2">•</span>
                    <span>{['5', '3', '8', '2', '4'][item-1]} miles away</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">Interest shown on {['May 12', 'May 10', 'May 8', 'May 5', 'May 2'][item-1]}</p>
                  <div className="flex space-x-2">
                    <Button variant="default" className="flex-1 bg-mediblue-600 hover:bg-mediblue-700">Message</Button>
                    <Button variant="outline" className="flex-1">View Profile</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default MyInterestsPage;
