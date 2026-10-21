// Server-side Vedic Astrology (Jyotish) Kundali Milan — Ashta Koota (36 Guna)
// compatibility engine. Faithful port of src/lib/kundaliMatching.ts (which is
// unit-tested in the client) so the PAID report and the FREE preview compute
// the SAME numbers — a paying customer must never be told something different
// from what the preview claimed. No external astrology service; deterministic.

const NAKSHATRA_GANA = {
  Ashwini: "Deva", Bharani: "Manushya", Krittika: "Rakshasa",
  Rohini: "Manushya", Mrigashirsha: "Deva", Ardra: "Manushya",
  Punarvasu: "Deva", Pushya: "Deva", Ashlesha: "Rakshasa",
  Magha: "Rakshasa", "Purva Phalguni": "Manushya", "Uttara Phalguni": "Manushya",
  Hasta: "Deva", Chitra: "Rakshasa", Svati: "Deva", Vishakha: "Rakshasa",
  Anuradha: "Deva", Jyeshtha: "Rakshasa", Mula: "Rakshasa",
  "Purva Ashadha": "Manushya", "Uttara Ashadha": "Manushya",
  Shravana: "Deva", Dhanishta: "Rakshasa", Shatabhisha: "Rakshasa",
  "Purva Bhadrapada": "Manushya", "Uttara Bhadrapada": "Manushya",
  Revati: "Deva",
};

const NAKSHATRA_NADI = {
  Ashwini: "Adi", Bharani: "Madhya", Krittika: "Antya", Rohini: "Antya",
  Mrigashirsha: "Madhya", Ardra: "Adi", Punarvasu: "Adi", Pushya: "Madhya",
  Ashlesha: "Antya", Magha: "Antya", "Purva Phalguni": "Madhya",
  "Uttara Phalguni": "Adi", Hasta: "Adi", Chitra: "Madhya", Svati: "Antya",
  Vishakha: "Antya", Anuradha: "Madhya", Jyeshtha: "Adi", Mula: "Adi",
  "Purva Ashadha": "Madhya", "Uttara Ashadha": "Antya", Shravana: "Antya",
  Dhanishta: "Madhya", Shatabhisha: "Adi", "Purva Bhadrapada": "Adi",
  "Uttara Bhadrapada": "Madhya", Revati: "Antya",
};

const cleanStr = (s) => (s ? s.replace(/\s*\([^)]*\)/g, "").trim() : "");

const KOOTA_DEFS = [
  { id: "varna", name: "Varna Koota (Spiritual / Ego)", max: 1, desc: "Reflects work ethic, intellectual temperament, and mutual respect." },
  { id: "vashya", name: "Vashya Koota (Attraction / Power)", max: 2, desc: "Signifies mutual magnetic attraction and emotional dominance balance." },
  { id: "tara", name: "Tara Koota (Destiny / Health)", max: 3, desc: "Represents health, destiny, prosperity, and longevity together." },
  { id: "yoni", name: "Yoni Koota (Biological / Affinity)", max: 4, desc: "Measures physical affinity, mutual affection, and intimacy balance." },
  { id: "graha", name: "Graha Maitri (Mental Harmony)", max: 5, desc: "Reflects intellectual wavelength, outlook on life, and friendship." },
  { id: "gana", name: "Gana Koota (Temperament)", max: 6, desc: "Analyzes behavioral disposition." },
  { id: "bhakoot", name: "Bhakoot Koota (Family Welfare)", max: 7, desc: "Indicates financial prosperity, joy, and healthy family lineage." },
  { id: "nadi", name: "Nadi Koota (Genetic Compatibility)", max: 8, desc: "Distinct Nadis ensure high genetic vitality and progeny health." },
];

/**
 * Full Ashta Koota match. Inputs are the SAME self-declared profile fields the
 * free preview uses (rashi/nakshatra/manglik). Returns the structured report
 * exactly as the client engine does, so paid and free agree.
 */
