// 메타 루프 진행 로직 (순수 로직 · Phaser 비의존) — #200 트랙
// 주문 완료 → 컬렉션 해금(#201), 컬렉션 진행 저장·복구(#204),
// 드림 바이크 성장·코인 소비(#203)의 데이터 규칙을 화면 코드와 분리해 단위 테스트 가능하게 관리합니다.

import { catalogBikeById, type CatalogBike } from './bike-catalog';

// ── 주문 메타: merge-prototype의 ORDERS(부품 목표)와 인덱스로 1:1 대응 ──
// 주문 3(엔듀런스 로드)은 데이터만 정의하며, 주문 순환 활성화는 #205에서 진행합니다.
export type OrderBikeCategory = 'city' | 'mtb' | 'road';
export type OrderMeta = {
  orderIndex: number;
  name: string;
  bikeCategory: OrderBikeCategory;
  reward: number;
  unlockBikeId: string;
};

export const ORDER_METAS: OrderMeta[] = [
  { orderIndex: 0, name: '통학용 어반 로드', bikeCategory: 'city', reward: 1000, unlockBikeId: 'urban-road' },
  { orderIndex: 1, name: '트레일 MTB', bikeCategory: 'mtb', reward: 1400, unlockBikeId: 'trail-mtb' },
  { orderIndex: 2, name: '엔듀런스 로드', bikeCategory: 'road', reward: 1800, unlockBikeId: 'aero-sprinter' },
];

export function orderMetaAt(orderIndex: number): OrderMeta | undefined {
  return ORDER_METAS[orderIndex];
}

// ── 컬렉션 진행 상태 ──
// 시작 보유는 Garage 대표 자전거 1대뿐이며, 나머지는 주문 납품으로만 해금됩니다.
export const INITIAL_OWNED_BIKE_IDS: readonly string[] = ['dream-road'];

export type CollectionProgress = {
  ownedBikeIds: string[];
  // 해금 후 아직 도감에서 확인하지 않은 신규 발견 자전거
  newBikeIds: string[];
  selectedBikeId: string;
  showcaseSlots: Array<string | null>;
};

export function createCollectionProgress(): CollectionProgress {
  return {
    ownedBikeIds: [...INITIAL_OWNED_BIKE_IDS],
    newBikeIds: [],
    selectedBikeId: INITIAL_OWNED_BIKE_IDS[0],
    showcaseSlots: [INITIAL_OWNED_BIKE_IDS[0], null, null],
  };
}

export type OrderUnlockResult = {
  unlockedBike?: CatalogBike;
  // 이번 주문으로 처음 해금됐는지 여부 — 같은 주문 반복 시 false (중복 누적 방지)
  isNew: boolean;
};

// 주문 완료 결과를 컬렉션에 반영합니다. 알 수 없는 주문·자전거 ID는 변화 없이 무시합니다.
export function applyOrderUnlock(progress: CollectionProgress, orderIndex: number): OrderUnlockResult {
  const meta = orderMetaAt(orderIndex);
  if (!meta) return { isNew: false };
  const bike = catalogBikeById(meta.unlockBikeId);
  if (!bike) return { isNew: false };
  if (progress.ownedBikeIds.includes(bike.id)) return { unlockedBike: bike, isNew: false };
  progress.ownedBikeIds.push(bike.id);
  if (!progress.newBikeIds.includes(bike.id)) progress.newBikeIds.push(bike.id);
  return { unlockedBike: bike, isNew: true };
}

// 도감에서 신규 자전거를 확인하면 NEW 표시를 해제합니다.
export function markBikeSeen(progress: CollectionProgress, bikeId: string) {
  progress.newBikeIds = progress.newBikeIds.filter((id) => id !== bikeId);
}

export function ownedBikeCount(progress: CollectionProgress): number {
  return new Set(progress.ownedBikeIds).size;
}

// ── 컬렉션 진행 저장·복구 (#204) ──
// localStorage 접근은 호출 측(컨트롤러)이 담당하고, 이 모듈은 직렬화·검증·마이그레이션 규칙만 가집니다.

export const COLLECTION_STORAGE_KEY = 'dbg-lab-meta-collection';
export const COLLECTION_SCHEMA_VERSION = 1;
const SHOWCASE_SLOT_COUNT = 3;

type SavedCollection = { version: number } & Partial<CollectionProgress>;

export function serializeCollectionProgress(progress: CollectionProgress): string {
  return JSON.stringify({ version: COLLECTION_SCHEMA_VERSION, ...progress } satisfies SavedCollection);
}

