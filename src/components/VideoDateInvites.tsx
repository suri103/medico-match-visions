
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Video, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

export interface VideoDateInvite {
  id: string;
  senderId: string;
  senderName: string;
  senderImage: string;
  message: string;
  proposedDate: Date;
  duration: number;
  status: 'pending' | 'accepted' | 'declined' | 'rescheduled';
}

interface VideoDateInvitesProps {
  invites: VideoDateInvite[];
  onAccept: (inviteId: string) => void;
  onDecline: (inviteId: string) => void;
  onReschedule: (inviteId: string) => void;
}

const VideoDateInvites: React.FC<VideoDateInvitesProps> = ({
  invites,
  onAccept,
  onDecline,
  onReschedule
}) => {
  const [expandedInvite, setExpandedInvite] = useState<string | null>(null);

  const handleAccept = (inviteId: string) => {
    onAccept(inviteId);
    toast({
      title: "Video Date Accepted",
      description: "The video date has been added to your calendar.",
    });
  };

  const handleDecline = (inviteId: string) => {
    onDecline(inviteId);
    toast({
      title: "Video Date Declined",
      description: "The invitation has been declined.",
    });
  };

  const toggleExpand = (inviteId: string) => {
    setExpandedInvite(expandedInvite === inviteId ? null : inviteId);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Video Date Invitations</h2>
      
      {invites.length === 0 ? (
        <p className="text-gray-500 py-6 text-center">No pending video date invitations</p>
      ) : (
        <div className="space-y-3">
          {invites.map((invite) => (
            <Card key={invite.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row">
                  <div className="w-full sm:w-1/4 bg-gray-50">
                    <img 
                      src={invite.senderImage} 
                      alt={invite.senderName} 
                      className="w-full h-36 sm:h-full object-cover"
                    />
                  </div>
                  <div className="flex-grow p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-medium">Dr. {invite.senderName}</h3>
                        <Badge 
                          variant={invite.status === 'pending' ? 'outline' : 
                                  invite.status === 'accepted' ? 'default' : 
                                  'secondary'}
                          className="mt-1"
                        >
                          {invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}
                        </Badge>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => toggleExpand(invite.id)}
                      >
                        {expandedInvite === invite.id ? (
                          <X className="h-4 w-4" />
                        ) : (
                          <span className="text-xs">More</span>
                        )}
                      </Button>
                    </div>
                    
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        <span>{format(invite.proposedDate, 'PPP')}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock className="h-4 w-4 mr-2" />
                        <span>{format(invite.proposedDate, 'h:mm a')} ({invite.duration} min)</span>
                      </div>
                    </div>
                    
                    {expandedInvite === invite.id && (
                      <div className="mt-4 border-t pt-3">
                        <p className="text-sm text-gray-600 mb-3">"{invite.message}"</p>
                      </div>
                    )}
                    
                    {invite.status === 'pending' && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button 
                          size="sm" 
                          variant="default"
                          className="flex items-center"
                          onClick={() => handleAccept(invite.id)}
                        >
                          <Video className="mr-1 h-4 w-4" />
                          Accept
                        </Button>
                        <Button 
                          size="sm"
                          variant="outline"
                          onClick={() => onReschedule(invite.id)}
                        >
                          Reschedule
                        </Button>
                        <Button 
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => handleDecline(invite.id)}
                        >
                          Decline
                        </Button>
                      </div>
                    )}
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

export default VideoDateInvites;
