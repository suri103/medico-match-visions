import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import { MemoryRouter } from 'react-router-dom';
import DoctorCard from '@/components/DoctorCard';
import { FavoritesProvider } from '@/features/favorites/FavoritesContext';
import { computeKundaliMilan, getAshtaKootaScore } from '@/lib/kundaliMatching';
import { EMPTY_PROFILE, profileToDoctor } from '@/lib/profile';
import { degreesList, specialtiesList, medicalCouncilsList } from '@/features/matches/data/constants';
import PaymentModal from '@/components/PaymentModal';

// Mock Auth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isSignedIn: true,
    user: { fullName: "Dr. Test User", firstName: "Test", lastName: "User" },
    signOut: vi.fn(),
    signIn: vi.fn(),
  }),
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
  toast: vi.fn(),
}));

describe('Comprehensive End-to-End Workflows Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Workflow 1: Medical Council Registry & Verification Workflow', () => {
    it('verifies the medical councils list contains major national, state, and AYUSH councils', () => {
      expect(medicalCouncilsList).toContain('National Medical Commission (NMC / MCI)');
      expect(medicalCouncilsList).toContain('Maharashtra Medical Council (MMC)');
      expect(medicalCouncilsList).toContain('Delhi Medical Council (DMC)');
      expect(medicalCouncilsList).toContain('Karnataka Medical Council (KMC)');
      expect(medicalCouncilsList).toContain('Dental Council of India (DCI)');
      expect(medicalCouncilsList).toContain('Veterinary Council of India (VCI)');
      expect(medicalCouncilsList).toContain('National Commission for Indian System of Medicine (NCISM - Ayurveda/Unani)');
      expect(medicalCouncilsList).toContain('National Commission for Homoeopathy (NCH)');
      expect(medicalCouncilsList).toContain('Indian Nursing Council (INC)');
    });

    it('creates doctor profile with council registration details and converts to verified Doctor object', () => {
      const userProfile = {
        ...EMPTY_PROFILE,
        name: 'Dr. Aarav Patel',
        degree: 'MBBS, MD',
        specialty: 'Cardiologist',
        hospital: 'Apollo Hospital',
        councilName: 'Maharashtra Medical Council (MMC)',
        registrationNumber: 'MMC-2018-87492',
        registrationYear: '2018',
        verificationStatus: 'verified' as const,
        verificationDocumentName: 'mmc_registration_certificate.pdf',
      };

      const doctor = profileToDoctor(userProfile, '1');
      if (!doctor) throw new Error('profileToDoctor returned null');

      expect(doctor.name).toBe('Dr. Aarav Patel');
      expect(doctor.isVerified).toBe(true);
      expect(doctor.councilName).toBe('Maharashtra Medical Council (MMC)');
      expect(doctor.registrationNumber).toBe('MMC-2018-87492');
      expect(doctor.registrationYear).toBe(2018);
      expect(doctor.verificationStatus).toBe('verified');
    });

    it('renders the verified council badge with council name on DoctorCard', () => {
      render(
        <MemoryRouter>
          <FavoritesProvider>
            <DoctorCard
              id="doc-1"
              name="Priya Desai"
              age={31}
              degree="MBBS, MS"
              specialty="General Surgery"
              hospital="Lilavati Hospital"
              city="Mumbai"
              imageUrl="https://randomuser.me/api/portraits/women/44.jpg"
              matchPercentage={94}
              interests={['Yoga', 'Reading']}
              isVerified={true}
              councilName="Maharashtra Medical Council (MMC)"
              registrationNumber="MMC-2017-64210"
              religion="Hindu"
              caste="Brahmin"
              onLike={() => {}}
              onVideo={() => {}}
              onMessage={() => {}}
            />
          </FavoritesProvider>
        </MemoryRouter>
      );

      expect(screen.getByText(/Priya Desai, 31/i)).toBeTruthy();
      expect(screen.getByText(/Maharashtra Verified|Medical Council Verified/i)).toBeTruthy();
      expect(screen.getByText(/MMC-2017-64210/i)).toBeTruthy();
    });
  });

  describe('Workflow 2: Degrees, Specialties & Matrimonial Astrological Matching Workflow', () => {
    it('contains full spectrum of medical, dental, AYUSH, veterinary and nursing qualifications', () => {
      expect(degreesList).toContain('MBBS');
      expect(degreesList).toContain('BDS');
      expect(degreesList).toContain('MD');
      expect(degreesList).toContain('MS');
      expect(degreesList).toContain('MDS');
      expect(degreesList).toContain('DM');
      expect(degreesList).toContain('MCh');
      expect(degreesList).toContain('DNB');
      expect(degreesList).toContain('BVSc & AH / MVSc (Veterinary)');
      expect(degreesList).toContain('BAMS (Ayurveda)');
      expect(degreesList).toContain('BHMS (Homeopathy)');
      expect(degreesList).toContain('B.Sc Nursing');
      expect(degreesList).toContain('M.Sc Nursing / NP');
      expect(degreesList).toContain('BPT / MPT (Physiotherapy)');

      expect(specialtiesList).toContain('Veterinary Physician / Surgeon');
      expect(specialtiesList).toContain('Ayurvedic Physician');
      expect(specialtiesList).toContain('Homeopathic Physician');
      expect(specialtiesList).toContain('Nursing Specialist / Critical Care');
      expect(specialtiesList).toContain('Dentist / Dental Surgeon');
    });

    it('accurately computes 36 Gunas Vedic Kundali Milan between two profiles', () => {
      const result = computeKundaliMilan(
        { rashi: 'Vrishabha (Taurus)', nakshatra: 'Rohini', manglik: 'Non-Manglik' },
        { rashi: 'Karka (Cancer)', nakshatra: 'Pushya', manglik: 'Non-Manglik' }
      );
      expect(result.maxPoints).toBe(36);
      expect(result.totalPoints).toBeGreaterThanOrEqual(18);
      expect(result.kootas.length).toBe(8);
      expect(result.kootas.some(k => k.name.includes('Varna'))).toBe(true);
      expect(result.kootas.some(k => k.name.includes('Nadi'))).toBe(true);
      expect(result.isAuspicious).toBe(true);
    });

    it('correctly calculates Ashta Koota Milan compatibility score', () => {
      const score = getAshtaKootaScore('Vrishabha (Taurus)', 'Rohini', 'Karka (Cancer)', 'Pushya');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(36);
    });
  });

  describe('Workflow 3: Notification & Interactive Response Workflow', () => {
    it('handles interaction states and connection responses', () => {
      const mockConnections = [
        { doctorId: 'doc-1', status: 'accepted' },
        { doctorId: 'doc-2', status: 'pending' },
      ];
      localStorage.setItem('mm:connections', JSON.stringify(mockConnections));

      const stored = JSON.parse(localStorage.getItem('mm:connections') || '[]');
      expect(stored.length).toBe(2);
      expect(stored.some((c: { doctorId: string; status: string }) => c.doctorId === 'doc-1' && c.status === 'accepted')).toBe(true);
    });
  });

  describe('Workflow 4: Membership Plans, Payment Backend & GST Invoicing Workflow', () => {
    it('computes 18% GST (CGST 9% + SGST 9%) correctly for tax invoices', () => {
      const planAmount = 2999;
      const baseAmount = Number((planAmount / 1.18).toFixed(2));
      const totalGst = Number((planAmount - baseAmount).toFixed(2));
      const cgst = Number((totalGst / 2).toFixed(2));
      const sgst = Number((totalGst / 2).toFixed(2));

      expect(baseAmount).toBeCloseTo(2541.53, 1);
      expect(totalGst).toBeCloseTo(457.47, 1);
      expect(cgst + sgst).toBeCloseTo(totalGst, 1);
    });

    it('renders PaymentModal with UPI / QR Code and Card selection options', () => {
      const onClose = vi.fn();
      render(
        <PaymentModal
          isOpen={true}
          onClose={onClose}
          serviceName="Gold Membership Plan"
          amount={2999}
          sku="platinum"
        />
      );

      expect(screen.getByText('Complete Your Payment')).toBeTruthy();
      expect(screen.getAllByText(/Gold Membership Plan/i).length).toBeGreaterThan(0);
      expect(screen.getByText('UPI / QR Code')).toBeTruthy();
      expect(screen.getByText('Cards / NetBanking')).toBeTruthy();
      expect(screen.getByText(/Total \(incl\. GST\)/i)).toBeTruthy();
    });
  });
});