// 저장 원본이 없거나(JSON 손상 포함) 스키마 버전이 다르면 기본값으로 복구합니다.
// 버전이 맞아도 필드 단위로 검증해 삭제된 자전거 ID·중복·형식 이상을 방어합니다.
export function parseCollectionProgress(raw: string | null | undefined): CollectionProgress {
  if (!raw) return createCollectionProgress();
  let saved: unknown;
  try {
    saved = JSON.parse(raw);
  } catch {
    return createCollectionProgress();
  }
  if (typeof saved !== 'object' || saved === null) return createCollectionProgress();
  const data = saved as SavedCollection;
  // 알 수 없는 구버전·신버전 스키마는 마이그레이션 규칙이 생길 때까지 기본값으로 시작합니다
  if (data.version !== COLLECTION_SCHEMA_VERSION) return createCollectionProgress();
  return sanitizeCollectionProgress(data);
}

// 저장 데이터의 비정상 값(미등록 ID, 중복, 잘못된 슬롯 수, 미보유 전시 등)을 안전한 값으로 보정합니다.
export function sanitizeCollectionProgress(data: Partial<CollectionProgress>): CollectionProgress {
  const fallback = createCollectionProgress();

  const ownedRaw = Array.isArray(data.ownedBikeIds) ? data.ownedBikeIds : fallback.ownedBikeIds;
  const owned = [...new Set(ownedRaw)].filter((id): id is string => typeof id === 'string' && Boolean(catalogBikeById(id)));
  // 시작 보유 자전거는 항상 유지해 빈 컬렉션으로 인한 진행 불가를 막습니다
  INITIAL_OWNED_BIKE_IDS.forEach((id) => { if (!owned.includes(id)) owned.unshift(id); });

  const newRaw = Array.isArray(data.newBikeIds) ? data.newBikeIds : [];
  const news = [...new Set(newRaw)].filter((id): id is string => typeof id === 'string' && owned.includes(id));

  const selected = typeof data.selectedBikeId === 'string' && catalogBikeById(data.selectedBikeId)
    ? data.selectedBikeId
    : owned[0];

  const slotsRaw = Array.isArray(data.showcaseSlots) ? data.showcaseSlots : fallback.showcaseSlots;
  const slots = Array.from({ length: SHOWCASE_SLOT_COUNT }, (_, index) => {
    const slot = slotsRaw[index];
    return typeof slot === 'string' && owned.includes(slot) ? slot : null;
  });

  return { ownedBikeIds: owned, newBikeIds: news, selectedBikeId: selected, showcaseSlots: slots };
}

// ── 드림 바이크 성장 (#203) ──
// 기존 C안 화면의 강화 규칙(파츠 3종 · Lv.1~4 · 비용 350×레벨 · 합계 7/10에서 등급 상승)을
// 화면 내부 값에서 분리해, 코인 차감과 강화 반영을 하나의 원자적 처리로 관리합니다.

export type DreamStatKey = '성능' | '스타일' | '희귀도';
export const DREAM_STAT_KEYS: DreamStatKey[] = ['성능', '스타일', '희귀도'];
export const DREAM_STAT_MIN_LEVEL = 1;
export const DREAM_STAT_MAX_LEVEL = 4;

export type DreamGrowth = {
  targetBikeId: string;
  stats: Record<DreamStatKey, number>;
};

export function createDreamGrowth(): DreamGrowth {
  return { targetBikeId: 'dream-road', stats: { 성능: 1, 스타일: 1, 희귀도: 1 } };
}

// 강화 비용: 현재 레벨 × 350 (명시적 데이터 — 밸런스 확정은 메인 담당)
export function dreamUpgradeCost(level: number): number {
  return 350 * level;
}

export function dreamTotalLevel(growth: DreamGrowth): number {
  return DREAM_STAT_KEYS.reduce((sum, key) => sum + growth.stats[key], 0);
}

// 종합 성장 단계: 합계 10 이상 = 3단계(드림), 7 이상 = 2단계(고급), 그 외 1단계(중급)
export function dreamStage(growth: DreamGrowth): 1 | 2 | 3 {
  const total = dreamTotalLevel(growth);
  return total >= 10 ? 3 : total >= 7 ? 2 : 1;
}

export function dreamGradeName(growth: DreamGrowth): '중급' | '고급' | '드림' {
  const stage = dreamStage(growth);
  return stage === 3 ? '드림' : stage === 2 ? '고급' : '중급';
}

export type DreamUpgradeResult =
  | { ok: true; coins: number; growth: DreamGrowth; upgradedTo: number; stageUp: boolean }
  | { ok: false; reason: 'coins' | 'max'; coins: number; growth: DreamGrowth };

