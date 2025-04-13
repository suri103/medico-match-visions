
import React from 'react';
import { Button } from '@/components/ui/button';
import DoctorCard from '@/components/DoctorCard';
import { Trash2, Star } from 'lucide-react';
import { Doctor } from '../data/sampleData';

interface DoctorsGridProps {
  doctors: Doctor[];
  onRemoveFavorite?: (id: string) => void;
  onAddFavorite?: (id: string) => void;
  onLike: (id: string) => void;
  onVideo: (id: string) => void;
  onMessage: (id: string) => void;
  gridType: 'favorites' | 'likes';
}

const DoctorsGrid: React.FC<DoctorsGridProps> = ({
  doctors,
  onRemoveFavorite,
  onAddFavorite,
  onLike,
  onVideo,
  onMessage,
  gridType
}) => {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {doctors.map((doctor) => (
        <div key={doctor.id} className="relative">
          {gridType === 'favorites' && onRemoveFavorite && (
            <Button 
              variant="ghost" 
              size="icon"
              className="absolute top-2 right-2 z-10 bg-white/80 backdrop-blur-sm hover:bg-white text-red-500 hover:text-red-700"
              onClick={() => onRemoveFavorite(doctor.id)}
            >
              <Trash2 size={18} />
            </Button>
          )}
          
          {gridType === 'likes' && onAddFavorite && (
            <Button 
              variant="ghost" 
              size="icon"
              className="absolute top-2 right-2 z-10 bg-white/80 backdrop-blur-sm hover:bg-white text-amber-500 hover:text-amber-600"
              onClick={() => onAddFavorite(doctor.id)}
            >
              <Star size={18} />
            </Button>
          )}
          
          <DoctorCard
            id={doctor.id}
            name={doctor.name}
            age={doctor.age}
            specialty={doctor.specialty}
            hospital={doctor.hospital}
            city={doctor.city}
            imageUrl={doctor.imageUrl}
            matchPercentage={doctor.matchPercentage}
            interests={doctor.interests}
            isOnline={doctor.isOnline}
            onLike={onLike}
            onVideo={onVideo}
            onMessage={onMessage}
          />
        </div>
      ))}
    </div>
  );
};

export default DoctorsGrid;
