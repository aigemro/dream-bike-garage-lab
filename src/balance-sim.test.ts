// 경제·밸런스 시뮬레이터 테스트 (#262)
// 결과 수치 자체가 아니라, 메인과 같은 수치를 쓰는지·재현되는지·체력 규칙을 지키는지를 확인합니다.
import { describe, expect, it } from 'vitest';
import { CAP, ORDER_LEVELS, RECOVERY, fresh } from './merge-placement-state';
import { ORDER_METAS, CRAFT_PARTS, UNDERSTANDING_PER_DELIVERY, dreamUpgradeCost } from './meta-progress';
import { RIVERSIDE_ENDURANCE_RACE, createSeededRandom } from './race-progress';
import {
  SESSION_PATTERNS, botStep, buildBalanceReport, dailyEnergy, mean, raceOdds, simulateRealtime, simulateWorkbench,
} from './balance-sim';

describe('메인(aigemro/dream-bike-garage dc3517e)과 같은 수치', () => {
  // 메인 수치가 바뀌면 이 테스트를 메인과 함께 갱신해야 시뮬레이션 결과를 메인 기준으로 읽을 수 있습니다.
  it('주문 요구 레벨·보상', () => {
    expect(ORDER_LEVELS).toEqual([[2, 2, 1, 1], [3, 2, 2, 1], [2, 3, 2, 2]]);
    expect(ORDER_METAS.map((meta) => meta.reward)).toEqual([1000, 1400, 1800]);
  });

  it('알바 체력·회복', () => {
    expect(CAP).toBe(30);
    expect(RECOVERY).toBe(10 * 60 * 1000);
  });

  it('제작·강화·이해도', () => {
    expect(CRAFT_PARTS.map((part) => part.cost)).toEqual([400, 300, 200, 100]);
    expect([1, 2, 3].map(dreamUpgradeCost)).toEqual([350, 700, 1050]);
    expect(UNDERSTANDING_PER_DELIVERY).toBe(50);
  });

  it('대회', () => {
    expect(RIVERSIDE_ENDURANCE_RACE).toMatchObject({ heldEveryDays: 5, entryFee: 500, rankRewards: [2000, 1200, 800], finishReward: 200, distanceMeters: 3000 });
  });
});

describe('봇 행동', () => {
  it('체력을 쓸 수 없고 합성·무료 상자도 없으면 멈춘다', () => {
    const s = fresh(0);
    s.board = s.board.map(() => null);
    expect(botStep(s, 'novice', createSeededRandom(1), false).action).toBe('blocked');
    expect(botStep(s, 'novice', createSeededRandom(1), true).action).toBe('box');
  });

  it('시작 보드에서 첫 주문을 상자 없이 납품한다', () => {
    for (const skill of ['expert', 'novice'] as const) {
      const s = fresh(0);
      const deliveries = [];
      for (let i = 0; i < 4 && deliveries.length === 0; i += 1) deliveries.push(...botStep(s, skill, createSeededRandom(2), false).deliveries);
      expect(deliveries).toEqual([{ orderIndex: 0, reward: 1000 }]);
    }
  });
});

describe('연속 납품', () => {
  it('한 행동으로 납품이 2건 확정되면 두 건을 모두 센다', () => {
    const s = fresh(0);
    s.board = s.board.map(() => null);
    s.installed = [false, false, true, true];
    // 프레임 Lv.1 두 개를 합치면 첫 주문이 끝나고, 남은 부품으로 두 번째 주문(트레일 MTB)까지 바로 끝납니다.
    s.board[0] = { kind: 0, level: 1 };
    s.board[1] = { kind: 0, level: 1 };
    s.board[10] = { kind: 1, level: 2 };
    s.board[20] = { kind: 0, level: 3 };
    s.board[21] = { kind: 1, level: 2 };
    s.board[22] = { kind: 2, level: 2 };
    s.board[23] = { kind: 3, level: 1 };
    expect(botStep(s, 'novice', createSeededRandom(3), false).deliveries).toEqual([
      { orderIndex: 0, reward: 1000 },
      { orderIndex: 1, reward: 1400 },
    ]);
  });
});

