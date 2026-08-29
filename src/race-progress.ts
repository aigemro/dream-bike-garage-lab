// 대회·레이스 순수 로직 (#231)
// 대회 일정·참가비·시뮬레이션·보상 정산을 Phaser 비의존 모듈로 분리합니다 (meta-progress 패턴).
// 시뮬레이션은 결과(틱별 진행 타임라인)를 먼저 확정하고, 씬은 그 타임라인을 재생만 합니다.
// 수치(참가비·상금·속도 계수)는 Lab 체감 검증용 1차안이며 밸런스 확정은 메인 담당입니다.
import type { BikeStats } from './meta-progress';
import { dreamStage } from './meta-progress';
import type { BikeCategory } from './bike-pixel-sprite';

// ─── 대회 메타 ─────────────────────────────────────────────────────────

export type RaceSegmentId = 'start' | 'climb' | 'descent' | 'sprint';
export type RaceSegment = {
  id: RaceSegmentId;
  name: string;
  // 트랙 진행률(0~1) 구간
  from: number;
  to: number;
  // 구간 속도 배율: 오르막 감속·내리막 가속으로 순위 변동 구간을 만듭니다.
  speedFactor: number;
};

export const RACE_SEGMENTS: RaceSegment[] = [
  { id: 'start', name: '스타트 직선', from: 0, to: 0.25, speedFactor: 1 },
  { id: 'climb', name: '오르막', from: 0.25, to: 0.45, speedFactor: 0.72 },
  { id: 'descent', name: '내리막', from: 0.45, to: 0.65, speedFactor: 1.3 },
  { id: 'sprint', name: '피니시 스퍼트', from: 0.65, to: 1, speedFactor: 1.1 },
];

export function segmentAt(progress: number): RaceSegment {
  const clamped = Math.min(Math.max(progress, 0), 1);
  return RACE_SEGMENTS.find((segment) => clamped < segment.to) ?? RACE_SEGMENTS[RACE_SEGMENTS.length - 1];
}

export type RaceMeta = {
  id: string;
  name: string;
  // N일차마다 개최 (dayNumber % heldEveryDays === 0)
  heldEveryDays: number;
  entryFee: number;
  distanceMeters: number;
  racerCount: number;
  // 1·2·3위 상금. 그 외 순위는 완주 수당만 받습니다.
  rankRewards: number[];
  finishReward: number;
};

// 참가비 500 = 첫 주문 급여(1000)의 절반. 하위권이면 참가비 손해 → 자전거 성장 동기.
export const RIVERSIDE_RACE: RaceMeta = {
  id: 'riverside-circuit',
  name: '리버사이드 서킷',
  heldEveryDays: 5,
  entryFee: 500,
  distanceMeters: 1200,
  racerCount: 8,
  rankRewards: [2000, 1200, 800],
  finishReward: 200,
};

// ─── 대회 일정 ─────────────────────────────────────────────────────────

export function isRaceDay(dayNumber: number, meta: RaceMeta = RIVERSIDE_RACE): boolean {
  return dayNumber > 0 && dayNumber % meta.heldEveryDays === 0;
}

// dayNumber 당일을 포함해 가장 가까운 대회 개최일
export function nextRaceDay(dayNumber: number, meta: RaceMeta = RIVERSIDE_RACE): number {
  const base = Math.max(1, dayNumber);
  return Math.ceil(base / meta.heldEveryDays) * meta.heldEveryDays;
}

export function daysUntilRace(dayNumber: number, meta: RaceMeta = RIVERSIDE_RACE): number {
  return nextRaceDay(dayNumber, meta) - Math.max(1, dayNumber);
}

// ─── 참가비 (원자적 처리: 실패 시 상태 무변경) ─────────────────────────

export type RaceEntryResult =
  | { ok: true; coins: number; entryFee: number }
  | { ok: false; reason: 'coins'; coins: number; entryFee: number };

