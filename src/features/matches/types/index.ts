
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
