import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Flag, ShieldAlert } from 'lucide-react';
import { Doctor } from '@/features/matches/types';
import { useFavoritesContext } from '@/features/favorites/FavoritesContext';
import { toast } from '@/hooks/use-toast';
import { reportProfile } from '@/services/api';

interface ReportProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: Doctor | null;
  onReported?: () => void;
}

const REPORT_REASONS = [
  "Unverified or Suspicious Medical Credentials (MCI / State Council)",
  "Inappropriate Profile Photos or Bio Content",
  "Harassment, Offensive Language or Inappropriate Behavior",
  "Commercial Solicitation, Spam, or Financial Scams",
  "Impersonation or False Identity Information",
  "Other Safety or Community Guidelines Violation",
];

export const ReportProfileModal: React.FC<ReportProfileModalProps> = ({
  isOpen,
  onClose,
  doctor,
  onReported,
}) => {
  const { blockDoctor } = useFavoritesContext();
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [details, setDetails] = useState<string>('');
  const [alsoBlock, setAlsoBlock] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!doctor) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) {
      toast({
        title: "Please select a reason",
        description: "Select the primary reason for reporting this profile.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await reportProfile(doctor.id, selectedReason, details.trim());
    } catch { /* ignore */ }

    try {
      const raw = localStorage.getItem('mm:reports');
      const reports = raw ? JSON.parse(raw) : [];
      const newReport = {
        id: `rep_${Date.now()}`,
        doctorId: doctor.id,
        doctorName: doctor.name,
        specialty: doctor.specialty,
        hospital: doctor.hospital,
        reason: selectedReason,
        details: details.trim(),
        timestamp: new Date().toISOString(),
        status: 'pending_review',
      };
      reports.unshift(newReport);
      localStorage.setItem('mm:reports', JSON.stringify(reports.slice(0, 100)));
      window.dispatchEvent(new CustomEvent('mm:persisted-state-changed', { detail: { key: 'mm:reports' } }));
    } catch {
      // Fallback ignore
    }

    if (alsoBlock) {
      blockDoctor(doctor.id);
    }

    setIsSubmitting(false);
    toast({
      title: "Profile Reported 🚩",
      description: `Thank you for reporting Dr. ${doctor.name.replace(/^dr\.?\s*/i, '')}. Our compliance team will review this case within 24 hours.`,
    });

    setSelectedReason('');
    setDetails('');
    onClose();
    onReported?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg bg-white p-6 rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-2 text-rose-600 mb-1">
            <div className="p-2 rounded-xl bg-rose-50 border border-rose-100">
              <ShieldAlert size={20} className="text-rose-600" />
            </div>
            <DialogTitle className="text-base sm:text-lg font-bold text-slate-900">
              Report Dr. {doctor.name.replace(/^dr\.?\s*/i, '')}'s Profile
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Reports are strictly confidential. Our trust and verification team will review the profile and credentials.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Reason selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-800 block">
              Reason for reporting <span className="text-rose-500">*</span>
            </label>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    selectedReason === reason
                      ? 'bg-rose-50/70 border-rose-300 text-rose-950 ring-1 ring-rose-300 font-medium'
                      : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100/70'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="mt-0.5 text-rose-600 focus:ring-rose-500 h-3.5 w-3.5"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Additional details */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-800 block">
              Additional Details (Optional)
            </label>
            <Textarea
              rows={3}
              placeholder="Provide any relevant context or specific details to help our moderation team investigate..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="text-xs resize-none"
            />
          </div>

          {/* Auto-block checkbox */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <Checkbox
              id="alsoBlock"
              checked={alsoBlock}
              onCheckedChange={(checked) => setAlsoBlock(Boolean(checked))}
            />
            <div className="text-left">
              <Label htmlFor="alsoBlock" className="text-xs font-semibold text-slate-800 cursor-pointer">
                Also block this doctor
              </Label>
              <p className="text-[11px] text-slate-500 leading-tight">
                They won't be able to view your profile, send messages, or invite you to video dates.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!selectedReason || isSubmitting}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
            >
              <Flag size={13} className="mr-1.5" /> Submit Confidential Report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
