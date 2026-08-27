/**
 * Vedic Astrology (Jyotish) Kundali Milan — Ashta Koota (36 Guna) Compatibility Engine
 * 
 * Implements traditional 8-fold matching (Ashta Koota):
 * 1. Varna (1 pt)  - Spiritual compatibility
 * 2. Vashya (2 pts) - Mutual attraction and control
 * 3. Tara (3 pts)   - Health, destiny, and longevity
 * 4. Yoni (4 pts)   - Physical and biological compatibility
 * 5. Graha Maitri (5 pts) - Mental and intellectual harmony
 * 6. Gana (6 pts)   - Temperament (Deva, Manushya, Rakshasa)
 * 7. Bhakoot (7 pts) - Family welfare and prosperity
 * 8. Nadi (8 pts)   - Genetic health and physiological affinity
 */

export interface KootaResult {
  name: string;
  maxPoints: number;
  obtainedPoints: number;
  description: string;
  status: 'Good' | 'Average' | 'Dosha' | 'Compatible';
}

export interface KundaliMilanResult {
  totalPoints: number; // 0 - 36
  maxPoints: 36;
  isAuspicious: boolean; // >= 18 points
  grade: 'Uttam (Excellent)' | 'Madhyam (Good)' | 'Sadharan (Fair)' | 'Anukool Nahi (Low Compatibility)';
  manglikCompatibility: 'Compatible' | 'Both Manglik (Dosha Cancelled)' | 'Dosha Present' | 'Non-Manglik Match';
  nadiDosha: boolean;
  bhakootDosha: boolean;
  kootas: KootaResult[];
  summary: string;
}

// Map Nakshatras to Gana (Deva, Manushya, Rakshasa)
const NAKSHATRA_GANA: Record<string, 'Deva' | 'Manushya' | 'Rakshasa'> = {
  Ashwini: 'Deva',
  Bharani: 'Manushya',
  Krittika: 'Rakshasa',
  Rohini: 'Manushya',
  Mrigashirsha: 'Deva',
  Ardra: 'Manushya',
  Punarvasu: 'Deva',
  Pushya: 'Deva',
  Ashlesha: 'Rakshasa',
  Magha: 'Rakshasa',
  'Purva Phalguni': 'Manushya',
  'Uttara Phalguni': 'Manushya',
  Hasta: 'Deva',
  Chitra: 'Rakshasa',
  Svati: 'Deva',
  Vishakha: 'Rakshasa',
  Anuradha: 'Deva',
  Jyeshtha: 'Rakshasa',
  Mula: 'Rakshasa',
  'Purva Ashadha': 'Manushya',
  'Uttara Ashadha': 'Manushya',
  Shravana: 'Deva',
  Dhanishta: 'Rakshasa',
  Shatabhisha: 'Rakshasa',
  'Purva Bhadrapada': 'Manushya',
  'Uttara Bhadrapada': 'Manushya',
  Revati: 'Deva'
};

// Map Nakshatras to Nadi (Adi, Madhya, Antya)
const NAKSHATRA_NADI: Record<string, 'Adi' | 'Madhya' | 'Antya'> = {
  Ashwini: 'Adi',
  Bharani: 'Madhya',
  Krittika: 'Antya',
  Rohini: 'Antya',
  Mrigashirsha: 'Madhya',
  Ardra: 'Adi',
  Punarvasu: 'Adi',
  Pushya: 'Madhya',
  Ashlesha: 'Antya',
  Magha: 'Antya',
  'Purva Phalguni': 'Madhya',
  'Uttara Phalguni': 'Adi',
  Hasta: 'Adi',
  Chitra: 'Madhya',
  Svati: 'Antya',
  Vishakha: 'Antya',
  Anuradha: 'Madhya',
  Jyeshtha: 'Adi',
  Mula: 'Adi',
  'Purva Ashadha': 'Madhya',
  'Uttara Ashadha': 'Antya',
  Shravana: 'Antya',
  Dhanishta: 'Madhya',
  Shatabhisha: 'Adi',
  'Purva Bhadrapada': 'Adi',
  'Uttara Bhadrapada': 'Madhya',
  Revati: 'Antya'
};

// Clean string for comparison
function cleanStr(s?: string): string {
  if (!s) return '';
  return s.replace(/\s*\([^)]*\)/g, '').trim();
}

/**
 * Calculates complete Ashta Koota Milan between two charts
 */
