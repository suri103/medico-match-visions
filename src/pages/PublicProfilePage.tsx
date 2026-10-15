import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import {
  Heart, MessageSquare, Video, ShieldCheck, MapPin, Building2,
  Stethoscope, Star, Sparkles, BookOpen, User,
  ArrowLeft, Phone, Maximize2,
  CheckCircle2, Share2, Award, HeartHandshake, Eye,
  Flag, Ban, MoreVertical
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { doctorProfiles } from '@/features/matches/data/sampleData';
import { Doctor } from '@/features/matches/types';
import { useFavoritesContext } from '@/features/favorites/FavoritesContext';
import { usePlan } from '@/hooks/usePlan';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { DoctorMessageModal } from '@/components/DoctorMessageModal';
import { DoctorVideoInviteModal } from '@/components/DoctorVideoInviteModal';
import { DoctorContactModal } from '@/components/DoctorContactModal';
import { hasServerSession, revealContact, fetchProfile, serverProfileToDoctor, getKundaliReport, type KundaliReport } from '@/services/api';
import { ReportProfileModal } from '@/components/ReportProfileModal';
import { BlockProfileModal } from '@/components/BlockProfileModal';
import { usePersistedState } from '@/hooks/usePersistedState';
import { EMPTY_PROFILE, profileToDoctor } from '@/lib/profile';
import { localAvatar } from '@/lib/avatar';
import { syncInboxForChat } from '@/features/messages/hooks/useChatSync';

const PublicProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isFavorite, toggleFavorite, sendInterest, withdrawInterest, isShortlisted, shortlistDoctor, unshortlistDoctor, isBlocked, unblockDoctor } = useFavoritesContext();
  const { contactLeft, consumeContactView, planName } = usePlan();

  const [myProfileData] = usePersistedState('mm:profileData', EMPTY_PROFILE);
  const [myProfilePhotos] = usePersistedState('mm:profilePhotos', [
    { id: 1, url: localAvatar('You'), isPrimary: true },
    { id: 2, url: localAvatar('Portfolio'), isPrimary: false },
  ]);
  const [myInterests] = usePersistedState<string[]>('mm:profileInterests', ['Reading', 'Travel', 'Medical Research', 'Fitness']);

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  // Detailed Kundali Match Report (paid) — null until bought/generated.
  const [report, setReport] = useState<KundaliReport | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportPurchaseRequired, setReportPurchaseRequired] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  // Contact data unlocked via the metered /api/contact-reveal endpoint.
  const [revealedContact, setRevealedContact] = useState<{ phone: string; email: string } | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);

  const isSelf = !id || id === 'me' || id.startsWith('me-');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (isSelf) {
      const primaryPhoto = myProfilePhotos.find((p: { isPrimary: boolean }) => p.isPrimary)?.url || myProfilePhotos[0]?.url || localAvatar(myProfileData.name || 'You');
      const doc = profileToDoctor(myProfileData, primaryPhoto, myInterests);
      if (doc) setDoctor(doc);
    } else {
      const found = doctorProfiles.find(d => String(d.id) === String(id));
      if (found) {
        setDoctor(found);
      } else if (hasServerSession() && id) {
        // Real profile from DB — fetch via API when not in demo dataset.
        let cancelled = false;
        fetchProfile(id).then((p) => {
          if (cancelled || !p) { if (!cancelled) setDoctor(null); return; }
          setDoctor(serverProfileToDoctor(p));
        }).catch(() => { if (!cancelled) setDoctor(null); });
        return () => { cancelled = true; };
      } else {
        // Audit M17: an unknown/removed id must render the not-found state —
        // showing doctorProfiles[0] as if the exact profile existed would be a
        // fabricated member the user may act on.
        setDoctor(null);
      }
    }
  }, [id, isSelf, myProfileData, myProfilePhotos, myInterests]);

  if (!doctor) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
            <User size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Doctor Profile Not Found</h2>
          <p className="text-slate-500 mb-6 max-w-md">
            The profile you are looking for may have been updated or removed from active matches.
          </p>
          <Button onClick={() => navigate('/matches')} className="bg-mediblue-600 hover:bg-mediblue-700">
            <ArrowLeft className="mr-2 h-4 w-4" /> Browse Doctor Matches
          </Button>
        </div>
      </div>
    );
  }

  const isLiked = isFavorite(doctor.id);
  const isSaved = isShortlisted(doctor.id);
  const isDoctorBlocked = isBlocked(doctor.id);

  // Normalize doctor name to avoid duplicate "Dr. Dr."
  const cleanDoctorName = (doctor.name || 'User').replace(/^dr\.?\s*/i, '');
  const doctorDisplayName = `Dr. ${cleanDoctorName}`;

  // Gallery Photos
  const safeImageUrl = doctor.imageUrl || localAvatar(doctor.name || 'Member');
  const photos = isSelf && myProfilePhotos.length > 0
    ? myProfilePhotos.map((p: { url: string }) => p.url)
    : [
        safeImageUrl,
        safeImageUrl.includes('?') ? `${safeImageUrl}&v=1` : `${safeImageUrl}?v=1`,
        safeImageUrl.includes('?') ? `${safeImageUrl}&v=2` : `${safeImageUrl}?v=2`,
        safeImageUrl.includes('?') ? `${safeImageUrl}&v=3` : `${safeImageUrl}?v=3`,
      ];

  const bio = doctor.aboutMe || "";
  const lookingForText = doctor.lookingFor || "";

  // Contact info — only what the profile actually carries, plus anything the
  // server's metered reveal endpoint has unlocked this session. Nothing is
  // fabricated: users act on what this shows (audit H1).
  const email = revealedContact?.email || doctor.email || '';
  const phone = revealedContact?.phone || doctor.phone || '';

  const handleOpenContact = async () => {
    if (isSelf) {
      navigate('/account');
      return;
    }
    // Wired path: the server's reveal endpoint is the ONLY source of contact
    // data, metered by the server-side quota. No charge when nothing is shared.
    if (hasServerSession()) {
      const r = await revealContact(doctor.id);
      if (r.ok) {
        setRevealedContact({ phone: r.phone, email: r.email });
        setIsContactModalOpen(true);
        return;
      }
      if (r.error && /limit/i.test(r.error)) {
        toast({
          title: 'Contact views limit reached',
          description: r.error,
          variant: 'destructive',
        });
        return;
      }
      // Server reached but the reveal failed for any reason other than an
      // unconfigured server: stop here (audit H-6). Falling through used to
      // charge LOCAL quota and show demo contact data for a reveal that never
      // happened. Only a missing backend (no-server) may use the demo path.
      if (r.error !== 'no-server') {
        toast({
          title: 'Contact not available',
          description: r.error || 'Could not fetch contact details. Please try again.',
          variant: 'destructive',
        });
        return;
      }
    }
    // Only charge quota when this profile actually carries contact details —
    // a paid view must never be burned on an empty profile (audit H1).
    const hasContact = Boolean(doctor.phone || doctor.email);
    if (hasContact && !consumeContactView()) {
      toast({
        title: "Contact views limit reached",
        description: `Your ${planName} plan allows limited contact views per month. Upgrade for more.`,
        variant: "destructive"
      });
      return;
    }
    setIsContactModalOpen(true);
  };

  // Deliver the message typed in DoctorMessageModal into the real chat thread
  // (mm:chat:{id}) and the inbox preview — previously the text was discarded
  // while the modal toasted success (audit H5).
  const deliverProfileMessage = (doctorId: string, text: string) => {
    try {
      const key = `mm:chat:${doctorId}`;
      const raw = localStorage.getItem(key);
      const arr: Array<{ id: string; content: string; sender: string; timestamp: string; status?: string }> = raw ? JSON.parse(raw) : [];
      arr.push({ id: `msg${Date.now()}`, content: text, sender: 'user', timestamp: new Date().toISOString(), status: 'sent' });
      localStorage.setItem(key, JSON.stringify(arr));
      window.dispatchEvent(new CustomEvent('mm:persisted-state-changed', { detail: { key } }));
      syncInboxForChat(doctorId, `Dr. ${doctor.name}`, doctor.imageUrl, arr);
    } catch {
      toast({ title: 'Message not saved', description: 'Could not save your message. Please try again.', variant: 'destructive' });
    }

    // Backend dispatch: if a match channel exists, sync through server messages
    // (api.ts exports listChannels — the previous listMyChannels name did not
    // exist, so this dispatch never type-checked nor ran).
    import('@/services/api').then(async ({ listChannels, sendChatMessage }) => {
      try {
        const channels = await listChannels();
        const ch = channels?.find((c) => c.profile?.id === doctorId);
        if (ch) {
          await sendChatMessage(ch.channelId, text);
        }
      } catch (err) {
        console.warn('Could not dispatch profile message to server channel', err);
      }
    }).catch(() => {});
  };

  // Deliver the video-date invite into the outgoing requests store shown on
  // the Video Dates page — previously the chosen date/slot were discarded
  // while the modal toasted success (audit H5).
  const deliverProfileInvite = (doctorId: string, date: string, time: string) => {
    try {
      const key = 'mm:sentVideoRequests';
      const raw = localStorage.getItem(key);
      const arr: Array<{ id: string; doctorName: string; date: string; duration: string }> = raw ? JSON.parse(raw) : [];
      arr.push({ id: `vdr${Date.now()}`, doctorName: `Dr. ${doctor.name}`, date: new Date(`${date}T00:00:00`).toISOString(), duration: time });
      localStorage.setItem(key, JSON.stringify(arr));
      window.dispatchEvent(new CustomEvent('mm:persisted-state-changed', { detail: { key } }));
    } catch {
      toast({ title: 'Invite not saved', description: 'Could not save your video date request. Please try again.', variant: 'destructive' });
    }

    // Backend dispatch: if profile ID is known, request video date on server
    // (api.ts exports createVideoDate — requestVideoDate never existed).
    const targetId = doctorId || doctor.id;
    if (targetId) {
      import('@/services/api').then(async ({ createVideoDate }) => {
        try {
          const timeSlot = time.includes(':') ? time : '10:00';
          const scheduledFor = new Date(`${date}T${timeSlot}:00`).toISOString();
          await createVideoDate(targetId, scheduledFor, 30);
        } catch (err) {
          console.warn('Could not dispatch video date request to server', err);
        }
      }).catch(() => {});
    }
  };

  const handleShareProfile = () => {
    if (navigator.share) {
      navigator.share({
        title: `${doctorDisplayName} - MedicoMatch Profile`,
        text: `Check out ${doctorDisplayName} (${doctor.degree}, ${doctor.specialty}) on MedicoMatch.`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => {
        toast({
          title: "Profile link copied!",
          description: "Shareable link copied to your clipboard.",
        });
      }).catch(() => {
        toast({ title: "Copy failed", description: "Clipboard access was denied.", variant: "destructive" });
      });
    }
  };

  const handleToggleLike = () => {
    if (isLiked) {
      // Mirror the Matches page behaviour: unliking withdraws the interest too,
      // otherwise the "hearts" and "My Interests" would disagree.
      toggleFavorite(doctor);
      withdrawInterest(doctor.id);
      toast({
        title: "Interest withdrawn",
        description: `Your interest in ${doctorDisplayName}'s profile has been withdrawn.`,
      });
      return;
    }
    // Quota is enforced centrally inside sendInterest (single source = usePlan).
    const accepted = sendInterest(doctor);
    if (!accepted) {
      toast({
        title: "Interest limit reached",
        description: "Your plan's monthly interest limit is reached. Upgrade for more.",
        variant: "destructive",
      });
      return;
    }
    // Only reflect the like when the interest was actually accepted.
    toggleFavorite(doctor);
    toast({
      title: "Interest & Like Sent! 💌",
      description: `You showed interest in ${doctorDisplayName}'s profile.`,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      {/* Main Container */}
      <main className="flex-1 pb-20">
        
        {/* Top Breadcrumb & Actions Bar — Only shown when viewing other doctors */}
        {!isSelf && (
          <div className="bg-white border-b border-slate-200 sticky top-0 z-20 backdrop-blur-md bg-white/95">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 -ml-2 text-xs font-medium h-8"
                  onClick={() => {
                    const navState = location.state as { returnTo?: string; returnTab?: string; returnChatId?: string; fromPage?: string } | undefined;
                    if (navState?.returnTo) {
                      navigate(navState.returnTo, {
                        state: {
                          activeTab: navState.returnTab,
                          openChatId: navState.returnChatId,
                        }
                      });
                    } else if (window.history.length > 2) {
                      navigate(-1);
                    } else {
                      navigate('/matches');
                    }
                  }}
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> 
                  {(location.state as { fromPage?: string })?.fromPage 
                    ? `Back to ${(location.state as { fromPage?: string }).fromPage}` 
                    : 'Back'}
                </Button>
                <div className="h-4 w-px bg-slate-200 hidden sm:block" />
                <span className="text-xs text-slate-600 font-medium hidden sm:inline-block">
                  {doctorDisplayName} ({[doctor.degree, doctor.specialty].filter(Boolean).join(', ') || 'Member'})
                </span>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs text-slate-600 border-slate-200 hover:bg-slate-50"
                  onClick={handleShareProfile}
                >
                  <Share2 size={13} className="mr-1.5" /> Share
                </Button>
                <Button
                  size="sm"
                  variant={isLiked ? "default" : "outline"}
                  className={`h-8 text-xs font-medium transition-all ${
                    isLiked 
                      ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-500 shadow-sm' 
                      : 'text-rose-600 border-rose-200 hover:bg-rose-50'
                  }`}
                  onClick={handleToggleLike}
                  disabled={isDoctorBlocked}
                >
                  <Heart size={13} className={`mr-1.5 ${isLiked ? 'fill-current' : ''}`} />
                  {isLiked ? 'Interest Sent' : 'Send Interest'}
                </Button>

                {/* More Options Dropdown: Report & Block */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-slate-600 border-slate-200 hover:bg-slate-50 rounded-lg">
                      <MoreVertical size={15} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-white shadow-lg border border-slate-200 rounded-xl p-1">
                    <DropdownMenuItem 
                      onClick={() => {
                        if (isSaved) {
                          unshortlistDoctor(doctor.id);
                          toast({ title: "Removed from shortlist" });
                        } else {
                          shortlistDoctor(doctor);
                          toast({ title: "Profile Shortlisted ⭐", description: `Dr. ${cleanDoctorName} saved to shortlist.` });
                        }
                      }}
                      className="text-xs cursor-pointer text-slate-700 py-2"
                    >
                      <Star size={14} className="mr-2 text-amber-500" />
                      {isSaved ? "Remove from Shortlist" : "Save to Shortlist"}
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />

                    <DropdownMenuItem 
                      onClick={() => setIsReportModalOpen(true)}
                      className="text-xs cursor-pointer text-rose-600 hover:bg-rose-50 py-2 font-medium"
                    >
                      <Flag size={14} className="mr-2 text-rose-600" />
                      Report Profile
                    </DropdownMenuItem>

                    {isDoctorBlocked ? (
                      <DropdownMenuItem 
                        onClick={() => {
                          unblockDoctor(doctor.id);
                          toast({ title: "Doctor Unblocked", description: `Dr. ${cleanDoctorName} has been unblocked.` });
                        }}
                        className="text-xs cursor-pointer text-emerald-700 hover:bg-emerald-50 py-2 font-medium"
                      >
                        <ShieldCheck size={14} className="mr-2 text-emerald-600" />
                        Unblock Doctor
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem 
                        onClick={() => setIsBlockModalOpen(true)}
                        className="text-xs cursor-pointer text-rose-600 hover:bg-rose-50 py-2 font-medium"
                      >
                        <Ban size={14} className="mr-2 text-rose-600" />
                        Block Profile
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 space-y-5">

          {/* Blocked Profile Banner */}
          {!isSelf && isDoctorBlocked && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 text-rose-900 shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-rose-100 text-rose-600 shrink-0">
                  <Ban size={18} />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold">You have blocked Dr. {cleanDoctorName}</p>
                  <p className="text-[11px] text-rose-700">This profile is blocked. They cannot view your profile or contact you.</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs font-semibold text-rose-700 border-rose-300 hover:bg-rose-100 shrink-0 bg-white"
                onClick={() => {
                  unblockDoctor(doctor.id);
                  toast({
                    title: "Doctor Unblocked",
                    description: `Dr. ${cleanDoctorName} has been unblocked.`,
                  });
                }}
              >
                Unblock Doctor
              </Button>
            </div>
          )}

          {/* Profile Hero Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Subtle Aesthetic Banner */}
            <div className="h-28 sm:h-36 bg-gradient-to-r from-slate-100 via-sky-50 to-slate-100 relative border-b border-slate-200">
              <div className="absolute inset-0 bg-[radial-gradient(#0a7ee8_1px,transparent_1px)] [background-size:16px_16px] opacity-10" />
              <div className="absolute top-3.5 right-4 flex items-center gap-2 flex-wrap">
                <Badge className="bg-white text-slate-700 border-slate-200 font-medium shadow-sm text-xs">
                  {isSelf ? 'My Public Matrimonial Profile' : `${doctor.matchPercentage}% Matrimonial Match`}
                </Badge>
                {doctor.isOnline && (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Online Now
                  </span>
                )}
              </div>
            </div>

            {/* Profile Identity & Info */}
            <div className="px-5 sm:px-6 pb-5 pt-0">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-14 mb-3.5">
                {/* Photo Avatar with zoom icon */}
                <div 
                  className="relative group cursor-pointer shrink-0" 
                  onClick={() => setGalleryIndex(0)}
                  title="Click to view full photo"
                >
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-4 border-white overflow-hidden bg-white shadow-md transition-transform group-hover:scale-[1.02]">
                    <img 
                      src={photos[0]} 
                      alt={doctorDisplayName} 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <div className="absolute bottom-1.5 right-1.5 bg-slate-900/70 text-white rounded-lg p-1 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <Maximize2 size={13} />
                  </div>
                </div>

                {/* Primary Interaction Buttons */}
                <div className="flex items-center gap-2 flex-wrap sm:pb-1">
                  {isSelf ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs font-medium text-slate-700 border-slate-300 hover:bg-slate-50"
                        onClick={handleShareProfile}
                      >
                        <Share2 size={13} className="mr-1.5 text-slate-500" /> Share Profile
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs font-medium border-slate-300 hover:bg-slate-50"
                        onClick={() => navigate('/account')}
                      >
                        <Award size={13} className="mr-1.5 text-mediblue-600" /> Verification Status
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 px-3.5 text-xs font-medium bg-mediblue-600 hover:bg-mediblue-700 text-white shadow-sm"
                        onClick={() => navigate('/profile/edit')}
                      >
                        <User size={13} className="mr-1.5" /> Edit Profile & Biodata
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs font-medium text-slate-700 border-slate-300 hover:bg-slate-50"
                        onClick={handleOpenContact}
                        disabled={isDoctorBlocked}
                      >
                        <Phone size={13} className="mr-1.5 text-slate-500" /> Contact
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs font-medium text-teal-700 border-teal-200 bg-teal-50 hover:bg-teal-100/50"
                        onClick={() => setIsVideoModalOpen(true)}
                        disabled={isDoctorBlocked}
                      >
                        <Video size={13} className="mr-1.5 text-teal-600" /> Request Video
                      </Button>

                      <Button
                        size="sm"
                        className="h-8 text-xs font-medium bg-mediblue-600 hover:bg-mediblue-700 text-white shadow-sm"
                        onClick={() => setIsMessageModalOpen(true)}
                        disabled={isDoctorBlocked}
                      >
                        <MessageSquare size={13} className="mr-1.5" /> Send Message
                      </Button>

                      <Button
                        size="sm"
                        className={`h-8 px-3.5 text-xs font-medium shadow-sm transition-all ${
                          isLiked 
                            ? 'bg-rose-600 hover:bg-rose-700 text-white' 
                            : 'bg-rose-500 hover:bg-rose-600 text-white'
                        }`}
                        onClick={handleToggleLike}
                        disabled={isDoctorBlocked}
                      >
                        <Heart size={13} className={`mr-1.5 ${isLiked ? 'fill-current' : ''}`} />
                        {isLiked ? 'Interest Sent' : 'Send Interest'}
                      </Button>

                      {/* Quick Action buttons for Report and Block */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        onClick={() => setIsReportModalOpen(true)}
                        title="Report this doctor profile"
                      >
                        <Flag size={14} />
                      </Button>

                      {isDoctorBlocked ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
                          onClick={() => {
                            unblockDoctor(doctor.id);
                            toast({ title: "Doctor Unblocked", description: `Dr. ${cleanDoctorName} has been unblocked.` });
                          }}
                          title="Unblock doctor"
                        >
                          Unblock
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                          onClick={() => setIsBlockModalOpen(true)}
                          title="Block this doctor"
                        >
                          <Ban size={14} />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Toned Down Doctor Identity Details */}
              <div className="space-y-1.5 pt-1 border-t border-slate-100">
                <div className="flex items-center gap-2 flex-wrap pt-1.5">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {doctorDisplayName}
                  </h1>
                  {doctor.age && (
                    <span className="text-sm sm:text-base font-normal text-slate-500">
                      , {doctor.age} yrs
                    </span>
                  )}
                  {doctor.isVerified && (
                    <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 text-[11px] font-semibold py-0.5 px-2 flex items-center gap-1 rounded-md">
                      <ShieldCheck size={13} className="text-emerald-600 shrink-0" /> Verified Doctor
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm">
                  {doctor.degree && (
                    <span className="font-semibold text-slate-700 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs">
                      {doctor.degree}
                    </span>
                  )}
                  <span className="font-semibold text-mediblue-700">
                    {doctor.specialty}
                  </span>
                </div>

                <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="flex items-center gap-1">
                    <Building2 size={13} className="text-slate-400 shrink-0" />
                    {doctor.hospital}
                  </span>
                  <span className="text-slate-300 font-bold">·</span>
                  <span className="flex items-center gap-1">
                    <MapPin size={13} className="text-slate-400 shrink-0" />
                    {doctor.city}{doctor.state ? `, ${doctor.state}` : ''}{doctor.country && doctor.country !== 'India' ? `, ${doctor.country}` : ''}
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* 2-Column Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left / Main Column (2 spans) */}
            <div className="lg:col-span-2 space-y-6">

              {/* Photo Showcase Gallery */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Eye size={16} className="text-mediblue-600" /> Photo Gallery
                  </h2>
                  <span className="text-xs text-slate-400 font-medium">{photos.length} Photos</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  {photos.map((photo, index) => (
                    <div
                      key={index}
                      className="group relative aspect-[3/4] min-h-[180px] sm:min-h-[220px] rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 cursor-pointer hover:shadow-lg transition-all"
                      onClick={() => setGalleryIndex(index)}
                    >
                      <img
                        src={photo}
                        alt={`Dr. ${doctor.name} Photo ${index + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="p-2.5 rounded-full bg-white/95 text-slate-800 shadow-md">
                          <Maximize2 size={16} />
                        </div>
                      </div>
                      {index === 0 && (
                        <span className="absolute top-2.5 left-2.5 text-[11px] font-semibold bg-white/95 backdrop-blur px-2.5 py-0.5 rounded-md shadow-xs text-slate-800">
                          Primary
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* About Me Section */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
                <div>
                  <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <User size={18} className="text-mediblue-600" /> About Me & Medical Life
                  </h2>
                  <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                    {bio}
                  </p>
                </div>

                <hr className="border-slate-100" />

                <div>
                  <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <HeartHandshake size={18} className="text-rose-500" /> What I'm Looking For in a Partner
                  </h2>
                  <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                    {lookingForText}
                  </p>

                  {/* Preference Tags */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    {doctor.prefAgeMin && doctor.prefAgeMax && (
                      <span className="inline-flex items-center text-xs font-medium px-3 py-1 rounded-lg bg-slate-50 text-slate-700 border border-slate-200">
                        Age Preference: {doctor.prefAgeMin}–{doctor.prefAgeMax} yrs
                      </span>
                    )}
                    {doctor.prefLocation && (
                      <span className="inline-flex items-center text-xs font-medium px-3 py-1 rounded-lg bg-slate-50 text-slate-700 border border-slate-200">
                        Preferred Location: {doctor.prefLocation}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Medical Credentials & Registration */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Stethoscope size={18} className="text-mediblue-600" /> Medical Qualifications & Registration
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Medical Degree</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{doctor.degree || 'Not specified'}</p>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Specialization</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{doctor.specialty || 'General Medicine'}</p>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Hospital / Practice</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{doctor.hospital || 'Private Practice'}</p>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Career Stage</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{doctor.careerStage || 'Medical Professional'}</p>
                  </div>
                </div>

                {/* State Medical Council Card */}
                {doctor.councilName ? (
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-emerald-950">{doctor.councilName}</p>
                          <Badge className="bg-emerald-600 text-white text-[10px] py-0 px-1.5 font-medium">Verified</Badge>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 font-mono">
                          Registration Number: <strong className="text-emerald-950 font-bold">{doctor.registrationNumber}</strong>
                          {doctor.registrationYear ? ` (Registered: ${doctor.registrationYear})` : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                    State Medical Council verification verified via institutional email credentials.
                  </div>
                )}
              </div>

            </div>

            {/* Right Column / Side Information (1 span) */}
            <div className="space-y-6">

              {/* Vedic Horoscope & Astrological Alignment (Clean Amber/Slate Theme - No Purple) */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles size={16} className="text-amber-500" /> Vedic Kundali
                  </h3>
                  {doctor.kundaliGunas && (
                    <Badge className="bg-amber-50 text-amber-900 border-amber-200 text-xs font-bold">
                      {doctor.kundaliGunas}/36 Gunas Match
                    </Badge>
                  )}
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-500 font-medium">Manglik Status</span>
                    <span className="font-semibold text-slate-800">{doctor.manglik || 'Non-Manglik'}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-500 font-medium">Rashi (Moon Sign)</span>
                    <span className="font-semibold text-slate-800">{doctor.rashi || 'Not Specified'}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-500 font-medium">Nakshatra</span>
                    <span className="font-semibold text-slate-800">{doctor.nakshatra || 'Not Specified'}</span>
                  </div>
                </div>

                {/* Detailed Kundali Match Report (paid, REPORTS_ENABLED server-side).
                    Server 503s when the flag is off — the button hides on 503 so
                    the product is never sellable with no reachable purchase path. */}
                {hasServerSession() && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    {reportError && !reportPurchaseRequired && (
                      <p className="text-[11px] text-slate-400">{reportError}</p>
                    )}
                    {report ? (
                      <div className="space-y-1.5">
                        {report.kootas.map((k) => (
                          <div key={k.id} className="flex items-center justify-between text-[11px] px-2 py-1.5 bg-amber-50/60 rounded border border-amber-100">
                            <span className="text-slate-600">{k.name}</span>
                            <span className={`font-semibold ${k.status === 'Dosha' ? 'text-rose-700' : 'text-emerald-700'}`}>
                              {k.obtainedPoints}/{k.max}
                            </span>
                          </div>
                        ))}
                        <p className="text-[10px] text-slate-400 pt-1">{report.disclaimer}</p>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                        disabled={reportBusy}
                        onClick={() => void (async () => {
                          setReportBusy(true);
                          try {
                            const r = await getKundaliReport(doctor.id);
                            if (r.ok) {
                              setReport(r.report);
                              toast({ title: "Kundali report unlocked", description: `You scored ${r.report.totalPoints}/36 Gunas with ${doctor.name}.` });
                            } else if (r.purchaseRequired) {
                              setReportPurchaseRequired(true);
                              // Route the buyer through the standard checkout
                              // (sku kundali-report, ₹499) — same Razorpay path.
                              navigate(`/plan?sku=kundali-report&profileId=${encodeURIComponent(doctor.id)}`);
                            } else {
                              setReportError(r.error);
                            }
                          } finally {
                            setReportBusy(false);
                          }
                        })()}
                      >
                        {reportBusy ? 'Preparing…' : 'Get Detailed Match Report (₹499)'}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Personal & Cultural Background */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <BookOpen size={16} className="text-mediblue-600" /> Background & Community
                </h3>

                <div className="grid grid-cols-2 gap-y-4 gap-x-3 text-xs">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Religion</p>
                    <p className="font-semibold text-slate-800 text-sm mt-0.5">{doctor.religion || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Caste / Community</p>
                    <p className="font-semibold text-slate-800 text-sm mt-0.5">{doctor.caste || doctor.cast || 'Open'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Subcaste</p>
                    <p className="font-semibold text-slate-800 text-sm mt-0.5">{doctor.subcaste || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Gotra / Lineage</p>
                    <p className="font-semibold text-slate-800 text-sm mt-0.5">{doctor.gotra || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Mother Tongue</p>
                    <p className="font-semibold text-slate-800 text-sm mt-0.5">{doctor.motherTongue || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Marital Status</p>
                    <p className="font-semibold text-slate-800 text-sm mt-0.5">{doctor.maritalStatus || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Height</p>
                    <p className="font-semibold text-slate-800 text-sm mt-0.5">{doctor.heightCm ? `${doctor.heightCm} cm` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Location</p>
                    <p className="font-semibold text-slate-800 text-sm mt-0.5">{doctor.city}</p>
                  </div>
                </div>
              </div>

              {/* Interests & Lifestyle */}
              {doctor.interests && doctor.interests.length > 0 && (
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Star size={16} className="text-amber-500" /> Lifestyle & Interests
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {doctor.interests.map((interest, i) => (
                      <span 
                        key={i} 
                        className="px-2.5 py-1 bg-slate-50 text-slate-700 rounded-lg text-xs font-medium border border-slate-200/80"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Verified Matrimonial Contact Details */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Phone size={16} className="text-mediblue-600" /> Verified Contact
                  </h3>
                  <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 size={12} /> Direct Channel
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase">Contact Number</p>
                        <p className="font-semibold text-slate-800 font-mono text-sm mt-0.5">{phone || 'Not shared on profile'}</p>
                      </div>
                      {phone && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2"
                          onClick={handleOpenContact}
                        >
                          Details
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Official Matrimonial Email</p>
                    <p className="font-semibold text-slate-800 text-xs mt-0.5 truncate">{email || 'Not shared on profile'}</p>
                  </div>
                </div>
              </div>

              {/* Trust, Safety & Profile Moderation Card */}
              {!isSelf && (
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <ShieldCheck size={16} className="text-emerald-600" /> Trust & Safety
                    </h3>
                    <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 border-slate-200">
                      Doctor Protection
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mb-3.5 leading-relaxed">
                    MedicoMatch enforces strict medical council credential checks. If you notice any suspicious activity or guideline violation, report immediately.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs font-semibold text-rose-600 border-rose-200 hover:bg-rose-50"
                      onClick={() => setIsReportModalOpen(true)}
                    >
                      <Flag size={13} className="mr-1.5" /> Report Profile
                    </Button>
                    {isDoctorBlocked ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs font-semibold text-emerald-700 border-emerald-200 hover:bg-emerald-50 bg-emerald-50/50"
                        onClick={() => {
                          unblockDoctor(doctor.id);
                          toast({ title: "Doctor Unblocked", description: `Dr. ${cleanDoctorName} has been unblocked.` });
                        }}
                      >
                        <ShieldCheck size={13} className="mr-1.5 text-emerald-600" /> Unblock
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-rose-600"
                        onClick={() => setIsBlockModalOpen(true)}
                      >
                        <Ban size={13} className="mr-1.5 text-rose-500" /> Block Doctor
                      </Button>
                    )}
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>

      </main>

      {/* Interactive Modals */}
      <DoctorContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        doctor={doctor}
        contactViewsRemaining={contactLeft}
        onStartChat={(_id) => {
          setIsContactModalOpen(false);
          setIsMessageModalOpen(true);
        }}
      />

      <DoctorMessageModal
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        doctor={doctor}
        onSendMessage={(id, text) => {
          deliverProfileMessage(id, text);
          if (!isLiked) toggleFavorite(doctor);
        }}
      />

      <DoctorVideoInviteModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        doctor={doctor}
        onInviteSent={(id, date, time) => {
          deliverProfileInvite(id, date, time);
          if (!isLiked) toggleFavorite(doctor);
        }}
      />

      <ReportProfileModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        doctor={doctor}
        onReported={() => {
          // Stay on page with updated state or allow user to browse
        }}
      />

      <BlockProfileModal
        isOpen={isBlockModalOpen}
        onClose={() => setIsBlockModalOpen(false)}
        doctor={doctor}
        onBlocked={() => {
          // Handled in favorites context
        }}
      />

      {/* Full Screen High-Res Photo Gallery Dialog */}
      <Dialog open={galleryIndex !== null} onOpenChange={(open) => !open && setGalleryIndex(null)}>
        <DialogContent className="max-w-5xl sm:max-w-6xl w-[96vw] max-h-[95vh] p-0 overflow-hidden bg-slate-950/95 backdrop-blur-2xl border-slate-800 text-white shadow-2xl flex flex-col rounded-2xl">
          {/* Header */}
          <div className="px-5 py-3.5 pr-14 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-tight">
                Dr. {doctorDisplayName}
              </span>
              <span className="text-xs text-slate-400 font-medium px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                Photo {(galleryIndex ?? 0) + 1} of {photos.length}
              </span>
            </div>
          </div>

          {/* Large Main Photo Carousel Area */}
          <div className="relative p-2 sm:p-4 flex items-center justify-center w-full bg-black/60 overflow-hidden">
            <Carousel className="w-full max-w-4xl mx-auto" opts={{ startIndex: galleryIndex || 0, loop: true }}>
              <CarouselContent>
                {photos.map((photo, i) => (
                  <CarouselItem key={i} className="flex items-center justify-center py-2">
                    <div className="relative flex items-center justify-center w-full">
                      <img 
                        src={photo} 
                        alt={`Dr. ${doctor.name} Photo ${i + 1}`} 
                        className="w-auto h-[48vh] sm:h-[70vh] max-h-[750px] min-h-[200px] sm:min-h-[380px] max-w-[92vw] sm:max-w-full rounded-2xl object-contain shadow-2xl ring-1 ring-white/15" 
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-1 sm:left-4 h-9 w-9 sm:h-12 sm:w-12 bg-slate-900/85 hover:bg-white hover:text-slate-950 text-white border-slate-700 shadow-xl z-20" />
              <CarouselNext className="right-1 sm:right-4 h-9 w-9 sm:h-12 sm:w-12 bg-slate-900/85 hover:bg-white hover:text-slate-950 text-white border-slate-700 shadow-xl z-20" />
            </Carousel>
          </div>

          {/* Bottom Thumbnail Selector Strip */}
          {photos.length > 1 && (
            <div className="px-4 py-3 bg-slate-900/90 border-t border-slate-800/80 flex items-center justify-center gap-2.5 overflow-x-auto">
              {photos.map((photo, i) => (
                <button
                  key={i}
                  onClick={() => setGalleryIndex(i)}
                  className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden shrink-0 transition-all ${
                    (galleryIndex ?? 0) === i
                      ? 'ring-2 ring-mediblue-500 scale-105 opacity-100 shadow-md'
                      : 'opacity-50 hover:opacity-90 border border-slate-700'
                  }`}
                  title={`View photo ${i + 1}`}
                >
                  <img src={photo} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PublicProfilePage;
