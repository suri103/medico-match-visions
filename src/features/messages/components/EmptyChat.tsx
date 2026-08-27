import React from 'react';
import { Eye, Heart, MessageSquare, Video, ArrowRight, Sparkles, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import { useFavoritesContext } from '@/features/favorites/FavoritesContext';
import { doctorProfiles } from '@/features/matches/data/sampleData';

const EmptyChat: React.FC = () => {
  const navigate = useNavigate();
  const { notifications, getNotificationCount } = useNotifications();
  const { sendInterest, isFavorite, connections } = useFavoritesContext();

  const profileViews = notifications.filter(n => n.type === 'profile_view').slice(0, 3);
  const interestsReceived = notifications.filter(n => n.type === 'interest').slice(0, 2);

  return (
    <div className="flex-grow flex flex-col bg-white rounded-lg shadow-sm h-full p-6 overflow-y-auto">
      {/* Activity Summary Bar */}
      <div className="bg-gradient-to-r from-mediblue-50 via-teal-50 to-blue-50 border border-blue-100 rounded-xl p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-mediblue-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Communication & Activity Hub
            </h3>
            <p className="text-xs md:text-sm text-slate-600 mt-0.5">
              Select a conversation on the left, or respond directly to doctor interactions below.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button 
              size="sm" 
              className="bg-mediblue-600 hover:bg-mediblue-700 text-xs shadow-sm"
              onClick={() => navigate('/matches')}
            >
              Browse Matches
              <ArrowRight size={13} className="ml-1.5" />
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="text-xs bg-white"
              onClick={() => navigate('/video-dates')}
            >
              <Video size={13} className="mr-1 text-emerald-600" />
              Video Dates
            </Button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Profile Views Section */}
        <div className="border border-slate-200/80 rounded-xl p-4 bg-slate-50/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-sky-100 text-sky-700">
                <Eye size={16} />
              </div>
              <h4 className="font-semibold text-slate-800 text-sm">
                Recent Profile Views
              </h4>
            </div>
            <span className="text-xs font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full">
              {getNotificationCount('profile_view')} new
            </span>
          </div>

          {profileViews.length > 0 ? (
            <div className="space-y-2.5">
              {profileViews.map((item) => {
                const doc = doctorProfiles.find(d => d.name.toLowerCase().includes(item.from.toLowerCase())) || {
                  id: item.doctorId || '1',
                  name: item.from,
                  age: 32,
                  specialty: item.specialty || 'Physician',
                  hospital: item.hospital || 'Hospital',
                  city: item.city || 'Delhi',
                  state: 'State',
                  country: 'India',
                  imageUrl: item.imageUrl,
                  matchPercentage: 88,
                  interests: [],
                  isOnline: true,
                  sexualOrientation: 'Straight'
                };
                const alreadyLiked = isFavorite(doc.id);
                return (
                  <div key={item.id} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-100 shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="h-9 w-9 shrink-0">
                        <img src={item.imageUrl} alt={item.from} className="object-cover" />
                      </Avatar>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">Dr. {item.from}</div>
                        <div className="text-[11px] text-slate-500 truncate">{item.specialty || 'Doctor'} · {item.city || 'India'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {alreadyLiked ? (
                        <span className="text-[11px] text-green-700 bg-green-50 px-2 py-1 rounded font-medium flex items-center gap-1">
                          <UserCheck size={11} /> Sent
                        </span>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-7 text-[11px] px-2 text-mediblue-700 hover:bg-blue-50 border-blue-200"
                          onClick={() => sendInterest(doc)}
                        >
                          <Heart size={11} className="mr-1 text-rose-500" />
                          Send Interest
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-4 text-center">No recent profile views</p>
          )}
        </div>

        {/* Interests Received Section */}
        <div className="border border-slate-200/80 rounded-xl p-4 bg-slate-50/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                <Heart size={16} className="fill-rose-500" />
              </div>
              <h4 className="font-semibold text-slate-800 text-sm">
                Interests Received
              </h4>
            </div>
            <span className="text-xs font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
              {getNotificationCount('interest')} pending
            </span>
          </div>

          {interestsReceived.length > 0 ? (
            <div className="space-y-2.5">
              {interestsReceived.map((item) => {
                const doc = doctorProfiles.find(d => d.name.toLowerCase().includes(item.from.toLowerCase())) || {
                  id: item.doctorId || '1',
                  name: item.from,
                  age: 30,
                  specialty: item.specialty || 'Specialist',
                  hospital: item.hospital || 'Hospital',
                  city: item.city || 'Mumbai',
                  state: 'State',
                  country: 'India',
                  imageUrl: item.imageUrl,
                  matchPercentage: 92,
                  interests: [],
                  isOnline: true,
                  sexualOrientation: 'Straight'
                };
                const isConn = connections.some(c => c.doctorId === doc.id && c.status === 'matched');
                return (
                  <div key={item.id} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-100 shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="h-9 w-9 shrink-0">
                        <img src={item.imageUrl} alt={item.from} className="object-cover" />
                      </Avatar>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">Dr. {item.from}</div>
                        <div className="text-[11px] text-slate-500 truncate">{item.specialty || 'Doctor'} · {item.city || 'India'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {isConn ? (
                        <Button 
                          size="sm" 
                          className="h-7 text-[11px] px-2 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => navigate('/messages', { state: { openChatId: doc.id, activeTab: 'messages' } })}
                        >
                          <MessageSquare size={11} className="mr-1" />
                          Chat
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          className="h-7 text-[11px] px-2 bg-rose-600 hover:bg-rose-700 text-white"
                          onClick={() => sendInterest(doc)}
                        >
                          <Heart size={11} className="mr-1 fill-white" />
                          Accept & Like
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-4 text-center">No pending interests</p>
          )}
        </div>
      </div>

      {/* Guidance and Tips */}
      <div className="mt-auto bg-slate-50 p-4 rounded-xl border border-slate-200">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Verified Doctor Communication Tips
        </h4>
        <div className="grid sm:grid-cols-3 gap-3 text-xs text-slate-600">
          <div className="flex items-start gap-1.5">
            <span className="text-mediblue-600 font-bold">1.</span>
            <span>Send personalized greetings highlighting mutual medical interests.</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-mediblue-600 font-bold">2.</span>
            <span>Initiate an HD video date once both doctors have accepted mutual interests.</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-mediblue-600 font-bold">3.</span>
            <span>Review the What's New tab regularly for new profile view notifications.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmptyChat;
