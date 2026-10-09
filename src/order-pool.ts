// 주문 풀 확장과 도감 자전거 해금 경로 (#266 · 순수 로직, Phaser·DOM 비의존)
// 현행(메인 dc3517e)은 주문 3종이 같은 순서로 반복되어, 도감 24대 중 주문으로 얻는 자전거가 3대뿐이고
// 실제 약 3일이면 모든 목표가 끝납니다(#262). 이 모듈은 도감의 일반 자전거 20대를 주문으로 잇는 데이터와
// 세 가지 공개 방식, 진행 속도 시뮬레이션을 담습니다. 수치는 후보값이며 확정은 메인에서 합니다.
import { CATALOG_BIKES, catalogBikeById } from './bike-catalog';
import {
  DREAM_STAT_KEYS, DREAM_STAT_MAX_LEVEL, UNDERSTANDING_MAX, applyBikeDelivery, applyBikeUpgrade, applyCraftPart,
  bikeStats, bikeUnderstanding, createCollectionProgress, createGrowthProgress, isBikeCrafted, isBikeRegistered, nextCraftPart,
  type CollectionProgress, type GrowthProgress,
} from './meta-progress';
import type { BikeCategory } from './bike-pixel-sprite';

export type PoolGrade = '입문' | '중급' | '고급';
/** 부품별 요구 레벨 [프레임, 휠셋, 구동계, 핸들바] */
export type PartLevels = readonly [number, number, number, number];
export type PoolOrder = {
  id: string;
  name: string;
  bikeId: string;
  category: BikeCategory;
  grade: PoolGrade;
  levels: PartLevels;
  reward: number;
  /** A안: 이 Day부터 주문 풀에 들어옵니다. */
  unlockDay: number;
};

/** 부품 레벨을 Lv.1 개수로 환산한 작업량(Lv.n = 2^(n-1)개) */
export const workUnits = (levels: PartLevels) => levels.reduce((sum, level) => sum + 2 ** (level - 1), 0);

