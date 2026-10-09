// E안 작업대 + Day C안(주문 N건 = 하루) 경제·밸런스 시뮬레이터 (#262 · 순수 로직, Phaser·DOM 비의존)
// 메인 aigemro/dream-bike-garage#77에서 정할 수치(하루 주문 수·체력·대회 참가비·상금)를 같은 규칙으로 비교하기 위한 봇 시뮬레이션입니다.
// 실제 사용자 데이터가 아니며, 결과는 플레이어 모델(숙련·초보)과 접속 패턴 가정에 따라 달라집니다.
// 수치 확정은 메인에서 합니다. Lab은 후보표와 권고만 제공합니다.
import {
  CAP, SIZE, ORDER_LEVELS, fresh, supply, drop, returnPart, mergeTargets, supplyBlock, requirements,
  type State, type ProgressEvent,
} from './merge-placement-state';
import {
  applyBikeUpgrade, applyCraftPart, applyOrderDelivery, bikeStats, computeNextGoal, createCollectionProgress,
  createGrowthProgress, dreamStage, nextCraftPart, type BikeStats, type CollectionProgress, type GrowthProgress,
} from './meta-progress';
import { AD_REFILL_AMOUNT } from './energy-refill';
import { SEASON_LABELS, simulateSeason, type SeasonVariant } from './race-season';
import { CURRENT_AVG_UNITS, POOL_VARIANT_LABELS, orderableBikeCount, simulatePool, type PoolVariant } from './order-pool';
import { HINT_EMPTY_THRESHOLD, applyRescue, emptyCells, isStuck, recommendMerge } from './merge-assist';
import { RIVERSIDE_ENDURANCE_RACE, createSeededRandom, isRaceDay, raceRewardForRank, simulateRace, type RaceMeta } from './race-progress';

// ── 플레이어 모델 ──
// expert(숙련): 합성 후보마다 한 수 앞을 보고 납품·장착 수와 남는 합성 쌍이 많은 쪽을 고릅니다.
// novice(초보): 지금 필요한 부품 쌍을 먼저, 없으면 아무 쌍이나 보드 위쪽부터 보이는 대로 합성합니다.
// chain(연쇄 노리기): 겹치지 않는 합성 쌍이 3개 이상 모이거나 빈칸이 8칸 이하가 될 때까지 합성을 미루고 상자를 연 뒤,
//   한꺼번에 이어 합성해 연쇄 보너스(3연쇄 무료 상자·5연쇄 필수 부품)를 노립니다. 합성 순서는 숙련과 같습니다.
export type Skill = 'expert' | 'novice' | 'chain';
export const SKILLS: Skill[] = ['expert', 'novice', 'chain'];
export const SKILL_LABELS: Record<Skill, string> = { expert: '숙련(한 수 앞 보기)', novice: '초보(보이는 쌍 바로 합성)', chain: '연쇄 노리기(모아서 합성)' };

const clone = (s: State): State => ({ ...s, board: s.board.map((part) => (part ? { ...part } : null)), installed: [...s.installed], undo: null });

function pairCount(s: State) {
  let count = 0;
  for (let index = 0; index < SIZE; index += 1) for (const to of mergeTargets(s, index)) if (to > index) count += 1;
  return count;
}

const needed = (s: State, kind: number, level: number) => !s.installed[kind] && level < requirements(s)[kind];

// 서로 겹치지 않는 합성 쌍 수(탐욕 근사)
function disjointPairs(s: State) {
  const used = new Set<number>();
  let count = 0;
  for (let index = 0; index < SIZE; index += 1) {
    if (used.has(index)) continue;
    const to = mergeTargets(s, index).find((target) => !used.has(target));
    if (to === undefined) continue;
    used.add(index); used.add(to); count += 1;
  }
  return count;
}

// 연쇄 노리기 봇이 지금 합성을 풀어 놓는 중인지 (상태별로 기억)
const releasing = new WeakMap<State, boolean>();

