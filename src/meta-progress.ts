// 메타 루프 진행 로직 (순수 로직 · Phaser 비의존) — #200 트랙
// 주문 완료 → 컬렉션 해금(#201)의 데이터 규칙을 화면 코드와 분리해 단위 테스트 가능하게 관리합니다.
// 저장·복구는 후속 이슈(#204)에서 이 모듈의 상태 모델 위에 얹습니다.

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
