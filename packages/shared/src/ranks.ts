export type RankTier =
  | 'Bronze'
  | 'Silver'
  | 'Gold'
  | 'Platinum'
  | 'Diamond'
  | 'Master'
  | 'Grandmaster'
  | 'Demon'
  | 'Saint'
  | 'Legend';

export interface RankConfig {
  tier: RankTier;
  minElo: number;
}

export const RANKS: RankConfig[] = [
  { tier: 'Legend', minElo: 2700 },
  { tier: 'Saint', minElo: 2500 },
  { tier: 'Demon', minElo: 2300 },
  { tier: 'Grandmaster', minElo: 2100 },
  { tier: 'Master', minElo: 1900 },
  { tier: 'Diamond', minElo: 1700 },
  { tier: 'Platinum', minElo: 1500 },
  { tier: 'Gold', minElo: 1300 },
  { tier: 'Silver', minElo: 1100 },
  { tier: 'Bronze', minElo: 0 },
];

export function getRankFromElo(elo: number): RankTier {
  const matchedRank = RANKS.find((r) => elo >= r.minElo);
  return matchedRank ? matchedRank.tier : 'Bronze';
}
