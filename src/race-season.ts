// 대회 난이도·보상 곡선 (#267 · 순수 로직, Phaser·DOM 비의존)
// 현행(메인 dc3517e) 대회는 상대 속도가 고정이라, 대표 자전거 강화가 끝나면(성능 4·드림 단계) 항상 우승합니다(#262 표 4).
// 이 모듈은 대회가 계속 긴장과 성장 목표를 만들도록 세 방안을 같은 시즌(주문 풀 A안 진행 + 5 Day마다 대회)으로 비교합니다.
// - league(A안): 대회 등급 리그 — 우승하면 다음 등급(상대·참가비·상금 상승)
// - course(B안): 코스 상성 — 대회마다 코스가 바뀌고, 맞는 카테고리 자전거로 나가면 속도 보너스
// - rewards(C안): 보상 다변화 — 상금 외에 무료 상자·체력, 우승 3회마다 드림 머신 이해도
import { CATALOG_BIKES, type BikeCategoryKorean } from './bike-catalog';
import { RIVERSIDE_ENDURANCE_RACE, isRaceDay, racerSpeedScore, raceRewardForRank, simulateRace, type RaceMeta } from './race-progress';
import { UNDERSTANDING_MAX, bikeStats, isBikeRegistered, type BikeStats } from './meta-progress';
import { createPoolState, deliverNext, spendCoins, ORDERS_PER_DAY, type PoolState } from './order-pool';

export type SeasonVariant = 'current' | 'league' | 'course' | 'rewards';
export const SEASON_LABELS: Record<SeasonVariant, string> = {
  current: '현행(리버사이드 3K 고정)',
  league: 'A안 대회 등급 리그',
  course: 'B안 코스 상성',
  rewards: 'C안 보상 다변화',
};

// ── A안: 대회 등급 ──
export type LeagueTier = { id: string; name: string; meta: RaceMeta };
const tier = (id: string, name: string, entryFee: number, rankRewards: number[], finishReward: number, npcSpeedMin: number, npcSpeedSpan: number): LeagueTier =>
  ({ id, name, meta: { ...RIVERSIDE_ENDURANCE_RACE, id: `league-${id}`, name, entryFee, rankRewards, finishReward, npcSpeedMin, npcSpeedSpan } });
export const LEAGUE_TIERS: readonly LeagueTier[] = [
  tier('bronze', '브론즈 · 동네 한 바퀴', 300, [1200, 800, 500], 150, 18.5, 6),
  tier('silver', '실버 · 리버사이드 3K', 500, [2000, 1200, 800], 200, 20.5, 9), // 현행과 같은 값
  tier('gold', '골드 · 시티 그랑프리', 1200, [4500, 2700, 1600], 400, 25, 7),
  tier('platinum', '플래티넘 · 드림 클래식', 2500, [9000, 5000, 3000], 800, 28, 5),
];

// ── B안: 코스 상성 ──
export type Course = { id: string; name: string; favored: BikeCategoryKorean; note: string };
export const COURSES: readonly Course[] = [
  { id: 'riverside', name: '강변 평지', favored: '로드', note: '긴 직선 · 로드 유리' },
  { id: 'hill', name: '산악 오르막', favored: 'MTB', note: '가파른 오르막 · MTB 유리' },
  { id: 'gravel', name: '자갈 임도', favored: '그래블', note: '자갈 노면 · 그래블 유리' },
  { id: 'alley', name: '도심 골목', favored: '미니벨로', note: '좁은 회전 · 미니벨로 유리' },
];
/** 코스와 맞는 카테고리 자전거의 속도 보너스(성능 1단계 = 2.5와 같은 크기) */
export const COURSE_BONUS = 2.5;
/** B안의 상대는 성장한 플레이어를 따라 강해집니다: 시즌 대회 n번째마다 상대 하한 +0.8 (최대 +6) */
export const COURSE_NPC_STEP = 0.8;

export const courseForRace = (raceIndex: number) => COURSES[raceIndex % COURSES.length];

// ── C안: 보상 다변화 ──
export type RaceItemReward = { freeBoxes: number; energy: number };
export const RANK_ITEMS: readonly RaceItemReward[] = [
  { freeBoxes: 2, energy: 10 },
  { freeBoxes: 1, energy: 0 },
  { freeBoxes: 0, energy: 5 },
];
export const WINS_FOR_DREAM = 3;
export const DREAM_REWARD_BIKE = 'dream-machine';
/** 무료 상자·체력 1의 코인 환산(주문 평균 보상 ÷ 주문당 체력 ≈ 1,400 ÷ 7.8) */
export const COINS_PER_ENERGY = 180;

