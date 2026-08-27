import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Clock, Film } from 'lucide-react';
import { format } from 'date-fns';
import type { VideoRecording } from '@/lib/videoStore';

interface RecordingPlayerProps {
  recording: VideoRecording | null;
  open: boolean;
  onClose: () => void;
}

const RecordingPlayer: React.FC<RecordingPlayerProps> = ({
  recording,
  open,
  onClose,
}) => {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="h-5 w-5 text-mediblue-600" />
            Video Date Recording
          </DialogTitle>
          <DialogDescription>
            {recording
              ? `Playback of your video date with ${recording.doctorName}.`
              : 'Select a completed video date to view its recording.'}
          </DialogDescription>
        </DialogHeader>

        {recording ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={recording.doctorImage} alt={recording.doctorName} />
                <AvatarFallback>
                  {recording.doctorName.split(' ').map((n) => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">Dr. {recording.doctorName}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(new Date(recording.recordedAt), 'PPP')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {recording.duration} min
                  </span>
                </div>
              </div>
            </div>

            {/* Native HTML5 player when a recording actually exists. */}
            {recording.url ? (
              <video
                key={recording.id}
                controls
                autoPlay
                className="w-full aspect-video rounded-lg bg-black"
                src={recording.url}
              >
                Your browser does not support HTML5 video playback.
              </video>
            ) : (
              <div className="aspect-video rounded-lg bg-slate-100 flex flex-col items-center justify-center text-center p-6">
                <Film className="h-10 w-10 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">Recording not available.</p>
                <p className="text-xs text-slate-400 mt-1">
                  No stored recording exists for this video date.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Film className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500">No recording selected.</p>
            <p className="text-sm text-gray-400 mt-1">
              Open a recording from your completed video dates.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RecordingPlayer;