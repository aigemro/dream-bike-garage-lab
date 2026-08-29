// #202 주문→컬렉션→성장 전체 메타 루프 검증 테스트
// 릴리스 통합 컨트롤러(mvp-release-integration)가 수행하는 상태 전이를
// meta-progress 순수 로직 수준에서 처음부터 끝까지 시뮬레이션합니다.
// 화면 연출을 제외한 데이터 흐름은 컨트롤러와 동일한 함수·순서를 사용합니다.
import { describe, expect, it } from 'vitest';
import { CATALOG_SIZE } from './bike-catalog';
import {
  DREAM_STAT_MAX_LEVEL,
  ORDER_METAS,
  applyDreamUpgrade,
  applyOrderUnlock,
  computeNextGoal,
  createCollectionProgress,
  createDreamGrowth,
  dreamGradeName,
  dreamUpgradeCost,
  markBikeSeen,
  orderMetaAt,
  ownedBikeCount,
  parseCollectionProgress,
  parseDreamGrowth,
  serializeCollectionProgress,
  serializeDreamGrowth,
  type CollectionProgress,
  type DreamGrowth,
} from './meta-progress';

// 컨트롤러의 저장·복구를 모사한 인메모리 localStorage
function makeStorage() {
  const store = new Map<string, string>();
  return {
    save(collection: CollectionProgress, growth: DreamGrowth) {
      store.set('collection', serializeCollectionProgress(collection));
      store.set('growth', serializeDreamGrowth(growth));
    },
    // 새로고침: 저장 원본에서 상태를 다시 구성
    reload() {
      return {
        collection: parseCollectionProgress(store.get('collection') ?? null),
        growth: parseDreamGrowth(store.get('growth') ?? null),
      };
    },
    corruptCollection() { store.set('collection', '{broken-json'); },
    reset() { store.clear(); },
  };
}

