
import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useAuthSessionKey } from '@/hooks/useAuthSessionKey';
import { doctorProfiles } from '../data/sampleData';
import { defaultSavedSearches, statesByCountry, citiesByState } from '../data/constants';
import { useFavoritesContext } from '@/features/favorites/FavoritesContext';
import { Doctor, SavedSearch } from '../types';
import { computeMatchScore } from '@/lib/matchScore';
import { usePlan } from '@/hooks/usePlan';
import { hasServerSession, browseProfiles } from '@/services/api';
import { localAvatar } from '@/lib/avatar';

const ITEMS_PER_PAGE = 6;

export interface MatchSearchCriteria {
  searchTerm?: string;
  usernameSearch?: string;
  keywordSearch?: string;
  minAge?: number[];
  maxAge?: number[];
  specialties?: string[];
  degrees?: string[];
  onlineOnly?: boolean;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  sexualOrientation?: string[];
  ethnicity?: string[];
  religion?: string;
  caste?: string;
  cast?: string;
  subcaste?: string;
  gotra?: string;
  motherTongue?: string[];
  excludeSameGotra?: boolean;
  minGunas?: number;
  color?: string;
  // P0-4 family depth.
  familyType?: string;
  familyStatus?: string;
  incomeBand?: string;
  diet?: string;
}

