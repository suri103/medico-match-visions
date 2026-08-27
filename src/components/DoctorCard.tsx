import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Video, MessageSquare, X, Eye, Bookmark, Phone, ShieldCheck, User, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFavoritesContext } from '@/features/favorites/FavoritesContext';
import type { Doctor } from '@/features/matches/types';
import { useToast } from '@/hooks/use-toast';

export type DoctorCardVariant = 'discover' | 'sent' | 'received' | 'compact';

interface DoctorCardProps {
  id: string;
  name: string;
  age: number;
  specialty: string;
  hospital: string;
  city: string;
  imageUrl: string;
  matchPercentage: number;
  interests: string[];
  isOnline?: boolean;
  isVerified?: boolean;
  councilName?: string;
  registrationNumber?: string;
  verificationStatus?: string;
  variant?: DoctorCardVariant;
  note?: string;
  whyMatch?: string[];
  religion?: string;
  degree?: string;
  caste?: string;
  subcaste?: string;
  gotra?: string;
  motherTongue?: string;
  kundaliGunas?: number;
  rashi?: string;
  nakshatra?: string;
  manglik?: string;
  onLike: (id: string) => void;
  onFavorite?: (id: string) => void;
  onVideo: (id: string) => void;
  onMessage: (id: string) => void;
  onShortlist?: (id: string) => void;
  onViewContact?: (id: string) => void;
  onWithdraw?: (id: string) => void;
  onPass?: (id: string) => void;
  onViewProfile?: (id: string) => void;
  onRemove?: (id: string) => void;
  overlayAction?: React.ReactNode;
}

