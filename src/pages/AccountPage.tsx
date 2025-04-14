
import React from 'react';
import Header from '@/components/Header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Shield, CreditCard, Bell } from 'lucide-react';

const AccountPage = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">My Account</h1>
          
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid grid-cols-4 mb-8">
              <TabsTrigger value="personal" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>Personal</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>Security</span>
              </TabsTrigger>
              <TabsTrigger value="billing" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span>Billing</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span>Notifications</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="personal" className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Personal Information</h2>
              <p className="text-gray-500 mb-6">Update your personal account details here.</p>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input type="text" className="w-full p-2 border rounded" placeholder="Your first name" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input type="text" className="w-full p-2 border rounded" placeholder="Your last name" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input type="email" className="w-full p-2 border rounded" placeholder="your.email@example.com" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input type="tel" className="w-full p-2 border rounded" placeholder="Your phone number" />
                </div>
                
                <div className="pt-4">
                  <button className="bg-mediblue-600 text-white px-4 py-2 rounded hover:bg-mediblue-700">
                    Save Changes
                  </button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="security" className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Security Settings</h2>
              <p className="text-gray-500 mb-6">Manage your password and security preferences.</p>
              
              {/* Security settings content */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-md font-medium mb-2">Change Password</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                      <input type="password" className="w-full p-2 border rounded" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                      <input type="password" className="w-full p-2 border rounded" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                      <input type="password" className="w-full p-2 border rounded" />
                    </div>
                  </div>
                  <button className="mt-3 bg-mediblue-600 text-white px-4 py-2 rounded hover:bg-mediblue-700">
                    Update Password
                  </button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="billing" className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Billing Information</h2>
              <p className="text-gray-500 mb-6">Manage your subscription and payment methods.</p>
              
              <div className="space-y-6">
                <div className="p-4 border rounded-lg bg-gray-50">
                  <h3 className="font-medium mb-2">Current Plan</h3>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-lg font-bold">Premium Plan</p>
                      <p className="text-sm text-gray-500">Billed monthly</p>
                    </div>
                    <button className="text-mediblue-600 hover:text-mediblue-800">
                      Change Plan
                    </button>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium mb-2">Payment Method</h3>
                  <div className="flex items-center p-3 border rounded mb-3">
                    <div className="mr-3">
                      <CreditCard className="h-6 w-6 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium">•••• •••• •••• 4242</p>
                      <p className="text-sm text-gray-500">Expires 12/2025</p>
                    </div>
                  </div>
                  <button className="text-mediblue-600 hover:text-mediblue-800 text-sm">
                    + Add new payment method
                  </button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="notifications" className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Notification Preferences</h2>
              <p className="text-gray-500 mb-6">Control how we contact you.</p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border-b">
                  <div>
                    <p className="font-medium">New Messages</p>
                    <p className="text-sm text-gray-500">Get notified when you receive a new message</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-mediblue-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-3 border-b">
                  <div>
                    <p className="font-medium">Profile Views</p>
                    <p className="text-sm text-gray-500">Get notified when someone views your profile</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-mediblue-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-3 border-b">
                  <div>
                    <p className="font-medium">Matches</p>
                    <p className="text-sm text-gray-500">Get notified when you have a new match</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-mediblue-600"></div>
                  </label>
                </div>
                
                <div className="pt-4">
                  <button className="bg-mediblue-600 text-white px-4 py-2 rounded hover:bg-mediblue-700">
                    Save Preferences
                  </button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default AccountPage;