// 주문 풀: 도감 24대 중 시작 자전거(나의 드림 로드바이크)와 드림 등급 3대(승급 보상 후보)를 뺀 20대.
// 처음 3종은 현행 메인 주문과 같은 값(첫날 학습 순서 유지). 보상은 등급 기준(입문 1,000 · 중급 1,400 · 고급 1,800, Lv.4 요구 시 +200).
export const ORDER_POOL: readonly PoolOrder[] = [
  { id: 'urban-road', name: '통학용 어반 로드', bikeId: 'urban-road', category: 'city', grade: '입문', levels: [2, 2, 1, 1], reward: 1000, unlockDay: 1 },
  { id: 'trail-mtb', name: '트레일 MTB', bikeId: 'trail-mtb', category: 'mtb', grade: '중급', levels: [3, 2, 2, 1], reward: 1400, unlockDay: 1 },
  { id: 'aero-sprinter', name: '엔듀런스 로드', bikeId: 'aero-sprinter', category: 'road', grade: '고급', levels: [2, 3, 2, 2], reward: 1800, unlockDay: 1 },
  // 입문 확장 (Day 3)
  { id: 'touring-road', name: '주말 투어링 로드', bikeId: 'touring-road', category: 'road', grade: '입문', levels: [2, 1, 2, 1], reward: 1000, unlockDay: 3 },
  { id: 'hardtail-mtb', name: '동네 산길 하드테일', bikeId: 'hardtail-mtb', category: 'mtb', grade: '입문', levels: [2, 2, 1, 1], reward: 1000, unlockDay: 3 },
  { id: 'allroad-gravel', name: '강변 올로드 그래블', bikeId: 'allroad-gravel', category: 'gravel', grade: '입문', levels: [1, 2, 2, 1], reward: 1000, unlockDay: 3 },
  { id: 'singlespeed-gravel', name: '싱글스피드 그래블', bikeId: 'singlespeed-gravel', category: 'gravel', grade: '입문', levels: [2, 2, 1, 1], reward: 1000, unlockDay: 3 },
  { id: 'city-mini', name: '장보기 시티 미니벨로', bikeId: 'city-mini', category: 'minivelo', grade: '입문', levels: [1, 2, 1, 2], reward: 1000, unlockDay: 3 },
  { id: 'folding-mini', name: '지하철 폴딩 미니벨로', bikeId: 'folding-mini', category: 'minivelo', grade: '입문', levels: [2, 1, 1, 2], reward: 1000, unlockDay: 3 },
  // 중급 확장 (Day 6)
  { id: 'classic-randonneur', name: '클래식 랜도너', bikeId: 'classic-randonneur', category: 'road', grade: '중급', levels: [2, 3, 2, 1], reward: 1400, unlockDay: 6 },
  { id: 'xc-mtb', name: '크로스컨트리 MTB', bikeId: 'xc-mtb', category: 'mtb', grade: '중급', levels: [3, 2, 1, 2], reward: 1400, unlockDay: 6 },
  { id: 'fat-bike', name: '겨울 눈길 팻바이크', bikeId: 'fat-bike', category: 'mtb', grade: '중급', levels: [2, 3, 1, 2], reward: 1400, unlockDay: 6 },
  { id: 'gravel-explorer', name: '그래블 익스플로러', bikeId: 'gravel-explorer', category: 'gravel', grade: '중급', levels: [3, 2, 2, 1], reward: 1400, unlockDay: 6 },
  { id: 'bikepacking-gravel', name: '캠핑 백패킹 그래블', bikeId: 'bikepacking-gravel', category: 'gravel', grade: '중급', levels: [2, 2, 2, 2], reward: 1400, unlockDay: 6 },
  { id: 'cargo-mini', name: '배달용 카고 미니벨로', bikeId: 'cargo-mini', category: 'minivelo', grade: '중급', levels: [3, 2, 1, 2], reward: 1400, unlockDay: 6 },
  { id: 'classic-mini', name: '클래식 미니벨로', bikeId: 'classic-mini', category: 'minivelo', grade: '중급', levels: [2, 2, 2, 2], reward: 1400, unlockDay: 6 },
  // 고급 확장 (Day 10)
  { id: 'enduro-mtb', name: '엔듀로 MTB', bikeId: 'enduro-mtb', category: 'mtb', grade: '고급', levels: [3, 3, 2, 2], reward: 1800, unlockDay: 10 },
  { id: 'downhill-mtb', name: '다운힐 MTB', bikeId: 'downhill-mtb', category: 'mtb', grade: '고급', levels: [4, 2, 2, 1], reward: 2000, unlockDay: 10 },
  { id: 'adventure-gravel', name: '어드벤처 그래블', bikeId: 'adventure-gravel', category: 'gravel', grade: '고급', levels: [3, 3, 2, 2], reward: 1800, unlockDay: 10 },
  { id: 'tour-mini', name: '장거리 투어 미니벨로', bikeId: 'tour-mini', category: 'minivelo', grade: '고급', levels: [2, 3, 3, 2], reward: 1800, unlockDay: 10 },
];

export const CURRENT_ORDER_IDS = ['urban-road', 'trail-mtb', 'aero-sprinter'] as const;
export const ORDERS_PER_DAY = 3;
export const BOARD_SIZE = 5;

export const poolOrder = (id: string) => ORDER_POOL.find((order) => order.id === id);

