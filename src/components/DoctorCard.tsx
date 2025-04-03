
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Video, MessageSquare, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DoctorCardProps {
  id: string;
  name: string;
  age: number;
  specialty: string;
  hospital: string;
  city: string;
  imageUrl: string;
  matchPercentage: number;
  interests: string[];
  isOnline?: boolean;
  onLike: (id: string) => void;
  onVideo: (id: string) => void;
  onMessage: (id: string) => void;
}

const DoctorCard: React.FC<DoctorCardProps> = ({
  id,
  name,
  age,
  specialty,
  hospital,
  city,
  imageUrl,
  matchPercentage,
  interests,
  isOnline = false,
  onLike,
  onVideo,
  onMessage
}) => {
  return (
    <Card className="profile-card overflow-hidden h-full flex flex-col">
      <div className="relative">
        <img 
          src={imageUrl} 
          alt={`Dr. ${name}`} 
          className="w-full h-64 object-cover"
        />
        <div className="absolute top-3 right-3">
          <Badge className="bg-mediblue-500 text-white font-semibold">
            {matchPercentage}% Match
          </Badge>
        </div>
        {isOnline && (
          <div className="absolute bottom-3 left-3">
            <Badge className="bg-green-500 text-white">
              Online Now
            </Badge>
          </div>
        )}
      </div>
      <CardContent className="flex-grow flex flex-col pt-4">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-mediblue-800">Dr. {name}, {age}</h3>
          <p className="text-gray-600">{specialty}</p>
          <p className="text-gray-500 text-sm">{hospital}, {city}</p>
        </div>
        
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Interests</h4>
          <div className="flex flex-wrap gap-1">
            {interests.map((interest, index) => (
              <Badge key={index} variant="outline" className="bg-mediteal-50 text-mediteal-700 border-mediteal-200">
                {interest}
              </Badge>
            ))}
          </div>
        </div>
        
        <div className="flex justify-between mt-auto pt-3">
          <Button 
            size="sm" 
            variant="outline"
            className="rounded-full hover:bg-red-50 hover:text-red-500 hover:border-red-200"
            onClick={() => onLike(id)}
          >
            <Heart size={18} className="mr-1" />
            Like
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            className="rounded-full hover:bg-mediblue-50 hover:text-mediblue-500 hover:border-mediblue-200"
            onClick={() => onVideo(id)}
          >
            <Video size={18} className="mr-1" />
            Video
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            className="rounded-full hover:bg-mediteal-50 hover:text-mediteal-500 hover:border-mediteal-200"
            onClick={() => onMessage(id)}
          >
            <MessageSquare size={18} className="mr-1" />
            Chat
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DoctorCard;
