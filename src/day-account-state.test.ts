// Day·계정 진행 저장소 검증 (#207 검토 후속)
// 손상된 dayHistory 요소 정규화와 setItem 실패 시 무예외 동작을 순수 로직 수준에서 확인합니다.
import { describe, expect, it } from 'vitest';
import {
  DAY_DURATION_MS,
  DayAccountRepository,
  MAX_DAY_HISTORY,
  createDefaultProgress,
  type DayAccountProgress,
  type KeyValueStorage,
} from './day-account-state';

// 브라우저 localStorage를 모사한 인메모리 저장소. failSet이 켜지면 setItem이 용량 초과처럼 예외를 던집니다.
function makeStorage(): KeyValueStorage & { store: Map<string, string>; failSet: boolean } {
  const store = new Map<string, string>();
  const storage = {
    store,
    failSet: false,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (storage.failSet) throw new Error('QuotaExceededError');
      store.set(key, value);
    },
    removeItem: (key: string) => { store.delete(key); },
  };
  return storage;
}

const PLAYER = 'player-test';
const PROGRESS_KEY = `dbg-lab-day-account-progress-v1:${PLAYER}`;

function saved(storage: KeyValueStorage, patch: Partial<DayAccountProgress>) {
  storage.setItem(PROGRESS_KEY, JSON.stringify({ ...createDefaultProgress(PLAYER), ...patch }));
}

describe('dayHistory 정규화', () => {
  it('객체가 아니거나 dayNumber가 없는 요소는 버리고 숫자 필드는 안전한 값으로 보정한다', () => {
    const storage = makeStorage();
    saved(storage, {
      dayHistory: [
        'broken',
        null,
        { earnings: 1000 },
        { dayNumber: 0, earnings: 500 },
        { dayNumber: 2, earnings: 'many', ordersCompleted: -3, endReason: 'unknown' },
        { dayNumber: 3.7, startedAt: '2026-09-01T00:00:00.000Z', endedAt: '2026-09-01T00:00:10.000Z', elapsedActiveMs: 10000, ordersCompleted: 2, earnings: 2400, endReason: 'time-limit', settlementRevision: 9 },
      ] as unknown as DayAccountProgress['dayHistory'],
    });
    const progress = new DayAccountRepository(storage).loadProgress(PLAYER);
    expect(progress.dayHistory).toHaveLength(2);
    expect(progress.dayHistory[0]).toMatchObject({ dayNumber: 2, earnings: 0, ordersCompleted: 0, endReason: 'manual-test', settlementRevision: 0 });
    expect(progress.dayHistory[1]).toMatchObject({ dayNumber: 3, earnings: 2400, ordersCompleted: 2, endReason: 'time-limit', settlementRevision: 9 });
    // 화면이 그대로 호출하는 표기 메서드가 예외 없이 동작해야 한다
    expect(() => progress.dayHistory.forEach((entry) => entry.earnings.toLocaleString())).not.toThrow();
  });

  it('이력은 최근 MAX_DAY_HISTORY개만 유지한다', () => {
    const storage = makeStorage();
    saved(storage, {
      dayHistory: Array.from({ length: MAX_DAY_HISTORY + 5 }, (_, index) => ({
        dayNumber: index + 1, startedAt: 't', endedAt: 't', elapsedActiveMs: 0, ordersCompleted: 0, earnings: 0, endReason: 'manual-test' as const, settlementRevision: index,
      })),
    });
    const progress = new DayAccountRepository(storage).loadProgress(PLAYER);
    expect(progress.dayHistory).toHaveLength(MAX_DAY_HISTORY);
    expect(progress.dayHistory[0].dayNumber).toBe(6);
  });

  it('dayHistory 자체가 배열이 아니면 빈 이력으로 복구한다', () => {
    const storage = makeStorage();
    saved(storage, { dayHistory: { broken: true } as unknown as DayAccountProgress['dayHistory'] });
    expect(new DayAccountRepository(storage).loadProgress(PLAYER).dayHistory).toEqual([]);
  });
});

describe('저장 실패 처리', () => {
  it('setItem이 실패해도 예외 없이 메모리 진행을 돌려주고 lastSaveError를 기록한다', () => {
    const storage = makeStorage();
    const repository = new DayAccountRepository(storage);
    const progress = repository.loadProgress(PLAYER);
    storage.failSet = true;
    const next = repository.saveProgress({ ...progress, coins: 999 });
    expect(next.coins).toBe(999);
    expect(next.revision).toBe(progress.revision + 1);
    expect(repository.lastSaveError).toContain('QuotaExceeded');
    expect(storage.store.has(PROGRESS_KEY)).toBe(false);
  });

  it('다음 저장이 성공하면 lastSaveError가 비워지고 저장 내용이 복구된다', () => {
    const storage = makeStorage();
    const repository = new DayAccountRepository(storage);
    const progress = repository.loadProgress(PLAYER);
    storage.failSet = true;
    repository.saveProgress(progress);
    storage.failSet = false;
    const next = repository.saveProgress({ ...progress, coins: 1234, currentDayState: { ...progress.currentDayState, status: 'paused', remainingMs: DAY_DURATION_MS / 2 } });
    expect(repository.lastSaveError).toBeNull();
    const reloaded = repository.loadProgress(PLAYER);
    expect(reloaded.coins).toBe(1234);
    expect(reloaded.currentDayState).toMatchObject({ status: 'paused', remainingMs: DAY_DURATION_MS / 2 });
    expect(reloaded.revision).toBe(next.revision);
  });

  it('removeItem이 실패해도 resetProgress는 기본 진행을 돌려준다', () => {
    const storage = makeStorage();
    storage.removeItem = () => { throw new Error('blocked'); };
    const repository = new DayAccountRepository(storage);
    expect(repository.resetProgress(PLAYER)).toMatchObject({ playerId: PLAYER, coins: 2480 });
  });
});
