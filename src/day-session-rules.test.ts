// Day 세션 순수 규칙 검증 (#210 종료 규칙 · #212 복구 정합성)
// 시간 차감·일시정지·마감·정산 1회·다음 Day·복원 규칙을 화면 없이 확인합니다.
import { describe, expect, it } from 'vitest';
import {
  DAY_DURATION_MS,
  MAX_DAY_HISTORY,
  canAcceptPlayInput,
  createReadyDay,
  formatDayClock,
  isDayUrgent,
  normalizeDayState,
  normalizeDurationMs,
  normalizeRestoredDay,
  pauseDay,
  prepareNextDay,
  recordOrderDelivery,
  resumeDay,
  settleDay,
  startDay,
  tickDay,
  type CurrentDayState,
  type DayHistoryEntry,
} from './day-session-rules';

const T0 = '2026-10-06T00:00:00.000Z';
const T1 = '2026-10-06T00:03:00.000Z';

function activeDay(durationMs = 60_000, dayNumber = 1): CurrentDayState {
  return startDay(createReadyDay(dayNumber, durationMs), T0);
}

describe('Day 시작', () => {
  it('준비 상태에서만 시작하고 시작 시점에 제한 시간을 확정한다', () => {
    const day = startDay(createReadyDay(3), T0, 180_000);
    expect(day).toMatchObject({ dayNumber: 3, status: 'active', durationMs: 180_000, remainingMs: 180_000, startedAt: T0 });
  });

  it('진행 중·정산 중인 Day는 다시 시작하지 않는다 (진행 손실 방지)', () => {
    const running = tickDay(activeDay(), 5000).day;
    expect(startDay(running, T1)).toBe(running);
    const settled = settleDay(running, [], { reason: 'manual-test', endedAt: T1, settlementRevision: 1 }).day;
    expect(startDay(settled, T1)).toBe(settled);
  });

  it('제한 시간은 1초~30분 범위로 보정한다', () => {
    expect(normalizeDurationMs(0)).toBe(1000);
    expect(normalizeDurationMs(99 * 60_000)).toBe(30 * 60_000);
    expect(normalizeDurationMs('broken')).toBe(DAY_DURATION_MS);
  });
});

describe('활성 플레이 시간 차감', () => {
  it('활성 상태에서만 시간을 차감한다', () => {
    const ready = createReadyDay(1, 60_000);
    expect(tickDay(ready, 1000).day).toBe(ready);
    const paused = pauseDay(activeDay(), 'background');
    expect(tickDay(paused, 1000).day).toBe(paused);
    const ticked = tickDay(activeDay(), 1500).day;
    expect(ticked).toMatchObject({ remainingMs: 58_500, elapsedActiveMs: 1500 });
  });

  it('0 이하·숫자가 아닌 경과 시간은 무시한다', () => {
    const day = activeDay();
    expect(tickDay(day, 0).day).toBe(day);
    expect(tickDay(day, -500).day).toBe(day);
    expect(tickDay(day, Number.NaN).day).toBe(day);
  });

  it('남은 시간이 0이 되면 마감 단계로 넘기고 초과 시간은 플레이 시간에 넣지 않는다', () => {
    const result = tickDay(tickDay(activeDay(10_000), 9000).day, 4000);
    expect(result.timeUp).toBe(true);
    expect(result.day).toMatchObject({ status: 'closing', remainingMs: 0, elapsedActiveMs: 10_000 });
    expect(canAcceptPlayInput(result.day)).toBe(false);
  });

  it('마감 단계에서는 더 이상 시간을 차감하지 않는다', () => {
    const closing = tickDay(activeDay(1000), 1000).day;
    expect(tickDay(closing, 500)).toEqual({ day: closing, timeUp: false });
  });
});