describe('메타 루프 E2E: 새 게임 → 주문 3종 → 성장 → 반복 (#202)', () => {
  it('첫 주문부터 다음 주문까지 전체 루프를 중단 없이 완주한다', () => {
    const storage = makeStorage();

    // 1. 새 게임 시작 (시작 코인 0 · 보유 자전거 1대)
    let collection = createCollectionProgress();
    let growth = createDreamGrowth();
    let coins = 0;
    let completedOrders = 0;
    let orderIndex = 0;
    expect(ownedBikeCount(collection)).toBe(1);
    expect(computeNextGoal(collection, growth)).toMatchObject({ kind: 'unlock', bikeId: 'urban-road' });

    // 2~3. 첫 주문 완료 → 급여와 신규 자전거 해금 확인
    const firstMeta = orderMetaAt(orderIndex)!;
    const unlock1 = applyOrderUnlock(collection, orderIndex);
    coins += firstMeta.reward;
    completedOrders += 1;
    storage.save(collection, growth);
    expect(unlock1.isNew).toBe(true);
    expect(unlock1.unlockedBike?.id).toBe('urban-road');
    expect(coins).toBe(1000);

    // 4. 컬렉션에서 해금 자전거 확인 (NEW 해제)
    expect(collection.newBikeIds).toContain('urban-road');
    markBikeSeen(collection, 'urban-road');
    storage.save(collection, growth);
    expect(collection.newBikeIds).not.toContain('urban-road');
    expect(ownedBikeCount(collection)).toBe(2);

    // 5. 급여로 드림 바이크 한 단계 강화
    const upgrade = applyDreamUpgrade(growth, coins, '성능');
    expect(upgrade.ok).toBe(true);
    if (upgrade.ok) {
      growth = upgrade.growth;
      coins = upgrade.coins;
    }
    storage.save(collection, growth);
    expect(growth.stats.성능).toBe(2);
    expect(coins).toBe(1000 - dreamUpgradeCost(1));

    // 6. 홈 기준 다음 목표 갱신 확인 (다음 미해금 자전거)
    expect(computeNextGoal(collection, growth)).toMatchObject({ kind: 'unlock', orderIndex: 1, bikeId: 'trail-mtb' });

    // 7. 다음 주문 시작 (주문 순환)
    orderIndex = (orderIndex + 1) % ORDER_METAS.length;
    expect(orderMetaAt(orderIndex)?.name).toBe('트레일 MTB');

    // 8. 새로고침 후 상태 복구
    const restored = storage.reload();
    expect(restored.collection).toEqual(collection);
    expect(restored.growth).toEqual(growth);
    collection = restored.collection;
    growth = restored.growth;

    // 9. 총 3종 주문 연속 완료
    for (; orderIndex < ORDER_METAS.length; orderIndex += 1) {
      const meta = orderMetaAt(orderIndex)!;
      const unlock = applyOrderUnlock(collection, orderIndex);
      coins += meta.reward;
      completedOrders += 1;
      storage.save(collection, growth);
      expect(unlock.isNew).toBe(true);
    }
    expect(completedOrders).toBe(3);
    expect(ownedBikeCount(collection)).toBe(4);
    expect(coins).toBe(1000 + 1400 + 1800 - dreamUpgradeCost(1));

    // 10. 마지막 주문 이후에도 다음 목표가 항상 존재한다 (강화 → 반복 주문)
    const afterAll = computeNextGoal(collection, growth);
    expect(afterAll.kind).toBe('upgrade');
    while (computeNextGoal(collection, growth).kind === 'upgrade') {
      const goal = computeNextGoal(collection, growth);
      if (goal.kind !== 'upgrade') break;
      const result = applyDreamUpgrade(growth, 99_999, goal.stat);
      expect(result.ok).toBe(true);
      if (result.ok) growth = result.growth;
    }
    expect(dreamGradeName(growth)).toBe('드림');
    expect(computeNextGoal(collection, growth)).toEqual({ kind: 'repeat' });

    // 주문 인덱스는 반복 순환으로 처음으로 돌아간다
    expect((orderIndex + 0) % ORDER_METAS.length).toBe(0);
  });

  it('보상 중복 지급과 코인만 차감되는 상태 불일치가 없다', () => {
    const collection = createCollectionProgress();
    let growth = createDreamGrowth();

    // 같은 주문을 빠르게 두 번 완료 처리해도 해금은 한 번만 반영된다
    applyOrderUnlock(collection, 0);
    const repeat = applyOrderUnlock(collection, 0);
    expect(repeat.isNew).toBe(false);
    expect(collection.ownedBikeIds.filter((id) => id === 'urban-road')).toHaveLength(1);

    // 빠른 연속 입력: 코인이 한 번 강화분(350)만 있을 때 연타해도 두 번째는 원자적으로 거부된다
    let coins = dreamUpgradeCost(1);
    const first = applyDreamUpgrade(growth, coins, '성능');
    expect(first.ok).toBe(true);
    if (first.ok) {
      growth = first.growth;
      coins = first.coins;
    }
    const second = applyDreamUpgrade(growth, coins, '성능');
    expect(second.ok).toBe(false);
    expect(second.coins).toBe(0);
    expect(growth.stats.성능).toBe(2);
  });

  it('저장 손상 후에도 진행 불가 없이 복구되고 나머지 저장은 유지된다', () => {
    const storage = makeStorage();
    const collection = createCollectionProgress();
    let growth = createDreamGrowth();
    applyOrderUnlock(collection, 0);
    const upgraded = applyDreamUpgrade(growth, 1000, '스타일');
    if (upgraded.ok) growth = upgraded.growth;
    storage.save(collection, growth);

    // 컬렉션 저장만 손상 → 컬렉션은 기본값 복구, 성장 저장은 그대로 유지
    storage.corruptCollection();
    const restored = storage.reload();
    expect(restored.collection).toEqual(createCollectionProgress());
    expect(restored.growth).toEqual(growth);
    // 복구된 상태에서도 다음 목표가 계산되어 진행을 이어갈 수 있다
    expect(computeNextGoal(restored.collection, restored.growth).kind).toBe('unlock');
  });

  it('새 게임 초기화 시 컬렉션·성장·다음 목표가 처음 상태로 돌아간다', () => {
    const storage = makeStorage();
    const collection = createCollectionProgress();
    [0, 1, 2].forEach((index) => applyOrderUnlock(collection, index));
    let growth = createDreamGrowth();
    growth.stats = { 성능: DREAM_STAT_MAX_LEVEL, 스타일: 2, 희귀도: 2 };
    storage.save(collection, growth);

    // 초기화: 저장 삭제 후 재로드 → 기본값
    storage.reset();
    const fresh = storage.reload();
    expect(fresh.collection).toEqual(createCollectionProgress());
    expect(fresh.growth).toEqual(createDreamGrowth());
    expect(ownedBikeCount(fresh.collection)).toBe(1);
    expect(CATALOG_SIZE).toBe(24);
  });
});