function chooseMerge(s: State, skill: Skill, rng: () => number): [number, number] | null {
  if (skill === 'chain') {
    const empty = s.board.filter((part) => !part).length;
    if (!releasing.get(s) && (disjointPairs(s) >= 3 || empty <= 8)) releasing.set(s, true);
    const pick = releasing.get(s) ? chooseMerge(s, 'expert', rng) : null;
    if (!pick) releasing.set(s, false);
    return pick;
  }
  if (skill === 'novice') {
    let fallback: [number, number] | null = null;
    for (let index = 0; index < SIZE; index += 1) {
      const part = s.board[index];
      if (!part) continue;
      const target = mergeTargets(s, index)[0];
      if (target === undefined) continue;
      if (needed(s, part.kind, part.level)) return [index, target];
      fallback ??= [index, target];
    }
    return fallback;
  }
  let best: [number, number] | null = null;
  let bestScore = -Infinity;
  for (let index = 0; index < SIZE; index += 1) {
    for (const to of mergeTargets(s, index)) {
      const next = clone(s);
      drop(next, index, to);
      const score = (next.order - s.order) * 1e4 + next.installed.filter(Boolean).length * 100 + pairCount(next) * 10 + rng();
      if (score > bestScore) { bestScore = score; best = [index, to]; }
    }
  }
  return best;
}

// 꽉 찼는데 합성할 쌍이 없을 때 버릴 부품: 지금 필요 없는 낮은 레벨부터
function chooseDiscard(s: State, rng: () => number): number {
  let pick = -1;
  let lowest = Infinity;
  s.board.forEach((part, index) => {
    if (!part) return;
    const value = 2 ** (part.level - 1) + (needed(s, part.kind, part.level) ? 6 : 0) + rng() * 0.1;
    if (value < lowest) { lowest = value; pick = index; }
  });
  return pick;
}

export type StepResult = {
  action: 'merge' | 'box' | 'free-box' | 'discard' | 'rescue' | 'blocked';
  // 이번 행동으로 확정된 납품 (주문 목록 위치·보상)
  deliveries: Array<{ orderIndex: number; reward: number }>;
};

function deliveriesOf(events: ProgressEvent[]) {
  // 'delivered' 이벤트의 order는 납품 뒤 증가한 누적 순번이므로 1을 빼 납품한 주문을 찾습니다.
  return events.flatMap((event) => (event.type === 'delivered'
    ? [{ orderIndex: (event.order - 1) % ORDER_LEVELS.length, reward: event.reward }]
    : []));
}

/**
 * 막힘 완화 보조(#264). hint: 빈칸이 기준 이하로 남으면 추천 쌍을 그대로 따릅니다(추천을 항상 따르는 상한).
 * rescue: 막힘일 때 남은 정리 횟수가 있으면 반품 대신 정리합니다. 남은 횟수는 호출 측이 하루마다 채웁니다.
 */
export type Assist = { hint?: boolean; hintEmpty?: number; rescue?: { remaining: number } };

/**
 * 봇이 한 번 행동합니다. 합성 → (꽉 찼으면) 정리·반품 → 무료 상자 → 체력 상자 순서입니다.
 * 체력은 호출 측이 관리하며, canSpendEnergy가 거짓이면 체력 상자를 열지 않고 'blocked'를 돌려줍니다.
 */
export function botStep(s: State, skill: Skill, rng: () => number, canSpendEnergy: boolean, assist: Assist = {}): StepResult {
  const hinted = assist.hint && emptyCells(s) <= (assist.hintEmpty ?? HINT_EMPTY_THRESHOLD) ? recommendMerge(s) : null;
  const merge: [number, number] | null = hinted ? [hinted.from, hinted.to] : chooseMerge(s, skill, rng);
  if (merge) return { action: 'merge', deliveries: deliveriesOf(drop(s, merge[0], merge[1])!.events) };
  if (supplyBlock({ ...s, energy: CAP }) === 'full') {
    // 미뤄 둔 합성이 있으면 반품보다 먼저 합성합니다.
    const held = skill === 'chain' ? chooseMerge(s, 'expert', rng) : null;
    if (held) return { action: 'merge', deliveries: deliveriesOf(drop(s, held[0], held[1])!.events) };
    if (assist.rescue && assist.rescue.remaining > 0 && isStuck(s) && applyRescue(s)) {
      assist.rescue.remaining -= 1;
      return { action: 'rescue', deliveries: [] };
    }
    returnPart(s, chooseDiscard(s, rng));
    s.undo = null;
    return { action: 'discard', deliveries: [] };
  }
  const free = s.freeBoxes > 0;
  // 상자를 열 수 없는데 미뤄 둔 합성이 있으면 마저 합성합니다.
  if (!free && !canSpendEnergy && skill === 'chain') {
    const held = chooseMerge(s, 'expert', rng);
    if (held) return { action: 'merge', deliveries: deliveriesOf(drop(s, held[0], held[1])!.events) };
  }
  if (!free && !canSpendEnergy) return { action: 'blocked', deliveries: [] };
  // 체력은 호출 측 기준을 쓰므로 규칙 모듈 안의 체력은 막지 않도록 채워 둡니다.
  s.energy = CAP;
  const result = supply(s, 0, rng)!;
  return { action: free ? 'free-box' : 'box', deliveries: deliveriesOf(result.events) };
}

