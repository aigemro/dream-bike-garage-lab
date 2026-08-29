// 메타 루프 진행 로직 (순수 로직 · Phaser 비의존) — #200 트랙
// 주문 완료 → 컬렉션 해금(#201)과 컬렉션 진행 저장·복구(#204)의 데이터 규칙을
// 화면 코드와 분리해 단위 테스트 가능하게 관리합니다.

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