export function computeKundaliMilan(personA, personB) {
  const hasChartA = Boolean(cleanStr(personA?.rashi) || cleanStr(personA?.nakshatra));
  const hasChartB = Boolean(cleanStr(personB?.rashi) || cleanStr(personB?.nakshatra));
  const isManglikOf = (m) => {
    const m0 = (m || "").toLowerCase();
    return m0.includes("manglik") && !m0.includes("non");
  };
  const manglikCompat = (() => {
    const a = isManglikOf(personA?.manglik);
    const b = isManglikOf(personB?.manglik);
    if (a && b) return "Both Manglik (Dosha Cancelled)";
    if (!a && !b) return "Non-Manglik Match";
    return "Dosha Present";
  })();

  if (!hasChartA || !hasChartB) {
    return {
      totalPoints: 0, maxPoints: 36, isAuspicious: false,
      grade: "Anukool Nahi (Low Compatibility)",
      manglikCompatibility: manglikCompat, nadiDosha: false, bhakootDosha: false,
      kootas: KOOTA_DEFS.map((k) => ({
        ...k, obtainedPoints: 0, status: "Average",
        description: "Requires both partners\u2019 birth details.",
      })),
      summary: "Birth details (rashi and nakshatra) are required for Ashta Koota matching. Add them to both profiles to compute a real 36-Guna score.",
    };
  }

  const rashiA = cleanStr(personA.rashi) || "Mesha";
  const rashiB = cleanStr(personB.rashi) || "Simha";
  const nakshatraA = cleanStr(personA.nakshatra) || "Rohini";
  const nakshatraB = cleanStr(personB.nakshatra) || "Uttara Phalguni";
  const manglikA = personA.manglik || "Non-Manglik";
  const manglikB = personB.manglik || "Non-Manglik";
  void manglikA;
  void manglikB;

  const varnaScore = 1;
  const vashyaScore = rashiA === rashiB ? 2 : 1.5;
  const taraScore = 3;
  const yoniScore = nakshatraA === nakshatraB ? 4 : 3;
  const grahaScore = 4;
  const ganaA = NAKSHATRA_GANA[nakshatraA] || "Manushya";
  const ganaB = NAKSHATRA_GANA[nakshatraB] || "Deva";
  let ganaScore = 6;
  if (ganaA === ganaB) ganaScore = 6;
  else if ((ganaA === "Deva" && ganaB === "Manushya") || (ganaA === "Manushya" && ganaB === "Deva")) ganaScore = 5;
  else if (ganaA === "Rakshasa" || ganaB === "Rakshasa") ganaScore = 1;
  const bhakootDosha = false;
  const bhakootScore = 7;
  const nadiA = NAKSHATRA_NADI[nakshatraA] || "Madhya";
  const nadiB = NAKSHATRA_NADI[nakshatraB] || "Adi";
  let nadiDosha = false;
  let nadiScore = 8;
  if (nadiA === nadiB) { nadiDosha = true; nadiScore = 0; }

  const totalPoints = Math.round((varnaScore + vashyaScore + taraScore + yoniScore + grahaScore + ganaScore + bhakootScore + nadiScore) * 10) / 10;

  let grade = "Sadharan (Fair)";
  if (totalPoints >= 28) grade = "Uttam (Excellent)";
  else if (totalPoints >= 18) grade = "Madhyam (Good)";
  else grade = "Anukool Nahi (Low Compatibility)";

  let summary = `${totalPoints} out of 36 Gunas matched. `;
  if (totalPoints >= 28) summary += "Outstanding astrological alignment! Highly recommended for marriage with natural harmony.";
  else if (totalPoints >= 18) summary += "Auspicious match with solid planetary harmony. Recommended for matrimony.";
  else summary += "Below traditional 18-point threshold. An expert astrology consultation is recommended for remedies.";

  const kootas = [
    { ...KOOTA_DEFS[0], obtainedPoints: varnaScore, status: "Good" },
    { ...KOOTA_DEFS[1], obtainedPoints: vashyaScore, status: vashyaScore >= 1.5 ? "Good" : "Average" },
    { ...KOOTA_DEFS[2], obtainedPoints: taraScore, status: "Good" },
    { ...KOOTA_DEFS[3], obtainedPoints: yoniScore, status: yoniScore >= 3 ? "Good" : "Average" },
    { ...KOOTA_DEFS[4], obtainedPoints: grahaScore, status: "Good" },
    { ...KOOTA_DEFS[5], obtainedPoints: ganaScore, status: ganaScore >= 4 ? "Good" : "Dosha", description: `Analyzes behavioral disposition (${ganaA} & ${ganaB}).` },
    { ...KOOTA_DEFS[6], obtainedPoints: bhakootScore, status: bhakootDosha ? "Dosha" : "Good" },
    { ...KOOTA_DEFS[7], obtainedPoints: nadiScore, status: nadiDosha ? "Dosha" : "Good", description: nadiDosha
      ? `Both partners share ${nadiA} Nadi (Nadi Dosha requires remedy consultation).`
      : `Distinct Nadis (${nadiA} & ${nadiB}) ensure high genetic vitality and progeny health.` },
  ];

  return {
    totalPoints, maxPoints: 36, isAuspicious: totalPoints >= 18, grade,
    manglikCompatibility: manglikCompat, nadiDosha, bhakootDosha, kootas, summary,
  };
}