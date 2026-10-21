import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, Sparkles, Lock, Crown, ArrowRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Doctor } from '@/features/matches/types';
import { toast } from '@/hooks/use-toast';
import { usePlan } from '@/hooks/usePlan';
import { useNavigate } from 'react-router-dom';

interface DoctorMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: Doctor | null;
  onSendMessage: (doctorId: string, text: string) => void;
}

const ICEBREAKERS = [
  "Hi Dr. [Name], I noticed our shared medical specialization and values. Would love to connect for matrimony!",
  "Namaste Dr. [Name], your profile and astrological compatibility look wonderful. Let's connect!",
  "Hello Dr. [Name], congratulations on your practice. I'd love to learn more about your background.",
  "Hi Dr. [Name], I reviewed your biodata and medical credentials. Hope we can connect for a quick conversation.",
];

export const DoctorMessageModal: React.FC<DoctorMessageModalProps> = ({
  isOpen,
  onClose,
  doctor,
  onSendMessage,
}) => {
  const navigate = useNavigate();
  const { isPremium, isPlatinum } = usePlan();
  const [message, setMessage] = useState('');
  const [selectedStarterIndex, setSelectedStarterIndex] = useState<number | null>(null);

  if (!doctor) return null;

  const handleSelectStarter = (starterText: string, index: number) => {
    setSelectedStarterIndex(index);
    setMessage(starterText);
  };

  const handleSend = () => {
    const textToSend = message.trim() || `Hi Dr. ${doctor.name}, I am interested in connecting with you!`;
    onSendMessage(doctor.id, textToSend);
    toast({
      title: "Message & Interest Sent! 💌",
      description: `Your message was delivered to Dr. ${doctor.name}.`,
    });
    setMessage('');
    setSelectedStarterIndex(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-white p-5 sm:p-6 rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-mediblue-600" />
              Personal Message to Dr. {doctor.name}
            </DialogTitle>
            {isPlatinum ? (
              <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] font-semibold">
                <Crown size={11} className="mr-1 text-purple-600" /> Platinum
              </Badge>
            ) : isPremium ? (
              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] font-semibold">
                <Crown size={11} className="mr-1 text-amber-600" /> Premium
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-slate-100 text-slate-700 text-[10px]">
                Free Plan
              </Badge>
            )}
          </div>
          <DialogDescription className="text-xs text-slate-500">
            {isPremium 
              ? "Send a custom personalized message or choose a quick starter."
              : "Free members can send prebuilt matrimonial starters. Upgrade to Premium to type custom notes."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          {/* Doctor summary */}
          <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <Avatar className="h-11 w-11 shrink-0 border border-slate-200">
              <AvatarImage src={doctor.imageUrl} alt={doctor.name} className="object-cover" />
              <AvatarFallback>{doctor.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 text-xs truncate">Dr. {doctor.name}, {doctor.age}</p>
              <p className="text-[11px] text-mediblue-700 font-medium">{doctor.degree} · {doctor.specialty}</p>
              <p className="text-[10px] text-slate-500 truncate">{doctor.hospital} · {doctor.city}</p>
            </div>
          </div>

          {/* Prebuilt Starters (Always available for both free and premium) */}
          <div>
            <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
              <Sparkles size={13} className="text-amber-500" /> Prebuilt Matrimonial Starters:
            </span>
            <div className="flex flex-col gap-1.5">
              {ICEBREAKERS.map((starter, i) => {
                const filled = starter.replace('[Name]', doctor.name.replace(/^dr\.?\s*/i, ''));
                const isSelected = selectedStarterIndex === i;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`text-left text-[11px] p-2.5 rounded-xl border transition-all ${
                      isSelected 
                        ? 'bg-mediblue-50/90 border-mediblue-400 text-mediblue-950 ring-1 ring-mediblue-400 font-medium' 
                        : 'bg-slate-50/80 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                    onClick={() => handleSelectStarter(filled, i)}
                  >
                    "{filled}"
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Message Field - Unlocked for Premium, Locked with Upgrade banner for Free */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                {!isPremium && <Lock size={12} className="text-amber-600" />}
                Custom Personal Message
              </label>
              {!isPremium && (
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Premium Feature
                </span>
              )}
            </div>

            {isPremium ? (
              <Textarea
                rows={3}
                placeholder={`Type your custom personal message to Dr. ${doctor.name}...`}
                value={message}
                onChange={(e) => {
                  setSelectedStarterIndex(null);
                  setMessage(e.target.value);
                }}
                className="text-xs"
              />
            ) : (
              <div className="relative">
                <Textarea
                  rows={2}
                  disabled
                  value={message}
                  placeholder="Select one of the prebuilt starters above..."
                  className="text-xs bg-slate-50 text-slate-700 cursor-not-allowed"
                />
                <div className="mt-2 p-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Crown size={15} className="text-amber-600 shrink-0" />
                    <p className="text-[11px] text-amber-900 leading-tight">
                      Want to type personalized messages? <span className="font-semibold">Upgrade to Premium</span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="h-7 px-2.5 text-[11px] bg-amber-600 hover:bg-amber-700 text-white rounded-lg shrink-0"
                    onClick={() => {
                      onClose();
                      void navigate('/plan');
                    }}
                  >
                    Upgrade <ArrowRight size={11} className="ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100">
          <Button variant="outline" onClick={onClose} size="sm" className="text-xs">
            Cancel
          </Button>
          <Button
            className="bg-mediblue-600 hover:bg-mediblue-700 text-white text-xs font-semibold"
            size="sm"
            disabled={!message.trim()}
            onClick={handleSend}
          >
            <Send size={13} className="mr-1.5" /> Send Starter Message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