// ── 1. 작업대 효율 ──
export type WorkbenchSummary = {
  skill: Skill;
  runs: number;
  orders: number;
  // 주문 1건마다 쓴 체력 (모든 회차·주문)
  energyPerOrder: number[];
  boxesPerOrder: number;
  freeBoxesPerOrder: number;
  mergesPerOrder: number;
  discardsPerOrder: number;
  // 막힘(꽉 참 + 합성 쌍 없음)을 한 번 이상 겪은 회차 비율
  stuckRunRate: number;
  // 반품(부품 손실)이 한 번 이상 필요했던 회차 비율
  discardRunRate: number;
  rescuesPerOrder: number;
};

export type WorkbenchAssistOptions = { hint?: boolean; hintEmpty?: number; rescuePerDay?: number; orderTarget?: number };

export function simulateWorkbench(options: { skill: Skill; runs: number; orders: number; seed?: number; assist?: WorkbenchAssistOptions }): WorkbenchSummary {
  const energyPerOrder: number[] = [];
  let boxes = 0, freeBoxes = 0, merges = 0, discards = 0, rescues = 0, stuckRuns = 0, discardRuns = 0;
  const rescuePerDay = options.assist?.rescuePerDay ?? 0;
  const orderTarget = options.assist?.orderTarget ?? 3;
  for (let run = 0; run < options.runs; run += 1) {
    const rng = createSeededRandom((options.seed ?? 1000) + run);
    const s = fresh(0);
    let stuck = false;
    let discarded = false;
    let delivered = 0;
    let energy = 0;
    // 정리 횟수는 하루(주문 orderTarget건)마다 다시 채웁니다.
    const assist: Assist = { hint: options.assist?.hint, hintEmpty: options.assist?.hintEmpty, rescue: rescuePerDay > 0 ? { remaining: rescuePerDay } : undefined };
    // 한 행동에 납품이 여러 건 확정될 수 있으므로(남은 부품으로 다음 주문까지 바로 완성) 납품 건수로 셉니다.
    // 그때 쓴 체력은 첫 납품에 넣고, 이어서 확정된 납품은 체력 0으로 기록합니다.
    for (let guard = 0; guard < options.orders * 5000 && delivered < options.orders; guard += 1) {
      const step = botStep(s, options.skill, rng, true, assist);
      if (step.action === 'box') { energy += 1; boxes += 1; }
      if (step.action === 'free-box') { freeBoxes += 1; boxes += 1; }
      if (step.action === 'merge') merges += 1;
      if (step.action === 'discard') { discards += 1; stuck = true; discarded = true; }
      if (step.action === 'rescue') { rescues += 1; stuck = true; }
      for (let i = 0; i < step.deliveries.length && delivered < options.orders; i += 1) {
        energyPerOrder.push(energy);
        energy = 0;
        delivered += 1;
        if (assist.rescue && delivered % orderTarget === 0) assist.rescue.remaining = rescuePerDay;
      }
    }
    if (stuck) stuckRuns += 1;
    if (discarded) discardRuns += 1;
  }
  const total = options.runs * options.orders;
  return {
    skill: options.skill, runs: options.runs, orders: options.orders, energyPerOrder,
    boxesPerOrder: boxes / total, freeBoxesPerOrder: freeBoxes / total, mergesPerOrder: merges / total,
    discardsPerOrder: discards / total, stuckRunRate: stuckRuns / options.runs,
    discardRunRate: discardRuns / options.runs, rescuesPerOrder: rescues / total,
  };
}

export const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
export function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))] ?? 0;
}

/** 하루(주문 orderTarget건)에 드는 체력 목록. 회차별 연속 주문을 하루 단위로 묶습니다. */
export function dailyEnergy(summary: WorkbenchSummary, orderTarget: number): number[] {
  const days: number[] = [];
  for (let run = 0; run < summary.runs; run += 1) {
    const slice = summary.energyPerOrder.slice(run * summary.orders, (run + 1) * summary.orders);
    for (let start = 0; start + orderTarget <= slice.length; start += orderTarget) days.push(slice.slice(start, start + orderTarget).reduce((a, b) => a + b, 0));
  }
  return days;
}

