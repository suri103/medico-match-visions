
export const specialtiesList = [
  'Cardiologist', 
  'Neurologist', 
  'Pediatrician', 
  'Orthopedic Surgeon', 
  'Dermatologist', 
  'Psychiatrist', 
  'Oncologist', 
  'General Practitioner'
];

export const orientationsList = ['Straight', 'Gay', 'Lesbian', 'Bisexual'];
export const ethnicityList = ['Asian', 'Black', 'Hispanic', 'White', 'Middle Eastern', 'Native American', 'Pacific Islander', 'Other'];
export const castList = ['No preference', 'Brahmin', 'Kshatriya', 'Vaishya', 'Shudra', 'Other'];
export const colorList = ['Fair', 'Light', 'Medium', 'Olive', 'Brown', 'Dark'];

export const countries = [
  { value: 'india', label: 'India' },
  { value: 'united_states', label: 'United States' },
  { value: 'canada', label: 'Canada' },
  { value: 'australia', label: 'Australia' },
  { value: 'united_kingdom', label: 'United Kingdom' },
];

export const statesByCountry = {
  india: [
    { value: 'maharashtra', label: 'Maharashtra' },
    { value: 'delhi', label: 'Delhi' },
    { value: 'karnataka', label: 'Karnataka' },
    { value: 'tamil_nadu', label: 'Tamil Nadu' },
    { value: 'telangana', label: 'Telangana' },
  ],
  united_states: [
    { value: 'new_york', label: 'New York' },
    { value: 'california', label: 'California' },
    { value: 'texas', label: 'Texas' },
    { value: 'florida', label: 'Florida' },
  ],
  canada: [
    { value: 'ontario', label: 'Ontario' },
    { value: 'quebec', label: 'Quebec' },
    { value: 'british_columbia', label: 'British Columbia' },
  ],
  australia: [
    { value: 'new_south_wales', label: 'New South Wales' },
    { value: 'victoria', label: 'Victoria' },
    { value: 'queensland', label: 'Queensland' },
  ],
  united_kingdom: [
    { value: 'england', label: 'England' },
    { value: 'scotland', label: 'Scotland' },
    { value: 'wales', label: 'Wales' },
  ],
};

export const citiesByState = {
  maharashtra: [
    { value: 'mumbai', label: 'Mumbai' },
    { value: 'pune', label: 'Pune' },
    { value: 'nagpur', label: 'Nagpur' },
  ],
  delhi: [
    { value: 'new_delhi', label: 'New Delhi' },
    { value: 'old_delhi', label: 'Old Delhi' },
  ],
  karnataka: [
    { value: 'bangalore', label: 'Bangalore' },
    { value: 'mysore', label: 'Mysore' },
  ],
  tamil_nadu: [
    { value: 'chennai', label: 'Chennai' },
    { value: 'coimbatore', label: 'Coimbatore' },
  ],
  telangana: [
    { value: 'hyderabad', label: 'Hyderabad' },
    { value: 'warangal', label: 'Warangal' },
  ],
  new_york: [
    { value: 'nyc', label: 'New York City' },
    { value: 'buffalo', label: 'Buffalo' },
    { value: 'albany', label: 'Albany' },
  ],
  california: [
    { value: 'los_angeles', label: 'Los Angeles' },
    { value: 'san_francisco', label: 'San Francisco' },
    { value: 'san_diego', label: 'San Diego' },
  ],
  ontario: [
    { value: 'toronto', label: 'Toronto' },
    { value: 'ottawa', label: 'Ottawa' },
    { value: 'hamilton', label: 'Hamilton' },
  ],
};

export const defaultSavedSearches = [
  {
    id: '1',
    name: 'Cardiologists in Mumbai',
    minAge: [30],
    maxAge: [40],
    specialties: ['Cardiologist'],
    country: 'india',
    state: 'maharashtra',
    city: 'mumbai',
    sexualOrientation: [],
    onlineOnly: false,
    searchKeywords: '',
  },
  {
    id: '2',
    name: 'Online Doctors',
    minAge: [25],
    maxAge: [45],
    specialties: [],
    country: null,
    state: null,
    city: null,
    sexualOrientation: [],
    onlineOnly: true,
    searchKeywords: '',
  }
];