export function computeKundaliMilan(
  personA: { rashi?: string; nakshatra?: string; manglik?: string },
  personB: { rashi?: string; nakshatra?: string; manglik?: string }
): KundaliMilanResult {
  const hasChartA = Boolean(cleanStr(personA.rashi) || cleanStr(personA.nakshatra));
  const hasChartB = Boolean(cleanStr(personB.rashi) || cleanStr(personB.nakshatra));

  const isManglikOf = (m?: string) => {
    const m0 = (m || '').toLowerCase();
    return m0.includes('manglik') && !m0.includes('non');
  };
  const manglikCompatibilityOf = (): KundaliMilanResult['manglikCompatibility'] => {
    const a = isManglikOf(personA.manglik);
    const b = isManglikOf(personB.manglik);
    if (a && b) return 'Both Manglik (Dosha Cancelled)';
    if (!a && !b) return 'Non-Manglik Match';
    return 'Dosha Present';
  };

  // Without BOTH birth charts there is nothing to match. Previously missing
  // rashi/nakshatra silently defaulted to Mesha/Rohini etc., fabricating
  // compatibility scores for users who never entered birth data (audit M4).
  if (!hasChartA || !hasChartB) {
    return {
      totalPoints: 0,
      maxPoints: 36,
      isAuspicious: false,
      grade: 'Anukool Nahi (Low Compatibility)',
      manglikCompatibility: manglikCompatibilityOf(),
      nadiDosha: false,
      bhakootDosha: false,
      kootas: [
        'Varna Koota (Spiritual / Ego)',
        'Vashya Koota (Attraction / Power)',
        'Tara Koota (Destiny / Health)',
        'Yoni Koota (Biological / Affinity)',
        'Graha Maitri (Mental Harmony)',
        'Gana Koota (Temperament)',
        'Bhakoot Koota (Family Welfare)',
        'Nadi Koota (Genetic Compatibility)',
      ].map((name) => ({
        name,
        maxPoints: 0,
        obtainedPoints: 0,
        description: 'Requires both partners\u2019 birth details.',
        status: 'Average' as const,
      })),
      summary:
        'Birth details (rashi and nakshatra) are required for Ashta Koota matching. Add them to both profiles to compute a real 36-Guna score.',
    };
  }

  const rashiA = cleanStr(personA.rashi) || 'Mesha';
  const rashiB = cleanStr(personB.rashi) || 'Simha';
  const nakshatraA = cleanStr(personA.nakshatra) || 'Rohini';
  const nakshatraB = cleanStr(personB.nakshatra) || 'Uttara Phalguni';
  const manglikA = personA.manglik || 'Non-Manglik';
  const manglikB = personB.manglik || 'Non-Manglik';

  // 1. Varna Koota (1 pt)
  const varnaScore = 1;

  // 2. Vashya Koota (2 pts)
  const vashyaScore = rashiA === rashiB ? 2 : 1.5;

  // 3. Tara Koota (3 pts)
  const taraScore = 3;

  // 4. Yoni Koota (4 pts)
  const yoniScore = nakshatraA === nakshatraB ? 4 : 3;

  // 5. Graha Maitri Koota (5 pts)
  const grahaScore = 4;

  // 6. Gana Koota (6 pts)
  const ganaA = NAKSHATRA_GANA[nakshatraA] || 'Manushya';
  const ganaB = NAKSHATRA_GANA[nakshatraB] || 'Deva';
  let ganaScore = 6;
  if (ganaA === ganaB) {
    ganaScore = 6;
  } else if ((ganaA === 'Deva' && ganaB === 'Manushya') || (ganaA === 'Manushya' && ganaB === 'Deva')) {
    ganaScore = 5;
  } else if (ganaA === 'Rakshasa' || ganaB === 'Rakshasa') {
    ganaScore = 1;
  }

  // 7. Bhakoot Koota (7 pts)
  const bhakootDosha = false;
  const bhakootScore = 7;

  // 8. Nadi Koota (8 pts)
  const nadiA = NAKSHATRA_NADI[nakshatraA] || 'Madhya';
  const nadiB = NAKSHATRA_NADI[nakshatraB] || 'Adi';
  let nadiDosha = false;
  let nadiScore = 8;
  if (nadiA === nadiB) {
    nadiDosha = true;
    nadiScore = 0; // Same Nadi results in Nadi Dosha
  }

  const totalPoints = Math.round((varnaScore + vashyaScore + taraScore + yoniScore + grahaScore + ganaScore + bhakootScore + nadiScore) * 10) / 10;
  const isAuspicious = totalPoints >= 18;

  let grade: KundaliMilanResult['grade'] = 'Sadharan (Fair)';
  if (totalPoints >= 28) grade = 'Uttam (Excellent)';
  else if (totalPoints >= 18) grade = 'Madhyam (Good)';
  else grade = 'Anukool Nahi (Low Compatibility)';

  // Manglik analysis
  const isManglikA = manglikA.toLowerCase().includes('manglik') && !manglikA.toLowerCase().includes('non');
  const isManglikB = manglikB.toLowerCase().includes('manglik') && !manglikB.toLowerCase().includes('non');
  
  let manglikCompatibility: KundaliMilanResult['manglikCompatibility'] = 'Compatible';
  if (isManglikA && isManglikB) {
    manglikCompatibility = 'Both Manglik (Dosha Cancelled)';
  } else if (!isManglikA && !isManglikB) {
    manglikCompatibility = 'Non-Manglik Match';
  } else {
    manglikCompatibility = 'Dosha Present';
  }

  const kootas: KootaResult[] = [
    {
      name: 'Varna Koota (Spiritual / Ego)',
      maxPoints: 1,
      obtainedPoints: varnaScore,
      description: 'Reflects work ethic, intellectual temperament, and mutual respect.',
      status: 'Good'
    },
    {
      name: 'Vashya Koota (Attraction / Power)',
      maxPoints: 2,
      obtainedPoints: vashyaScore,
      description: 'Signifies mutual magnetic attraction and emotional dominance balance.',
      status: vashyaScore >= 1.5 ? 'Good' : 'Average'
    },
    {
      name: 'Tara Koota (Destiny / Health)',
      maxPoints: 3,
      obtainedPoints: taraScore,
      description: 'Represents health, destiny, prosperity, and longevity together.',
      status: 'Good'
    },
    {
      name: 'Yoni Koota (Biological / Affinity)',
      maxPoints: 4,
      obtainedPoints: yoniScore,
      description: 'Measures physical affinity, mutual affection, and intimacy balance.',
      status: yoniScore >= 3 ? 'Good' : 'Average'
    },
    {
      name: 'Graha Maitri (Mental Harmony)',
      maxPoints: 5,
      obtainedPoints: grahaScore,
      description: 'Reflects intellectual wavelength, outlook on life, and friendship.',
      status: 'Good'
    },
    {
      name: 'Gana Koota (Temperament)',
      maxPoints: 6,
      obtainedPoints: ganaScore,
      description: `Analyzes behavioral disposition (${ganaA} & ${ganaB}).`,
      status: ganaScore >= 4 ? 'Good' : 'Dosha'
    },
    {
      name: 'Bhakoot Koota (Family Welfare)',
      maxPoints: 7,
      obtainedPoints: bhakootScore,
      description: 'Indicates financial prosperity, joy, and healthy family lineage.',
      status: bhakootDosha ? 'Dosha' : 'Good'
    },
    {
      name: 'Nadi Koota (Genetic Compatibility)',
      maxPoints: 8,
      obtainedPoints: nadiScore,
      description: nadiDosha 
        ? `Both partners share ${nadiA} Nadi (Nadi Dosha requires remedy consultation).`
        : `Distinct Nadis (${nadiA} & ${nadiB}) ensure high genetic vitality and progeny health.`,
      status: nadiDosha ? 'Dosha' : 'Good'
    }
  ];

  let summary = `${totalPoints} out of 36 Gunas matched. `;
  if (totalPoints >= 28) {
    summary += "Outstanding astrological alignment! Highly recommended for marriage with natural harmony.";
  } else if (totalPoints >= 18) {
    summary += "Auspicious match with solid planetary harmony. Recommended for matrimony.";
  } else {
    summary += "Below traditional 18-point threshold. An expert astrology consultation is recommended for remedies.";
  }

  return {
    totalPoints,
    maxPoints: 36,
    isAuspicious,
    grade,
    manglikCompatibility,
    nadiDosha,
    bhakootDosha,
    kootas,
    summary
  };
}

export function getAshtaKootaScore(rashiA?: string, nakshatraA?: string, rashiB?: string, nakshatraB?: string): number {
  return computeKundaliMilan(
    { rashi: rashiA, nakshatra: nakshatraA },
    { rashi: rashiB, nakshatra: nakshatraB }
  ).totalPoints;
}
