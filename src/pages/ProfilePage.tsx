
import React, { useState } from 'react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Edit, Upload, Star, Settings, History, Heart, CameraIcon, Trash2, PlusCircle, X } from 'lucide-react';

const ProfilePage = () => {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [interests, setInterests] = useState(['Yoga', 'Reading', 'Traveling', 'Music', 'Cooking']);
  const [newInterest, setNewInterest] = useState('');
  
  const handleSaveProfile = () => {
    setIsEditing(false);
    toast({
      title: "Profile updated",
      description: "Your profile has been successfully updated."
    });
  };
  
  const handleAddInterest = () => {
    if (newInterest.trim() && !interests.includes(newInterest.trim())) {
      setInterests([...interests, newInterest.trim()]);
      setNewInterest('');
    }
  };
  
  const handleRemoveInterest = (interest: string) => {
    setInterests(interests.filter(i => i !== interest));
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            {/* Profile Header/Banner */}
            <div className="relative h-56 bg-gradient-to-r from-mediblue-600 to-mediteal-500">
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <div className="flex items-end">
                  <div className="relative">
                    <div className="w-28 h-28 rounded-full border-4 border-white overflow-hidden bg-white">
                      <img 
                        src="https://randomuser.me/api/portraits/women/33.jpg" 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button className="absolute bottom-1 right-1 bg-white text-mediblue-600 rounded-full p-1 shadow-md hover:bg-gray-100">
                      <CameraIcon size={16} />
                    </button>
                  </div>
                  <div className="ml-4 pb-2">
                    <h1 className="text-2xl font-bold">Dr. Maya Reddy</h1>
                    <p className="text-blue-100">Cardiologist at Apollo Hospital, Mumbai</p>
                  </div>
                </div>
              </div>
              <button className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full p-2">
                <Edit size={16} />
              </button>
            </div>
            
            {/* Profile Tabs */}
            <Tabs defaultValue="profile">
              <div className="px-6 border-b">
                <TabsList className="bg-transparent border-b-0 p-0">
                  <TabsTrigger 
                    value="profile" 
                    className="py-4 px-6 data-[state=active]:border-b-2 data-[state=active]:border-mediblue-500 data-[state=active]:shadow-none rounded-none"
                  >
                    Profile
                  </TabsTrigger>
                  <TabsTrigger 
                    value="settings" 
                    className="py-4 px-6 data-[state=active]:border-b-2 data-[state=active]:border-mediblue-500 data-[state=active]:shadow-none rounded-none"
                  >
                    Account Settings
                  </TabsTrigger>
                  <TabsTrigger 
                    value="preferences" 
                    className="py-4 px-6 data-[state=active]:border-b-2 data-[state=active]:border-mediblue-500 data-[state=active]:shadow-none rounded-none"
                  >
                    Match Preferences
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="profile" className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Profile Information</h2>
                  {!isEditing ? (
                    <Button onClick={() => setIsEditing(true)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Profile
                    </Button>
                  ) : (
                    <div className="space-x-2">
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSaveProfile}>
                        Save Changes
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <div className="space-y-6">
                      <div>
                        <Label htmlFor="name">Full Name</Label>
                        <Input 
                          id="name" 
                          defaultValue="Dr. Maya Reddy" 
                          disabled={!isEditing}
                          className={!isEditing ? "bg-gray-50" : ""}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="specialty">Medical Specialty</Label>
                        {isEditing ? (
                          <Select defaultValue="cardiology">
                            <SelectTrigger>
                              <SelectValue placeholder="Select specialty" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cardiology">Cardiology</SelectItem>
                              <SelectItem value="neurology">Neurology</SelectItem>
                              <SelectItem value="pediatrics">Pediatrics</SelectItem>
                              <SelectItem value="orthopedics">Orthopedic Surgery</SelectItem>
                              <SelectItem value="dermatology">Dermatology</SelectItem>
                              <SelectItem value="psychiatry">Psychiatry</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input value="Cardiology" disabled className="bg-gray-50" />
                        )}
                      </div>
                      
                      <div>
                        <Label htmlFor="hospital">Hospital/Clinic</Label>
                        <Input 
                          id="hospital" 
                          defaultValue="Apollo Hospital" 
                          disabled={!isEditing}
                          className={!isEditing ? "bg-gray-50" : ""}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="location">Location</Label>
                        <Input 
                          id="location" 
                          defaultValue="Mumbai, Maharashtra" 
                          disabled={!isEditing}
                          className={!isEditing ? "bg-gray-50" : ""}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="experience">Experience (Years)</Label>
                        <Input 
                          id="experience" 
                          type="number" 
                          defaultValue="8" 
                          disabled={!isEditing}
                          className={!isEditing ? "bg-gray-50" : ""}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="space-y-6">
                      <div>
                        <Label htmlFor="about">About Me</Label>
                        <Textarea 
                          id="about" 
                          rows={5}
                          defaultValue="I am a dedicated cardiologist with 8 years of experience. I'm passionate about preventive cardiology and enjoy working with patients to develop healthy lifestyle habits. Outside of work, I love yoga, reading, and exploring new cultures through travel." 
                          disabled={!isEditing}
                          className={!isEditing ? "bg-gray-50" : ""}
                        />
                      </div>
                      
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <Label>Interests</Label>
                          {isEditing && (
                            <div className="flex space-x-2">
                              <Input 
                                placeholder="Add interest"
                                value={newInterest}
                                onChange={(e) => setNewInterest(e.target.value)}
                                className="text-sm"
                              />
                              <Button size="sm" onClick={handleAddInterest}>
                                <PlusCircle size={16} />
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {interests.map((interest, index) => (
                            <Badge 
                              key={index} 
                              className="bg-mediteal-100 text-mediteal-800 hover:bg-mediteal-200"
                            >
                              {interest}
                              {isEditing && (
                                <button 
                                  className="ml-1 text-mediteal-800 hover:text-mediteal-900"
                                  onClick={() => handleRemoveInterest(interest)}
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="lookingFor">Looking For</Label>
                        <Textarea 
                          id="lookingFor" 
                          rows={3}
                          defaultValue="I'm looking for someone who is intellectually curious, values work-life balance, and enjoys both deep conversations and lighthearted fun. Ideally, someone who understands the demands of medical profession." 
                          disabled={!isEditing}
                          className={!isEditing ? "bg-gray-50" : ""}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 pt-6 border-t">
                  <h3 className="text-lg font-semibold mb-4">Profile Photos</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
                      <img 
                        src="https://randomuser.me/api/portraits/women/33.jpg" 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 flex space-x-1">
                        <button className="bg-white/80 hover:bg-white p-1 rounded-full text-gray-700">
                          <Star size={14} className="text-yellow-500" />
                        </button>
                        {isEditing && (
                          <button className="bg-white/80 hover:bg-white p-1 rounded-full text-red-500">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {Array(3).fill(null).map((_, index) => (
                      <div key={index} className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
                        <img 
                          src={`https://randomuser.me/api/portraits/women/${30 + index}.jpg`} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                        />
                        {isEditing && (
                          <button className="absolute top-2 right-2 bg-white/80 hover:bg-white p-1 rounded-full text-red-500">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                    
                    {isEditing && (
                      <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-50">
                        <div className="text-center">
                          <Upload className="h-8 w-8 text-gray-400 mx-auto mb-1" />
                          <p className="text-sm text-gray-500">Add Photo</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="settings" className="p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-6">Account Settings</h2>
                
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Settings className="mr-2 h-5 w-5 text-mediblue-500" />
                      General Settings
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="email">Email Address</Label>
                        <Input id="email" type="email" defaultValue="dr.maya.reddy@gmail.com" />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input id="phone" type="tel" defaultValue="+91 9876543210" />
                      </div>
                      <div className="flex justify-end">
                        <Button>Save Changes</Button>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <History className="mr-2 h-5 w-5 text-mediblue-500" />
                      Account History
                    </h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-600">Account created: <span className="font-medium">January 15, 2023</span></p>
                      <p className="text-gray-600">Last login: <span className="font-medium">Today, 10:30 AM</span></p>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center text-red-500">
                      <X className="mr-2 h-5 w-5" />
                      Deactivate Account
                    </h3>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                      <p className="text-gray-700 mb-3">Deactivating your account will hide your profile from other users and pause all notifications. You can reactivate at any time.</p>
                      <Button variant="outline" className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600">
                        Deactivate Account
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="preferences" className="p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-6">Match Preferences</h2>
                
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Heart className="mr-2 h-5 w-5 text-mediblue-500" />
                      Looking For
                    </h3>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="gender-preference">Gender Preference</Label>
                        <Select defaultValue="any">
                          <SelectTrigger id="gender-preference">
                            <SelectValue placeholder="Select preference" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="any">No Preference</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label>Age Range</Label>
                        <div className="flex items-center space-x-2">
                          <Input type="number" defaultValue="28" className="w-20" />
                          <span>to</span>
                          <Input type="number" defaultValue="40" className="w-20" />
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="distance">Maximum Distance</Label>
                        <Select defaultValue="50">
                          <SelectTrigger id="distance">
                            <SelectValue placeholder="Select distance" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10 kilometers</SelectItem>
                            <SelectItem value="25">25 kilometers</SelectItem>
                            <SelectItem value="50">50 kilometers</SelectItem>
                            <SelectItem value="100">100 kilometers</SelectItem>
                            <SelectItem value="any">Any distance</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="specialty-preference">Specialty Preference</Label>
                        <Select defaultValue="any">
                          <SelectTrigger id="specialty-preference">
                            <SelectValue placeholder="Select specialty" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">No Preference</SelectItem>
                            <SelectItem value="cardiology">Cardiology</SelectItem>
                            <SelectItem value="neurology">Neurology</SelectItem>
                            <SelectItem value="pediatrics">Pediatrics</SelectItem>
                            <SelectItem value="orthopedics">Orthopedic Surgery</SelectItem>
                            <SelectItem value="dermatology">Dermatology</SelectItem>
                            <SelectItem value="psychiatry">Psychiatry</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Interests & Compatibility</h3>
                    <div className="space-y-4">
                      <div>
                        <Label>Important Interests (Select up to 5)</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                          {['Travel', 'Fitness', 'Reading', 'Cooking', 'Movies', 'Music', 'Art', 'Sports', 'Photography', 'Dancing', 'Hiking', 'Technology'].map((interest) => (
                            <div key={interest} className="flex items-center space-x-2">
                              <input type="checkbox" id={`interest-${interest}`} className="rounded text-mediblue-500" />
                              <Label htmlFor={`interest-${interest}`} className="cursor-pointer">{interest}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Communication Preferences</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <h4 className="font-medium">Match Notifications</h4>
                          <p className="text-sm text-gray-500">Receive notifications when you get new matches</p>
                        </div>
                        <div className="flex items-center">
                          <input type="checkbox" defaultChecked className="rounded text-mediblue-500" />
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <h4 className="font-medium">Message Notifications</h4>
                          <p className="text-sm text-gray-500">Receive notifications for new messages</p>
                        </div>
                        <div className="flex items-center">
                          <input type="checkbox" defaultChecked className="rounded text-mediblue-500" />
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <h4 className="font-medium">Video Date Reminders</h4>
                          <p className="text-sm text-gray-500">Receive reminders before scheduled video dates</p>
                        </div>
                        <div className="flex items-center">
                          <input type="checkbox" defaultChecked className="rounded text-mediblue-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end pt-4">
                    <Button>Save Preferences</Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
