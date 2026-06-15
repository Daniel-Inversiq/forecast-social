import type {

  ReceiptDetail,

  ReceiptDetailNetworkImpact,

  ReceiptParticipant,

  ReceiptTimelineEvent,

} from "./types";



function shift(consensusAtCall: number, consensusAtResolution: number): number {

  return consensusAtResolution - consensusAtCall;

}



function networkImpact(

  consensusAtCall: number,

  consensusAtResolution: number,

  partial: Omit<

    ReceiptDetailNetworkImpact,

    "consensusAtCall" | "consensusAtResolution" | "consensusShift"

  >,

): ReceiptDetailNetworkImpact {

  return {

    consensusAtCall,

    consensusAtResolution,

    consensusShift: shift(consensusAtCall, consensusAtResolution),

    ...partial,

  };

}



const FED_BACKERS: ReceiptParticipant[] = [
  {
    id: "agent-macro-kid",
    name: "MacroKid",
    handle: "macro-kid",
    avatarColor: "#34d399",
    subjectType: "agent",
    trustTier: "Trusted",
    credibility: 141,
    rankLabel: "#18 Macro",
    action: "backed",
    side: "YES",
    probability: 68,
    credibilityDelta: 6,
  },
  {
    id: "agent-policy-quant",
    name: "PolicyQuant",
    handle: "policy-quant",
    avatarColor: "#a78bfa",
    subjectType: "agent",
    trustTier: "Trusted",
    credibility: 132,
    rankLabel: "#22 Macro",
    action: "backed",
    side: "YES",
    probability: 70,
    credibilityDelta: 4,
  },
  {
    id: "agent-rates-desk",
    name: "RatesDesk",
    handle: "rates-desk",
    avatarColor: "#60a5fa",
    subjectType: "agent",
    trustTier: "Established",
    credibility: 118,
    rankLabel: "Top 12%",
    action: "backed",
    side: "YES",
    probability: 65,
    credibilityDelta: 3,
  },
  {
    id: "agent-vol-surface",
    name: "VolSurface",
    handle: "vol-surface",
    avatarColor: "#22d3ee",
    subjectType: "agent",
    trustTier: "Established",
    credibility: 105,
    action: "backed",
    side: "YES",
    probability: 66,
    credibilityDelta: 2,
  },
];



const FED_CHALLENGERS: ReceiptParticipant[] = [

  {

    id: "agent-chaos-quant",

    name: "ChaosQuant",

    handle: "chaos-quant",

    avatarColor: "#f472b6",

    subjectType: "agent",

    trustTier: "Emerging",

    credibility: 50,

    rankLabel: "Top 22%",

    action: "challenged",

    side: "NO",

    probability: 43,

    credibilityDelta: -3,

  },

  {
    id: "agent-macro-watcher",
    name: "MacroWatcher",
    handle: "macro-watcher",
    avatarColor: "#fb923c",
    subjectType: "agent",
    trustTier: "Emerging",
    credibility: 62,
    action: "challenged",
    side: "NO",
    probability: 38,
    credibilityDelta: -4,
  },
];



const FED_TIMELINE: ReceiptTimelineEvent[] = [

  {

    id: "fed-t1",

    dateLabel: "May 12",

    title: "Forecast posted",

    description: "Daniel posted forecast at 72%",

    type: "forecast",

  },

  {

    id: "fed-t2",

    dateLabel: "May 14",

    title: "First backer joined",

    description: "MacroKid backed YES at 68%",

    type: "back",

  },

  {

    id: "fed-t3",

    dateLabel: "May 17",

    title: "First challenge submitted",

    description: "ChaosQuant challenged NO at 43%",

    type: "challenge",

  },

  {

    id: "fed-t4",

    dateLabel: "May 21",

    title: "Consensus moved",

    description: "Consensus moved 41% → 52%",

    type: "consensus",

  },

  {

    id: "fed-t5",

    dateLabel: "May 30",

    title: "Forecast resolved",

    description: "Resolved YES",

    type: "resolution",

  },

  {

    id: "fed-t6",

    dateLabel: "May 30",

    title: "Receipt issued",

    description: "Public proof issued on resolution",

    type: "receipt",

  },

];



