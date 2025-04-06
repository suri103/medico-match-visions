
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export interface VideoDateHistoryItem {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorImage: string;
  specialty: string;
  date: Date;
  duration: number;
  status: 'completed' | 'missed' | 'cancelled';
  rating?: number;
  notes?: string;
}

interface VideoDateHistoryProps {
  history: VideoDateHistoryItem[];
  onRebook: (doctorId: string) => void;
  onViewRecording?: (sessionId: string) => void;
}

const VideoDateHistory: React.FC<VideoDateHistoryProps> = ({
  history,
  onRebook,
  onViewRecording
}) => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Video Date History</h2>
      
      {history.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Video className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500">No video date history yet</p>
          <p className="text-sm text-gray-400 mt-1">Your past video dates will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((item) => (
            <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row">
                  <div className="w-full md:w-1/4 bg-gray-100">
                    <img 
                      src={item.doctorImage} 
                      alt={item.doctorName} 
                      className="w-full h-40 md:h-full object-cover opacity-90"
                    />
                  </div>
                  <div className="flex-grow p-6">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-lg font-semibold">Dr. {item.doctorName}</h3>
                        <p className="text-gray-500">{item.specialty}</p>
                      </div>
                      <Badge 
                        variant={
                          item.status === 'completed' ? 'default' :
                          item.status === 'missed' ? 'destructive' : 'outline'
                        }
                      >
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </Badge>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:space-x-6 mb-4 text-sm text-gray-500">
                      <div className="flex items-center mb-2 sm:mb-0">
                        <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                        <span>{format(item.date, 'PPP')}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 text-gray-400 mr-2" />
                        <span>{format(item.date, 'h:mm a')} ({item.duration} min)</span>
                      </div>
                    </div>
                    
                    {item.rating !== undefined && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-1">Your rating:</p>
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <svg 
                              key={i}
                              className={`h-5 w-5 ${i < item.rating! ? 'text-yellow-400' : 'text-gray-300'}`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {item.notes && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-1">Notes:</p>
                        <p className="text-sm text-gray-600 italic">"{item.notes}"</p>
                      </div>
                    )}
                    
                    <div className="flex space-x-3 mt-4">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => onRebook(item.doctorId)}
                      >
                        Book Again
                      </Button>
                      
                      {onViewRecording && item.status === 'completed' && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => onViewRecording(item.id)}
                        >
                          View Recording
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default VideoDateHistory;