export function applyRaceEntry(coins: number, meta: RaceMeta = RIVERSIDE_RACE): RaceEntryResult {
  if (coins < meta.entryFee) return { ok: false, reason: 'coins', coins, entryFee: meta.entryFee };
  return { ok: true, coins: coins - meta.entryFee, entryFee: meta.entryFee };
}

// ─── 시드 기반 난수 (재현 가능한 레이스) ───────────────────────────────

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── 라이더 성능 ───────────────────────────────────────────────────────

// 속도 점수(미터/틱): 성능 레벨이 주 스탯, 드림 단계(중급/고급/드림)가 보정.
// 최소(성능1·중급) 21 ~ 최대(성능4·드림) 31.5. NPC 밴드(20.5~29.5)와 겹치되
// 성장할수록 밴드 상단을 넘어서도록 설계했습니다.
export function racerSpeedScore(stats: BikeStats): number {
  return 17 + stats.성능 * 2.5 + dreamStage(stats) * 1.5;
}

const NPC_SPEED_MIN = 20.5;
const NPC_SPEED_SPAN = 9;

// NPC 프로필: 이름·자전거 종류·프레임색은 고정, 속도만 시드로 결정됩니다.
type NpcProfile = { name: string; category: BikeCategory; frameColor: number };
const NPC_PROFILES: NpcProfile[] = [
  { name: '강변의 지호', category: 'road', frameColor: 0x4e8092 },
  { name: '언덕왕 미소', category: 'mtb', frameColor: 0x5e9a67 },
  { name: '자갈길 서준', category: 'gravel', frameColor: 0xb98a4e },
  { name: '골목의 하나', category: 'minivelo', frameColor: 0xf4b84a },
  { name: '출근왕 도윤', category: 'city', frameColor: 0x573044 },
  { name: '바람잡이 유나', category: 'road', frameColor: 0x86ba6f },
  { name: '정비소 삼촌', category: 'mtb', frameColor: 0x8e5136 },
];

// ─── 레이스 시뮬레이션 ─────────────────────────────────────────────────

// 재생 기준 1틱 시간(ms). 씬은 이 값을 배속으로 나눠 재생합니다.
export const RACE_TICK_MS = 600;
// 폭주 방지 상한 (최저 속도로도 완주에 충분한 값)
const MAX_TICKS = 240;
// 틱마다 ±9% 변동: 매 레이스 긴장감을 만들되 성능 차를 뒤집을 정도는 아닙니다.
const TICK_NOISE = 0.09;

export type RaceSimulationInput = {
  seed: number;
  playerName?: string;
  playerStats: BikeStats;
  playerCategory?: BikeCategory;
  playerFrameColor?: number;
  meta?: RaceMeta;
};

export type RacerResult = {
  id: string;
  name: string;
  isPlayer: boolean;
  category: BikeCategory;
  frameColor: number;
  speedScore: number;
  rank: number;
  finishTimeMs: number;
  // 틱별 진행률(0~1). [0]은 출발 전 0이며, 완주 후에는 1로 고정됩니다.
  timeline: number[];
};

export type RaceResult = {
  meta: RaceMeta;
  seed: number;
  tickMs: number;
  totalTicks: number;
  racers: RacerResult[];
  playerRank: number;
  playerTimeMs: number;
};