const DoctorCard: React.FC<DoctorCardProps> = ({
  id, name, age, specialty, degree, hospital, city, imageUrl, matchPercentage, interests,
  isOnline = false, isVerified = false, councilName, registrationNumber, verificationStatus: _verificationStatus,
  variant = 'discover', note: _note, whyMatch: _whyMatch,
  religion, caste, subcaste: _subcaste, gotra: _gotra, motherTongue: _motherTongue, kundaliGunas, rashi: _rashi, nakshatra: _nakshatra, manglik: _manglik,
  onLike, onFavorite, onVideo, onMessage, onShortlist, onViewContact, onWithdraw, onPass, onViewProfile, onRemove: _onRemove, overlayAction = null,
}) => {
  const { toast } = useToast();
  const { isFavorite, isInterestSent: checkInterestSent, isShortlisted, isMatched, isBlocked, toggleFavorite } = useFavoritesContext();
  const isFav = isFavorite ? isFavorite(id) : false;
  const isInterestSent = checkInterestSent ? checkInterestSent(id) : false;
  const shortlisted = isShortlisted ? isShortlisted(id) : false;
  const matched = isMatched ? isMatched(id) : false;
  const blocked = isBlocked ? isBlocked(id) : false;

  const displayName = name.replace(/^dr\.?\s*/i, '');

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onFavorite) {
      onFavorite(id);
    } else {
      const doc: Doctor = {
        id, name, age, specialty, degree, hospital, city, imageUrl, matchPercentage, interests, isOnline, isVerified,
        state: '', country: 'India', sexualOrientation: 'Straight'
      };
      toggleFavorite(doc);
    }
    if (isFav) {
      toast({
        title: "Removed from Favorites",
        description: `Dr. ${displayName} has been removed from your favorites.`
      });
    } else {
      toast({
        title: "Added to Favorites ⭐",
        description: `You favorited Dr. ${displayName}. View your saved profiles in Favorites.`
      });
    }
  };

  return (
    <Card 
      className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg border-slate-200/90 bg-white flex flex-col h-full rounded-2xl ${
        matched ? 'ring-2 ring-emerald-500/30' : ''
      }`}
    >
      {/* Profile Image with subtle overlay */}
      <div className="relative h-[220px] sm:h-[240px] w-full overflow-hidden bg-slate-100">
        <img 
          src={imageUrl} 
          alt={`Dr. ${displayName}`} 
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        
        {/* Status / Match pill */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          <Badge className="bg-white/95 text-slate-800 backdrop-blur font-semibold shadow-xs text-[11px] border-0 px-2 py-0.5">
            {matchPercentage}% Match
          </Badge>
          {isOnline && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-medium backdrop-blur shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Online
            </span>
          )}
        </div>

        {/* Single Star / Favorite quick-action on top-right of image */}
        <button
          onClick={handleToggleFavorite}
          aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
          className={`absolute top-2.5 right-2.5 p-1.5 rounded-full backdrop-blur transition-all active:scale-90 shadow-md ${
            isFav 
              ? 'bg-amber-400 text-slate-900 ring-2 ring-white/90 scale-105' 
              : 'bg-black/35 text-white hover:bg-black/55 hover:text-amber-300'
          }`}
          title={isFav ? "Favorited (Saved in Favorites)" : "Star / Add to Favorites"}
        >
          <Star size={15} className={isFav ? 'fill-slate-900 text-slate-900' : ''} />
        </button>

        {overlayAction}
      </div>

      {/* Compact White Content Section */}
      <CardContent className="flex flex-col flex-1 p-3 sm:p-3.5 pt-2.5 justify-between">
        <div className="space-y-1">
          {/* Header Row: Doctor Name & Upper-Right Action Icons (Video, Shortlist, Contact) */}
          <div className="flex justify-between items-center gap-1.5">
            <h3 className="font-bold text-slate-900 tracking-tight text-[15px] leading-tight flex items-center gap-1 truncate">
              <span className="truncate">Dr. {displayName}, {age}</span>
              {isVerified && (
                <span className="shrink-0 text-emerald-600" title="Medical Council Verified">
                  <ShieldCheck size={14} />
                </span>
              )}
            </h3>

            {/* Upper Right Action Icons (no redundant duplicate star) */}
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => onVideo(id)}
                disabled={blocked}
                className="p-1 rounded-md text-teal-600 hover:bg-teal-50 hover:text-teal-700 transition-colors"
                title="Request Video Date"
                aria-label="Request Video Date"
              >
                <Video size={15} />
              </button>

              {onShortlist && (
                <button
                  onClick={() => onShortlist(id)}
                  disabled={blocked}
                  className={`p-1 rounded-md transition-colors ${
                    shortlisted 
                      ? 'text-mediblue-600 hover:bg-mediblue-50' 
                      : 'text-slate-400 hover:text-mediblue-600 hover:bg-slate-50'
                  }`}
                  title={shortlisted ? "Saved in Shortlist" : "Save / Shortlist"}
                  aria-label="Save / Shortlist"
                >
                  <Bookmark size={15} className={shortlisted ? 'fill-current' : ''} />
                </button>
              )}

              {onViewContact && (
                <button
                  onClick={() => onViewContact(id)}
                  disabled={blocked}
                  className="p-1 rounded-md text-slate-500 hover:text-mediblue-700 hover:bg-mediblue-50 transition-colors"
                  title="View Contact & Connection"
                  aria-label="View Contact"
                >
                  <Phone size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Degree & Specialty */}
          <p className="text-[12px] font-semibold text-mediblue-700 truncate">
            {degree ? `${degree} · ` : ''}{specialty}
          </p>

          {/* Hospital & Location */}
          <p className="text-[11px] text-slate-500 truncate">
            {hospital} · {city}
          </p>

          {/* Key tags (single compact row) */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            {isVerified && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/60 flex items-center gap-1">
                <ShieldCheck size={11} className="text-emerald-600" />
                {councilName ? `${councilName.split(' ')[0]} Verified` : 'Medical Council Verified'}
                {registrationNumber ? ` · ${registrationNumber}` : ''}
              </span>
            )}
            {kundaliGunas && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                ✨ {kundaliGunas}/36
              </span>
            )}
            {religion && religion !== 'No preference' && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                {religion}
              </span>
            )}
            {caste && caste !== 'No preference' && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/60">
                {caste}
              </span>
            )}
            {interests && interests.length > 0 && (
              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200 truncate max-w-[100px]">
                {interests[0]}
              </span>
            )}
          </div>
        </div>

        {/* Action Button Row */}
        {variant === 'discover' && (
          <div className="pt-3 mt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
            {onViewProfile && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9 py-2 px-2 text-xs text-slate-700 border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-1.5 font-medium rounded-xl transition-all shadow-xs"
                onClick={() => onViewProfile(id)}
                disabled={blocked}
              >
                <User size={13} className="text-slate-500 shrink-0" />
                <span>Profile</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-9 py-2 px-2 text-xs text-mediblue-700 border-mediblue-200 hover:bg-mediblue-50 flex items-center justify-center gap-1.5 font-medium rounded-xl transition-all shadow-xs"
              onClick={() => onMessage(id)}
              disabled={blocked}
            >
              <MessageSquare size={13} className="text-mediblue-600 shrink-0" />
              <span>Chat</span>
            </Button>

            <Button
              size="sm"
              className={`flex-1 h-9 py-2 px-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 rounded-xl transition-all shadow-xs ${
                isInterestSent 
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs' 
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200'
              }`}
              onClick={() => onLike(id)}
              disabled={blocked}
            >
              <Heart size={13} className={`shrink-0 ${isInterestSent ? 'fill-current text-white' : 'text-rose-600'}`} />
              <span className="truncate">{isInterestSent ? 'Interest Sent' : 'Send Interest'}</span>
            </Button>
          </div>
        )}

        {variant === 'sent' && (
          <div className="flex items-center gap-2 pt-3 mt-2.5 border-t border-slate-100">
            <Button size="sm" className="flex-1 rounded-xl h-9 py-2 text-xs bg-mediblue-600 hover:bg-mediblue-700" onClick={() => onMessage(id)}>
              <MessageSquare size={13} className="mr-1.5" /> Message
            </Button>
            {onViewProfile && (
              <Button size="sm" variant="outline" className="rounded-xl h-9 py-2 text-xs border-slate-200" onClick={() => onViewProfile(id)}>
                <Eye size={13} className="mr-1.5" /> Profile
              </Button>
            )}
            {onWithdraw && (
              <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-slate-400 hover:text-red-600 rounded-xl" onClick={() => onWithdraw(id)} title="Withdraw">
                <X size={14} />
              </Button>
            )}
          </div>
        )}

        {variant === 'received' && (
          <div className="flex items-center gap-1.5 pt-3 mt-2.5 border-t border-slate-100">
            <Button size="sm" variant="outline" className="flex-1 rounded-xl h-9 py-2 text-xs border-slate-200" onClick={() => onPass?.(id)}>
              Pass
            </Button>
            <Button size="sm" variant="outline" className="flex-1 rounded-xl h-9 py-2 text-xs border-mediblue-200 text-mediblue-700" onClick={() => onMessage(id)}>
              Chat
            </Button>
            <Button size="sm" className="flex-1 rounded-xl h-9 py-2 text-xs bg-mediblue-600 hover:bg-mediblue-700" onClick={() => onLike(id)}>
              Like
            </Button>
          </div>
        )}

        {variant === 'compact' && (
          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs px-2.5" onClick={() => onViewProfile?.(id)}>View</Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs px-2.5" onClick={() => onMessage(id)}>Message</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DoctorCard;
