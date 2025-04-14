
import React from 'react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown, MessageSquare, Calendar } from 'lucide-react';

const InterestedInYouPage = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">Interested In You</h1>
              <p className="text-gray-500">People who've shown interest in your profile</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Showing 6 of 12 interests</p>
              <Button variant="link" className="p-0 h-auto text-mediblue-600">View All</Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div key={item} className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="h-40 bg-mediblue-50 relative">
                  <img 
                    src={`https://randomuser.me/api/portraits/${item % 2 === 0 ? 'men' : 'women'}/${20 + item}.jpg`} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-white rounded-full p-1">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">Dr. {item % 2 === 0 ? 'Robert' : 'Jennifer'} {['Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris'][item-1]}</h3>
                    <div className="text-xs font-medium bg-mediblue-100 text-mediblue-800 px-2 py-0.5 rounded">
                      {['95%', '88%', '92%', '86%', '90%', '89%'][item-1]} Match
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-2">{['Surgeon', 'Psychiatrist', 'Oncologist', 'Radiologist', 'Anesthesiologist', 'Orthopedist'][item-1]}, {['38', '33', '41', '30', '36', '42'][item-1]} years</p>
                  <p className="text-sm text-gray-600 mb-3">{['Showed interest 2 hours ago', 'Sent you a like yesterday', 'Viewed your profile 3 times', 'Wants to connect with you', 'Interested in your profile', 'Showed interest this morning'][item-1]}</p>
                  
                  <div className="flex space-x-1">
                    <Button size="sm" variant="outline" className="flex-1">
                      <ThumbsDown className="h-4 w-4 mr-1" />
                      Pass
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-mediblue-600 border-mediblue-200 hover:bg-mediblue-50">
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Message
                    </Button>
                    <Button size="sm" className="flex-1 bg-mediblue-600 hover:bg-mediblue-700">
                      <ThumbsUp className="h-4 w-4 mr-1" />
                      Like
                    </Button>
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

export default InterestedInYouPage;
