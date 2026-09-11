
export const degreesList = [
  // Completed qualifications
  'MBBS',
  'MD',
  'MS',
  'DNB',
  'BDS',
  'MDS',
  'DM',
  'MCh',
  'BAMS (Ayurveda)',
  'BHMS (Homeopathy)',
  'BVSc & AH / MVSc (Veterinary)',
  'B.Sc Nursing',
  'M.Sc Nursing / NP',
  'BNYS (Naturopathy & Yoga)',
  'BUMS (Unani)',
  'BPT / MPT (Physiotherapy)',
  'Pharm.D / M.Pharm',
  'MRCP / FRCS',
  'Other',
  // Pursuing (student tier — fully eligible to marry, never auto-labelled Dr.)
  'MBBS (Pursuing)',
  'BDS (Pursuing)',
  'BHMS / BAMS (Pursuing)',
  'BVSc (Pursuing)',
  'Nursing (Pursuing)',
];

// Honest career stage — SEPARATE from verification. A student is fully
// eligible to marry but is NOT a "Dr."; these stages gate the title prefix.
export const careerStagesList = [
  'Medical Student',
  'Intern / House Surgeon',
  'Resident (JR/SR)',
  'Consultant / Specialist',
  'Surgeon',
  'General Practitioner',
  'Ayurveda / Homeopathy / Unani Practitioner',
  'Veterinary Doctor',
  'Nursing Professional',
  'Allied Health / Physiotherapist',
  'Academic / Researcher',
  'Other',
];

export const specialtiesList = [
  'General Physician',
  'General Practitioner',
  'Cardiologist', 
  'Neurologist', 
  'Pediatrician', 
  'Orthopedic Surgeon', 
  'Dermatologist', 
  'Psychiatrist', 
  'Oncologist',
  'Gynecologist & Obstetrician',
  'General Surgeon',
  'Radiologist',
  'Anesthesiologist',
  'Pathologist',
  'Ophthalmologist',
  'ENT Specialist',
  'Dentist / Dental Surgeon',
  'Orthodontist',
  'Veterinary Physician / Surgeon',
  'Ayurvedic Physician',
  'Homeopathic Physician',
  'Nursing Specialist / Critical Care',
  'Physiotherapist'
];

export const orientationsList = ['Straight', 'Gay', 'Lesbian', 'Bisexual'];
export const ethnicityList = ['Asian', 'Black', 'Hispanic', 'White', 'Middle Eastern', 'Native American', 'Pacific Islander', 'Other'];

export const religionList = [
  'No preference',
  'Hindu',
  'Muslim',
  'Christian',
  'Sikh',
  'Jain',
  'Buddhist',
  'Parsi',
  'Jewish',
  'Spiritual',
  'Other'
];

export const casteList = [
  'No preference',
  'Brahmin',
  'Kshatriya / Rajput',
  'Vaishya / Baniya',
  'Kayastha',
  'Reddy',
  'Nair',
  'Maratha',
  'Jat',
  'Agarwal',
  'Gupta',
  'Patel',
  'Iyer / Iyengar',
  'Lingayat',
  'Gounder',
  'Mudaliar',
  'Sunni',
  'Shia',
  'Roman Catholic',
  'Protestant',
  'Sikh - Jat',
  'Sikh - Ramgarhia',
  'Jain - Digambar',
  'Jain - Shwetambar',
  'Other'
];

// Alias for backwards compatibility
export const castList = casteList;

export const gotraList = [
  'No preference',
  'Kashyapa',
  'Bharadwaja',
  'Vashistha',
  'Vishvamitra',
  'Gautama',
  'Jamadagni',
  'Atri',
  'Agastya',
  'Harita',
  'Shandilya',
  'Garg',
  'Kaushik',
  'Vatsa',
  'Parashara',
  'Mudgala',
  'Sankrithi',
  'Angirasa',
  'Dhanvantari',
  'Kaundinya',
  'Not Applicable / Don\'t Know',
  'Other'
];

export const subcasteSuggestions = [
  'No preference',
  'Smartha',
  'Iyer (Vadama / Brahacharanam)',
  'Iyengar (Vadakalai / Tenkalai)',
  'Deshastha',
  'Chitpavan / Kokanastha',
  'Saraswat / GSB',
  'Nagar',
  'Kanyakubja',
  'Saryupareen',
  'Gour',
  'Sanadhya',
  'Vaidiki',
  'Niyogi',
  'Havyaka',
  'Maheshwari',
  'Khandelwal',
  'Oswal',
  'Porwal',
  'Rathore',
  'Chauhan',
  'Sisodia',
  'Parmar',
  'Leuva',
  'Kadva',
  '96 Kuli Maratha',
  'Deshmukh',
  'Motati Reddy',
  'Pedakanti Reddy',
  'Menon',
  'Pillai',
  'Kurup',
  'Other'
];

