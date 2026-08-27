
export interface Doctor {
  id: string;
  name: string;
  age: number;
  specialty: string;
  degree?: string;
  hospital: string;
  city: string;
  state: string;
  // Contact details are only present when the doctor chose to share them.
  phone?: string;
  email?: string;
  country: string;
  imageUrl: string;
  matchPercentage: number;
  interests: string[];
  isOnline: boolean;
  sexualOrientation: string;
  isVerified?: boolean;
  councilName?: string;
  registrationNumber?: string;
  registrationYear?: number;
  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
  verificationDocumentName?: string;
  verificationDocumentUrl?: string;
  verifiedAt?: string;
  profileVisibility?: 'visible' | 'hidden' | 'private';
  lastActive?: Date | string;
  educationDetails?: string;
  aboutMe?: string;
  lookingFor?: string;
  ethnicity?: string;
  religion?: string;
  caste?: string;
  cast?: string;
  subcaste?: string;
  gotra?: string;
  skinTone?: string;
  gender?: string;
  heightCm?: number;
  maritalStatus?: string;
  motherTongue?: string;
  rashi?: string;
  nakshatra?: string;
  manglik?: string;
  kundaliGunas?: number;
  prefAgeMin?: number;
  prefAgeMax?: number;
  prefLocation?: string;
  prefReligion?: string;
  prefCaste?: string;
  prefSubcaste?: string;
  prefGotra?: string;
  prefMotherTongue?: string[];
  prefDegree?: string[];
  excludeSameGotra?: boolean;
}

export interface SavedSearch {
  id: string;
  name: string;
  minAge: number[];
  maxAge: number[];
  specialties: string[];
  degrees?: string[];
  country: string | null;
  state: string | null;
  city: string | null;
  sexualOrientation: string[];
  onlineOnly: boolean;
  searchKeywords: string;
  ethnicity: string[];
  religion?: string;
  caste?: string;
  cast?: string;
  subcaste?: string;
  gotra?: string;
  motherTongue?: string[];
  excludeSameGotra?: boolean;
  minGunas?: number;
  color: string;
  usernameSearch: string;
  keywordSearch: string;
}

export interface LocationOption {
  value: string;
  label: string;
}

export interface MatchFilters {
  ageRange: [number, number];
  specialties: string[];
  location: {
    country: string | null;
    state: string | null;
    city: string | null;
  };
  sexualOrientation: string[];
  onlineOnly: boolean;
  verifiedOnly: boolean;
  searchKeywords: string;
}

export interface VideoDateInvitation {
  id: string;
  senderId: string;
  senderName: string;
  senderImage: string;
  message?: string;
  proposedDate: Date;
  duration: number;
  status: 'pending' | 'accepted' | 'declined' | 'rescheduled';
}

export interface VideoDateScheduled {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorImage: string;
  doctorSpecialty: string;
  date: Date;
  duration: number;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export interface Notification {
  id: string;
  type: 'message' | 'view' | 'interest' | 'hello' | 'videoDate' | 'connection';
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  relatedId: string;
}

export interface UserConnection {
  id: string;
  userId: string;
  userName: string;
  userImage: string;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  timestamp: Date;
}
