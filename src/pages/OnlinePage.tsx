
import React from 'react';
import Header from '@/components/Header';
import { SidebarProvider } from '@/components/ui/sidebar';

const OnlinePage = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <SidebarProvider defaultOpen={true}>
        <div className="flex flex-1 w-full overflow-x-hidden">
          <aside className="w-64 border-r bg-white p-6">
            <h2 className="text-lg font-semibold mb-4">Most Recent Matches</h2>
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <h3 className="font-medium">New Members</h3>
                <p className="text-sm text-gray-500">See who just joined</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <h3 className="font-medium">Who's Online</h3>
                <p className="text-sm text-gray-500">Members active now</p>
              </div>
            </div>
          </aside>

          <main className="flex-grow p-4 md:p-8 overflow-x-hidden w-full">
            <div className="max-w-7xl mx-auto w-full">
              <h1 className="text-2xl font-bold mb-6">Who's Online</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Placeholder content for demo */}
                {[1, 2, 3, 4, 5, 6].map((item) => (
                  <div key={item} className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center mb-3">
                      <div className="w-12 h-12 bg-mediblue-100 rounded-full flex items-center justify-center mr-3 relative">
                        <span className="text-mediblue-600 font-bold">DR</span>
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
                      </div>
                      <div>
                        <h3 className="font-medium">Dr. User {item}</h3>
                        <p className="text-sm text-gray-500">Active now</p>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <button className="text-sm text-mediblue-600">View Profile</button>
                      <button className="text-sm text-mediblue-600">Message</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
};

export default OnlinePage;
