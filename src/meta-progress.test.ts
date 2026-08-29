// #201 주문 완료 → 컬렉션 해금 규칙 단위 테스트
import { describe, expect, it } from 'vitest';
import { CATALOG_BIKES, catalogBikeById } from './bike-catalog';
import {
  ORDER_METAS,
  applyOrderUnlock,
  createCollectionProgress,
  markBikeSeen,
  orderMetaAt,
  ownedBikeCount,
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

describe('신규 발견 확인 처리', () => {
  it('도감에서 확인하면 NEW 표시가 해제되고 보유는 유지된다', () => {
    const progress = createCollectionProgress();
    applyOrderUnlock(progress, 0);
    markBikeSeen(progress, 'urban-road');
    expect(progress.newBikeIds).not.toContain('urban-road');
    expect(progress.ownedBikeIds).toContain('urban-road');
  });
});