/** C안 단골 손님: 연속 주문 3건을 마치면 마지막 자전거를 바로 도감 등록(이야기 보상) */
export type RegularCustomer = { id: string; name: string; story: string; orderIds: readonly [string, string, string]; arriveDay: number };
export const REGULAR_CUSTOMERS: readonly RegularCustomer[] = [
  { id: 'courier', name: '배달 기사 민수', story: '골목 배달을 시작했어요. 가벼운 것부터 짐을 싣는 자전거까지!', orderIds: ['city-mini', 'folding-mini', 'cargo-mini'], arriveDay: 2 },
  { id: 'travel', name: '여행 동호회 지안', story: '강변 라이딩에서 시작해 캠핑 여행까지 가 보려고요.', orderIds: ['allroad-gravel', 'gravel-explorer', 'bikepacking-gravel'], arriveDay: 4 },
  { id: 'mountain', name: '산악회 태호', story: '동네 산길부터 겨울 눈길까지 같이 달려요.', orderIds: ['hardtail-mtb', 'xc-mtb', 'fat-bike'], arriveDay: 6 },
  { id: 'randonneur', name: '랜도너 클럽 서윤', story: '주말 투어에서 장거리 랜도너까지 준비 중이에요.', orderIds: ['touring-road', 'classic-randonneur', 'tour-mini'], arriveDay: 8 },
];

export type PoolVariant = 'cycle' | 'tiers' | 'board' | 'regulars';
export const POOL_VARIANT_LABELS: Record<PoolVariant, string> = {
  cycle: '현행(주문 3종 순환)',
  tiers: 'A안 등급 단계 확장',
  board: 'B안 주문 게시판',
  regulars: 'C안 단골 손님',
};

// ── 진행 상태 ──
export type PoolState = {
  variant: PoolVariant;
  day: number;
  coins: number;
  collection: CollectionProgress;
  growth: GrowthProgress;
  deliveredById: Record<string, number>;
  ordersDelivered: number;
  // 오늘 일정: 남은 주문 id(앞에서부터 처리). B안은 게시판에서 고르기 전까지 비어 있습니다.
  today: string[];
  board: string[];
  // C안: 단골 손님별 다음 주문 위치(0~3, 3이면 완료)
  regularStep: Record<string, number>;
  cycleIndex: number;
};

export function createPoolState(variant: PoolVariant): PoolState {
  const state: PoolState = {
    variant, day: 1, coins: 0, collection: createCollectionProgress(), growth: createGrowthProgress(),
    deliveredById: {}, ordersDelivered: 0, today: [], board: [], regularStep: {}, cycleIndex: 0,
  };
  planDay(state);
  return state;
}

/** 이 Day에 주문 풀에 들어와 있는 주문 */
export function availableOrders(state: Pick<PoolState, 'variant' | 'day'>): PoolOrder[] {
  if (state.variant === 'cycle') return CURRENT_ORDER_IDS.map((id) => poolOrder(id)!);
  return ORDER_POOL.filter((order) => order.unlockDay <= state.day);
}

// 고르는 순서: 아직 도감 등록 전인 자전거(이해도 높은 것 먼저 → 끝내기 쉬운 쪽) → 납품이 적은 주문 → 풀 순서.
function priority(state: PoolState, orders: PoolOrder[]): PoolOrder[] {
  return [...orders].sort((a, b) => {
    const ra = isBikeRegistered(state.collection, a.bikeId) ? 1 : 0;
    const rb = isBikeRegistered(state.collection, b.bikeId) ? 1 : 0;
    if (ra !== rb) return ra - rb;
    const ua = bikeUnderstanding(state.collection, a.bikeId), ub = bikeUnderstanding(state.collection, b.bikeId);
    if (ua !== ub) return ub - ua;
    const da = state.deliveredById[a.id] ?? 0, db = state.deliveredById[b.id] ?? 0;
    if (da !== db) return da - db;
    return ORDER_POOL.indexOf(a) - ORDER_POOL.indexOf(b);
  });
}

/** 지금 손님이 와 있는 단골(C안). 도착 Day가 지났고 연속 주문이 남은 첫 손님 */
export function activeRegular(state: PoolState): RegularCustomer | undefined {
  if (state.variant !== 'regulars') return undefined;
  return REGULAR_CUSTOMERS.find((customer) => customer.arriveDay <= state.day && (state.regularStep[customer.id] ?? 0) < 3);
}