const categoryOf = (bikeId: string) => CATALOG_BIKES.find((bike) => bike.id === bikeId)?.category;

export type Entry = { bikeId: string; stats: BikeStats; bonus: number };

/** 출전 자전거: 현행·A·C안은 가장 빠른 보유 자전거, B안은 코스 보너스까지 더해 가장 빠른 자전거 */
export function chooseEntry(state: PoolState, course?: Course): Entry {
  let best: Entry | null = null;
  for (const bikeId of state.collection.craftedBikeIds) {
    const stats = bikeStats(state.growth, bikeId);
    const bonus = course && categoryOf(bikeId) === course.favored ? COURSE_BONUS : 0;
    if (!best || racerSpeedScore(stats) + bonus > racerSpeedScore(best.stats) + best.bonus) best = { bikeId, stats, bonus };
  }
  return best!;
}

export type RaceOdds = { win: number; podium: number };

/** 같은 출전 조건에서 시드를 바꿔 가며 우승·시상대 확률을 잽니다. */
export function raceOddsFor(entry: Entry, meta: RaceMeta, seeds = 120): RaceOdds {
  let win = 0, podium = 0;
  for (let seed = 1; seed <= seeds; seed += 1) {
    const rank = simulateRace({ seed: seed * 7907, playerStats: entry.stats, playerSpeedBonus: entry.bonus, meta }).playerRank;
    if (rank === 1) win += 1;
    if (rank <= 3) podium += 1;
  }
  return { win: win / seeds, podium: podium / seeds };
}

/** 결과가 미리 정해져 있지 않은 대회: 우승 또는 시상대 확률이 15~85% */
export const isUncertain = (odds: RaceOdds) => [odds.win, odds.podium].some((p) => p >= 0.15 && p <= 0.85);

export type SeasonRace = {
  day: number;
  name: string;
  courseName?: string;
  bikeId: string;
  bonus: number;
  entryFee: number;
  rank: number;
  reward: number;
  items: RaceItemReward;
  odds: RaceOdds;
  skipped: boolean;
  promotedTo?: string;
  dreamUnlocked?: boolean;
};

export type SeasonState = {
  variant: SeasonVariant;
  pool: PoolState;
  leagueIndex: number;
  wins: number;
  raceIndex: number;
  freeBoxes: number;
  energy: number;
  races: SeasonRace[];
};

export function createSeason(variant: SeasonVariant): SeasonState {
  return { variant, pool: createPoolState('tiers'), leagueIndex: 0, wins: 0, raceIndex: 0, freeBoxes: 0, energy: 0, races: [] };
}

/** 이번 대회 규칙(참가비·상금·상대 속도) */
export function raceMetaFor(season: SeasonState): RaceMeta {
  if (season.variant === 'league') return LEAGUE_TIERS[season.leagueIndex].meta;
  if (season.variant === 'course') {
    const lift = Math.min(6, season.raceIndex * COURSE_NPC_STEP);
    return { ...RIVERSIDE_ENDURANCE_RACE, npcSpeedMin: 20.5 + lift };
  }
  return RIVERSIDE_ENDURANCE_RACE;
}