// ── 2. 실제 시간 진행 (체력 회복 + 접속 패턴 + 메타 진행 + 대회) ──
export type PlayLimitParams = {
  orderTarget: number;
  energyCap: number;
  recoveryMinutes: number;
};
// 하루 중 접속 시각(시). 접속하면 체력이 바닥날 때까지 플레이한다고 가정합니다.
export const SESSION_PATTERNS: Record<string, number[]> = { '하루 2회': [9, 21], '하루 4회': [8, 12, 16, 20] };

export type RealtimeOptions = PlayLimitParams & {
  skill: Skill;
  sessionHours: number[];
  realDays: number;
  runs: number;
  race?: RaceMeta;
  seed?: number;
};

export type RealtimeSummary = {
  ordersPerRealDay: number;
  gameDaysPerRealDay: number;
  // 처음 대회일(Day 5 등)에 도달한 실제 일차 (도달 못 하면 제외하고 평균, reached로 비율 표시)
  firstRaceRealDay: number;
  // 홈 다음 목표가 '반복'만 남은 시점
  goalsExhaustedRealDay: number;
  goalsExhaustedGameDay: number;
  goalsExhaustedReached: number;
  coinsAtEnd: number;
  racesEntered: number;
  racePodiumRate: number;
  raceNet: number;
};

type Meta = { coins: number; collection: CollectionProgress; growth: GrowthProgress };

// 코인을 홈 NEXT GOAL 순서(부품 제작 → 강화)대로 바로 씁니다.
function spendOnGoals(meta: Meta) {
  for (let guard = 0; guard < 64; guard += 1) {
    const goal = computeNextGoal(meta.collection, meta.growth);
    if (goal.kind === 'craft') {
      const part = nextCraftPart(meta.collection, goal.bikeId);
      if (!part) return;
      const result = applyCraftPart(meta.collection, meta.coins, goal.bikeId, part.type);
      if (!result.ok) return;
      meta.coins = result.coins;
      continue;
    }
    if (goal.kind === 'upgrade') {
      const result = applyBikeUpgrade(meta.collection, meta.growth, meta.coins, goal.bikeId, goal.stat);
      if (!result.ok) return;
      meta.coins = result.coins;
      meta.growth = result.growth;
      continue;
    }
    return;
  }
}

function heroStats(meta: Meta): BikeStats {
  const total = (stats: BikeStats) => stats.성능 * 100 + stats.스타일 + stats.희귀도;
  return meta.collection.craftedBikeIds
    .map((id) => bikeStats(meta.growth, id))
    .reduce((best, stats) => (total(stats) > total(best) ? stats : best));
}