export const useMatches = (initialSearch?: MatchSearchCriteria) => {
  const { toast } = useToast();
  const { planName, consumeVideoDate } = usePlan();
  const { isInterestSent, sendInterest, withdrawInterest, connections, blockedIds, interestedInYou, canMessage, markViewed } = useFavoritesContext();
  const meProfile = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('mm:profileData') || 'null'); } catch { return null; }
  }, []);
  const myInterests: string[] = useMemo(() => {
    try { const v = JSON.parse(localStorage.getItem('mm:profileInterests') || 'null'); return Array.isArray(v) ? v : []; } catch { return []; }
  }, []);
  const scoredProfiles = (() => {
    if (!meProfile?.name) return doctorProfiles;
    return doctorProfiles.map(d => ({ ...d, matchPercentage: computeMatchScore(d, meProfile, myInterests) }));
  })();

  // RULE: blocked/passed/hidden profiles must never reappear in results.
  // Both reset and every filter pass below derive from this pre-filtered pool
  // so a dismissed profile stays dismissed for the life of the session.
  const dismissedIds = new Set<string>([
    ...blockedIds,
    ...connections.filter(c => c.status === 'passed').map(c => c.doctorId),
  ]);
  // Wired mode: DB profiles replace the static sample pool as browsing source.
  const [serverPool, setServerPool] = useState<Doctor[] | null>(null);
  // Audit M18: once a real server session exists, NEVER fall back to the 17
  // fictional sample doctors when the browse fetch is absent or fails (a prod
  // hiccup would otherwise present fake members). Wired users see an empty/
  // loading state instead; the sample pool is only for demo/guest browsing.
  const sessionKey = useAuthSessionKey();
  const wired = !!sessionKey && hasServerSession();
  const poolSource = wired ? (serverPool ?? []) : scoredProfiles;
  const basePool = poolSource.filter(
    (d) =>
      !dismissedIds.has(d.id) &&
      d.profileVisibility !== 'hidden' &&
      d.profileVisibility !== 'private'
  );

  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>(
    () => [...basePool].sort((a, b) => b.matchPercentage - a.matchPercentage)
  );

  // Wired mode: real profiles from the DB replace the static sample pool as
  // the browsing source; Search clicks push supported criteria down to SQL.
  useEffect(() => {
    if (!hasServerSession()) { setServerPool(null); return; }
    let cancelled = false;
    browseProfiles({ limit: 200 }).then((rows) => {
      if (!rows || cancelled) return;
      setServerPool(rows.map((p) => ({
        id: p.id,
        userId: p.userId ?? undefined,
        name: p.name.replace(/^Dr\.\s*/i, ''),
        age: p.age ?? 30,
        specialty: p.specialty || '',
        degree: p.degree || '',
        hospital: p.hospital || '',
        city: p.city || '',
        state: p.state || '',
        country: p.country || 'India',
        imageUrl: p.imageUrl || localAvatar(p.name),
        matchPercentage: p.kundaliGunas ?? 75,
        interests: p.interests || [],
        isOnline: p.isOnline,
        sexualOrientation: p.sexualOrientation || 'Straight',
        ethnicity: p.ethnicity || undefined,
        religion: p.religion || undefined,
        caste: p.caste || undefined,
        cast: p.caste || undefined,
        subcaste: p.subcaste || undefined,
        gotra: p.gotra || undefined,
        motherTongue: p.motherTongue || undefined,
        rashi: p.rashi || undefined,
        nakshatra: p.nakshatra || undefined,
        manglik: p.manglik || undefined,
        kundaliGunas: p.kundaliGunas ?? undefined,
        isVerified: p.isVerified,
        // P0-4 family depth.
        familyType: p.familyType ?? undefined,
        familyStatus: p.familyStatus ?? undefined,
        incomeBand: p.incomeBand ?? undefined,
        diet: p.diet ?? undefined,
      } as Doctor)));
    }).catch(() => {});
    return () => { cancelled = true; };
    // Refetch for whichever user is signed in; reset serverPool on identity
    // change via the wired branch above (audit H6/M18).
  }, [sessionKey]);
  // P0-5 daily picks: server-ranked (boosted + verified first).
  useEffect(() => {
    if (!hasServerSession()) { setDailyPicks([]); return; }
    let cancelled = false;
    void (async () => {
      try {
        const { dailyMatches } = await import('@/services/api');
        const rows = await dailyMatches(6);
        if (!rows || cancelled) return;
        setDailyPicks(rows.map((p) => ({
          id: p.id, userId: p.userId ?? undefined, name: p.name.replace(/^Dr\.\s*/i, ''), age: p.age ?? 30,
          specialty: p.specialty || '', degree: p.degree || '',
          hospital: p.hospital || '', city: p.city || '', state: p.state || '',
          country: p.country || 'India', imageUrl: p.imageUrl || localAvatar(p.name),
          matchPercentage: p.kundaliGunas ?? 75, interests: p.interests || [],
          isOnline: p.isOnline, sexualOrientation: p.sexualOrientation || 'Straight',
          isVerified: p.isVerified,
        } as Doctor)));
      } catch { /* daily rail is optional */ }
    })();
    return () => { cancelled = true; };
  }, [sessionKey]);
  const [searchTerm, setSearchTerm] = useState('');
  const [minAge, setMinAge] = useState<number[]>([25]);
  const [maxAge, setMaxAge] = useState<number[]>([45]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [selectedDegrees, setSelectedDegrees] = useState<string[]>([]);
  const [onlineOnly, setOnlineOnly] = useState(Boolean(initialSearch?.onlineOnly));
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'matches' | 'video' | 'chat'>('matches');
  const [savedSearches, setSavedSearches] = usePersistedState<SavedSearch[]>('mm:savedSearches', defaultSavedSearches);
  const [searchName, setSearchName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editingSavedSearchId, setEditingSavedSearchId] = useState<string | null>(null);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [selectedSavedSearch, setSelectedSavedSearch] = useState<string | null>(null);
  const [usernameSearch, setUsernameSearch] = useState('');
  const [keywordSearch, setKeywordSearch] = useState('');
  
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedOrientation, setSelectedOrientation] = useState<string[]>([]);
  const [selectedEthnicity, setSelectedEthnicity] = useState<string[]>([]);
  const [selectedReligion, setSelectedReligion] = useState<string>('No preference');
  const [selectedCaste, setSelectedCaste] = useState<string>('No preference');
  const [selectedSubcaste, setSelectedSubcaste] = useState<string>('');
  const [selectedGotra, setSelectedGotra] = useState<string>('No preference');
  const [selectedMotherTongue, setSelectedMotherTongue] = useState<string[]>([]);
  const [excludeSameGotra, setExcludeSameGotra] = useState<boolean>(false);
  const [minGunas, setMinGunas] = useState<number>(0);
  const [selectedColor, setSelectedColor] = useState<string>('');
  // P0-4 family depth filters.
  const [selectedFamilyType, setSelectedFamilyType] = useState<string>('No preference');
  const [selectedFamilyStatus, setSelectedFamilyStatus] = useState<string>('No preference');
  const [selectedIncomeBand, setSelectedIncomeBand] = useState<string>('No preference');
  const [selectedDiet, setSelectedDiet] = useState<string>('No preference');
  // P0-5 daily picks (server-ranked) shown above the grid when wired.
  const [dailyPicks, setDailyPicks] = useState<Doctor[]>([]);
  const [availableStates, setAvailableStates] = useState<{value: string, label: string}[]>([]);
  const [availableCities, setAvailableCities] = useState<{value: string, label: string}[]>([]);

  const handleDegreeChange = (degree: string) => {
    setSelectedDegrees(prev =>
      prev.includes(degree)
        ? prev.filter(d => d !== degree)
        : [...prev, degree]
    );
  };

  // Cascading location filter: populate available states when country changes
  useEffect(() => {
    if (selectedCountry) {
      setAvailableStates(statesByCountry[selectedCountry as keyof typeof statesByCountry] || []);
    } else {
      setAvailableStates([]);
    }
  }, [selectedCountry]);

  // Cascading location filter: populate available cities when state changes
  useEffect(() => {
    if (selectedState) {
      setAvailableCities(citiesByState[selectedState as keyof typeof citiesByState] || []);
    } else {
      setAvailableCities([]);
    }
  }, [selectedState]);

  useEffect(() => {
    const totalPages = Math.ceil(filteredDoctors.length / ITEMS_PER_PAGE);
    setTotalPages(totalPages || 1);
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [filteredDoctors, currentPage]);

  // If initial search criteria are provided (e.g. redirected from Search Page),
  // populate and execute the filter synchronously on mount.
  useEffect(() => {
    if (!initialSearch) return;
    if (initialSearch.searchTerm !== undefined) setSearchTerm(initialSearch.searchTerm);
    if (initialSearch.usernameSearch !== undefined) setUsernameSearch(initialSearch.usernameSearch);
    if (initialSearch.keywordSearch !== undefined) setKeywordSearch(initialSearch.keywordSearch);
    if (initialSearch.minAge !== undefined) setMinAge(initialSearch.minAge);
    if (initialSearch.maxAge !== undefined) setMaxAge(initialSearch.maxAge);
    if (initialSearch.specialties !== undefined) setSpecialties(initialSearch.specialties);
    if (initialSearch.country !== undefined) setSelectedCountry(initialSearch.country);
    if (initialSearch.state !== undefined) setSelectedState(initialSearch.state);
    if (initialSearch.city !== undefined) setSelectedCity(initialSearch.city);
    if (initialSearch.onlineOnly !== undefined) setOnlineOnly(initialSearch.onlineOnly);
    if (initialSearch.sexualOrientation !== undefined) setSelectedOrientation(initialSearch.sexualOrientation);
    if (initialSearch.ethnicity !== undefined) setSelectedEthnicity(initialSearch.ethnicity);
    setSelectedReligion(initialSearch.religion ?? 'No preference');
    setSelectedCaste(initialSearch.caste ?? initialSearch.cast ?? 'No preference');
    setSelectedSubcaste(initialSearch.subcaste ?? '');
    setSelectedGotra(initialSearch.gotra ?? 'No preference');
    setSelectedMotherTongue(initialSearch.motherTongue ?? []);
    setExcludeSameGotra(initialSearch.excludeSameGotra ?? false);
    setMinGunas(initialSearch.minGunas ?? 0);
    setSelectedColor(initialSearch.color ?? '');
    // P0-4 family depth from Search redirect.
    setSelectedFamilyType(initialSearch.familyType ?? 'No preference');
    setSelectedFamilyStatus(initialSearch.familyStatus ?? 'No preference');
    setSelectedIncomeBand(initialSearch.incomeBand ?? 'No preference');
    setSelectedDiet(initialSearch.diet ?? 'No preference');
    applyFilters(initialSearch, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizeLocation = (value: string) =>
    value.toLowerCase().replace(/[\s_-]+/g, '');

  const locationMatches = (doctorValue: string, selectedValue: string) => {
    const doctor = normalizeLocation(doctorValue);
    const selected = normalizeLocation(selectedValue);
    return doctor.includes(selected) || selected.includes(doctor);
  };

  const applyFilters = (overrides?: Partial<MatchSearchCriteria>, silent?: boolean) => {
    const criteria: MatchSearchCriteria = {
      searchTerm,
      usernameSearch,
      keywordSearch,
      minAge,
      maxAge,
      specialties,
      degrees: selectedDegrees,
      onlineOnly,
      country: selectedCountry,
      state: selectedState,
      city: selectedCity,
      sexualOrientation: selectedOrientation,
      ethnicity: selectedEthnicity,
      religion: selectedReligion,
      caste: selectedCaste,
      cast: selectedCaste,
      subcaste: selectedSubcaste,
      gotra: selectedGotra,
      motherTongue: selectedMotherTongue,
      excludeSameGotra,
      minGunas,
      color: selectedColor,
      familyType: selectedFamilyType,
      familyStatus: selectedFamilyStatus,
      incomeBand: selectedIncomeBand,
      diet: selectedDiet,
      ...overrides,
    };

    const sTerm = criteria.searchTerm?.trim() || '';
    const uSearch = criteria.usernameSearch?.trim() || '';
    const kSearch = criteria.keywordSearch?.trim() || '';
    const mAge = criteria.minAge?.[0] ?? 25;
    const xAge = criteria.maxAge?.[0] ?? 45;
    const specs = criteria.specialties ?? [];
    const degs = criteria.degrees ?? [];
    const orientations = criteria.sexualOrientation ?? [];
    const ethnicities = criteria.ethnicity ?? [];
    const mTongues = criteria.motherTongue ?? [];

    const myDoctor = (() => {
      try {
        const p = JSON.parse(localStorage.getItem('mm:profileData') || 'null');
        const photos = JSON.parse(localStorage.getItem('mm:profilePhotos') || 'null');
        const primary = Array.isArray(photos) ? (photos.find((x: { isPrimary: boolean }) => x.isPrimary)?.url || photos[0]?.url) : undefined;
        if (!p?.name || !p?.specialty) return null;
        const parts = (p.location || '').split(',').map((s: string) => s.trim()).filter(Boolean);
        return {
          id: `me-${p.name.toLowerCase().replace(/\s+/g, '-')}`,
          name: p.name,
          age: 30,
          specialty: p.specialty,
          degree: p.degree || '',
          hospital: p.hospital || '—',
          city: parts[0] || '—',
          state: parts[1] || '',
          country: 'India',
          imageUrl: primary || '',
          matchPercentage: 100,
          interests: [] as string[],
          isOnline: true,
          sexualOrientation: 'Straight',
        } as Doctor;
      } catch { return null; }
    })();
    const pool = myDoctor ? [...basePool, myDoctor] : basePool;
    const myGotra = (meProfile?.gotra || '').toLowerCase().trim();

    const filtered = pool.filter(doctor => {
      // Defensive: never let dismissed (blocked/passed) or hidden/private
      // profiles surface, even if dismissal state changes mid-session.
      if (dismissedIds.has(doctor.id)) return false;
      if (doctor.profileVisibility === 'hidden' || doctor.profileVisibility === 'private') return false;
      if (doctor.id === myDoctor?.id) return false;
      const matchesSearch = !sTerm ||
        doctor.name.toLowerCase().includes(sTerm) ||
        doctor.specialty.toLowerCase().includes(sTerm) ||
        (doctor.degree && doctor.degree.toLowerCase().includes(sTerm)) ||
        doctor.city.toLowerCase().includes(sTerm) ||
        doctor.hospital.toLowerCase().includes(sTerm);

      const matchesUsername = !uSearch || doctor.name.toLowerCase().includes(uSearch);

      const matchesKeyword = !kSearch ||
        doctor.interests.some(interest => interest.toLowerCase().includes(kSearch)) ||
        doctor.specialty.toLowerCase().includes(kSearch) ||
        (doctor.degree && doctor.degree.toLowerCase().includes(kSearch)) ||
        doctor.hospital.toLowerCase().includes(kSearch);

      const matchesAge = doctor.age >= mAge && doctor.age <= xAge;
      const matchesSpecialty = specs.length === 0 || specs.includes(doctor.specialty);
      const matchesDegree = degs.length === 0 || degs.some(deg => {
        if (!doctor.degree) return false;
        const dDeg = doctor.degree.toLowerCase();
        const fDeg = deg.toLowerCase();
        if (dDeg.includes(fDeg) || fDeg.includes(dDeg)) return true;
        const fTokens = fDeg.split(/[^\w]+/).filter(t => t.length >= 3);
        return fTokens.some(t => dDeg.includes(t));
      });
      const matchesOnlineStatus = !criteria.onlineOnly || doctor.isOnline;

      const matchesCountry = !criteria.country || locationMatches(doctor.country, criteria.country);
      const matchesState = !criteria.state || locationMatches(doctor.state, criteria.state);
      const matchesCity = !criteria.city || locationMatches(doctor.city, criteria.city);
      const matchesOrientation = orientations.length === 0 || orientations.includes(doctor.sexualOrientation);

      const matchesEthnicity = ethnicities.length === 0 || (doctor.ethnicity !== undefined && ethnicities.includes(doctor.ethnicity));
      const matchesReligion = !criteria.religion || criteria.religion === 'No preference' || (doctor.religion !== undefined && doctor.religion.toLowerCase() === criteria.religion.toLowerCase());
      const targetCaste = criteria.caste || criteria.cast;
      const matchesCaste = !targetCaste || targetCaste === 'No preference' || ((doctor.caste || doctor.cast) !== undefined && (doctor.caste || doctor.cast)!.toLowerCase() === targetCaste.toLowerCase());
      const matchesSubcaste = !criteria.subcaste || criteria.subcaste === 'No preference' || criteria.subcaste === ''
        ? true
        : (doctor.subcaste !== undefined && doctor.subcaste.toLowerCase().includes(criteria.subcaste.toLowerCase().trim()));
      const matchesGotra = !criteria.gotra || criteria.gotra === 'No preference'
        ? true
        : (doctor.gotra !== undefined && doctor.gotra.toLowerCase() === criteria.gotra.toLowerCase());
      const matchesGotraExclusion = !criteria.excludeSameGotra || !myGotra || myGotra === 'no preference'
        ? true
        : !(doctor.gotra && doctor.gotra.toLowerCase().trim() === myGotra);
      const matchesMotherTongue = mTongues.length === 0
        ? true
        : (doctor.motherTongue !== undefined && mTongues.includes(doctor.motherTongue));
      const matchesGunas = !criteria.minGunas || criteria.minGunas === 0
        ? true
        : ((doctor.kundaliGunas ?? 0) >= criteria.minGunas);
      const matchesColor = !criteria.color || (doctor.skinTone !== undefined && doctor.skinTone === criteria.color);
      // P0-4 family second pass (server already filtered single-selects).
      const fam = (doctor as unknown as Record<string, string | undefined>);
      const matchesFamilyType = !criteria.familyType || criteria.familyType === 'No preference' || (fam.familyType !== undefined && fam.familyType.toLowerCase() === criteria.familyType.toLowerCase());
      const matchesFamilyStatus = !criteria.familyStatus || criteria.familyStatus === 'No preference' || (fam.familyStatus !== undefined && fam.familyStatus.toLowerCase() === criteria.familyStatus.toLowerCase());
      const matchesIncome = !criteria.incomeBand || criteria.incomeBand === 'No preference' || (fam.incomeBand !== undefined && fam.incomeBand.toLowerCase() === criteria.incomeBand.toLowerCase());
      const matchesDiet = !criteria.diet || criteria.diet === 'No preference' || (fam.diet !== undefined && fam.diet.toLowerCase() === criteria.diet.toLowerCase());

      return matchesSearch && matchesUsername && matchesKeyword && matchesAge &&
             matchesSpecialty && matchesDegree && matchesOnlineStatus && matchesCountry &&
             matchesState && matchesCity && matchesOrientation &&
             matchesEthnicity && matchesReligion && matchesCaste && matchesSubcaste && matchesGotra &&
             matchesGotraExclusion && matchesMotherTongue && matchesGunas && matchesColor &&
             matchesFamilyType && matchesFamilyStatus && matchesIncome && matchesDiet;
    });

    setFilteredDoctors(filtered);
    setCurrentPage(1);

    if (!silent) {
      toast({
        title: `Found ${filtered.length} matches`,
        description: "Showing doctors that match your criteria",
      });
    }
  };

  // Server pushdown: re-apply filters whenever a fresh DB pool arrives, and
  // push supported criteria to SQL on every explicit Search click.
  useEffect(() => {
    if (!serverPool) return;
    applyFilters(undefined, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverPool]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasServerSession()) {
      // H1: push Shaadi-style criteria to SQL instead of fetching 200
      // unfiltered rows. Single-select/ scalar filters go server-side;
      // multi-select + derived rules (degrees, orientation[], exclusion)
      // stay client-side in applyFilters() below.
      const singleReligion = selectedReligion && selectedReligion !== 'No preference' ? selectedReligion : undefined;
      const singleCaste = selectedCaste && selectedCaste !== 'No preference' ? selectedCaste : undefined;
      const singleGotra = selectedGotra && selectedGotra !== 'No preference' ? selectedGotra : undefined;
      const singleMotherTongue = selectedMotherTongue.length === 1 ? selectedMotherTongue[0] : undefined;
      const singleOrientation = selectedOrientation.length === 1 ? selectedOrientation[0] : undefined;
      const singleEthnicity = selectedEthnicity.length === 1 ? selectedEthnicity[0] : undefined;
      const criteria = {
        q: searchTerm || usernameSearch || keywordSearch || undefined,
        city: selectedCity && selectedCity !== 'All India' ? selectedCity : undefined,
        specialty: specialties[0],
        minAge: minAge[0],
        maxAge: maxAge[0],
        religion: singleReligion,
        caste: singleCaste,
        gotra: singleGotra,
        motherTongue: singleMotherTongue,
        orientation: singleOrientation,
        ethnicity: singleEthnicity,
        minGunas: minGunas || undefined,
        familyType: selectedFamilyType !== 'No preference' ? selectedFamilyType : undefined,
        familyStatus: selectedFamilyStatus !== 'No preference' ? selectedFamilyStatus : undefined,
        incomeBand: selectedIncomeBand !== 'No preference' ? selectedIncomeBand : undefined,
        diet: selectedDiet !== 'No preference' ? selectedDiet : undefined,
        limit: 200,
      };
      void browseProfiles(criteria).then((rows) => {
        if (!rows) return;
        setServerPool(rows.map((p) => ({
          id: p.id,
          name: p.name.replace(/^Dr\.\s*/i, ''),
          age: p.age ?? 30,
          specialty: p.specialty || 'Physician',
          degree: p.degree || '',
          hospital: p.hospital || '',
          city: p.city || '',
          state: p.state || '',
          country: p.country || 'India',
          imageUrl: p.imageUrl || localAvatar(p.name),
          matchPercentage: p.kundaliGunas ?? 75,
          interests: p.interests || [],
          isOnline: p.isOnline,
          sexualOrientation: p.sexualOrientation || 'Straight',
          ethnicity: p.ethnicity || undefined,
          religion: p.religion || undefined,
          caste: p.caste || undefined,
          cast: p.caste || undefined,
          subcaste: p.subcaste || undefined,
          gotra: p.gotra || undefined,
          motherTongue: p.motherTongue || undefined,
          rashi: p.rashi || undefined,
          nakshatra: p.nakshatra || undefined,
          manglik: p.manglik || undefined,
          kundaliGunas: p.kundaliGunas ?? undefined,
          isVerified: p.isVerified,
          familyType: (p as unknown as Record<string, string>).familyType,
          familyStatus: (p as unknown as Record<string, string>).familyStatus,
          incomeBand: (p as unknown as Record<string, string>).incomeBand,
          diet: (p as unknown as Record<string, string>).diet,
        } as Doctor)));
      }).catch(() => {});
    }
    applyFilters();
  };

  const handleReset = () => {
    setSearchTerm('');
    setSelectedFamilyType('No preference');
    setSelectedFamilyStatus('No preference');
    setSelectedIncomeBand('No preference');
    setSelectedDiet('No preference');
    setMinAge([25]);
    setMaxAge([45]);
    setSpecialties([]);
    setSelectedDegrees([]);
    setOnlineOnly(false);
    setSelectedCountry(null);
    setSelectedState(null);
    setSelectedCity(null);
    setSelectedOrientation([]);
    setSelectedEthnicity([]);
    setSelectedReligion('No preference');
    setSelectedCaste('No preference');
    setSelectedSubcaste('');
    setSelectedGotra('No preference');
    setSelectedMotherTongue([]);
    setExcludeSameGotra(false);
    setMinGunas(0);
    setSelectedColor('');
    setUsernameSearch('');
    setKeywordSearch('');
    // Derive from the pre-filtered pool so reset never resurrects a
    // blocked/passed/hidden profile.
    setFilteredDoctors([...basePool].sort((a, b) => b.matchPercentage - a.matchPercentage));
    setCurrentPage(1);
  };

  const handleVideoCall = (id: string) => {
    if (blockedIds.includes(id)) {
      toast({ title: "Blocked", description: "Unblock this profile first.", variant: "destructive" });
      return;
    }
    if (!canMessage(id)) {
      toast({ title: "Match to video chat", description: "Like each other first to unlock video calls.", variant: "destructive" });
      return;
    }
    // Starting a call from Matches consumes the monthly video-date quota,
    // same as the dedicated scheduling form (audit H3).
    if (!consumeVideoDate()) {
      toast({ title: "Video date limit reached", description: `Your ${planName} plan's monthly video date limit is reached. Upgrade for more.`, variant: "destructive" });
      return;
    }
    markViewed(id);
    setSelectedDoctor(id);
    setActiveView('video');
  };

  const handleChat = (id: string) => {
    if (blockedIds.includes(id)) {
      toast({ title: "Blocked", description: "Unblock this profile first.", variant: "destructive" });
      return;
    }
    if (!canMessage(id)) {
      toast({ title: "Match to chat", description: "Like each other first to unlock chat.", variant: "destructive" });
      return;
    }
    markViewed(id);
    setSelectedDoctor(id);
    setActiveView('chat');
  };

  const handleLike = (id: string) => {
    const doctor = scoredProfiles.find(d => d.id === id) || filteredDoctors.find(d => d.id === id);
    if (!doctor) return;
    if (blockedIds.includes(id)) {
      toast({ title: "Blocked", description: "Unblock this profile first.", variant: "destructive" });
      return;
    }
    markViewed(id);
    const interestAlreadySent = isInterestSent(id);
    if (interestAlreadySent) {
      withdrawInterest(doctor.id);
      toast({ title: "Interest withdrawn", description: `Interest in Dr. ${doctor.name} has been withdrawn.` });
      return;
    }
    const theyLikedMe = interestedInYou.some(i => i.doctor.id === id);
    const wasMatchedBefore = connections.some(c => c.doctorId === id && c.status === 'matched');
    // Quota is enforced centrally inside sendInterest (single source = usePlan).
    const accepted = sendInterest(doctor);
    if (!accepted) {
      toast({ title: "Interest limit reached", description: "Your plan's monthly interest limit is reached. Upgrade for more.", variant: "destructive" });
      return;
    }
    if (!wasMatchedBefore && theyLikedMe) {
      toast({ title: "It's a match! 🎉", description: `You and Dr. ${doctor.name} liked each other. Chat is now unlocked.` });
      try {
        const raw = localStorage.getItem('mm:notifications');
        const arr = raw ? JSON.parse(raw) : [];
        arr.unshift({ id: Date.now().toString(), type: 'interest', from: doctor.name, content: `You matched with Dr. ${doctor.name}! Start chatting now.`, timestamp: new Date().toISOString(), read: false, imageUrl: doctor.imageUrl });
        localStorage.setItem('mm:notifications', JSON.stringify(arr.slice(0, 50)));
        window.dispatchEvent(new CustomEvent('mm:persisted-state-changed', { detail: { key: 'mm:notifications' } }));
      } catch { /* ignore */ }
    } else {
      toast({ title: "Interest sent! ❤️", description: `Matrimonial interest sent to Dr. ${doctor.name}. View sent proposals in My Interests.` });
      try {
        const raw = localStorage.getItem('mm:notifications');
        const arr = raw ? JSON.parse(raw) : [];
        arr.unshift({ id: (Date.now()+1).toString(), type: 'interest', from: doctor.name, content: `You showed interest in Dr. ${doctor.name}`, timestamp: new Date().toISOString(), read: false, imageUrl: doctor.imageUrl });
        localStorage.setItem('mm:notifications', JSON.stringify(arr.slice(0, 50)));
        window.dispatchEvent(new CustomEvent('mm:persisted-state-changed', { detail: { key: 'mm:notifications' } }));
      } catch { /* ignore */ }
    }
  };

  const saveCurrentSearch = () => {
    const trimmed = searchName.trim();
    if (!trimmed) {
      toast({
        title: "Please name your search",
        description: "Enter a name to save your search criteria",
        variant: "destructive"
      });
      return;
    }
    if (savedSearches.some(s => s.name.toLowerCase() === trimmed.toLowerCase() && s.id !== editingSavedSearchId)) {
      toast({ title: "Name already exists", description: "Choose a different name for this search.", variant: "destructive" });
      return;
    }
    if (!editingSavedSearchId && savedSearches.length >= 20) {
      toast({ title: "Too many saved searches", description: "Delete one before saving another (max 20).", variant: "destructive" });
      return;
    }

    const newSearch: SavedSearch = {
      id: editingSavedSearchId || Date.now().toString(),
      name: trimmed,
      minAge,
      maxAge,
      specialties,
      degrees: selectedDegrees,
      country: selectedCountry,
      state: selectedState,
      city: selectedCity,
      sexualOrientation: selectedOrientation,
      onlineOnly,
      searchKeywords: searchTerm,
      ethnicity: selectedEthnicity,
      religion: selectedReligion,
      caste: selectedCaste,
      cast: selectedCaste,
      subcaste: selectedSubcaste,
      gotra: selectedGotra,
      motherTongue: selectedMotherTongue,
      excludeSameGotra,
      minGunas,
      color: selectedColor,
      usernameSearch,
      keywordSearch,
      familyType: selectedFamilyType,
      familyStatus: selectedFamilyStatus,
      incomeBand: selectedIncomeBand,
      diet: selectedDiet,
    };

    if (editingSavedSearchId) {
      setSavedSearches(savedSearches.map(search => 
        search.id === editingSavedSearchId ? newSearch : search
      ));
      setEditingSavedSearchId(null);
    } else {
      setSavedSearches([...savedSearches, newSearch]);
    }

    setSearchName('');
    
    toast({
      title: "Search saved!",
      description: "Your search criteria has been saved for future use."
    });
  };

  const loadSavedSearch = (searchId: string) => {
    const search = savedSearches.find(s => s.id === searchId);
    if (!search) return;

    setMinAge(search.minAge);
    setMaxAge(search.maxAge);
    setSpecialties(search.specialties);
    setSelectedDegrees((search as SavedSearch).degrees ?? []);
    setSelectedCountry(search.country);
    setSelectedState(search.state);
    setSelectedCity(search.city);
    setSelectedOrientation(search.sexualOrientation);
    setOnlineOnly(search.onlineOnly);
    setSearchTerm(search.searchKeywords || '');
    setSelectedEthnicity((search as SavedSearch).ethnicity ?? []);
    setSelectedReligion((search as SavedSearch).religion ?? 'No preference');
    setSelectedCaste((search as SavedSearch).caste ?? (search as SavedSearch).cast ?? 'No preference');
    setSelectedSubcaste((search as SavedSearch).subcaste ?? '');
    setSelectedGotra((search as SavedSearch).gotra ?? 'No preference');
    setSelectedMotherTongue((search as SavedSearch).motherTongue ?? []);
    setExcludeSameGotra((search as SavedSearch).excludeSameGotra ?? false);
    setMinGunas((search as SavedSearch).minGunas ?? 0);
    setSelectedColor((search as SavedSearch).color ?? '');
    setUsernameSearch((search as SavedSearch).usernameSearch ?? '');
    setKeywordSearch((search as SavedSearch).keywordSearch ?? '');
    setSelectedFamilyType((search as SavedSearch).familyType ?? 'No preference');
    setSelectedFamilyStatus((search as SavedSearch).familyStatus ?? 'No preference');
    setSelectedIncomeBand((search as SavedSearch).incomeBand ?? 'No preference');
    setSelectedDiet((search as SavedSearch).diet ?? 'No preference');
    setSelectedSavedSearch(searchId);

    applyFilters(
      {
        minAge: search.minAge,
        maxAge: search.maxAge,
        specialties: search.specialties,
        degrees: (search as SavedSearch).degrees ?? [],
        country: search.country,
        state: search.state,
        city: search.city,
        sexualOrientation: search.sexualOrientation,
        onlineOnly: search.onlineOnly,
        searchTerm: search.searchKeywords || '',
        usernameSearch: (search as SavedSearch).usernameSearch ?? '',
        keywordSearch: (search as SavedSearch).keywordSearch ?? '',
        ethnicity: (search as SavedSearch).ethnicity ?? [],
        religion: (search as SavedSearch).religion ?? 'No preference',
        caste: (search as SavedSearch).caste ?? (search as SavedSearch).cast ?? 'No preference',
        cast: (search as SavedSearch).caste ?? (search as SavedSearch).cast ?? 'No preference',
        subcaste: (search as SavedSearch).subcaste ?? '',
        gotra: (search as SavedSearch).gotra ?? 'No preference',
        motherTongue: (search as SavedSearch).motherTongue ?? [],
        excludeSameGotra: (search as SavedSearch).excludeSameGotra ?? false,
        minGunas: (search as SavedSearch).minGunas ?? 0,
        color: (search as SavedSearch).color ?? '',
        familyType: (search as SavedSearch).familyType ?? 'No preference',
        familyStatus: (search as SavedSearch).familyStatus ?? 'No preference',
        incomeBand: (search as SavedSearch).incomeBand ?? 'No preference',
        diet: (search as SavedSearch).diet ?? 'No preference',
      },
      true
    );

    toast({
      title: "Search loaded",
      description: `Applied search criteria: "${search.name}"`
    });
  };

  const editSavedSearch = (searchId: string) => {
    const search = savedSearches.find(s => s.id === searchId);
    if (!search) return;

    setEditingSavedSearchId(searchId);
    setSearchName(search.name);
    setMinAge(search.minAge);
    setMaxAge(search.maxAge);
    setSpecialties(search.specialties);
    setSelectedDegrees((search as SavedSearch).degrees ?? []);
    setSelectedCountry(search.country);
    setSelectedState(search.state);
    setSelectedCity(search.city);
    setSelectedOrientation(search.sexualOrientation);
    setOnlineOnly(search.onlineOnly);
    setSearchTerm(search.searchKeywords);
    setSelectedEthnicity((search as SavedSearch).ethnicity ?? []);
    setSelectedReligion((search as SavedSearch).religion ?? 'No preference');
    setSelectedCaste((search as SavedSearch).caste ?? (search as SavedSearch).cast ?? 'No preference');
    setSelectedSubcaste((search as SavedSearch).subcaste ?? '');
    setSelectedGotra((search as SavedSearch).gotra ?? 'No preference');
    setSelectedMotherTongue((search as SavedSearch).motherTongue ?? []);
    setExcludeSameGotra((search as SavedSearch).excludeSameGotra ?? false);
    setMinGunas((search as SavedSearch).minGunas ?? 0);
    setSelectedColor((search as SavedSearch).color ?? '');
    setUsernameSearch((search as SavedSearch).usernameSearch ?? '');
    setKeywordSearch((search as SavedSearch).keywordSearch ?? '');
    setSelectedFamilyType((search as SavedSearch).familyType ?? 'No preference');
    setSelectedFamilyStatus((search as SavedSearch).familyStatus ?? 'No preference');
    setSelectedIncomeBand((search as SavedSearch).incomeBand ?? 'No preference');
    setSelectedDiet((search as SavedSearch).diet ?? 'No preference');
    
    toast({
      title: "Edit saved search",
      description: "Make your changes and click 'Save search' when done."
    });
  };

  const deleteSavedSearch = (searchId: string) => {
    setSavedSearches(savedSearches.filter(s => s.id !== searchId));
    
    if (selectedSavedSearch === searchId) {
      setSelectedSavedSearch(null);
    }
    
    toast({
      title: "Search deleted",
      description: "Your saved search has been removed."
    });
  };

  const handleOrientationChange = (orientation: string) => {
    setSelectedOrientation(
      selectedOrientation.includes(orientation)
        ? selectedOrientation.filter((o) => o !== orientation)
        : [...selectedOrientation, orientation]
    );
  };

  const handleEthnicityChange = (ethnicity: string) => {
    setSelectedEthnicity(
      selectedEthnicity.includes(ethnicity)
        ? selectedEthnicity.filter((e) => e !== ethnicity)
        : [...selectedEthnicity, ethnicity]
    );
  };

  const handleMotherTongueChange = (language: string) => {
    setSelectedMotherTongue(
      selectedMotherTongue.includes(language)
        ? selectedMotherTongue.filter((l) => l !== language)
        : [...selectedMotherTongue, language]
    );
  };

  const handleSortChange = (sortOption: string) => {
    const sorted = [...filteredDoctors];
    switch (sortOption) {
      case 'match':
        sorted.sort((a, b) => b.matchPercentage - a.matchPercentage);
        break;
      case 'age-asc':
        sorted.sort((a, b) => a.age - b.age);
        break;
      case 'age-desc':
        sorted.sort((a, b) => b.age - a.age);
        break;
      case 'name-asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'gunas-desc':
        sorted.sort((a, b) => (b.kundaliGunas ?? 0) - (a.kundaliGunas ?? 0));
        break;
      default:
        break;
    }
    setFilteredDoctors(sorted);
  };

  const getPaginatedDoctors = () => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredDoctors.slice(startIndex, endIndex);
  };

  const selectedDoctorData = selectedDoctor 
    ? (scoredProfiles.find(d => d.id === selectedDoctor) || doctorProfiles.find(d => d.id === selectedDoctor))
    : null;

  return {
    filteredDoctors,
    searchTerm,
    setSearchTerm,
    minAge,
    setMinAge,
    maxAge,
    setMaxAge,
    specialties,
    setSpecialties,
    selectedDegrees,
    setSelectedDegrees,
    handleDegreeChange,
    onlineOnly,
    setOnlineOnly,
    selectedDoctor,
    setSelectedDoctor,
    activeView,
    setActiveView,
    savedSearches,
    searchName,
    setSearchName,
    currentPage,
    setCurrentPage,
    totalPages,
    editingSavedSearchId,
    setEditingSavedSearchId,
    showSavedSearches,
    setShowSavedSearches,
    selectedSavedSearch,
    setSelectedSavedSearch,
    usernameSearch,
    setUsernameSearch,
    keywordSearch,
    setKeywordSearch,
    selectedCountry,
    setSelectedCountry,
    selectedState,
    setSelectedState,
    selectedCity,
    setSelectedCity,
    selectedOrientation,
    selectedEthnicity,
    selectedReligion,
    setSelectedReligion,
    selectedCaste,
    setSelectedCaste,
    selectedCast: selectedCaste,
    setSelectedCast: setSelectedCaste,
    selectedSubcaste,
    setSelectedSubcaste,
    selectedGotra,
    setSelectedGotra,
    selectedMotherTongue,
    setSelectedMotherTongue,
    handleMotherTongueChange,
    excludeSameGotra,
    setExcludeSameGotra,
    minGunas,
    setMinGunas,
    selectedColor,
    setSelectedColor,
    selectedFamilyType,
    setSelectedFamilyType,
    selectedFamilyStatus,
    setSelectedFamilyStatus,
    selectedIncomeBand,
    setSelectedIncomeBand,
    selectedDiet,
    setSelectedDiet,
    dailyPicks,
    availableStates,
    availableCities,
    handleSearch,
    handleReset,
    handleVideoCall,
    handleChat,
    handleLike,
    saveCurrentSearch,
    loadSavedSearch,
    editSavedSearch,
    deleteSavedSearch,
    handleOrientationChange,
    handleEthnicityChange,
    handleSortChange,
    getPaginatedDoctors,
    selectedDoctorData
  };
};
