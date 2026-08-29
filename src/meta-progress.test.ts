// #201 주문 완료 → 컬렉션 해금 / #204 저장·복구 규칙 단위 테스트
import { describe, expect, it } from 'vitest';
import { CATALOG_BIKES, catalogBikeById } from './bike-catalog';
import {
  COLLECTION_SCHEMA_VERSION,
  ORDER_METAS,
  applyOrderUnlock,
  createCollectionProgress,
  markBikeSeen,
  orderMetaAt,
  ownedBikeCount,
  parseCollectionProgress,
  sanitizeCollectionProgress,
  serializeCollectionProgress,
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
