import type { CorePitchType } from "./constants";

export type Hand = "L" | "R";
export type LineupState = "Official" | "Projected" | "Not posted";
export type Confidence = "Large sample" | "Low confidence";
export type ChipKind = "Hits" | "HR" | "K" | "Fade";

export type PitchRates = {
  xwoba: number | null;
  xba: number | null;
  xslg: number | null;
  whiff: number | null;
  barrel: number | null;
  hardHit: number | null;
  rv100: number | null;
  pa: number;
  pitches: number;
};

export type PitchMixEntry = PitchRates & {
  type: string;
  usage: number;
  rolledIntoOther: boolean;
};

export type VsHandMeans = PitchRates;

export type LeagueBaseline = {
  hand: Hand;
  xwoba: number;
  xba: number;
  xslg: number;
  whiff: number;
  barrel: number | null;
  pa: number;
};

export type DataWarning = {
  source: "savant" | "statsapi";
  message: string;
};

export type BatterRow = {
  playerId: number;
  name: string;
  battingOrder: number;
  position: string;
  batSide: Hand | "S" | null;
  standVsPitcher: Hand | null;
  proj: {
    xwoba: number | null;
    xba: number | null;
    xslg: number | null;
    whiff: number | null;
    barrel: number | null;
  };
  edges: {
    hitsXwobaPoints: number | null;
    kWhiffPp: number | null;
    hrBarrelPp: number | null;
    hrXslgPoints: number | null;
  };
  comparisonPa: number;
  confidence: Confidence;
  chips: ChipKind[];
  why: string;
  missingReason: string | null;
};

export type Chip = {
  kind: ChipKind;
  playerId: number;
  name: string;
  strength: number;
  lowConfidence: boolean;
  detail: string;
};

export type StarterCard = {
  playerId: number | null;
  name: string | null;
  throws: Hand | null;
  topPitches: { type: string; usage: number }[];
  mix: PitchMixEntry[];
  otherUsage: number;
  otherTypes: string[];
  mixQualityXwoba: number | null;
  missingReason: string | null;
};

export type TeamSide = {
  teamId: number;
  teamName: string;
  abbreviation: string;
  starter: StarterCard;
  lineupState: LineupState;
  lineup: BatterRow[];
  chips: Chip[];
};

export type GameCard = {
  gamePk: number;
  gameDateUtc: string;
  gameTimeEt: string;
  park: string;
  status: string;
  away: TeamSide;
  home: TeamSide;
  lineupState: LineupState | "Split";
  chips: Chip[];
  warnings: DataWarning[];
};

export type Slate = {
  dateEt: string;
  timezone: string;
  games: GameCard[];
  warnings: DataWarning[];
  cache: {
    savantAsOf: string | null;
    slateAsOf: string;
  };
};

export type Person = {
  id: number;
  fullName: string;
  batSide: Hand | "S" | null;
  pitchHand: Hand | null;
};

export type OfficialLineupPlayer = {
  id: number;
  fullName: string;
  position: string;
};

export type PastTeamGame = {
  gamePk: number;
  date: string;
  teamId: number;
  opponentId: number;
  opponentStarterId: number | null;
  opponentThrows: Hand | null;
  lineup: OfficialLineupPlayer[];
};

export type SavantStore = {
  fetchedAt: string;
  pitcherUsage: Map<number, Record<string, number>>;
  pitcherVsType: Map<number, Map<string, PitchRates>>;
  batterVsType: Map<number, Map<string, PitchRates>>;
  batterVsHand: Map<string, VsHandMeans>;
  league: Record<Hand, LeagueBaseline>;
  warnings: DataWarning[];
};

export type { CorePitchType };
