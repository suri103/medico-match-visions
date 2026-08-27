import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Video, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Doctor } from '@/features/matches/types';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface DoctorVideoInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: Doctor | null;
  onInviteSent?: (doctorId: string, date: string, time: string) => void;
}

const TIME_SLOTS = [
  '06:00 PM - 06:30 PM',
  '07:00 PM - 07:30 PM',
  '08:00 PM - 08:30 PM',
  '09:00 PM - 09:30 PM',
];

export const DoctorVideoInviteModal: React.FC<DoctorVideoInviteModalProps> = ({
  isOpen,
  onClose,
  doctor,
  onInviteSent,
}) => {
  const navigate = useNavigate();
  const [selectedSlot, setSelectedSlot] = useState(TIME_SLOTS[1]);
  // Local-calendar date helpers — toISOString() is UTC and can shift the
  // "tomorrow" default by a day depending on the user's timezone.
  const toLocalDateInput = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [dateStr, setDateStr] = useState(toLocalDateInput(tomorrow));

  if (!doctor) return null;

  const handleSendInvite = () => {
    onInviteSent?.(doctor.id, dateStr, selectedSlot);
    toast({
      title: "Video Date Request Sent! 📹",
      description: `Invitation sent to Dr. ${doctor.name} for ${dateStr} at ${selectedSlot}.`,
    });
    onClose();
  };

  const handleInstantDate = () => {
    onClose();
    navigate('/video-dates');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-white p-6">
        <DialogHeader className="text-left">
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Video className="h-5 w-5 text-emerald-600" />
            Request 1-on-1 Video Date with Dr. {doctor.name}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Invite Dr. {doctor.name} to a secure, private video consultation date.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          {/* Doctor summary */}
          <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl border">
            <Avatar className="h-11 w-11 shrink-0 border">
              <AvatarImage src={doctor.imageUrl} alt={doctor.name} className="object-cover" />
              <AvatarFallback>{doctor.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 text-xs truncate">Dr. {doctor.name}, {doctor.age}</p>
              <p className="text-[11px] text-mediblue-700">{doctor.degree} · {doctor.specialty}</p>
              <p className="text-[10px] text-slate-500 truncate">{doctor.hospital} · {doctor.city}</p>
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1 mb-1">
              <CalendarIcon size={13} className="text-mediblue-600" /> Select Date
            </label>
            <input
              type="date"
              value={dateStr}
              min={toLocalDateInput(new Date())}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-mediblue-600"
            />
          </div>

          {/* Time Slot Picker */}
          <div>
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1 mb-1.5">
              <Clock size={13} className="text-emerald-600" /> Preferred Evening Time Slot
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={`text-xs p-2 rounded-lg border text-center transition-all ${
                    selectedSlot === slot
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-semibold ring-1 ring-emerald-600'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 flex flex-col sm:flex-row">
          <Button variant="outline" onClick={onClose} size="sm">
            Cancel
          </Button>
          <Button
            variant="ghost"
            onClick={handleInstantDate}
            size="sm"
            className="text-xs text-mediblue-700 hover:bg-mediblue-50"
          >
            Open Video Date Room
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            size="sm"
            onClick={handleSendInvite}
          >
            <Video size={13} className="mr-1.5" /> Send Video Date Invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