/** Day 시작 때 오늘 주문(또는 B안 게시판 후보)을 정합니다. 같은 상태면 항상 같은 결과입니다. */
export function planDay(state: PoolState) {
  state.today = [];
  state.board = [];
  if (state.variant === 'cycle') {
    for (let i = 0; i < ORDERS_PER_DAY; i += 1) state.today.push(CURRENT_ORDER_IDS[(state.cycleIndex + i) % CURRENT_ORDER_IDS.length]);
    return;
  }
  const ranked = priority(state, availableOrders(state));
  if (state.variant === 'board') {
    state.board = ranked.slice(0, BOARD_SIZE).map((order) => order.id);
    return;
  }
  const regular = activeRegular(state);
  if (regular) state.today.push(regular.orderIds[state.regularStep[regular.id] ?? 0]);
  for (const order of ranked) {
    if (state.today.length >= ORDERS_PER_DAY) break;
    // 단골 손님이 와 있는 동안 그 손님의 주문은 손님 순서로만 받습니다. 연속 주문을 마치면 일반 주문으로 돌아옵니다.
    if (state.variant === 'regulars' && REGULAR_CUSTOMERS.some((c) => c.orderIds.includes(order.id) && c.arriveDay <= state.day && (state.regularStep[c.id] ?? 0) < 3)) continue;
    if (!state.today.includes(order.id)) state.today.push(order.id);
  }
}

/** B안: 게시판 후보 중 3건을 고릅니다. 후보가 아닌 id나 개수가 맞지 않으면 false */
export function chooseFromBoard(state: PoolState, ids: string[]): boolean {
  const unique = [...new Set(ids)];
  if (state.variant !== 'board' || unique.length !== ORDERS_PER_DAY || !unique.every((id) => state.board.includes(id))) return false;
  state.today = unique;
  state.board = [];
  return true;
}

/** B안 시뮬레이션 정책: 도감 등록 전 우선, 같으면 보상 ÷ 작업량이 큰 주문 */
export function autoChooseBoard(state: PoolState): string[] {
  const candidates = state.board.map((id) => poolOrder(id)!);
  return [...candidates]
    .sort((a, b) => (Number(isBikeRegistered(state.collection, a.bikeId)) - Number(isBikeRegistered(state.collection, b.bikeId)))
      || b.reward / workUnits(b.levels) - a.reward / workUnits(a.levels))
    .slice(0, ORDERS_PER_DAY)
    .map((order) => order.id);
}

export type DeliveryResult = { order: PoolOrder; registeredNow: boolean; storyUnlock?: string; dayFinished: boolean };

/** 오늘 일정의 다음 주문 1건을 납품합니다(작업대 플레이는 생략). 오늘 3건을 마치면 다음 Day를 준비합니다. */
export function deliverNext(state: PoolState): DeliveryResult | null {
  const id = state.today[0];
  const order = id ? poolOrder(id) : undefined;
  if (!order) return null;
  state.today.shift();
  state.coins += order.reward;
  state.ordersDelivered += 1;
  state.deliveredById[order.id] = (state.deliveredById[order.id] ?? 0) + 1;
  if (state.variant === 'cycle') state.cycleIndex += 1;
  const result = applyBikeDelivery(state.collection, order.bikeId);
  let storyUnlock: string | undefined;
  const regular = REGULAR_CUSTOMERS.find((c) => state.variant === 'regulars' && c.orderIds[state.regularStep[c.id] ?? 0] === order.id && c.arriveDay <= state.day);
  if (regular) {
    const step = (state.regularStep[regular.id] ?? 0) + 1;
    state.regularStep[regular.id] = step;
    // 연속 주문 3건을 마치면 마지막 자전거를 이야기 보상으로 바로 등록합니다.
    if (step >= 3) {
      const last = poolOrder(regular.orderIds[2])!.bikeId;
      if (!isBikeRegistered(state.collection, last)) {
        state.collection.understandingByBikeId[last] = UNDERSTANDING_MAX;
        state.collection.registeredBikeIds.push(last);
        storyUnlock = last;
      }
    }
  }
  const dayFinished = state.today.length === 0;
  if (dayFinished) {
    state.day += 1;
    planDay(state);
  }
  return { order, registeredNow: result.registeredNow, storyUnlock, dayFinished };
}