export function simulateRealtime(options: RealtimeOptions): RealtimeSummary {
  const race = options.race ?? RIVERSIDE_ENDURANCE_RACE;
  const recoveryMs = options.recoveryMinutes * 60_000;
  const rows: RealtimeSummary[] = [];
  let exhaustedCount = 0;
  for (let run = 0; run < options.runs; run += 1) {
    const rng = createSeededRandom((options.seed ?? 7000) + run);
    const s = fresh(0);
    const meta: Meta = { coins: 0, collection: createCollectionProgress(), growth: createGrowthProgress() };
    let energy = options.energyCap;
    let anchor = 0;
    let dayNumber = 1, ordersToday = 0, orders = 0;
    let firstRaceRealDay = 0, exhaustedRealDay = 0, exhaustedGameDay = 0;
    let racesEntered = 0, podiums = 0, raceNet = 0, racedDay = 0;
    const tryRace = (realDay: number) => {
      if (!isRaceDay(dayNumber, race) || racedDay === dayNumber) return;
      if (!firstRaceRealDay) firstRaceRealDay = realDay;
      racedDay = dayNumber;
      if (meta.coins < race.entryFee) return;
      meta.coins -= race.entryFee;
      const result = simulateRace({ seed: dayNumber * 1009 + run, playerStats: heroStats(meta), meta: race });
      const reward = raceRewardForRank(result.playerRank, race);
      meta.coins += reward;
      raceNet += reward - race.entryFee;
      racesEntered += 1;
      if (result.playerRank <= 3) podiums += 1;
    };
    for (let realDay = 1; realDay <= options.realDays; realDay += 1) {
      for (const hour of options.sessionHours) {
        const now = ((realDay - 1) * 24 + hour) * 3_600_000;
        // 회복: 가득 찬 뒤의 시간은 쌓지 않습니다(메인·Lab 규칙과 같음)
        if (energy >= options.energyCap) anchor = now;
        else {
          const ticks = Math.floor((now - anchor) / recoveryMs);
          energy = Math.min(options.energyCap, energy + ticks);
          anchor = energy >= options.energyCap ? now : anchor + ticks * recoveryMs;
        }
        tryRace(realDay);
        for (let guard = 0; guard < 20_000; guard += 1) {
          const step = botStep(s, options.skill, rng, energy >= 1);
          if (step.action === 'blocked') break;
          if (step.action === 'box') {
            if (energy >= options.energyCap) anchor = now;
            energy -= 1;
          }
          for (const delivery of step.deliveries) {
            orders += 1;
            meta.coins += delivery.reward;
            applyOrderDelivery(meta.collection, delivery.orderIndex);
            spendOnGoals(meta);
            ordersToday += 1;
            if (ordersToday >= options.orderTarget) {
              dayNumber += 1;
              ordersToday = 0;
              tryRace(realDay);
            }
          }
          if (!exhaustedRealDay && computeNextGoal(meta.collection, meta.growth).kind === 'repeat') {
            exhaustedRealDay = realDay;
            exhaustedGameDay = dayNumber;
          }
        }
      }
    }
    if (exhaustedRealDay) exhaustedCount += 1;
    rows.push({
      ordersPerRealDay: orders / options.realDays,
      gameDaysPerRealDay: (dayNumber - 1) / options.realDays,
      firstRaceRealDay,
      goalsExhaustedRealDay: exhaustedRealDay,
      goalsExhaustedGameDay: exhaustedGameDay,
      goalsExhaustedReached: exhaustedRealDay ? 1 : 0,
      coinsAtEnd: meta.coins,
      racesEntered,
      racePodiumRate: racesEntered ? podiums / racesEntered : 0,
      raceNet,
    });
  }
  const avgOf = (pick: (row: RealtimeSummary) => number, onlyPositive = false) => mean(rows.map(pick).filter((value) => !onlyPositive || value > 0));
  return {
    ordersPerRealDay: avgOf((row) => row.ordersPerRealDay),
    gameDaysPerRealDay: avgOf((row) => row.gameDaysPerRealDay),
    firstRaceRealDay: avgOf((row) => row.firstRaceRealDay, true),
    goalsExhaustedRealDay: avgOf((row) => row.goalsExhaustedRealDay, true),
    goalsExhaustedGameDay: avgOf((row) => row.goalsExhaustedGameDay, true),
    goalsExhaustedReached: exhaustedCount / options.runs,
    coinsAtEnd: avgOf((row) => row.coinsAtEnd),
    racesEntered: avgOf((row) => row.racesEntered),
    racePodiumRate: mean(rows.filter((row) => row.racesEntered > 0).map((row) => row.racePodiumRate)),
    raceNet: avgOf((row) => row.raceNet),
  };
}

// ── 3. 대회: 성능 레벨별 순위 확률 ──
export type RaceOdds = { performance: number; stage: number; winRate: number; podiumRate: number; expectedReward: number };

export function raceOdds(stats: BikeStats, race: RaceMeta = RIVERSIDE_ENDURANCE_RACE, seeds = 400): Omit<RaceOdds, 'performance' | 'stage'> {
  let wins = 0, podiums = 0, reward = 0;
  for (let seed = 1; seed <= seeds; seed += 1) {
    const result = simulateRace({ seed: seed * 7919, playerStats: stats, meta: race });
    if (result.playerRank === 1) wins += 1;
    if (result.playerRank <= 3) podiums += 1;
    reward += raceRewardForRank(result.playerRank, race);
  }
  return { winRate: wins / seeds, podiumRate: podiums / seeds, expectedReward: reward / seeds };
}

// 대회 표에 쓰는 대표 자전거 스탯 예시 (시작 → 강화 완료)
export const RACE_STAT_SAMPLES: ReadonlyArray<readonly [number, number, number]> = [[1, 1, 1], [2, 1, 1], [2, 2, 2], [3, 2, 2], [4, 3, 3], [4, 4, 4]];

// ── 비교 후보 ──
export const CURRENT_LIMIT: PlayLimitParams = { orderTarget: 3, energyCap: CAP, recoveryMinutes: 10 };
export const RACE_CANDIDATES: Array<{ label: string; meta: RaceMeta }> = [
  { label: '현행 (참가비 500 · 2,000/1,200/800 · 완주 200)', meta: RIVERSIDE_ENDURANCE_RACE },
  { label: '상금 2배 (참가비 1,000 · 4,000/2,400/1,600 · 완주 400)', meta: { ...RIVERSIDE_ENDURANCE_RACE, entryFee: 1000, rankRewards: [4000, 2400, 1600], finishReward: 400 } },
  { label: '하루 수입 연동 (참가비 1,500 · 8,000/4,000/2,000 · 완주 500)', meta: { ...RIVERSIDE_ENDURANCE_RACE, entryFee: 1500, rankRewards: [8000, 4000, 2000], finishReward: 500 } },
];