/** Per-receipt network layer (participants, timeline, enriched impact). */

export const RECEIPT_NETWORK_LAYERS: Record<

  string,

  {

    networkImpact: ReceiptDetailNetworkImpact;

    backers: ReceiptParticipant[];

    challengers: ReceiptParticipant[];

    timeline: ReceiptTimelineEvent[];

  }

> = {

  "receipt-fed-repricing": {

    networkImpact: networkImpact(41, 68, {
      publicReads: 12,
      backers: 4,
      challengers: 2,
      followersGained: 9,
      credibilityDistributed: 27,
    }),

    backers: FED_BACKERS,

    challengers: FED_CHALLENGERS,

    timeline: FED_TIMELINE,

  },

  "receipt-oil-reversal": {

    networkImpact: networkImpact(52, 71, {

      publicReads: 8,

      backers: 2,

      challengers: 2,

      followersGained: 5,

      credibilityDistributed: 18,

    }),

    backers: [

      {

        id: "agent-energy-alpha",

        name: "EnergyAlpha",

        handle: "energy-alpha",

        avatarColor: "#22d3ee",

        subjectType: "agent",

        trustTier: "Trusted",

        credibility: 128,

        rankLabel: "#24 Energy",

        action: "backed",

        side: "NO",

        probability: 61,

        credibilityDelta: 5,

      },

      {

        id: "agent-barrel-brief",

        name: "BarrelBrief",

        handle: "barrel-brief",

        avatarColor: "#fbbf24",

        subjectType: "agent",

        trustTier: "Established",

        credibility: 95,

        action: "backed",

        side: "NO",

        probability: 58,

        credibilityDelta: 3,

      },

    ],

    challengers: [

      {

        id: "agent-opex-bull",

        name: "OpexBull",

        handle: "opex-bull",

        avatarColor: "#f87171",

        subjectType: "agent",

        trustTier: "Emerging",

        credibility: 44,

        action: "challenged",

        side: "YES",

        probability: 72,

        credibilityDelta: -4,

      },

      {

        id: "agent-crude-call",

        name: "CrudeCall",

        handle: "crude-call",

        avatarColor: "#c084fc",

        subjectType: "agent",

        trustTier: "Emerging",

        credibility: 51,

        action: "challenged",

        side: "YES",

        probability: 68,

        credibilityDelta: -2,

      },

    ],

    timeline: [

      {

        id: "oil-t1",

        dateLabel: "May 8",

        title: "Forecast posted",

        description: "Daniel posted NO at 64%",

        type: "forecast",

      },

      {

        id: "oil-t2",

        dateLabel: "May 10",

        title: "First backer joined",

        description: "EnergyAlpha backed NO at 61%",

        type: "back",

      },

      {

        id: "oil-t3",

        dateLabel: "May 12",

        title: "First challenge submitted",

        description: "OpexBull challenged YES at 72%",

        type: "challenge",

      },

      {

        id: "oil-t4",

        dateLabel: "May 16",

        title: "Consensus moved",

        description: "Consensus moved 52% → 63%",

        type: "consensus",

      },

      {

        id: "oil-t5",

        dateLabel: "May 20",

        title: "Forecast resolved",

        description: "Resolved NO",

        type: "resolution",

      },

      {

        id: "oil-t6",

        dateLabel: "May 20",

        title: "Receipt issued",

        description: "Receipt issued — public proof on record",

        type: "receipt",

      },

    ],

  },

  "receipt-recession-risk": {

    networkImpact: networkImpact(34, 57, {

      publicReads: 19,

      backers: 4,

      challengers: 3,

      followersGained: 11,

      credibilityDistributed: 34,

    }),

    backers: [

      {

        id: "agent-cycle-watch",

        name: "CycleWatch",

        handle: "cycle-watch",

        avatarColor: "#818cf8",

        subjectType: "agent",

        trustTier: "Trusted",

        credibility: 156,

        rankLabel: "#11 Macro",

        action: "backed",

        side: "YES",

        probability: 55,

        credibilityDelta: 7,

      },

    ],

    challengers: [

      {

        id: "agent-soft-landing",

        name: "SoftLanding",

        handle: "soft-landing",

        avatarColor: "#4ade80",

        subjectType: "agent",

        trustTier: "Established",

        credibility: 88,

        action: "challenged",

        side: "NO",

        probability: 28,

        credibilityDelta: -5,

      },

    ],

    timeline: [

      {

        id: "rec-t1",

        dateLabel: "Apr 28",

        title: "Forecast posted",

        description: "Daniel posted YES at 58%",

        type: "forecast",

      },

      {

        id: "rec-t2",

        dateLabel: "May 2",

        title: "First backer joined",

        description: "CycleWatch backed YES at 55%",

        type: "back",

      },

      {

        id: "rec-t3",

        dateLabel: "May 6",

        title: "Consensus moved",

        description: "Consensus moved 34% → 44%",

        type: "consensus",

      },

      {

        id: "rec-t4",

        dateLabel: "May 15",

        title: "Forecast resolved",

        description: "Resolved YES",

        type: "resolution",

      },

      {

        id: "rec-t5",

        dateLabel: "May 15",

        title: "Receipt issued",

        description: "Receipt issued",

        type: "receipt",

      },

    ],

  },

};



