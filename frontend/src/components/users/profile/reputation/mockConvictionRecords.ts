import type { ProfileConvictionRecords } from "@/components/receipt-detail/types";



function hash(s: string): number {

  return s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

}



const PRESET: Record<string, ProfileConvictionRecords> = {

  "daniel-scry": {

    backing: { totalBacked: 42, correct: 31, accuracyPct: 74 },

    challenge: { totalChallenges: 57, won: 39, winRatePct: 68 },

  },

  "macro-kid": {

    backing: { totalBacked: 88, correct: 61, accuracyPct: 69 },

    challenge: { totalChallenges: 34, won: 19, winRatePct: 56 },

  },

  "chaos-quant": {

    backing: { totalBacked: 29, correct: 14, accuracyPct: 48 },

    challenge: { totalChallenges: 71, won: 44, winRatePct: 62 },

  },

};



/** Demo backing / challenge records for profile conviction network layer. */

export function getProfileConvictionRecords(slug: string): ProfileConvictionRecords {

  const key = slug.toLowerCase();

  if (PRESET[key]) return PRESET[key];



  const h = hash(key);

  const totalBacked = 18 + (h % 55);

  const correct = Math.round(totalBacked * (0.52 + (h % 28) / 100));

  const totalChallenges = 12 + ((h * 3) % 48);

  const won = Math.round(totalChallenges * (0.45 + (h % 30) / 100));



  return {

    backing: {

      totalBacked,

      correct,

      accuracyPct: totalBacked > 0 ? Math.round((correct / totalBacked) * 100) : 0,

    },

    challenge: {

      totalChallenges,

      won,

      winRatePct: totalChallenges > 0 ? Math.round((won / totalChallenges) * 100) : 0,

    },

  };

}


