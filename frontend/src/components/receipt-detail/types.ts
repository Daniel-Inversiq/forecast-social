import type { ScryReceiptOutcome, ScryReceiptStatus } from "@/components/users/profile/reputation/types";



export type ReceiptDetailOutcome = ScryReceiptOutcome;

export type ReceiptDetailStatus = ScryReceiptStatus;



export type ReceiptDetailForecaster = {

  name: string;

  slug: string;

  subjectType: "user" | "agent";

  avatarColor: string;

};



export type ReceiptParticipant = {

  id: string;

  name: string;

  handle: string;

  avatarColor?: string;

  subjectType?: "user" | "agent";

  trustTier: string;

  credibility: number;

  rankLabel?: string;

  action: "backed" | "challenged";

  side: "YES" | "NO";

  probability: number;

  credibilityDelta: number;

};



export type ReceiptTimelineEventType =

  | "forecast"

  | "back"

  | "challenge"

  | "consensus"

  | "resolution"

  | "receipt";



export type ReceiptTimelineEvent = {

  id: string;

  dateLabel: string;

  title: string;

  description: string;

  type: ReceiptTimelineEventType;

};



export type ReceiptDetailNetworkImpact = {

  publicReads: number;

  backers: number;

  challengers: number;

  consensusAtCall: number;

  consensusAtResolution: number;

  consensusShift: number;

  followersGained: number;

  credibilityDistributed: number;

};



export type ReceiptDetailCredibilityImpact = {

  earned: number;

  reason: string;

};



export type ReceiptDetailRelated = {

  id: string;

  forecastTitle: string;

  forecasterName: string;

  outcome: ReceiptDetailOutcome;

  credibilityDelta: number;

};



export type ReceiptDetail = {

  id: string;

  displayNumber: string;

  forecastTitle: string;

  status: ReceiptDetailStatus;

  outcome: ReceiptDetailOutcome;

  credibilityDelta: number;

  resolvedAt: string | null;

  forecaster: ReceiptDetailForecaster;

  calledProbability: number;

  consensusAtCall: number;

  consensusAtResolution: number;

  side: "YES" | "NO";

  calledAt: string;

  reasoning: string;

  networkImpact: ReceiptDetailNetworkImpact;

  credibilityImpact: ReceiptDetailCredibilityImpact;

  backers: ReceiptParticipant[];

  challengers: ReceiptParticipant[];

  timeline: ReceiptTimelineEvent[];

  related: ReceiptDetailRelated[];

};



export type ProfileBackingRecord = {

  totalBacked: number;

  correct: number;

  accuracyPct: number;

};



export type ProfileChallengeRecord = {

  totalChallenges: number;

  won: number;

  winRatePct: number;

};



export type ProfileConvictionRecords = {

  backing: ProfileBackingRecord;

  challenge: ProfileChallengeRecord;

};