// 코인 차감과 레벨 상승을 함께 계산해 반환합니다. 실패 시 어느 쪽도 변하지 않습니다(원자적 처리).
export function applyDreamUpgrade(growth: DreamGrowth, coins: number, stat: DreamStatKey): DreamUpgradeResult {
  const level = growth.stats[stat];
  if (level >= DREAM_STAT_MAX_LEVEL) return { ok: false, reason: 'max', coins, growth };
  const cost = dreamUpgradeCost(level);
  if (coins < cost) return { ok: false, reason: 'coins', coins, growth };
  const beforeStage = dreamStage(growth);
  const next: DreamGrowth = { ...growth, stats: { ...growth.stats, [stat]: level + 1 } };
  return { ok: true, coins: coins - cost, growth: next, upgradedTo: level + 1, stageUp: dreamStage(next) > beforeStage };
}

// ── 드림 바이크 성장 저장·복구 (#203) — 컬렉션(#204)과 같은 버전·보정 규칙 구조 ──

export const GROWTH_STORAGE_KEY = 'dbg-lab-meta-growth';
export const GROWTH_SCHEMA_VERSION = 1;

type SavedGrowth = { version: number } & Partial<DreamGrowth>;

export function serializeDreamGrowth(growth: DreamGrowth): string {
  return JSON.stringify({ version: GROWTH_SCHEMA_VERSION, ...growth } satisfies SavedGrowth);
}

export function parseDreamGrowth(raw: string | null | undefined): DreamGrowth {
  if (!raw) return createDreamGrowth();
  let saved: unknown;
  try {
    saved = JSON.parse(raw);
  } catch {
    return createDreamGrowth();
  }
  if (typeof saved !== 'object' || saved === null) return createDreamGrowth();
  const data = saved as SavedGrowth;
  if (data.version !== GROWTH_SCHEMA_VERSION) return createDreamGrowth();
  return sanitizeDreamGrowth(data);
}

// 저장 데이터의 비정상 값(범위 밖 레벨, 소수·문자열, 미등록 대상 자전거)을 안전한 값으로 보정합니다.
export function sanitizeDreamGrowth(data: Partial<DreamGrowth>): DreamGrowth {
  const fallback = createDreamGrowth();
  const targetBikeId = typeof data.targetBikeId === 'string' && catalogBikeById(data.targetBikeId)
    ? data.targetBikeId
    : fallback.targetBikeId;
  const stats = { ...fallback.stats };
  DREAM_STAT_KEYS.forEach((key) => {
    const value = data.stats?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      stats[key] = Math.min(DREAM_STAT_MAX_LEVEL, Math.max(DREAM_STAT_MIN_LEVEL, Math.floor(value)));
    }
  });
  return { targetBikeId, stats };
}

// ── 다음 목표 결정 규칙 (#205) ──
// 우선순위: 1) 아직 해금하지 못한 자전거를 주는 다음 주문 → 2) 강화 가능한 드림 바이크 파츠
// → 3) 모두 달성 시 반복 주문 안내. 목표 달성 시 홈 화면이 이 규칙으로 다음 목표를 자동 갱신합니다.

export type NextGoal =
  | { kind: 'unlock'; orderIndex: number; orderName: string; bikeId: string; bikeName: string }
  | { kind: 'upgrade'; stat: DreamStatKey; cost: number }
  | { kind: 'repeat' };

export function computeNextGoal(collection: CollectionProgress, growth: DreamGrowth): NextGoal {
  const nextUnlock = ORDER_METAS.find((meta) => !collection.ownedBikeIds.includes(meta.unlockBikeId));
  if (nextUnlock) {
    const bike = catalogBikeById(nextUnlock.unlockBikeId);
    return {
      kind: 'unlock',
      orderIndex: nextUnlock.orderIndex,
      orderName: nextUnlock.name,
      bikeId: nextUnlock.unlockBikeId,
      bikeName: bike?.name ?? nextUnlock.unlockBikeId,
    };
  }
  const upgradable = DREAM_STAT_KEYS.filter((key) => growth.stats[key] < DREAM_STAT_MAX_LEVEL);
  if (upgradable.length > 0) {
    // 가장 낮은 단계의 파츠부터 안내해 성장 격차를 줄입니다
    const stat = upgradable.reduce((lowest, key) => (growth.stats[key] < growth.stats[lowest] ? key : lowest));
    return { kind: 'upgrade', stat, cost: dreamUpgradeCost(growth.stats[stat]) };
  }
  return { kind: 'repeat' };
}