/** 대회 하나를 치릅니다. 참가비가 모자라면 건너뜁니다. 결과는 시드(Day)로 정해집니다. */
export function runRace(season: SeasonState): SeasonRace {
  const pool = season.pool;
  const meta = raceMetaFor(season);
  const course = season.variant === 'course' ? courseForRace(season.raceIndex) : undefined;
  const entry = chooseEntry(pool, course);
  const base = {
    day: pool.day, name: meta.name, courseName: course?.name, bikeId: entry.bikeId, bonus: entry.bonus, entryFee: meta.entryFee,
    items: { freeBoxes: 0, energy: 0 }, odds: raceOddsFor(entry, meta),
  };
  season.raceIndex += 1;
  if (pool.coins < meta.entryFee) {
    const skipped: SeasonRace = { ...base, rank: 0, reward: 0, skipped: true };
    season.races.push(skipped);
    return skipped;
  }
  pool.coins -= meta.entryFee;
  const rank = simulateRace({ seed: pool.day * 1009 + 17, playerStats: entry.stats, playerSpeedBonus: entry.bonus, meta }).playerRank;
  const reward = raceRewardForRank(rank, meta);
  pool.coins += reward;
  const result: SeasonRace = { ...base, rank, reward, skipped: false };
  if (rank === 1) season.wins += 1;
  if (season.variant === 'league' && rank === 1 && season.leagueIndex < LEAGUE_TIERS.length - 1) {
    season.leagueIndex += 1;
    result.promotedTo = LEAGUE_TIERS[season.leagueIndex].name;
  }
  if (season.variant === 'rewards') {
    result.items = { ...(RANK_ITEMS[rank - 1] ?? { freeBoxes: 0, energy: 0 }) };
    season.freeBoxes += result.items.freeBoxes;
    season.energy += result.items.energy;
    if (rank === 1 && season.wins % WINS_FOR_DREAM === 0 && !isBikeRegistered(pool.collection, DREAM_REWARD_BIKE)) {
      pool.collection.understandingByBikeId[DREAM_REWARD_BIKE] = UNDERSTANDING_MAX;
      pool.collection.registeredBikeIds.push(DREAM_REWARD_BIKE);
      result.dreamUnlocked = true;
    }
  }
  season.races.push(result);
  return result;
}

/** 다음 대회 참가비만큼은 남기고 나머지 코인을 제작·강화에 씁니다(대회를 준비하는 플레이어). */
export function spendKeepingFee(season: SeasonState) {
  const reserve = Math.min(season.pool.coins, raceMetaFor(season).entryFee);
  season.pool.coins -= reserve;
  spendCoins(season.pool);
  season.pool.coins += reserve;
}

/** 하루 진행: 대회일이면 먼저 대회, 그다음 주문 3건 납품과 코인 사용 */
export function playSeasonDay(season: SeasonState): SeasonRace | null {
  const race = isRaceDay(season.pool.day, RIVERSIDE_ENDURANCE_RACE) ? runRace(season) : null;
  const day = season.pool.day;
  for (let i = 0; i < ORDERS_PER_DAY && season.pool.day === day; i += 1) deliverNext(season.pool);
  spendKeepingFee(season);
  return race;
}

export type SeasonSummary = {
  variant: SeasonVariant;
  races: number;
  entered: number;
  winRate: number;
  podiumRate: number;
  // 출전 전 우승 확률 또는 시상대 확률이 15~85%였던 대회 비율: 결과가 미리 정해져 있지 않은(긴장 있는) 대회
  uncertainRate: number;
  netCoins: number;
  itemCoins: number;
  firstGuaranteedWinDay: number | null;
  finalTier?: string;
  // B안: 코스와 맞는 카테고리 자전거로 출전한 비율(보유 자전거 선택이 의미 있었던 대회)
  courseMatchRate?: number;
  dreamUnlockDay?: number | null;
};

/** 시즌(기본 60 Day = 대회 12회)을 돌려 방안별 지표를 냅니다. */
export function simulateSeason(variant: SeasonVariant, days = 60): SeasonSummary {
  const season = createSeason(variant);
  while (season.pool.day <= days) playSeasonDay(season);
  const entered = season.races.filter((race) => !race.skipped);
  const share = (filter: (race: SeasonRace) => boolean) => (entered.length ? entered.filter(filter).length / entered.length : 0);
  return {
    variant,
    races: season.races.length,
    entered: entered.length,
    winRate: share((race) => race.rank === 1),
    podiumRate: share((race) => race.rank <= 3),
    uncertainRate: share((race) => isUncertain(race.odds)),
    netCoins: entered.reduce((sum, race) => sum + race.reward - race.entryFee, 0),
    itemCoins: (season.freeBoxes + season.energy) * COINS_PER_ENERGY,
    firstGuaranteedWinDay: entered.find((race) => race.odds.win >= 0.95)?.day ?? null,
    finalTier: variant === 'league' ? LEAGUE_TIERS[season.leagueIndex].name : undefined,
    courseMatchRate: variant === 'course' ? share((race) => race.bonus > 0) : undefined,
    dreamUnlockDay: variant === 'rewards' ? season.races.find((race) => race.dreamUnlocked)?.day ?? null : undefined,
  };
}

