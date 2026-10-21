import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { ThumbsUp } from 'lucide-react';
import { useFavoritesContext } from '@/features/favorites/FavoritesContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { usePlan } from '@/hooks/usePlan';
import { Crown } from 'lucide-react';
import DoctorCard from '@/components/DoctorCard';

const InterestedInYouPage = () => {
  const { interestedInYou, passInterest, likeFromInterested } = useFavoritesContext();
  const { canUse } = usePlan();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handlePass = (id: string) => {
    passInterest(id);
    toast({ title: "Interest dismissed", description: "You passed on this profile." });
  };
  const handleLike = (id: string) => {
    likeFromInterested(id);
    toast({ title: "You liked this profile!", description: "They have been added to your favorites." });
  };
  const handleMessage = (doctorId: string) => {
    void navigate('/messages', { state: { openChatId: doctorId } });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Interested in you</h1>
              <p className="text-sm text-slate-500">People who have shown interest in your profile</p>
            </div>
            <p className="text-sm text-slate-500 hidden sm:block">{interestedInYou.length} {interestedInYou.length === 1 ? 'interest' : 'interests'}</p>
          </div>

          {!canUse('seeWhoLikedYou') && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8 mb-6 text-center">
              <Crown className="mx-auto h-10 w-10 text-amber-400 mb-3" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2">See who is interested in you</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">Who liked you is a Premium feature. Upgrade to see the people who have shown interest and respond.</p>
              <Button className="rounded-full bg-mediblue-600 hover:bg-mediblue-700" onClick={() => navigate('/plan')}>Upgrade to Premium</Button>
            </div>
          )}

          {interestedInYou.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-12 text-center">
              <ThumbsUp className="mx-auto h-12 w-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No new interests</h3>
              <p className="text-sm text-slate-500">When someone shows interest in your profile, they will appear here.</p>
              <Button className="mt-6 rounded-full" onClick={() => navigate('/matches')}>Browse matches</Button>
            </div>
          ) : canUse('seeWhoLikedYou') ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {interestedInYou.map((item) => (
                <DoctorCard
                  key={item.id}
                  id={item.doctor.id}
                  name={item.doctor.name}
                  age={item.doctor.age}
                  specialty={item.doctor.specialty}
                  degree={item.doctor.degree}
                  hospital={item.doctor.hospital}
                  city={item.doctor.city}
                  imageUrl={item.doctor.imageUrl}
                  matchPercentage={item.doctor.matchPercentage}
                  interests={item.doctor.interests}
                  isOnline={item.doctor.isOnline}
                  isVerified={item.doctor.isVerified}
                  councilName={item.doctor.councilName}
                  registrationNumber={item.doctor.registrationNumber}
                  religion={item.doctor.religion}
                  caste={item.doctor.caste || item.doctor.cast}
                  subcaste={item.doctor.subcaste}
                  gotra={item.doctor.gotra}
                  variant="received"
                  note={item.note}
                  onLike={() => handleLike(item.id)}
                  onVideo={() => navigate('/video-dates')}
                  onMessage={() => handleMessage(item.doctor.id)}
                  onPass={() => handlePass(item.id)}
                  onViewProfile={() => navigate(`/doctor/${item.doctor.id}`, { state: { returnTo: '/interested-in-you', fromPage: 'Interested in You' } })}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {interestedInYou.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="relative overflow-hidden bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 flex flex-col items-center text-center"
                >
                  <div className="relative mb-4">
                    <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center filter blur-[6px] select-none pointer-events-none">
                      <span className="text-3xl text-slate-400">🩺</span>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-amber-500 text-white p-2 rounded-full shadow-md">
                        <Crown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                  <h3 className="text-base font-semibold text-slate-800">
                    {item.doctor.specialty || "Verified Doctor"}
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    {item.doctor.city ? `Practicing in ${item.doctor.city}` : "Medical Professional"}
                  </p>
                  <div className="w-full pt-4 border-t border-slate-100 flex items-center justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full text-mediblue-600 border-mediblue-200 hover:bg-mediblue-50 text-xs"
                      onClick={() => navigate('/plan')}
                    >
                      Unlock with Premium
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default InterestedInYouPage;