export function simulateRace(input: RaceSimulationInput): RaceResult {
  const meta = input.meta ?? RIVERSIDE_RACE;
  const random = createSeededRandom(input.seed);

  type Runner = {
    id: string; name: string; isPlayer: boolean; category: BikeCategory; frameColor: number;
    speedScore: number; distance: number; finishTimeMs: number | null; timeline: number[];
  };
  const runners: Runner[] = [
    {
      id: 'player',
      name: input.playerName ?? '나',
      isPlayer: true,
      category: input.playerCategory ?? 'road',
      frameColor: input.playerFrameColor ?? 0xc95746,
      speedScore: racerSpeedScore(input.playerStats),
      distance: 0, finishTimeMs: null, timeline: [0],
    },
    ...NPC_PROFILES.slice(0, meta.racerCount - 1).map((profile, index) => ({
      id: `npc-${index}`,
      name: profile.name,
      isPlayer: false,
      category: profile.category,
      frameColor: profile.frameColor,
      speedScore: NPC_SPEED_MIN + random() * NPC_SPEED_SPAN,
      distance: 0, finishTimeMs: null as number | null, timeline: [0],
    })),
  ];

  let tick = 0;
  while (tick < MAX_TICKS && runners.some((runner) => runner.finishTimeMs === null)) {
    tick += 1;
    runners.forEach((runner) => {
      if (runner.finishTimeMs !== null) {
        runner.timeline.push(1);
        return;
      }
      const progress = runner.distance / meta.distanceMeters;
      const noise = 1 + (random() * 2 - 1) * TICK_NOISE;
      const step = runner.speedScore * segmentAt(progress).speedFactor * noise;
      const previousDistance = runner.distance;
      runner.distance = Math.min(meta.distanceMeters, runner.distance + step);
      if (runner.distance >= meta.distanceMeters) {
        // 결승선을 지난 시점을 틱 안에서 선형 보간해 기록 순위를 정확히 가립니다.
        const fraction = (meta.distanceMeters - previousDistance) / step;
        runner.finishTimeMs = Math.round((tick - 1 + fraction) * RACE_TICK_MS);
        runner.timeline.push(1);
      } else {
        runner.timeline.push(runner.distance / meta.distanceMeters);
      }
    });
  }

  // 안전장치: 상한에 걸린 미완주 러너는 남은 거리 비율로 기록을 추정합니다.
  // (타임라인 길이는 다른 러너와 동일하게 유지합니다)
  runners.forEach((runner) => {
    if (runner.finishTimeMs === null) {
      runner.finishTimeMs = Math.round((tick + (1 - runner.distance / meta.distanceMeters) * 10) * RACE_TICK_MS);
      runner.timeline[runner.timeline.length - 1] = 1;
    }
  });

  const ordered = [...runners].sort((a, b) => (a.finishTimeMs ?? 0) - (b.finishTimeMs ?? 0));
  const rankById = new Map(ordered.map((runner, index) => [runner.id, index + 1]));
  const racers: RacerResult[] = runners.map((runner) => ({
    id: runner.id,
    name: runner.name,
    isPlayer: runner.isPlayer,
    category: runner.category,
    frameColor: runner.frameColor,
    speedScore: runner.speedScore,
    rank: rankById.get(runner.id)!,
    finishTimeMs: runner.finishTimeMs!,
    timeline: runner.timeline,
  }));
  const player = racers.find((racer) => racer.isPlayer)!;

  return {
    meta,
    seed: input.seed,
    tickMs: RACE_TICK_MS,
    totalTicks: tick,
    racers,
    playerRank: player.rank,
    playerTimeMs: player.finishTimeMs,
  };
}

// 재생용 진행률 보간: 틱 사이를 선형 보간해 부드럽게 움직입니다.
export function progressAt(timeline: number[], tickFloat: number): number {
  if (tickFloat <= 0) return timeline[0] ?? 0;
  const index = Math.floor(tickFloat);
  if (index >= timeline.length - 1) return timeline[timeline.length - 1] ?? 1;
  const fraction = tickFloat - index;
  return timeline[index] + (timeline[index + 1] - timeline[index]) * fraction;
}

// ─── 보상 정산 ─────────────────────────────────────────────────────────

export function raceRewardForRank(rank: number, meta: RaceMeta = RIVERSIDE_RACE): number {
  return meta.rankRewards[rank - 1] ?? meta.finishReward;
}

export type RaceRewardResult = { coins: number; reward: number; rank: number };

export function applyRaceReward(coins: number, rank: number, meta: RaceMeta = RIVERSIDE_RACE): RaceRewardResult {
  const reward = raceRewardForRank(rank, meta);
  return { coins: coins + reward, reward, rank };
}

export function formatRaceTime(timeMs: number): string {
  const totalSeconds = timeMs / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`;
}
