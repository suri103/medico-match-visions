
export interface Doctor {
  id: string;
  name: string;
  age: number;
  specialty: string;
  hospital: string;
  city: string;
  state: string;
  country: string;
  imageUrl: string;
  matchPercentage: number;
  interests: string[];
  isOnline: boolean;
  sexualOrientation: string;
  isVerified?: boolean;
  profileVisibility?: 'visible' | 'hidden' | 'private';
  lastActive?: Date;
  educationDetails?: string;
  aboutMe?: string;
  lookingFor?: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  minAge: number[];
  maxAge: number[];
  specialties: string[];
  country: string | null;
  state: string | null;
  city: string | null;
  sexualOrientation: string[];
  onlineOnly: boolean;
  searchKeywords: string;
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