export const motherTongueList = [
  'Hindi',
  'Tamil',
  'Telugu',
  'Marathi',
  'Gujarati',
  'Bengali',
  'Malayalam',
  'Kannada',
  'Punjabi',
  'Odia',
  'Marwari',
  'Sindhi',
  'Konkani',
  'Assamese',
  'Urdu',
  'English',
  'Other'
];

export const rashiList = [
  'Mesha (Aries)',
  'Vrishabha (Taurus)',
  'Mithuna (Gemini)',
  'Karka (Cancer)',
  'Simha (Leo)',
  'Kanya (Virgo)',
  'Tula (Libra)',
  'Vrishchika (Scorpio)',
  'Dhanu (Sagittarius)',
  'Makara (Capricorn)',
  'Kumbha (Aquarius)',
  'Meena (Pisces)'
];

export const nakshatraList = [
  'Ashwini',
  'Bharani',
  'Krittika',
  'Rohini',
  'Mrigashirsha',
  'Ardra',
  'Punarvasu',
  'Pushya',
  'Ashlesha',
  'Magha',
  'Purva Phalguni',
  'Uttara Phalguni',
  'Hasta',
  'Chitra',
  'Svati',
  'Vishakha',
  'Anuradha',
  'Jyeshtha',
  'Mula',
  'Purva Ashadha',
  'Uttara Ashadha',
  'Shravana',
  'Dhanishta',
  'Shatabhisha',
  'Purva Bhadrapada',
  'Uttara Bhadrapada',
  'Revati'
];

export const manglikList = [
  'Non-Manglik',
  'Manglik',
  'Anshik (Partial) Manglik',
  'Don\'t Know'
];

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
    { value: 'gujarat', label: 'Gujarat' },
    { value: 'punjab', label: 'Punjab' },
    { value: 'uttar_pradesh', label: 'Uttar Pradesh' },
    { value: 'kerala', label: 'Kerala' },
  ],
  united_states: [
    { value: 'new_york', label: 'New York' },
    { value: 'california', label: 'California' },
    { value: 'texas', label: 'Texas' },
    { value: 'florida', label: 'Florida' },
    { value: 'illinois', label: 'Illinois' },
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
  gujarat: [
    { value: 'ahmedabad', label: 'Ahmedabad' },
    { value: 'surat', label: 'Surat' },
    { value: 'vadodara', label: 'Vadodara' },
  ],
  punjab: [
    { value: 'chandigarh', label: 'Chandigarh' },
    { value: 'amritsar', label: 'Amritsar' },
    { value: 'ludhiana', label: 'Ludhiana' },
  ],
  uttar_pradesh: [
    { value: 'lucknow', label: 'Lucknow' },
    { value: 'noida', label: 'Noida' },
    { value: 'kanpur', label: 'Kanpur' },
  ],
  kerala: [
    { value: 'kochi', label: 'Kochi' },
    { value: 'thiruvananthapuram', label: 'Thiruvananthapuram' },
  ],
  new_york: [
    { value: 'new_york_city', label: 'New York City' },
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

export const defaultSavedSearches: import('../types').SavedSearch[] = [
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
    ethnicity: [],
    religion: 'Hindu',
    caste: 'Brahmin',
    cast: 'Brahmin',
    color: '',
    usernameSearch: '',
    keywordSearch: '',
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
    ethnicity: [],
    religion: 'No preference',
    caste: 'No preference',
    cast: 'No preference',
    color: '',
    usernameSearch: '',
    keywordSearch: '',
  }
];

export const medicalCouncilsList = [
  'National Medical Commission (NMC / MCI)',
  'Maharashtra Medical Council (MMC)',
  'Delhi Medical Council (DMC)',
  'Karnataka Medical Council (KMC)',
  'Tamil Nadu Medical Council (TNMC)',
  'Uttar Pradesh Medical Council (UPMC)',
  'West Bengal Medical Council (WBMC)',
  'Gujarat Medical Council (GMC)',
  'Kerala Medical Council (KMC)',
  'Punjab Medical Council (PMC)',
  'Rajasthan Medical Council (RMC)',
  'Andhra Pradesh / Telangana Medical Council (APMC)',
  'Dental Council of India (DCI)',
  'Veterinary Council of India (VCI)',
  'National Commission for Indian System of Medicine (NCISM - Ayurveda/Unani)',
  'National Commission for Homoeopathy (NCH)',
  'Indian Nursing Council (INC)',
  'General Medical Council (GMC - UK)',
  'State Medical Board (USA / ECFMG)',
  'Medical Board of Australia (AHPRA)',
  'Other State Medical Council / International Board'
];
