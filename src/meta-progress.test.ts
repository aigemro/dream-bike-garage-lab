// #201 주문 완료 → 컬렉션 해금 / #204 저장·복구 규칙 단위 테스트
import { describe, expect, it } from 'vitest';
import { CATALOG_BIKES, catalogBikeById } from './bike-catalog';
import {
  COLLECTION_SCHEMA_VERSION,
  DREAM_STAT_MAX_LEVEL,
  GROWTH_SCHEMA_VERSION,
  ORDER_METAS,
  applyDreamUpgrade,
  applyOrderUnlock,
  createCollectionProgress,
  createDreamGrowth,
  dreamGradeName,
  dreamStage,
  dreamUpgradeCost,
  markBikeSeen,
  orderMetaAt,
  ownedBikeCount,
  parseCollectionProgress,
  parseDreamGrowth,
  sanitizeCollectionProgress,
  sanitizeDreamGrowth,
  serializeCollectionProgress,
  serializeDreamGrowth,
} from './meta-progress';

describe('주문 메타 매핑', () => {
  it('모든 주문의 해금 자전거 ID가 카탈로그에 실제로 존재한다', () => {
    ORDER_METAS.forEach((meta) => {
      expect(catalogBikeById(meta.unlockBikeId), `${meta.name}의 해금 자전거`).toBeDefined();
    });
  });

  it('카탈로그 ID는 중복이 없다', () => {
    const ids = CATALOG_BIKES.map((bike) => bike.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('범위를 벗어난 주문 인덱스는 undefined를 반환한다', () => {
    expect(orderMetaAt(-1)).toBeUndefined();
    expect(orderMetaAt(ORDER_METAS.length)).toBeUndefined();
  });
});

describe('초기 컬렉션 상태', () => {
  it('시작 보유는 드림 로드바이크 1대뿐이다', () => {
    const progress = createCollectionProgress();
    expect(progress.ownedBikeIds).toEqual(['dream-road']);
    expect(ownedBikeCount(progress)).toBe(1);
    expect(progress.newBikeIds).toEqual([]);
  });

  it('주문 완료 없이 컬렉션만 열람하면 잠금 상태가 유지된다', () => {
    const progress = createCollectionProgress();
    // 열람은 상태 변경 함수를 호출하지 않으므로 그대로여야 한다
    expect(ownedBikeCount(progress)).toBe(1);
    expect(progress.ownedBikeIds.includes('urban-road')).toBe(false);
  });
});

describe('주문 완료 → 해금', () => {
  it('주문 1 완료 시 어반 로드가 신규 해금된다', () => {
    const progress = createCollectionProgress();
    const result = applyOrderUnlock(progress, 0);
    expect(result.isNew).toBe(true);
    expect(result.unlockedBike?.id).toBe('urban-road');
    expect(progress.ownedBikeIds).toContain('urban-road');
    expect(progress.newBikeIds).toContain('urban-road');
  });

  it('주문 2·3도 매핑된 자전거를 해금한다', () => {
    const progress = createCollectionProgress();
    expect(applyOrderUnlock(progress, 1).unlockedBike?.id).toBe('trail-mtb');
    expect(applyOrderUnlock(progress, 2).unlockedBike?.id).toBe('aero-sprinter');
    // 시작 보유 1대 + 신규 해금 2대
    expect(ownedBikeCount(progress)).toBe(3);
  });

  it('같은 주문을 반복해도 보유 목록이 중복 누적되지 않는다', () => {
    const progress = createCollectionProgress();
    applyOrderUnlock(progress, 0);
    const repeat = applyOrderUnlock(progress, 0);
    expect(repeat.isNew).toBe(false);
    expect(repeat.unlockedBike?.id).toBe('urban-road');
    expect(progress.ownedBikeIds.filter((id) => id === 'urban-road')).toHaveLength(1);
    expect(ownedBikeCount(progress)).toBe(2);
  });

  it('알 수 없는 주문 인덱스는 아무 변화도 만들지 않는다', () => {
    const progress = createCollectionProgress();
    const result = applyOrderUnlock(progress, 99);
    expect(result.isNew).toBe(false);
    expect(result.unlockedBike).toBeUndefined();
    expect(ownedBikeCount(progress)).toBe(1);
  });
});

describe('컬렉션 저장·복구 (#204)', () => {
  it('직렬화 → 복원 왕복 후 상태가 동일하다', () => {
    const progress = createCollectionProgress();
    applyOrderUnlock(progress, 0);
    applyOrderUnlock(progress, 1);
    markBikeSeen(progress, 'urban-road');
    progress.selectedBikeId = 'trail-mtb';
    progress.showcaseSlots = ['dream-road', 'urban-road', null];

    const restored = parseCollectionProgress(serializeCollectionProgress(progress));
    expect(restored).toEqual(progress);
  });

  it('저장 데이터가 없으면 기본값으로 시작한다', () => {
    expect(parseCollectionProgress(null)).toEqual(createCollectionProgress());
    expect(parseCollectionProgress('')).toEqual(createCollectionProgress());
  });

  it('손상된 JSON은 진행 불가 오류 없이 기본값으로 복구된다', () => {
    expect(parseCollectionProgress('{"version":1,')).toEqual(createCollectionProgress());
    expect(parseCollectionProgress('"문자열"')).toEqual(createCollectionProgress());
  });

  it('스키마 버전이 다르면 기본값으로 복구된다', () => {
    const old = JSON.stringify({ version: COLLECTION_SCHEMA_VERSION + 1, ownedBikeIds: ['urban-road'] });
    expect(parseCollectionProgress(old)).toEqual(createCollectionProgress());
    const noVersion = JSON.stringify({ ownedBikeIds: ['urban-road'] });
    expect(parseCollectionProgress(noVersion)).toEqual(createCollectionProgress());
  });

  it('삭제된 데이터 ID·중복 보유는 걸러지고 시작 자전거는 항상 유지된다', () => {
    const result = sanitizeCollectionProgress({
      ownedBikeIds: ['urban-road', 'urban-road', 'deleted-bike', 42 as unknown as string],
      newBikeIds: ['deleted-bike', 'urban-road'],
    });
    expect(result.ownedBikeIds).toEqual(['dream-road', 'urban-road']);
    expect(result.newBikeIds).toEqual(['urban-road']);
  });

  it('미보유·미등록 자전거가 선택·전시에 남아 있으면 안전한 값으로 보정한다', () => {
    const result = sanitizeCollectionProgress({
      ownedBikeIds: ['dream-road'],
      selectedBikeId: 'deleted-bike',
      showcaseSlots: ['trail-mtb', 'dream-road'],
    });
    expect(result.selectedBikeId).toBe('dream-road');
    // 미보유 슬롯은 비우고, 슬롯 수는 항상 3개로 맞춘다
    expect(result.showcaseSlots).toEqual([null, 'dream-road', null]);
  });

  it('새 게임 초기화는 기본 진행 상태와 동일하다', () => {
    const progress = createCollectionProgress();
    expect(ownedBikeCount(progress)).toBe(1);
    expect(progress.showcaseSlots).toEqual(['dream-road', null, null]);
  });
});

describe('신규 발견 확인 처리', () => {
  it('도감에서 확인하면 NEW 표시가 해제되고 보유는 유지된다', () => {
    const progress = createCollectionProgress();
    applyOrderUnlock(progress, 0);
    markBikeSeen(progress, 'urban-road');
    expect(progress.newBikeIds).not.toContain('urban-road');
    expect(progress.ownedBikeIds).toContain('urban-road');
  });
});

describe('드림 바이크 성장 (#203)', () => {
  it('첫 주문 급여(1,000코인)로 최소 한 단계 강화할 수 있다', () => {
    const growth = createDreamGrowth();
    const firstReward = ORDER_METAS[0].reward;
    expect(dreamUpgradeCost(growth.stats.성능)).toBeLessThanOrEqual(firstReward);
    const result = applyDreamUpgrade(growth, firstReward, '성능');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.growth.stats.성능).toBe(2);
      expect(result.coins).toBe(firstReward - dreamUpgradeCost(1));
    }
  });

  it('코인이 부족하면 차감도 강화도 발생하지 않는다', () => {
    const growth = createDreamGrowth();
    const result = applyDreamUpgrade(growth, 100, '성능');
    expect(result.ok).toBe(false);
    expect(result.coins).toBe(100);
    expect(growth.stats.성능).toBe(1);
    if (!result.ok) expect(result.reason).toBe('coins');
  });

  it('최대 단계에서는 강화가 거부된다', () => {
    const growth = createDreamGrowth();
    growth.stats.성능 = DREAM_STAT_MAX_LEVEL;
    const result = applyDreamUpgrade(growth, 99_999, '성능');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('max');
  });

  it('강화 성공 시 코인 차감과 단계 증가가 함께 적용된다', () => {
    let growth = createDreamGrowth();
    let coins = 10_000;
    const result = applyDreamUpgrade(growth, coins, '스타일');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.coins).toBe(coins - dreamUpgradeCost(1));
      expect(result.growth.stats.스타일).toBe(2);
      // 원본은 변경하지 않는다 (실패 시 어느 쪽도 변하지 않는 원자성 보장과 동일 원칙)
      expect(growth.stats.스타일).toBe(1);
    }
  });

  it('합계 7·10 도달 시 등급이 상승하고 stageUp이 보고된다', () => {
    let growth = createDreamGrowth();
    expect(dreamStage(growth)).toBe(1);
    expect(dreamGradeName(growth)).toBe('중급');
    let coins = 99_999;
    let stageUps = 0;
    // 성능→스타일→희귀도 순서로 반복 강화하며 등급 상승 시점을 확인
    for (const stat of ['성능', '스타일', '희귀도', '성능', '스타일', '희귀도', '성능'] as const) {
      const result = applyDreamUpgrade(growth, coins, stat);
      expect(result.ok).toBe(true);
      if (result.ok) {
        growth = result.growth;
        coins = result.coins;
        if (result.stageUp) stageUps += 1;
      }
    }
    // 합계 10 → 드림 등급까지 두 번의 등급 상승
    expect(dreamStage(growth)).toBe(3);
    expect(dreamGradeName(growth)).toBe('드림');
    expect(stageUps).toBe(2);
  });
});