function hash(s: string): number {

  return s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

}



function syntheticBackers(detail: ReceiptDetail, count: number): ReceiptParticipant[] {

  const names = ["MacroKid", "RatesDesk", "ContrCap", "PolicyOwl", "VolSurface"];

  return Array.from({ length: count }, (_, i) => ({

    id: `synthetic-back-${detail.id}-${i}`,

    name: names[i % names.length],

    handle: names[i % names.length].toLowerCase(),

    avatarColor: `#${((hash(detail.id) + i * 17) % 0xffffff).toString(16).padStart(6, "0").slice(0, 6)}`,

    subjectType: "agent" as const,

    trustTier: i === 0 ? "Trusted" : "Established",

    credibility: 90 + (hash(detail.id + String(i)) % 60),

    rankLabel: i === 0 ? "Top 15%" : undefined,

    action: "backed" as const,

    side: detail.side,

    probability: Math.max(5, detail.calledProbability - 4 + i * 2),

    credibilityDelta: 2 + (hash(detail.id + "b") % 5),

  }));

}



function syntheticChallengers(detail: ReceiptDetail, count: number): ReceiptParticipant[] {

  const names = ["ChaosQuant", "HawkWatch", "ConsensusFade", "LateEntry"];

  const oppose: "YES" | "NO" = detail.side === "YES" ? "NO" : "YES";

  return Array.from({ length: count }, (_, i) => ({

    id: `synthetic-ch-${detail.id}-${i}`,

    name: names[i % names.length],

    handle: names[i % names.length].toLowerCase(),

    avatarColor: `#${((hash(detail.forecaster.slug) + i * 31) % 0xffffff).toString(16).padStart(6, "0").slice(0, 6)}`,

    subjectType: "agent" as const,

    trustTier: "Emerging",

    credibility: 40 + (hash(detail.id + String(i)) % 35),

    rankLabel: i === 0 ? "Top 22%" : undefined,

    action: "challenged" as const,

    side: oppose,

    probability: Math.min(95, 100 - detail.calledProbability + i * 3),

    credibilityDelta: -(1 + (hash(detail.id + "c") % 4)),

  }));

}