// ── 목표와 코인 사용 ──
export type PoolGoal = { kind: 'craft'; bikeId: string } | { kind: 'understand'; bikeId: string } | { kind: 'upgrade'; bikeId: string } | { kind: 'repeat' };

/** 홈 NEXT GOAL과 같은 우선순위(제작 → 이해도 → 강화)를 이 방안의 전체 주문 풀 기준으로 계산합니다. */
export function nextPoolGoal(state: PoolState): PoolGoal {
  const craft = state.collection.registeredBikeIds.find((id) => !isBikeCrafted(state.collection, id));
  if (craft) return { kind: 'craft', bikeId: craft };
  const pool = state.variant === 'cycle' ? availableOrders(state) : ORDER_POOL;
  const study = pool.find((order) => !isBikeRegistered(state.collection, order.bikeId));
  if (study) return { kind: 'understand', bikeId: study.bikeId };
  const upgrade = state.collection.craftedBikeIds.find((id) => DREAM_STAT_KEYS.some((key) => bikeStats(state.growth, id)[key] < DREAM_STAT_MAX_LEVEL));
  if (upgrade) return { kind: 'upgrade', bikeId: upgrade };
  return { kind: 'repeat' };
}

/** 코인을 제작 → 강화 순서로 바로 씁니다. */
export function spendCoins(state: PoolState) {
  for (let guard = 0; guard < 200; guard += 1) {
    const craftTarget = state.collection.registeredBikeIds.find((id) => !isBikeCrafted(state.collection, id));
    if (craftTarget) {
      const part = nextCraftPart(state.collection, craftTarget);
      const result = part ? applyCraftPart(state.collection, state.coins, craftTarget, part.type) : null;
      if (!result?.ok) return;
      state.coins = result.coins;
      continue;
    }
    const upgradeTarget = state.collection.craftedBikeIds.find((id) => DREAM_STAT_KEYS.some((key) => bikeStats(state.growth, id)[key] < DREAM_STAT_MAX_LEVEL));
    if (!upgradeTarget) return;
    const stats = bikeStats(state.growth, upgradeTarget);
    const stat = DREAM_STAT_KEYS.filter((key) => stats[key] < DREAM_STAT_MAX_LEVEL).reduce((low, key) => (stats[key] < stats[low] ? key : low));
    const result = applyBikeUpgrade(state.collection, state.growth, state.coins, upgradeTarget, stat);
    if (!result.ok) return;
    state.coins = result.coins;
    state.growth = result.growth;
  }
}

// ── 진행 속도 시뮬레이션 ──
/**
 * 주문 작업량 → 체력 환산 모델: 체력 = 작업량 × perUnit.
 * 주문마다 남은 부품이 다음 주문을 돕기 때문에 주문 종류별 체력은 들쭉날쭉합니다. 그래서 개별 주문이 아니라
 * #262 작업대 시뮬레이터(초보 모델)의 현행 3종 평균 체력 ÷ 평균 작업량으로 비율 하나만 맞춥니다.
 */
export type EnergyModel = { perUnit: number };
export const energyPerOrder = (model: EnergyModel, levels: PartLevels) => model.perUnit * workUnits(levels);
export const CURRENT_AVG_UNITS = CURRENT_ORDER_IDS.reduce((sum, id) => sum + workUnits(poolOrder(id)!.levels), 0) / CURRENT_ORDER_IDS.length;

export type PoolSimResult = {
  variant: PoolVariant;
  daysTo10Registered: number | null;
  daysToAllRegistered: number | null;
  daysTo10Owned: number | null;
  goalsExhaustedDay: number | null;
  goalsExhaustedRealDay: number | null;
  ordersToExhaust: number | null;
  coinsAtDay30: number;
  avgEnergyPerOrder: number;
  registeredAtDay30: number;
  ownedAtDay30: number;
};

