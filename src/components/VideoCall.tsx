
import React, { useState } from 'react';
import { 
  Mic, MicOff, Video as VideoIcon, VideoOff, Phone, 
  MessageSquare, Users, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';

interface VideoCallProps {
  doctorId: string;
  doctorName: string;
  doctorImage: string;
  onEndCall: () => void;
}

const VideoCall: React.FC<VideoCallProps> = ({
  doctorId,
  doctorName,
  doctorImage,
  onEndCall
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    // Simulate connection delay
    const timer = setTimeout(() => {
      setIsLoading(false);
      setIsConnected(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Main video area */}
      <div className="flex-grow relative overflow-hidden">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-t-mediblue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-xl">Connecting to Dr. {doctorName}...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Remote video (doctor) - Main large video */}
            <div className="absolute inset-0">
              {!isConnected || isVideoOff ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-800">
                  <Avatar className="w-32 h-32">
                    <img src={doctorImage} alt={doctorName} className="object-cover" />
                  </Avatar>
                </div>
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                  {/* This would be where the actual video stream renders */}
                  <img 
                    src={doctorImage} 
                    alt={doctorName} 
                    className="w-full h-full object-cover opacity-80" 
                  />
                  <div className="absolute top-4 left-4">
                    <Card className="bg-black/50 text-white px-3 py-1 backdrop-blur-sm">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse-subtle"></div>
                        <span>Dr. {doctorName}</span>
                      </div>
                    </Card>
                  </div>
                </div>
              )}
            </div>

            {/* Local video (user) - Small picture-in-picture */}
            <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden border-2 border-white/20 shadow-lg">
              <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                {/* This would be where the actual local video stream renders */}
                <div className="text-sm text-center text-gray-300">Your camera</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="bg-black/80 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-gray-700"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-gray-700"
              onClick={() => setIsVideoOff(!isVideoOff)}
            >
              {isVideoOff ? <VideoOff size={20} /> : <VideoIcon size={20} />}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-gray-700"
            >
              <MessageSquare size={20} />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-gray-700"
            >
              <Users size={20} />
            </Button>
          </div>
          
          <Button
            variant="default"
            size="icon"
            className="rounded-full bg-red-600 hover:bg-red-700"
            onClick={onEndCall}
          >
            <Phone size={20} className="rotate-[135deg]" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-gray-700"
          >
            <Settings size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;
