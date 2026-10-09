// 체력 소진·광고 충전 규칙 테스트 (#263)
import { describe, expect, it } from 'vitest';
import {
  AD_REFILL_AMOUNT, REFILL_POLICIES, addEnergy, claimAdRefill, claimFreeRefill, formatDuration, isEnergyEmpty, msUntilFull,
  parseRefillRecord, refillStatus,
} from './energy-refill';

const TODAY = '2026-10-09';

describe('광고 충전', () => {
  it('끝까지 본 광고만 지급하고 횟수를 센다', () => {
    const done = claimAdRefill('card', null, TODAY, 'completed');
    expect(done).toEqual({ record: { date: TODAY, adsWatched: 1, freeUsed: 0 }, amount: AD_REFILL_AMOUNT });
    for (const result of ['failed', 'dismissed'] as const) {
      expect(claimAdRefill('card', done.record, TODAY, result)).toEqual({ record: done.record, amount: 0 });
    }
  });

  it('하루 횟수를 다 쓰면 지급하지 않고, 날짜가 바뀌면 다시 쓸 수 있다', () => {
    let record = null;
    for (let i = 0; i < REFILL_POLICIES.daily.adsPerDay; i += 1) record = claimAdRefill('daily', record, TODAY, 'completed').record;
    expect(refillStatus('daily', record, TODAY).adsLeft).toBe(0);
    expect(claimAdRefill('daily', record, TODAY, 'completed').amount).toBe(0);
    expect(refillStatus('daily', record, '2026-10-10').adsLeft).toBe(REFILL_POLICIES.daily.adsPerDay);
    expect(claimAdRefill('daily', record, '2026-10-10', 'completed').record).toEqual({ date: '2026-10-10', adsWatched: 1, freeUsed: 0 });
  });

  it('방안별 하루 횟수', () => {
    expect(refillStatus('card', null, TODAY)).toEqual({ adsLeft: 3, freeLeft: 0 });
    expect(refillStatus('daily', null, TODAY)).toEqual({ adsLeft: 2, freeLeft: 1 });
    expect(refillStatus('rest', null, TODAY)).toEqual({ adsLeft: 3, freeLeft: 0 });
  });
});

describe('B안 하루 무료 충전', () => {
  it('하루 1회 가득 채우고, 다른 방안에서는 쓸 수 없다', () => {
    const first = claimFreeRefill('daily', null, TODAY, 4, 30)!;
    expect(first).toEqual({ record: { date: TODAY, adsWatched: 0, freeUsed: 1 }, amount: 26 });
    expect(claimFreeRefill('daily', first.record, TODAY, 0, 30)).toBeNull();
    expect(claimFreeRefill('daily', first.record, '2026-10-10', 0, 30)?.amount).toBe(30);
    expect(claimFreeRefill('card', null, TODAY, 0, 30)).toBeNull();
  });
});

describe('체력 계산', () => {
  it('충전은 최대치를 넘지 않는다', () => {
    expect(addEnergy(25, 30, 10)).toBe(30);
    expect(addEnergy(0, 30, 10)).toBe(10);
    expect(addEnergy(5, 30, -3)).toBe(5);
  });

  it('체력과 무료 상자가 모두 없을 때만 소진이다', () => {
    expect(isEnergyEmpty({ energy: 0, freeBoxes: 0 })).toBe(true);
    expect(isEnergyEmpty({ energy: 0, freeBoxes: 1 })).toBe(false);
    expect(isEnergyEmpty({ energy: 1, freeBoxes: 0 })).toBe(false);
  });

  it('가득 찰 때까지 남은 시간', () => {
    const minute = 60_000;
    expect(msUntilFull(30, 0, 0, 30, 10 * minute)).toBe(0);
    expect(msUntilFull(0, 0, 0, 30, 10 * minute)).toBe(300 * minute);
    expect(msUntilFull(28, 0, 3 * minute, 30, 10 * minute)).toBe(17 * minute);
    expect(formatDuration(300 * minute)).toBe('5시간 0분');
    expect(formatDuration(17 * minute)).toBe('17분');
  });
});

describe('저장 기록', () => {
  it('손상된 기록은 없음으로 본다', () => {
    expect(parseRefillRecord(null)).toBeNull();
    expect(parseRefillRecord('{x')).toBeNull();
    expect(parseRefillRecord(JSON.stringify({ date: TODAY, adsWatched: -1, freeUsed: 0 }))).toBeNull();
    expect(parseRefillRecord(JSON.stringify({ date: TODAY, adsWatched: 2, freeUsed: 1 }))).toEqual({ date: TODAY, adsWatched: 2, freeUsed: 1 });
  });
});