describe('작업대 효율', () => {
  it('같은 시드면 같은 결과가 나온다', () => {
    const a = simulateWorkbench({ skill: 'novice', runs: 4, orders: 6 });
    const b = simulateWorkbench({ skill: 'novice', runs: 4, orders: 6 });
    expect(a).toEqual(b);
    expect(a.energyPerOrder).toHaveLength(24);
  });

  it('숙련 봇이 초보 봇보다 주문당 체력을 적게 쓴다', () => {
    const expert = simulateWorkbench({ skill: 'expert', runs: 20, orders: 12 });
    const novice = simulateWorkbench({ skill: 'novice', runs: 20, orders: 12 });
    expect(mean(expert.energyPerOrder)).toBeLessThan(mean(novice.energyPerOrder));
  });

  it('하루 체력은 연속 주문을 하루 단위로 묶어 더한다', () => {
    const summary = { skill: 'novice' as const, runs: 1, orders: 6, energyPerOrder: [1, 2, 3, 4, 5, 6], boxesPerOrder: 0, freeBoxesPerOrder: 0, mergesPerOrder: 0, discardsPerOrder: 0, stuckRunRate: 0, discardRunRate: 0, rescuesPerOrder: 0 };
    expect(dailyEnergy(summary, 3)).toEqual([6, 15]);
    expect(dailyEnergy(summary, 5)).toEqual([15]);
  });
});

describe('실제 시간 진행', () => {
  const base = { orderTarget: 3, energyCap: 30, recoveryMinutes: 10, skill: 'novice' as const, realDays: 3, runs: 3 };

  it('접속이 없으면 진행하지 않는다', () => {
    expect(simulateRealtime({ ...base, sessionHours: [] }).ordersPerRealDay).toBe(0);
  });

  it('체력 상한이 크고 회복이 빠를수록 하루에 더 많이 진행한다', () => {
    const slow = simulateRealtime({ ...base, sessionHours: SESSION_PATTERNS['하루 2회'] });
    const fast = simulateRealtime({ ...base, energyCap: 40, recoveryMinutes: 6, sessionHours: SESSION_PATTERNS['하루 2회'] });
    expect(fast.ordersPerRealDay).toBeGreaterThan(slow.ordersPerRealDay);
  });

  it('하루 주문 수가 적을수록 같은 주문 수로 Day가 더 많이 지난다', () => {
    const two = simulateRealtime({ ...base, orderTarget: 2, sessionHours: SESSION_PATTERNS['하루 2회'] });
    const five = simulateRealtime({ ...base, orderTarget: 5, sessionHours: SESSION_PATTERNS['하루 2회'] });
    expect(two.ordersPerRealDay).toBeCloseTo(five.ordersPerRealDay, 5);
    expect(two.gameDaysPerRealDay).toBeGreaterThan(five.gameDaysPerRealDay);
  });
});

describe('대회 확률', () => {
  it('성능이 높을수록 시상대 확률이 높다', () => {
    const low = raceOdds({ 성능: 1, 스타일: 1, 희귀도: 1 }, RIVERSIDE_ENDURANCE_RACE, 120);
    const high = raceOdds({ 성능: 4, 스타일: 4, 희귀도: 4 }, RIVERSIDE_ENDURANCE_RACE, 120);
    expect(high.podiumRate).toBeGreaterThan(low.podiumRate);
  });
});

describe('보고서', () => {
  it('표 9개를 만들고 같은 옵션이면 같은 내용이다', () => {
    const options = { workbenchRuns: 3, workbenchOrders: 6, realtimeRuns: 1, realDays: 2 };
    const report = buildBalanceReport(options);
    expect(report.match(/^### 표 \d/gm)).toHaveLength(9);
    expect(buildBalanceReport(options)).toBe(report);
  }, 60_000);
});
