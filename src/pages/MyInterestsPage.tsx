import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Heart, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useFavoritesContext } from '@/features/favorites/FavoritesContext';
import DoctorCard from '@/components/DoctorCard';

const MyInterestsPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { interests, withdrawInterest } = useFavoritesContext();

  const handleWithdraw = (doctorId: string, name: string) => {
    withdrawInterest(doctorId);
    toast({ title: "Interest withdrawn", description: `You are no longer showing interest in Dr. ${name}.` });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">My Interests</h1>
              <p className="text-sm text-slate-500">People you have shown interest in</p>
            </div>
            <p className="text-sm text-slate-500 hidden sm:block">{interests.length} {interests.length === 1 ? 'interest' : 'interests'}</p>
          </div>

          {interests.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-12 text-center">
              <Heart className="mx-auto h-12 w-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2">No interests yet</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">When you like a profile, it appears here so you can keep track of who you have shown interest in.</p>
              <Button className="mt-6 rounded-full" onClick={() => navigate('/matches')}>
                <Search className="h-4 w-4 mr-2" /> Find matches
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {interests.map((item) => (
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
                  variant="sent"
                  note={item.note}
                  onLike={() => navigate('/messages', { state: { openChatId: item.doctor.id } })}
                  onVideo={() => navigate('/video-dates')}
                  onMessage={() => navigate('/messages', { state: { openChatId: item.doctor.id } })}
                  onViewProfile={() => navigate(`/doctor/${item.doctor.id}`, { state: { returnTo: '/my-interests', fromPage: 'My Interests' } })}
                  onWithdraw={() => handleWithdraw(item.doctor.id, item.doctor.name)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default MyInterestsPage;
