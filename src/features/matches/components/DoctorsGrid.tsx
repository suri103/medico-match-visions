
import React, { useState } from 'react';
import DoctorCard from '@/components/DoctorCard';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from '@/components/ui/pagination';
import { Doctor } from '../types';
import EmptyMatches from './EmptyMatches';
import { useFavoritesContext } from '@/features/favorites/FavoritesContext';
import { usePlan } from '@/hooks/usePlan';
import { toast } from '@/hooks/use-toast';
import { DoctorContactModal } from '@/components/DoctorContactModal';
import { DoctorMessageModal } from '@/components/DoctorMessageModal';
import { DoctorVideoInviteModal } from '@/components/DoctorVideoInviteModal';
import { hasServerSession, revealContact } from '@/services/api';
import { useNavigate } from 'react-router-dom';

interface DoctorsGridProps {
  doctors: Doctor[];
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onReset?: () => void;
  onLike: (id: string) => void;
  onVideo: (id: string) => void;
  onMessage: (id: string) => void;
}

const DoctorsGrid: React.FC<DoctorsGridProps> = ({
  doctors,
  currentPage = 1,
  totalPages = 1,
  onPageChange = () => {},
  onReset = () => {},
  onLike,
  onVideo,
  onMessage
}) => {
  const { shortlistDoctor, unshortlistDoctor, isShortlisted, isMatched, markViewed, sendInterest } = useFavoritesContext();
  const { contactLeft, consumeContactView, planName } = usePlan();
  const navigate = useNavigate();

  const [contactDoctor, setContactDoctor] = useState<Doctor | null>(null);
  const [messageDoctor, setMessageDoctor] = useState<Doctor | null>(null);
  const [videoDoctor, setVideoDoctor] = useState<Doctor | null>(null);

  if (doctors.length === 0) {
    return <EmptyMatches onResetFilters={onReset} />;
  }

  const handleOpenContact = async (doctor: Doctor) => {
    markViewed(doctor.id);
    // Wired path: the metered /api/contact-reveal endpoint is the only source
    // of real contact data; the server charges its own quota and refuses when
    // nothing is shared (no charge for empty profiles — audit H1).
    if (hasServerSession()) {
      const r = await revealContact(doctor.id);
      if (r.ok) {
        setContactDoctor({ ...doctor, phone: r.phone || undefined, email: r.email || undefined });
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
      if (r.error !== 'no-server') {
        toast({
          title: 'Contact not available',
          description: r.error || 'Could not fetch contact details. Please try again.',
          variant: 'destructive',
        });
        return;
      }
    }
    // Demo path: quota is only charged when there is actually contact info to
    // reveal — a paid view must never be burned on an empty profile (H1).
    const hasContact = Boolean(doctor.phone || doctor.email);
    if (hasContact && !consumeContactView()) {
      toast({
        title: "Contact views limit reached",
        description: `Your ${planName} plan allows limited contact views per month. Upgrade for more.`,
        variant: "destructive"
      });
      return;
    }
    setContactDoctor(doctor);
  };

  const handleMessageClick = (doctor: Doctor) => {
    if (isMatched(doctor.id)) {
      onMessage(doctor.id);
    } else {
      setMessageDoctor(doctor);
    }
  };

  const handleVideoClick = (doctor: Doctor) => {
    if (isMatched(doctor.id)) {
      onVideo(doctor.id);
    } else {
      setVideoDoctor(doctor);
    }
  };

  const handleSendDirectMessage = (doctorId: string, _text: string) => {
    const doc = doctors.find(d => d.id === doctorId);
    if (doc) {
      void sendInterest(doc);
      onLike(doctorId);
    }
  };

  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {doctors.map((doctor) => (
          <DoctorCard
            key={doctor.id}
            id={doctor.id}
            name={doctor.name}
            age={doctor.age}
            specialty={doctor.specialty}
            degree={doctor.degree}
            hospital={doctor.hospital}
            city={doctor.city}
            imageUrl={doctor.imageUrl}
            matchPercentage={doctor.matchPercentage}
            interests={doctor.interests}
            isOnline={doctor.isOnline}
            isVerified={doctor.isVerified}
            councilName={doctor.councilName}
            registrationNumber={doctor.registrationNumber}
            religion={doctor.religion}
            caste={doctor.caste || doctor.cast}
            subcaste={doctor.subcaste}
            gotra={doctor.gotra}
            motherTongue={doctor.motherTongue}
            kundaliGunas={doctor.kundaliGunas}
            rashi={doctor.rashi}
            nakshatra={doctor.nakshatra}
            manglik={doctor.manglik}
            onLike={onLike}
            onVideo={() => handleVideoClick(doctor)}
            onMessage={() => handleMessageClick(doctor)}
            onShortlist={(id) => {
              if (isShortlisted(id)) { unshortlistDoctor(id); toast({ title: "Removed from shortlist" }); }
              else { shortlistDoctor(doctor); toast({ title: "Shortlisted", description: `Dr. ${doctor.name} saved to shortlist.` }); }
            }}
            onViewContact={() => handleOpenContact(doctor)}
            onViewProfile={() => navigate(`/doctor/${doctor.id}`, { state: { returnTo: '/matches', fromPage: 'Matches' } })}
          />
        ))}
      </div>

      <DoctorContactModal
        isOpen={!!contactDoctor}
        onClose={() => setContactDoctor(null)}
        doctor={contactDoctor}
        contactViewsRemaining={contactLeft}
        onStartChat={(id) => {
          onMessage(id);
        }}
      />

      <DoctorMessageModal
        isOpen={!!messageDoctor}
        onClose={() => setMessageDoctor(null)}
        doctor={messageDoctor}
        onSendMessage={handleSendDirectMessage}
      />

      <DoctorVideoInviteModal
        isOpen={!!videoDoctor}
        onClose={() => setVideoDoctor(null)}
        doctor={videoDoctor}
        onInviteSent={() => {
          // Audit H-3: the modal now creates the server-side video-date
          // booking itself and toasts the honest outcome. It used to call
          // `onLike(id)`, which sent a MATRIMONIAL INTEREST — so clicking
          // "Send Video Date Invite" silently sent an interest to the peer
          // and booked nothing. The invite is its own action.
        }}
      />
      
      {totalPages > 1 && (
        <Pagination className="mb-8">
          <PaginationContent>
            {currentPage > 1 && (
              <PaginationItem>
                <PaginationPrevious 
                  href="#" 
                  onClick={(e) => {
                    e.preventDefault();
                    onPageChange(currentPage - 1);
                  }} 
                />
              </PaginationItem>
            )}
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              if (
                page === 1 || 
                page === totalPages || 
                (page >= currentPage - 1 && page <= currentPage + 1)
              ) {
                return (
                  <PaginationItem key={page}>
                    <PaginationLink 
                      href="#" 
                      isActive={page === currentPage}
                      onClick={(e) => {
                        e.preventDefault();
                        onPageChange(page);
                      }}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                );
              }
              
              if (page === 2 && currentPage > 3) {
                return (
                  <PaginationItem key="ellipsis-start">
                    <PaginationEllipsis />
                  </PaginationItem>
                );
              }
              
              if (page === totalPages - 1 && currentPage < totalPages - 2) {
                return (
                  <PaginationItem key="ellipsis-end">
                    <PaginationEllipsis />
                  </PaginationItem>
                );
              }
              
              return null;
            })}
            
            {currentPage < totalPages && (
              <PaginationItem>
                <PaginationNext 
                  href="#" 
                  onClick={(e) => {
                    e.preventDefault();
                    onPageChange(currentPage + 1);
                  }} 
                />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
    </>
  );
};

export default DoctorsGrid;
