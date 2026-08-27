import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Phone, Mail, Building, ShieldCheck, CheckCircle2, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Doctor } from '@/features/matches/types';
import { toast } from '@/hooks/use-toast';

interface DoctorContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: Doctor | null;
  contactViewsRemaining?: number | typeof Infinity;
  onStartChat?: (doctorId: string) => void;
}

export const DoctorContactModal: React.FC<DoctorContactModalProps> = ({
  isOpen,
  onClose,
  doctor,
  contactViewsRemaining,
  onStartChat,
}) => {
  if (!doctor) return null;

  // Contact details come exclusively from the profile record. Nothing is
  // fabricated: this modal is presented as "Verified Contact & Credentials"
  // and users act on what it shows (audit H1).
  const phone = doctor.phone || '';
  const email = doctor.email || '';

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: `${label} Copied`,
        description: `${text} copied to clipboard.`,
      });
    }).catch(() => {
      toast({ title: 'Copy failed', description: 'Clipboard access was denied.', variant: 'destructive' });
    });
  };

  const handleWhatsApp = () => {
    if (!phone) return;
    window.open(
      `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello Dr. ${doctor.name}, I came across your profile on MedicoMatch.`)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-white p-6">
        <DialogHeader className="text-left">
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Phone className="h-5 w-5 text-mediblue-600" />
            Verified Contact & Credentials
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Official contact and state medical council credentials for matrimonial communication.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Doctor Header Card */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <Avatar className="h-14 w-14 border-2 border-white shadow-sm shrink-0">
              <AvatarImage src={doctor.imageUrl} alt={doctor.name} className="object-cover" />
              <AvatarFallback>{doctor.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="font-bold text-slate-900 text-sm truncate">
                  Dr. {doctor.name}
                </h4>
                {doctor.isVerified && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] py-0 px-1.5">
                    <CheckCircle2 size={10} className="mr-1 text-emerald-600" /> Verified
                  </Badge>
                )}
              </div>
              <p className="text-xs font-semibold text-mediblue-700 mt-0.5">
                {doctor.degree || 'MBBS'} · {doctor.specialty}
              </p>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {doctor.hospital} · {doctor.city}, {doctor.state || doctor.country || 'India'}
              </p>
            </div>
          </div>

          {/* Medical Council Verification Badge Card */}
          {doctor.councilName && doctor.registrationNumber ? (
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700">
                  <p className="font-bold text-emerald-950">
                    {doctor.councilName}
                  </p>
                  <p className="text-slate-600 mt-0.5 font-mono text-[11px]">
                    Reg. No: <strong className="text-slate-800">{doctor.registrationNumber}</strong>
                    {doctor.registrationYear ? ` (Year: ${doctor.registrationYear})` : ''}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-[11px] text-slate-600">
                Council registration details have not been submitted for this profile.
              </p>
            </div>
          )}

          {/* Contact Details List */}
          <div className="space-y-2.5 text-xs">
            {/* Phone */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
                  <Phone size={15} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Phone / Mobile</p>
                  <p className="font-semibold text-slate-800 text-sm font-mono">{phone || 'Not shared on profile'}</p>
                </div>
              </div>
              {phone && (
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2"
                    onClick={() => handleCopy(phone, 'Phone number')}
                  >
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleWhatsApp}
                  >
                    WhatsApp
                  </Button>
                </div>
              )}
            </div>

            {/* Email */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-md bg-mediblue-50 text-mediblue-600 shrink-0">
                  <Mail size={15} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Email Address</p>
                  <p className="font-medium text-slate-800 truncate max-w-[200px] sm:max-w-[220px]">{email || 'Not shared on profile'}</p>
                </div>
              </div>
              {email && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2 self-end sm:self-auto"
                  onClick={() => handleCopy(email, 'Email address')}
                >
                  Copy
                </Button>
              )}
            </div>

            {/* Hospital & Clinic Location */}
            <div className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200">
              <div className="p-1.5 rounded-md bg-amber-50 text-amber-600 mt-0.5">
                <Building size={15} />
              </div>
              <div className="text-xs">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Clinical Practice Address</p>
                <p className="font-medium text-slate-800">{doctor.hospital}</p>
                <p className="text-slate-500 text-[11px] mt-0.5">{doctor.city}, {doctor.state || doctor.country || 'India'}</p>
              </div>
            </div>
          </div>

          {contactViewsRemaining !== undefined && (
            <div className="text-[11px] text-slate-500 text-center pt-1">
              Contact views remaining this month: <strong className="text-slate-700">{contactViewsRemaining === Infinity ? 'Unlimited' : contactViewsRemaining}</strong>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} size="sm">
            Close
          </Button>
          {onStartChat && (
            <Button
              className="bg-mediblue-600 hover:bg-mediblue-700 text-white text-xs"
              size="sm"
              onClick={() => {
                onClose();
                onStartChat(doctor.id);
              }}
            >
              <MessageSquare size={13} className="mr-1.5" /> Start Chat
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
