// 주문 풀 확장·도감 해금 규칙 테스트 (#266)
import { describe, expect, it } from 'vitest';
import { ORDER_LEVELS } from './merge-placement-state';
import { ORDER_METAS, isBikeRegistered } from './meta-progress';
import {
  CURRENT_ORDER_IDS, ORDER_POOL, REGULAR_CUSTOMERS, activeRegular, autoChooseBoard, availableOrders, chooseFromBoard, createPoolState,
  deliverNext, nextPoolGoal, poolCatalogIssues, poolOrder, simulatePool, workUnits,
} from './order-pool';

const deliverDay = (state: ReturnType<typeof createPoolState>) => { for (let i = 0; i < 3; i += 1) deliverNext(state); };

describe('주문 풀 데이터', () => {
  it('도감의 일반 자전거 20대를 중복 없이 하나씩 주문으로 잇는다', () => {
    expect(poolCatalogIssues()).toEqual([]);
    expect(ORDER_POOL).toHaveLength(20);
  });

  it('처음 3종은 현행 메인 주문과 같은 요구 레벨·보상이다', () => {
    CURRENT_ORDER_IDS.forEach((id, index) => {
      expect(poolOrder(id)!.levels).toEqual(ORDER_LEVELS[index]);
      expect(poolOrder(id)!.reward).toBe(ORDER_METAS[index].reward);
      expect(poolOrder(id)!.bikeId).toBe(ORDER_METAS[index].bikeId);
    });
  });

  it('작업량은 Lv.1 개수로 환산한다', () => {
    expect(workUnits([2, 2, 1, 1])).toBe(6);
    expect(workUnits([4, 2, 2, 1])).toBe(13);
  });
});

describe('현행 순환', () => {
  it('주문 3종을 같은 순서로 반복한다', () => {
    const state = createPoolState('cycle');
    expect(state.today).toEqual(['urban-road', 'trail-mtb', 'aero-sprinter']);
    deliverDay(state);
    expect(state.day).toBe(2);
    expect(state.today).toEqual(['urban-road', 'trail-mtb', 'aero-sprinter']);
  });
});

describe('A안 등급 단계 확장', () => {
  it('Day가 지나면 입문 → 중급 → 고급 주문이 풀에 들어온다', () => {
    expect(availableOrders({ variant: 'tiers', day: 1 })).toHaveLength(3);
    expect(availableOrders({ variant: 'tiers', day: 3 })).toHaveLength(9);
    expect(availableOrders({ variant: 'tiers', day: 6 })).toHaveLength(16);
    expect(availableOrders({ variant: 'tiers', day: 10 })).toHaveLength(20);
  });

  it('도감 등록 전이고 이해도가 높은 자전거의 주문을 먼저 낸다', () => {
    const state = createPoolState('tiers');
    deliverDay(state); // Day 1: 현행 3종 → 각 50%
    expect(state.today).toEqual(['urban-road', 'trail-mtb', 'aero-sprinter']);
    deliverDay(state); // Day 2: 3종 등록
    expect(CURRENT_ORDER_IDS.every((id) => isBikeRegistered(state.collection, id))).toBe(true);
    expect(state.day).toBe(3);
    expect(state.today.every((id) => poolOrder(id)!.unlockDay === 3)).toBe(true);
  });
});

describe('B안 주문 게시판', () => {
  it('하루 시작에 후보 5건을 보여 주고 그중 3건만 고를 수 있다', () => {
    const state = createPoolState('board');
    expect(state.today).toEqual([]);
    expect(state.board).toHaveLength(3); // Day 1은 풀에 3종뿐
    expect(chooseFromBoard(state, ['urban-road'])).toBe(false);
    expect(chooseFromBoard(state, ['urban-road', 'trail-mtb', 'touring-road'])).toBe(false);
    expect(chooseFromBoard(state, autoChooseBoard(state))).toBe(true);
    expect(state.today).toHaveLength(3);
    deliverDay(state);
    expect(chooseFromBoard(state, autoChooseBoard(state))).toBe(true);
    deliverDay(state);
    expect(state.day).toBe(3);
    expect(state.board).toHaveLength(5);
  });
});

describe('C안 단골 손님', () => {
  it('손님이 오면 연속 주문을 하루 1건씩 내고, 3건을 마치면 마지막 자전거를 바로 등록한다', () => {
    const state = createPoolState('regulars');
    deliverDay(state); // Day 1
    const courier = REGULAR_CUSTOMERS[0];
    expect(activeRegular(state)?.id).toBe(courier.id);
    expect(state.today[0]).toBe(courier.orderIds[0]);
    deliverDay(state); deliverDay(state);
    expect(state.regularStep[courier.id]).toBe(2);
    let story: string | undefined;
    for (let i = 0; i < 3; i += 1) story = deliverNext(state)?.storyUnlock ?? story;
    expect(story).toBe('cargo-mini');
    expect(isBikeRegistered(state.collection, 'cargo-mini')).toBe(true);
  });
});

describe('목표와 진행 속도', () => {
  it('현행은 주문 3종만으로 목표가 끝나고, 주문 풀은 20대가 목표에 들어간다', () => {
    const cycle = createPoolState('cycle');
    const tiers = createPoolState('tiers');
    for (let day = 0; day < 2; day += 1) { deliverDay(cycle); deliverDay(tiers); }
    expect(nextPoolGoal(tiers).kind).not.toBe('repeat');
  });

  it('주문 풀 방안은 현행보다 목표가 훨씬 늦게 소진되고, 같은 입력이면 같은 결과다', () => {
    const model = { perUnit: 0.94 };
    const cycle = simulatePool('cycle', model);
    const tiers = simulatePool('tiers', model);
    expect(cycle.goalsExhaustedDay).not.toBeNull();
    expect(tiers.goalsExhaustedDay!).toBeGreaterThan(cycle.goalsExhaustedDay! * 3);
    expect(tiers.daysToAllRegistered).not.toBeNull();
    expect(simulatePool('regulars', model)).toEqual(simulatePool('regulars', model));
  });
});