describe('일시정지·재개', () => {
  it('활성 Day만 일시정지하고 사유를 남긴다', () => {
    const paused = pauseDay(activeDay(), 'screen-navigation');
    expect(paused).toMatchObject({ status: 'paused', pauseReason: 'screen-navigation' });
    expect(canAcceptPlayInput(paused)).toBe(false);
    const ready = createReadyDay();
    expect(pauseDay(ready, 'background')).toBe(ready);
  });

  it('일시정지한 Day만 재개하고 사유를 지운다', () => {
    const resumed = resumeDay(pauseDay(activeDay(), 'background'));
    expect(resumed).toMatchObject({ status: 'active', pauseReason: null });
    expect(canAcceptPlayInput(resumed)).toBe(true);
    const closing = tickDay(activeDay(1000), 1000).day;
    expect(resumeDay(closing)).toBe(closing);
  });
});

describe('납품 기록', () => {
  it('활성·일시정지·마감 중 확정된 납품은 Day 통계에 반영한다', () => {
    const base = activeDay(1000);
    const cases = [base, pauseDay(base, 'background'), tickDay(base, 1000).day];
    for (const day of cases) {
      const result = recordOrderDelivery(day, 1400);
      expect(result.counted).toBe(true);
      expect(result.day).toMatchObject({ ordersCompleted: 1, earnings: 1400, status: day.status });
    }
  });

  it('준비·정산 상태의 납품은 Day 통계에 넣지 않는다', () => {
    const ready = createReadyDay();
    expect(recordOrderDelivery(ready, 1000)).toEqual({ day: ready, counted: false });
    const settled = settleDay(activeDay(), [], { reason: 'manual-test', endedAt: T1, settlementRevision: 2 }).day;
    expect(recordOrderDelivery(settled, 1000).counted).toBe(false);
  });

  it('보상은 0 이상의 정수로만 더한다', () => {
    expect(recordOrderDelivery(activeDay(), -50).day.earnings).toBe(0);
    expect(recordOrderDelivery(activeDay(), 999.9).day.earnings).toBe(999);
  });
});

describe('정산', () => {
  it('마감 중 Day를 시간 종료로 정산하고 이력을 한 번만 남긴다', () => {
    let day = recordOrderDelivery(activeDay(10_000), 1000).day;
    day = tickDay(day, 10_000).day;
    const first = settleDay(day, [], { reason: 'time-limit', endedAt: T1, settlementRevision: 7 });
    expect(first.settled).toBe(true);
    expect(first.day).toMatchObject({ status: 'settlement', endReason: 'time-limit', settlementRevision: 7, remainingMs: 0 });
    expect(first.history).toEqual([{
      dayNumber: 1, startedAt: T0, endedAt: T1, elapsedActiveMs: 10_000, ordersCompleted: 1, earnings: 1000, endReason: 'time-limit', settlementRevision: 7,
    }]);
    // 시간 종료와 수동 종료가 겹쳐도 두 번째 정산은 적용되지 않는다
    const second = settleDay(first.day, first.history, { reason: 'manual-test', endedAt: T1, settlementRevision: 8 });
    expect(second).toEqual({ day: first.day, history: first.history, settled: false });
  });

  it('같은 Day 번호의 이력이 이미 있으면 이력을 추가하지 않는다 (재진입 중복 방지)', () => {
    const existing: DayHistoryEntry[] = [{ dayNumber: 1, startedAt: T0, endedAt: T0, elapsedActiveMs: 1, ordersCompleted: 0, earnings: 0, endReason: 'manual-test', settlementRevision: 1 }];
    const result = settleDay(activeDay(), existing, { reason: 'manual-test', endedAt: T1, settlementRevision: 2 });
    expect(result.settled).toBe(true);
    expect(result.history).toBe(existing);
  });

  it('수동 종료는 남은 시간을 기록으로 유지하고, 일시정지 중에도 정산할 수 있다', () => {
    const paused = pauseDay(tickDay(activeDay(60_000), 20_000).day, 'logout');
    const result = settleDay(paused, [], { reason: 'manual-test', endedAt: T1, settlementRevision: 3 });
    expect(result.day).toMatchObject({ status: 'settlement', remainingMs: 40_000, pauseReason: null });
  });

  it('준비 상태는 정산하지 않고, 이력은 최근 MAX_DAY_HISTORY개만 유지한다', () => {
    const ready = createReadyDay();
    expect(settleDay(ready, [], { reason: 'time-limit', endedAt: T1, settlementRevision: 1 }).settled).toBe(false);
    const history: DayHistoryEntry[] = Array.from({ length: MAX_DAY_HISTORY }, (_, index) => ({
      dayNumber: index + 1, startedAt: T0, endedAt: T0, elapsedActiveMs: 0, ordersCompleted: 0, earnings: 0, endReason: 'manual-test' as const, settlementRevision: index,
    }));
    const result = settleDay(activeDay(60_000, MAX_DAY_HISTORY + 1), history, { reason: 'manual-test', endedAt: T1, settlementRevision: 99 });
    expect(result.history).toHaveLength(MAX_DAY_HISTORY);
    expect(result.history[0].dayNumber).toBe(2);
    expect(result.history.at(-1)?.dayNumber).toBe(MAX_DAY_HISTORY + 1);
  });
});

