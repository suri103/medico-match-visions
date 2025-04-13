
import React from 'react';
import DoctorCard from '@/components/DoctorCard';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from '@/components/ui/pagination';
import { Doctor } from '../types';
import EmptyMatches from './EmptyMatches';

interface DoctorsGridProps {
  doctors: Doctor[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onLike: (id: string) => void;
  onVideo: (id: string) => void;
  onMessage: (id: string) => void;
  onReset: () => void;
}

const DoctorsGrid: React.FC<DoctorsGridProps> = ({
  doctors,
  currentPage,
  totalPages,
  onPageChange,
  onLike,
  onVideo,
  onMessage,
  onReset
}) => {
  if (doctors.length === 0) {
    return <EmptyMatches onResetFilters={onReset} />;
  }

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
            hospital={doctor.hospital}
            city={doctor.city}
            imageUrl={doctor.imageUrl}
            matchPercentage={doctor.matchPercentage}
            interests={doctor.interests}
            isOnline={doctor.isOnline}
            onLike={onLike}
            onVideo={onVideo}
            onMessage={onMessage}
          />
        ))}
      </div>
      
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
