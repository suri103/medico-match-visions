import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Ban } from 'lucide-react';
import { Doctor } from '@/features/matches/types';
import { useFavoritesContext } from '@/features/favorites/FavoritesContext';
import { toast } from '@/hooks/use-toast';

interface BlockProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: Doctor | null;
  onBlocked?: () => void;
}

export const BlockProfileModal: React.FC<BlockProfileModalProps> = ({
  isOpen,
  onClose,
  doctor,
  onBlocked,
}) => {
  const { blockDoctor } = useFavoritesContext();

  if (!doctor) return null;

  const handleConfirmBlock = () => {
    blockDoctor(doctor.id);
    toast({
      title: "Doctor Blocked",
      description: `Dr. ${doctor.name.replace(/^dr\.?\s*/i, '')} has been blocked and removed from your matches.`,
    });
    onClose();
    onBlocked?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-white p-6 rounded-2xl">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
              <Ban size={20} />
            </div>
            <DialogTitle className="text-base sm:text-lg font-bold text-slate-900">
              Block Dr. {doctor.name.replace(/^dr\.?\s*/i, '')}?
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-600 space-y-2">
            <p>
              Once blocked, the following will happen immediately:
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <ul className="space-y-2 text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <li className="flex items-start gap-2">
              <span className="text-rose-500 font-bold">•</span>
              <span>This doctor will be removed from your Matches, Online list, and Favorites.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-rose-500 font-bold">•</span>
              <span>They will not be able to view your profile or contact details.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-rose-500 font-bold">•</span>
              <span>They will not be able to send messages, video date invites, or matrimonial interests.</span>
            </li>
          </ul>
          <p className="text-[11px] text-slate-500 mt-2">
            You can manage or unblock doctors anytime from your Account or Favorites settings.
          </p>
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
            type="button"
            size="sm"
            onClick={handleConfirmBlock}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
          >
            <Ban size={13} className="mr-1.5" /> Block Doctor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