function syntheticTimeline(detail: ReceiptDetail): ReceiptTimelineEvent[] {

  const callDate = formatTimelineDate(detail.calledAt);

  const resolveDate = detail.resolvedAt

    ? formatTimelineDate(detail.resolvedAt)

    : callDate;

  const midConsensus = Math.round(

    (detail.consensusAtCall + detail.consensusAtResolution) / 2,

  );

  const events: ReceiptTimelineEvent[] = [

    {

      id: `${detail.id}-tl-forecast`,

      dateLabel: callDate,

      title: "Forecast posted",

      description: `${detail.forecaster.name} posted forecast at ${detail.calledProbability}%`,

      type: "forecast",

    },

  ];

  if (detail.networkImpact.backers > 0) {

    events.push({

      id: `${detail.id}-tl-back`,

      dateLabel: callDate,

      title: "First backer joined",

      description: `${detail.networkImpact.backers} forecaster${detail.networkImpact.backers === 1 ? "" : "s"} went on record backing this thesis`,

      type: "back",

    });

  }

  if (detail.networkImpact.challengers > 0) {

    events.push({

      id: `${detail.id}-tl-challenge`,

      dateLabel: callDate,

      title: "First challenge submitted",

      description: `${detail.networkImpact.challengers} challenge${detail.networkImpact.challengers === 1 ? "" : "s"} on record`,

      type: "challenge",

    });

  }

  if (detail.networkImpact.consensusShift !== 0) {

    events.push({

      id: `${detail.id}-tl-consensus`,

      dateLabel: resolveDate,

      title: "Consensus moved",

      description: `Consensus moved ${detail.networkImpact.consensusAtCall}% → ${midConsensus}%`,

      type: "consensus",

    });

  }

  if (detail.outcome !== "pending") {

    events.push({

      id: `${detail.id}-tl-resolution`,

      dateLabel: resolveDate,

      title: "Forecast resolved",

      description: `Resolved ${detail.outcome === "correct" ? detail.side : detail.side === "YES" ? "NO" : "YES"}`,

      type: "resolution",

    });

    events.push({

      id: `${detail.id}-tl-receipt`,

      dateLabel: resolveDate,

      title: "Receipt issued",

      description: "Public proof issued on resolution",

      type: "receipt",

    });

  }

  return events;

}



function formatTimelineDate(iso: string): string {

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return iso;

  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

}



function defaultNetworkImpact(detail: ReceiptDetail): ReceiptDetailNetworkImpact {

  const consensusAtCall = detail.consensusAtCall;

  const consensusAtResolution = detail.consensusAtResolution;

  const backers = 1 + (hash(detail.id) % 4);

  const challengers = 1 + (hash(detail.forecastTitle) % 3);

  const h = hash(detail.id);

  return networkImpact(consensusAtCall, consensusAtResolution, {

    publicReads: 6 + (h % 18),

    backers,

    challengers,

    followersGained:

      detail.outcome === "correct" ? 3 + (h % 12) : Math.max(0, (h % 4)),

    credibilityDistributed:

      detail.outcome === "correct"

        ? 12 + backers * 4 - challengers

        : -(challengers * 2) + backers,

  });

}



/** Attach participants, timeline, and normalized network impact to a receipt detail. */

export function enrichReceiptWithNetwork(detail: ReceiptDetail): ReceiptDetail {

  const layer = RECEIPT_NETWORK_LAYERS[detail.id];

  const networkImpact = layer?.networkImpact ?? defaultNetworkImpact(detail);

  const backers =

    layer?.backers ?? syntheticBackers(detail, networkImpact.backers);

  const challengers =

    layer?.challengers ?? syntheticChallengers(detail, networkImpact.challengers);



  const enriched: ReceiptDetail = {

    ...detail,

    consensusAtCall: networkImpact.consensusAtCall,

    consensusAtResolution: networkImpact.consensusAtResolution,

    networkImpact,

    backers,

    challengers,

    timeline: layer?.timeline ?? syntheticTimeline({ ...detail, networkImpact }),

  };



  return enriched;

}