/**
 * 방안별로 코인을 바로 쓰며 주문을 납품했을 때의 진행 속도.
 * 실제 일수는 하루 체력 예산(기본: 하루 2회 접속 × 체력 30)을 주문별 체력으로 나눠 계산합니다.
 */
export function simulatePool(variant: PoolVariant, model: EnergyModel, options: { maxDays?: number; dailyEnergy?: number } = {}): PoolSimResult {
  const maxDays = options.maxDays ?? 120;
  const dailyEnergy = options.dailyEnergy ?? 60;
  const state = createPoolState(variant);
  let energyUsed = 0;
  let realDay = 1, budget = dailyEnergy;
  const result: PoolSimResult = {
    variant, daysTo10Registered: null, daysToAllRegistered: null, daysTo10Owned: null, goalsExhaustedDay: null, goalsExhaustedRealDay: null,
    ordersToExhaust: null, coinsAtDay30: 0, avgEnergyPerOrder: 0, registeredAtDay30: 0, ownedAtDay30: 0,
  };
  const orderable = variant === 'cycle' ? CURRENT_ORDER_IDS.length : ORDER_POOL.length;
  for (let guard = 0; guard < maxDays * ORDERS_PER_DAY + 10 && state.day <= maxDays; guard += 1) {
    if (variant === 'board' && state.today.length === 0) chooseFromBoard(state, autoChooseBoard(state));
    const order = poolOrder(state.today[0]);
    if (!order) break;
    const cost = energyPerOrder(model, order.levels);
    while (budget < cost) { realDay += 1; budget += dailyEnergy; }
    budget -= cost;
    energyUsed += cost;
    const dayBefore = state.day;
    deliverNext(state);
    spendCoins(state);
    const registered = state.collection.registeredBikeIds.length - 1; // 시작 자전거 제외
    const owned = state.collection.craftedBikeIds.length - 1;
    if (result.daysTo10Registered === null && registered >= 10) result.daysTo10Registered = dayBefore;
    if (result.daysToAllRegistered === null && registered >= orderable) result.daysToAllRegistered = dayBefore;
    if (result.daysTo10Owned === null && owned >= 10) result.daysTo10Owned = dayBefore;
    if (result.goalsExhaustedDay === null && nextPoolGoal(state).kind === 'repeat') {
      result.goalsExhaustedDay = dayBefore;
      result.goalsExhaustedRealDay = realDay;
      result.ordersToExhaust = state.ordersDelivered;
    }
    if (dayBefore === 30 && state.day === 31) {
      result.coinsAtDay30 = state.coins;
      result.registeredAtDay30 = registered;
      result.ownedAtDay30 = owned;
    }
  }
  result.avgEnergyPerOrder = state.ordersDelivered ? energyUsed / state.ordersDelivered : 0;
  return result;
}

/** 이 방안에서 주문으로 얻을 수 있는 도감 자전거 수(시작 자전거 제외) */
export function orderableBikeCount(variant: PoolVariant) {
  return variant === 'cycle' ? CURRENT_ORDER_IDS.length : ORDER_POOL.length;
}

/** 주문 풀 데이터가 카탈로그와 맞는지(테스트용): 모든 주문 자전거가 카탈로그에 있고 중복이 없음 */
export function poolCatalogIssues(): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  for (const order of ORDER_POOL) {
    if (!catalogBikeById(order.bikeId)) issues.push(`카탈로그에 없는 자전거: ${order.bikeId}`);
    if (ids.has(order.bikeId)) issues.push(`중복 자전거: ${order.bikeId}`);
    ids.add(order.bikeId);
    if (order.levels.some((level) => level < 1 || level > 4)) issues.push(`요구 레벨 범위 밖: ${order.id}`);
  }
  const missing = CATALOG_BIKES.filter((bike) => bike.grade !== '드림' && bike.id !== 'dream-road' && !ids.has(bike.id));
  missing.forEach((bike) => issues.push(`주문 풀에 없는 일반 자전거: ${bike.id}`));
  return issues;
}