describe('드림 바이크 성장 저장·복구 (#203)', () => {
  it('직렬화 → 복원 왕복 후 상태가 동일하다', () => {
    let growth = createDreamGrowth();
    const upgraded = applyDreamUpgrade(growth, 1000, '희귀도');
    if (upgraded.ok) growth = upgraded.growth;
    expect(parseDreamGrowth(serializeDreamGrowth(growth))).toEqual(growth);
  });

  it('저장 없음·손상 JSON·버전 불일치 시 기본값으로 복구된다', () => {
    expect(parseDreamGrowth(null)).toEqual(createDreamGrowth());
    expect(parseDreamGrowth('{broken')).toEqual(createDreamGrowth());
    const wrongVersion = JSON.stringify({ version: GROWTH_SCHEMA_VERSION + 1, stats: { 성능: 4 } });
    expect(parseDreamGrowth(wrongVersion)).toEqual(createDreamGrowth());
  });

  it('범위 밖 레벨과 미등록 대상 자전거는 안전한 값으로 보정된다', () => {
    const result = sanitizeDreamGrowth({
      targetBikeId: 'deleted-bike',
      stats: { 성능: 99, 스타일: -3, 희귀도: 2.7 },
    });
    expect(result.targetBikeId).toBe('dream-road');
    expect(result.stats).toEqual({ 성능: DREAM_STAT_MAX_LEVEL, 스타일: 1, 희귀도: 2 });
  });
});
