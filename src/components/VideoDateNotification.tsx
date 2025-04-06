
import React from 'react';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Video } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

interface VideoDateNotificationProps {
  isOpen: boolean;
  onClose: () => void;
  invitation: {
    id: string;
    senderName: string;
    senderImage: string;
    proposedDate: Date;
    duration: number;
    message?: string;
  } | null;
  onAccept: (inviteId: string) => void;
  onDecline: (inviteId: string) => void;
  onReschedule: (inviteId: string) => void;
}

const VideoDateNotification: React.FC<VideoDateNotificationProps> = ({
  isOpen,
  onClose,
  invitation,
  onAccept,
  onDecline,
  onReschedule
}) => {
  if (!invitation) return null;

  const handleAccept = () => {
    onAccept(invitation.id);
    onClose();
    toast({
      title: "Video Date Accepted",
      description: `You have accepted a video date with Dr. ${invitation.senderName}`,
    });
  };

  const handleDecline = () => {
    onDecline(invitation.id);
    onClose();
  };

  const handleReschedule = () => {
    onReschedule(invitation.id);
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">New Video Date Invitation</AlertDialogTitle>
          <div className="flex items-center space-x-3 mt-2">
            <img 
              src={invitation.senderImage} 
              alt={invitation.senderName}
              className="w-12 h-12 rounded-full object-cover"
            />
            <div>
              <p className="font-semibold">Dr. {invitation.senderName}</p>
              <div className="flex items-center text-sm text-gray-500">
                <Video className="h-3.5 w-3.5 mr-1" />
                <span>Video Date Request</span>
              </div>
            </div>
          </div>
        </AlertDialogHeader>
        <div className="my-4 space-y-3">
          <div className="flex items-center text-sm">
            <Calendar className="h-4 w-4 text-mediblue-500 mr-2" />
            <span>{format(invitation.proposedDate, 'PPP')}</span>
          </div>
          <div className="flex items-center text-sm">
            <Clock className="h-4 w-4 text-mediblue-500 mr-2" />
            <span>{format(invitation.proposedDate, 'h:mm a')} ({invitation.duration} minutes)</span>
          </div>
          {invitation.message && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 italic">"{invitation.message}"</p>
            </div>
          )}
        </div>
        <AlertDialogDescription className="text-center text-sm text-gray-500">
          Would you like to accept this video date invitation?
        </AlertDialogDescription>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel asChild>
            <Button 
              variant="ghost" 
              className="text-red-500"
              onClick={handleDecline}
            >
              Decline
            </Button>
          </AlertDialogCancel>
          <Button 
            variant="outline"
            onClick={handleReschedule}
          >
            Suggest New Time
          </Button>
          <AlertDialogAction asChild>
            <Button onClick={handleAccept}>Accept</Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default VideoDateNotification;