describe('다음 Day', () => {
  it('정산을 확인한 뒤에만 다음 Day 번호로 넘어가며 새 제한 시간을 적용한다', () => {
    const settled = settleDay(activeDay(), [], { reason: 'manual-test', endedAt: T1, settlementRevision: 1 }).day;
    expect(prepareNextDay(settled, 180_000)).toEqual(createReadyDay(2, 180_000));
    const running = activeDay();
    expect(prepareNextDay(running)).toBe(running);
  });
});

describe('복원 규칙', () => {
  it('저장된 active Day는 일시정지(restore)로 복원해 화면 밖에서 시간이 흐르지 않게 한다', () => {
    const restored = normalizeRestoredDay(tickDay(activeDay(), 3000).day);
    expect(restored).toMatchObject({ status: 'paused', pauseReason: 'restore', remainingMs: 57_000 });
  });

  it('이전 버전의 completed 상태는 다음 Day 준비로 복원하고, 나머지 상태는 그대로 둔다', () => {
    const completed = { ...createReadyDay(4, 60_000), status: 'completed' as const };
    expect(normalizeRestoredDay(completed)).toEqual(createReadyDay(5, 60_000));
    const closing = tickDay(activeDay(1000), 1000).day;
    expect(normalizeRestoredDay(closing)).toBe(closing);
    const ready = createReadyDay();
    expect(normalizeRestoredDay(ready)).toBe(ready);
  });

  it('제한 시간이 없던 이전 저장은 기본 길이로 보정하고 남은 시간을 그 범위로 자른다', () => {
    const legacy = { dayNumber: 2, status: 'paused', remainingMs: 99_999, elapsedActiveMs: 1000, ordersCompleted: 1, earnings: 1000, pauseReason: 'unknown-reason' };
    expect(normalizeDayState(legacy)).toMatchObject({
      dayNumber: 2, status: 'paused', durationMs: DAY_DURATION_MS, remainingMs: DAY_DURATION_MS, pauseReason: null,
    });
  });

  it('알 수 없는 상태 값은 기본값으로 복구한다', () => {
    expect(normalizeDayState({ status: 'running', dayNumber: -3 })).toMatchObject({ status: 'ready', dayNumber: 1 });
    expect(normalizeDayState(null)).toEqual(createReadyDay());
  });
});

describe('표기', () => {
  it('분 단위 Day도 mm:ss로 표기한다', () => {
    expect(formatDayClock(180_000)).toBe('03:00');
    expect(formatDayClock(59_001)).toBe('01:00');
    expect(formatDayClock(9_000)).toBe('00:09');
    expect(formatDayClock(-1)).toBe('00:00');
  });

  it('종료 임박 강조는 Day 길이의 10%(최소 3초)부터 켠다', () => {
    expect(isDayUrgent(3000, 10_000)).toBe(true);
    expect(isDayUrgent(3001, 10_000)).toBe(false);
    expect(isDayUrgent(18_000, 180_000)).toBe(true);
    expect(isDayUrgent(18_001, 180_000)).toBe(false);
  });
});