// ── 보고서 ──
export type ReportOptions = { workbenchRuns: number; workbenchOrders: number; realtimeRuns: number; realDays: number };
export const FULL_REPORT: ReportOptions = { workbenchRuns: 400, workbenchOrders: 30, realtimeRuns: 60, realDays: 14 };

const fixed = (value: number, digits = 1) => (Number.isFinite(value) ? value.toFixed(digits) : '-');
const percent = (value: number) => `${Math.round(value * 100)}%`;
const coins = (value: number) => Math.round(value).toLocaleString('en-US');

/** 표 전체를 마크다운으로 만듭니다. 같은 옵션이면 항상 같은 결과입니다(시드 고정). */
export function buildBalanceReport(options: ReportOptions = FULL_REPORT): string {
  const lines: string[] = [];
  const skills = SKILLS;
  const workbench = Object.fromEntries(skills.map((skill) => [skill, simulateWorkbench({ skill, runs: options.workbenchRuns, orders: options.workbenchOrders })])) as Record<Skill, WorkbenchSummary>;

  lines.push(`### 표 1. 작업대 효율 (주문 ${options.workbenchOrders}건 × ${options.workbenchRuns}회)`, '');
  lines.push('| 플레이어 | 주문당 체력 평균 | p50 / p90 | 상자(무료 포함) | 합성 | 반품 | 막힘을 겪은 회차 |', '|---|---|---|---|---|---|---|');
  for (const skill of skills) {
    const w = workbench[skill];
    lines.push(`| ${SKILL_LABELS[skill]} | ${fixed(mean(w.energyPerOrder), 2)} | ${percentile(w.energyPerOrder, 0.5)} / ${percentile(w.energyPerOrder, 0.9)} | ${fixed(w.boxesPerOrder, 2)} (무료 ${fixed(w.freeBoxesPerOrder, 2)}) | ${fixed(w.mergesPerOrder, 2)} | ${fixed(w.discardsPerOrder, 3)} | ${percent(w.stuckRunRate)} |`);
  }

  lines.push('', `### 표 6. 막힘 완화 보조 효과 (#264, 주문 ${options.workbenchOrders}건 × ${options.workbenchRuns}회)`, '');
  lines.push(`추천은 빈칸이 ${HINT_EMPTY_THRESHOLD}칸 이하일 때 추천 쌍을 항상 따르는 상한입니다. 정리는 하루(주문 3건)에 1회입니다.`, '');
  lines.push('| 플레이어 · 보조 | 주문당 체력 | 막힘을 겪은 회차 | 반품이 필요했던 회차 | 주문당 반품 | 주문당 정리 |', '|---|---|---|---|---|---|');
  const assistRows: Array<[string, Skill, WorkbenchAssistOptions]> = [
    ['초보 · 보조 없음(현행)', 'novice', {}],
    ['초보 · B안 합성 추천', 'novice', { hint: true }],
    ['초보 · B안 (빈칸 10칸 이하부터 추천)', 'novice', { hint: true, hintEmpty: 10 }],
    ['초보 · C안 막힘 구제(정리)', 'novice', { rescuePerDay: 1 }],
    ['초보 · B+C', 'novice', { hint: true, rescuePerDay: 1 }],
    ['숙련 · 보조 없음', 'expert', {}],
  ];
  for (const [label, skill, assist] of assistRows) {
    const w = Object.keys(assist).length === 0 ? workbench[skill] : simulateWorkbench({ skill, runs: options.workbenchRuns, orders: options.workbenchOrders, assist });
    lines.push(`| ${label} | ${fixed(mean(w.energyPerOrder), 2)} | ${percent(w.stuckRunRate)} | ${percent(w.discardRunRate)} | ${fixed(w.discardsPerOrder, 3)} | ${fixed(w.rescuesPerOrder, 3)} |`);
  }

  lines.push('', '### 표 2. 하루 체력과 "체력 한 통으로 하루 마침" 비율', '');
  lines.push('하루를 가득 찬 체력으로 시작한다고 볼 때, 그날 주문을 체력 한 통 안에 끝내는 비율입니다.', '');
  lines.push('| 하루 주문 | 플레이어 | 하루 체력 평균 (p90) | 체력 30으로 마침 | 체력 40으로 마침 |', '|---|---|---|---|---|');
  for (const target of [2, 3, 5]) {
    for (const skill of skills) {
      const days = dailyEnergy(workbench[skill], target);
      const within = (cap: number) => days.filter((value) => value <= cap).length / days.length;
      lines.push(`| ${target}건 | ${SKILL_LABELS[skill]} | ${fixed(mean(days))} (${percentile(days, 0.9)}) | ${percent(within(30))} | ${percent(within(40))} |`);
    }
  }

  lines.push('', '### 표 7. 체력 충전으로 하루(주문 3건)를 마치는 비율 (#263)', '');
  lines.push(`하루를 가득 찬 체력 ${CAP}으로 시작하고, 광고 1회 +${AD_REFILL_AMOUNT}, 무료 충전 1회는 다시 가득(+${CAP})으로 볼 때의 상한입니다.`, '');
  lines.push('| 플레이어 | 충전 없음 | 광고 1회 | 광고 2회 | 광고 3회 (A·C안 하루 최대) | 무료 충전 | 무료 + 광고 2회 (B안 하루 최대) |', '|---|---|---|---|---|---|---|');
  for (const skill of skills) {
    const days = dailyEnergy(workbench[skill], 3);
    const within = (budget: number) => percent(days.filter((value) => value <= budget).length / days.length);
    const ad = AD_REFILL_AMOUNT;
    lines.push(`| ${SKILL_LABELS[skill]} | ${within(CAP)} | ${within(CAP + ad)} | ${within(CAP + 2 * ad)} | ${within(CAP + 3 * ad)} | ${within(2 * CAP)} | ${within(2 * CAP + 2 * ad)} |`);
  }

  lines.push('', `### 표 3. 실제 시간 진행 (초보 모델, ${options.realDays}일 × ${options.realtimeRuns}회, 접속하면 체력이 바닥날 때까지 플레이)`, '');
  lines.push('보수적으로 초보 모델만 씁니다. 굵은 줄이 현재 메인 값입니다.', '');
  lines.push('| 하루 주문 | 체력 최대 | 회복 | 하루 2회 접속: 주문 / Day | 하루 4회 접속: 주문 / Day | 첫 대회까지 (2회 / 4회) | 목표 소진 실제 일 (2회 / 4회) | 목표 소진 Day |', '|---|---|---|---|---|---|---|---|');
  for (const target of [2, 3, 5]) {
    for (const cap of [30, 40]) {
      for (const recovery of [10, 6]) {
        const [two, four] = Object.values(SESSION_PATTERNS).map((hours) => simulateRealtime({ orderTarget: target, energyCap: cap, recoveryMinutes: recovery, skill: 'novice', sessionHours: hours, realDays: options.realDays, runs: options.realtimeRuns }));
        const current = target === CURRENT_LIMIT.orderTarget && cap === CURRENT_LIMIT.energyCap && recovery === CURRENT_LIMIT.recoveryMinutes;
        const b = current ? '**' : '';
        lines.push(`| ${b}${target}건${b} | ${b}${cap}${b} | ${b}${recovery}분${b} | ${fixed(two.ordersPerRealDay)} / ${fixed(two.gameDaysPerRealDay)} | ${fixed(four.ordersPerRealDay)} / ${fixed(four.gameDaysPerRealDay)} | ${fixed(two.firstRaceRealDay)}일 / ${fixed(four.firstRaceRealDay)}일 | ${fixed(two.goalsExhaustedRealDay)}일 / ${fixed(four.goalsExhaustedRealDay)}일 | Day ${fixed(two.goalsExhaustedGameDay)} |`);
      }
    }
  }

  lines.push('', '### 표 4. 대회: 대표 자전거 성능별 순위 확률 (리버사이드 3K, 400회)', '');
  lines.push('| 성능·스타일·희귀도 | 성장 단계 | 1위 | 시상대(3위 이내) | 기대 상금(현행) |', '|---|---|---|---|---|');
  for (const [성능, 스타일, 희귀도] of RACE_STAT_SAMPLES) {
    const stats: BikeStats = { 성능, 스타일, 희귀도 };
    const odds = raceOdds(stats);
    lines.push(`| ${성능}·${스타일}·${희귀도} | ${dreamStage(stats)} | ${percent(odds.winRate)} | ${percent(odds.podiumRate)} | ${coins(odds.expectedReward)} |`);
  }

  lines.push('', `### 표 5. 대회 참가비·상금 후보 (현행 하루 주문 3건 · 체력 30 · 10분, 하루 2회 접속, ${options.realDays}일)`, '');
  lines.push('| 후보 | 플레이어 | 참가 횟수 | 시상대 비율 | 대회 순수익 합계 | 기간 끝 코인 |', '|---|---|---|---|---|---|');
  for (const candidate of RACE_CANDIDATES) {
    for (const skill of ['expert', 'novice'] as const) {
      const r = simulateRealtime({ ...CURRENT_LIMIT, skill, sessionHours: SESSION_PATTERNS['하루 2회'], realDays: options.realDays, runs: options.realtimeRuns, race: candidate.meta });
      lines.push(`| ${candidate.label} | ${skill === 'expert' ? '숙련' : '초보'} | ${fixed(r.racesEntered)} | ${percent(r.racePodiumRate)} | ${coins(r.raceNet)} | ${coins(r.coinsAtEnd)} |`);
    }
  }
  // 표 8: 주문 풀 확장(#266). 체력은 작업량에 비례한다고 보고, 초보 모델의 현행 3종 평균으로 비율을 맞춥니다.
  const perUnit = mean(workbench.novice.energyPerOrder) / CURRENT_AVG_UNITS;
  lines.push('', '### 표 8. 주문 풀·도감 해금 방안별 진행 속도 (#266)', '');
  lines.push(`코인을 제작 → 강화 순서로 바로 쓰는 플레이어. 주문 체력 = 작업량 × ${fixed(perUnit, 2)}(초보 모델 현행 평균 기준), 실제 일수는 하루 2회 접속(체력 60)으로 계산합니다. 작업대 플레이는 생략하고 주문 단위로 계산합니다.`, '');
  lines.push('| 방안 | 주문으로 얻는 자전거 | 도감 등록 10대 | 전부 등록 | 보유 10대 | 목표 소진 (Day / 실제 일) | 소진까지 주문 | Day 30 코인 | 주문당 체력 |', '|---|---|---|---|---|---|---|---|---|');
  const dayOf = (value: number | null) => (value === null ? '-' : `Day ${value}`);
  for (const variant of ['cycle', 'tiers', 'board', 'regulars'] as PoolVariant[]) {
    const r = simulatePool(variant, { perUnit });
    lines.push(`| ${POOL_VARIANT_LABELS[variant]} | ${orderableBikeCount(variant)}대 | ${dayOf(r.daysTo10Registered)} | ${dayOf(r.daysToAllRegistered)} | ${dayOf(r.daysTo10Owned)} | ${dayOf(r.goalsExhaustedDay)} / ${r.goalsExhaustedRealDay ?? '-'}일 | ${r.ordersToExhaust ?? '-'}건 | ${coins(r.coinsAtDay30)} | ${fixed(r.avgEnergyPerOrder, 2)} |`);
  }
  // 표 9: 대회 난이도·보상 곡선(#267). 주문 풀 A안으로 성장하며 5 Day마다 대회에 나가는 60 Day 시즌
  lines.push('', '### 표 9. 대회 난이도·보상 방안별 시즌 결과 (#267, 60 Day = 대회 12회)', '');
  lines.push('주문 풀 A안으로 성장하며 다음 대회 참가비만 남기고 코인을 제작·강화에 씁니다. 출전 전 확률은 같은 조건에서 시드 120개로 잰 값이고, 결과가 정해지지 않은 대회는 우승 또는 시상대 확률이 15~85%인 대회입니다.', '');
  lines.push('| 방안 | 우승 | 시상대 | 결과가 정해지지 않은 대회 | 대회 순수익 | 아이템 코인 환산 | 비고 |', '|---|---|---|---|---|---|---|');
  for (const variant of ['current', 'league', 'course', 'rewards'] as SeasonVariant[]) {
    const r = simulateSeason(variant);
    const note = r.finalTier ? `최종 등급 ${r.finalTier}` : r.courseMatchRate !== undefined ? `코스 맞춤 자전거 출전 ${percent(r.courseMatchRate)}` : r.dreamUnlockDay ? `드림 머신 등록 Day ${r.dreamUnlockDay}` : `첫 대회부터 우승 확률 95% 이상`;
    lines.push(`| ${SEASON_LABELS[variant]} | ${percent(r.winRate)} | ${percent(r.podiumRate)} | ${percent(r.uncertainRate)} | ${coins(r.netCoins)} | ${coins(r.itemCoins)} | ${note} |`);
  }
  return lines.join('\n');
}

