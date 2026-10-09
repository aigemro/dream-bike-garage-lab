import { describe, it, expect, vi } from 'vitest';
import {
  fresh, supply, supplyBlock, nextSlot, drop, canMerge, mergeTargets, undo, returnPart, restore, recover,
  requirements, orderMeta, RECOVERY, CAP, ORDER_LEVELS, type State,
} from './merge-placement-state';
import { ORDER_METAS } from './meta-progress';

const cleared = (s = fresh(0)) => { s.board.fill(null); return s; };
const put = (s: State, index: number, kind: number, level: number) => { s.board[index] = { kind, level }; };
// 구동계(2)·핸들바(3)는 첫 주문에서 이미 장착되어 있어 합성해도 자동 장착되지 않는 쌍입니다.
const comboPairs: Array<[number, number]> = [[13, 12], [15, 14], [25, 24], [27, 26], [31, 30]];
function boardWithPairs(count: number) {
  const s = cleared();
  comboPairs.slice(0, count).forEach(([from, to], i) => { put(s, from, 2 + (i % 2), 1); put(s, to, 2 + (i % 2), 1); });
  return s;
}

describe('E v3 주문·자동 장착', () => {
  it('일반 프로젝트 주문 3종의 이름·보상·요구 레벨을 사용한다', () => {
    expect(ORDER_LEVELS).toEqual([[2, 2, 1, 1], [3, 2, 2, 1], [2, 3, 2, 2]]);
    expect([0, 1, 2].map(order => orderMeta(order).name)).toEqual(ORDER_METAS.map(meta => meta.name));
    expect(orderMeta(3)).toBe(ORDER_METAS[0]);
    expect(requirements({ order: 4 })).toEqual([3, 2, 2, 1]);
  });

  it('시작 주문을 지정하면 그 주문 요구 기준으로 시작 부품을 장착한다', () => {
    const s = fresh(0, 1);
    expect(s.order).toBe(1);
    expect(requirements(s)).toEqual([3, 2, 2, 1]);
    expect(s.installed).toEqual([false, false, false, true]);
    expect(s.board[4]).toEqual({ kind: 2, level: 1 });
  });

  it('시작할 때 이미 요구를 채운 부품은 바로 장착한다', () => {
    const s = fresh(0);
    expect(s.installed).toEqual([false, false, true, true]);
    expect(s.board[4]).toBeNull();
    expect(s.board[5]).toBeNull();
    expect(nextSlot(s)).toBe(21);
  });

  it('첫 주문은 프레임·휠셋 합성으로 장착하고 1,000 C를 받아 다음 주문으로 넘어간다', () => {
    const s = fresh(0);
    expect(drop(s, 1, 0)!.events.map(event => event.type)).toEqual(['merged', 'installed']);
    expect(s.installed).toEqual([true, false, true, true]);
    const second = drop(s, 3, 2)!;
    expect(second.events.at(-1)).toEqual({ type: 'delivered', order: 1, reward: 1000, name: '통학용 어반 로드' });
    expect(s.coins).toBe(1000);
    expect(requirements(s)).toEqual([3, 2, 2, 1]);
  });

  it('납품 직후 다음 주문을 이미 채운 부품은 같은 행동에서 장착한다', () => {
    const s = cleared();
    s.installed = [true, false, true, true];
    put(s, 0, 1, 1); put(s, 1, 1, 1);
    put(s, 20, 0, 3); put(s, 30, 2, 2);
    const result = drop(s, 1, 0)!;
    expect(result.events.map(event => event.type)).toEqual(['merged', 'installed', 'delivered', 'installed', 'installed']);
    expect(s.order).toBe(1);
    expect(s.installed).toEqual([true, false, true, false]);
    expect(s.board[20]).toBeNull();
    expect(s.board[30]).toBeNull();
  });

  it('남은 부품으로 다음 주문까지 완성되면 한 행동에서 연속 납품한다', () => {
    const s = cleared();
    s.installed = [true, true, true, false];
    put(s, 0, 3, 1); put(s, 1, 3, 1);
    put(s, 10, 0, 3); put(s, 11, 1, 2); put(s, 12, 2, 2); put(s, 13, 3, 1);
    const result = drop(s, 1, 0)!;
    expect(result.events.filter(event => event.type === 'delivered').map(event => event.reward)).toEqual([1000, 1400]);
    expect(s.order).toBe(2);
    expect(s.coins).toBe(2400);
    expect(s.board.every(part => part === null)).toBe(true);
  });

  it('요구 레벨에 가장 가까운 부품부터 장착해 상위 부품을 아낀다', () => {
    const s = cleared();
    s.installed = [false, false, true, true];
    put(s, 0, 0, 3); put(s, 30, 0, 1); put(s, 31, 0, 1);
    const result = drop(s, 31, 30)!;
    expect(result.events.find(event => event.type === 'installed')).toMatchObject({ from: 30, part: { kind: 0, level: 2 } });
    expect(s.board[0]).toEqual({ kind: 0, level: 3 });
  });
});

describe('E v3 상자·인접 합성', () => {
  it('예정 칸에 바로 배치하고 체력을 1 쓴다', () => {
    const s = fresh(0);
    const result = supply(s, 0, () => .9)!;
    expect(result.events[0]).toMatchObject({ type: 'placed', index: 21, part: { kind: 3, level: 1 }, free: false, guaranteed: false });
    expect(s.energy).toBe(CAP - 1);
    expect(nextSlot(s)).toBe(20);
  });

  it('작업대가 가득 차거나 체력이 없으면 추첨·차감하지 않는다', () => {
    const s = fresh(0), rng = vi.fn(() => 0);
    s.board.fill({ kind: 0, level: 1 });
    expect(supplyBlock(s)).toBe('full');
    expect(supply(s, 0, rng)).toBeNull();
    s.board[0] = null; s.energy = 0;
    expect(supplyBlock(s)).toBe('energy');
    expect(supply(s, 0, rng)).toBeNull();
    expect(rng).not.toHaveBeenCalled();
  });

  it('상하좌우 이웃만 대상 칸에서 합성한다', () => {
    const s = cleared();
    put(s, 7, 1, 1); put(s, 8, 1, 1); put(s, 13, 1, 1);
    expect(mergeTargets(s, 7).sort((a, b) => a - b)).toEqual([8, 13]);
    expect(drop(s, 7, 13)!.events[0]).toMatchObject({ type: 'merged', from: 7, to: 13, part: { kind: 1, level: 2 } });
    expect(s.board[7]).toBeNull();
  });

  it('떨어진·대각선·줄바꿈·다른 종류·같은 칸·최고 레벨 합성은 거부한다', () => {
    for (const [from, to, a, b] of [[0, 41, 1, 1], [0, 7, 1, 1], [5, 6, 1, 1], [0, 1, 4, 4], [0, 1, 1, 2], [0, 0, 1, 1]]) {
      const s = cleared();
      put(s, from, 0, a); put(s, to, 0, b);
      const before = structuredClone(s);
      expect(canMerge(s, from, to)).toBe(false);
      expect(drop(s, from, to)).toBeNull();
      expect(s).toEqual(before);
    }
  });
});

describe('E v3 연쇄 합성 보너스', () => {
  it('상자를 열지 않고 3연쇄하면 무료 상자를 받고, 무료 상자는 체력을 쓰지 않는다', () => {
    const s = boardWithPairs(3);
    drop(s, 13, 12); drop(s, 15, 14);
    const third = drop(s, 25, 24)!;
    expect(third.events).toContainEqual({ type: 'bonus', bonus: 'free-box', combo: 3 });
    expect(s.freeBoxes).toBe(1);
    const result = supply(s, 0, () => .9)!;
    expect(result.events[0]).toMatchObject({ type: 'placed', free: true });
    expect(s.energy).toBe(CAP);
    expect(s.freeBoxes).toBe(0);
    expect(s.freeUsed).toBe(1);
    expect(s.combo).toBe(0);
  });

  it('5연쇄하면 다음 상자에서 아직 장착하지 않은 종류가 확정으로 나온다', () => {
    const s = boardWithPairs(5);
    comboPairs.forEach(([from, to]) => drop(s, from, to));
    expect(s.guarantees).toBe(1);
    const placed = supply(s, 0, () => .99)!.events[0];
    expect(placed).toMatchObject({ type: 'placed', guaranteed: true, free: true });
    if (placed.type === 'placed') expect([0, 1]).toContain(placed.part.kind);
    expect(s.guarantees).toBe(0);
  });

  it('되돌리기는 합성과 함께 받은 연쇄 보너스·자동 진행까지 되돌린다', () => {
    const s = boardWithPairs(3);
    drop(s, 13, 12); drop(s, 15, 14);
    const before = structuredClone(s);
    drop(s, 25, 24);
    expect(s.freeBoxes).toBe(1);
    expect(undo(s)).toBe(true);
    expect({ ...s, undo: null }).toEqual({ ...before, undo: null });
    expect(undo(s)).toBe(false);
  });

  it('새 상자를 열면 연쇄가 끊기고 되돌리기 기록이 지워진다', () => {
    const s = boardWithPairs(2);
    drop(s, 13, 12);
    supply(s, 0, () => .9);
    expect(s.combo).toBe(0);
    expect(s.undo).toBeNull();
    expect(undo(s)).toBe(false);
  });

  it('반품은 연쇄를 끊지 않고, 예정 칸을 비우며 되돌릴 수 있다', () => {
    const s = boardWithPairs(1);
    drop(s, 13, 12);
    const at = nextSlot(s);
    put(s, at, 1, 1);
    expect(returnPart(s, at)).toBe(true);
    expect(s.combo).toBe(1);
    expect(nextSlot(s)).toBe(at);
    expect(undo(s)).toBe(true);
    expect(s.board[at]).not.toBeNull();
  });
});

describe('E v3 체력·저장', () => {
  it('되돌리기 후에도 회복한 체력과 회복 간격을 유지한다', () => {
    const s = fresh(0);
    returnPart(s, 0);
    s.energy = 29; s.anchor = 0;
    recover(s, RECOVERY);
    undo(s);
    expect(s.energy).toBe(30);
    expect(s.anchor).toBe(RECOVERY);
  });

  it('v3 진행을 그대로 복구하고, 손상된 값이나 기록에 끼워 넣은 체력은 받아들이지 않는다', () => {
    const s = fresh(0);
    returnPart(s, 0);
    expect(restore(JSON.stringify(s), 0)).toEqual(s);
    const raw = JSON.parse(JSON.stringify(s));
    raw.undo.energy = 999; raw.undo.anchor = 999;
    const clean = restore(JSON.stringify(raw), 0);
    undo(clean);
    expect(clean.energy).toBe(CAP);
    expect(clean.anchor).toBe(0);
    raw.board = [];
    expect(restore(JSON.stringify(raw), 0)).toEqual(fresh(0));
    expect(restore('{broken', 0)).toEqual(fresh(0));
  });

  it('v2 저장을 v3로 옮기고 새 주문 규칙으로 한 번 정리한다', () => {
    const v2 = {
      version: 2, board: Array(42).fill(null), installed: [false, false, false, false], order: 0, coins: 500,
      growth: 1, merges: 4, returned: 1, energy: 20, anchor: 0, misses: 0, supplied: 6, undo: null,
    };
    v2.board[4] = { kind: 2, level: 1 }; v2.board[5] = { kind: 3, level: 1 }; v2.board[10] = { kind: 0, level: 1 };
    const migrated = restore(JSON.stringify(v2), 0);
    expect(migrated).toMatchObject({ version: 3, coins: 500, merges: 4, energy: 20, combo: 0, freeBoxes: 0, guarantees: 0, freeUsed: 0 });
    expect('growth' in migrated).toBe(false);
    expect(migrated.installed).toEqual([false, false, true, true]);
    expect(migrated.board[10]).toEqual({ kind: 0, level: 1 });
  });

  it('v1의 대기·보류 부품을 예정 칸으로 옮긴다', () => {
    const v1: Record<string, unknown> = {
      version: 1, board: Array(42).fill(null), installed: [false, false, false, false], order: 0, coins: 0,
      growth: 0, merges: 0, returned: 0, energy: 30, anchor: 0, misses: 0, supplied: 0,
      pending: { kind: 2, level: 1 }, held: { kind: 3, level: 2 },
    };
    (v1.board as unknown[])[4] = { kind: 2, level: 1 };
    (v1.board as unknown[])[5] = { kind: 3, level: 1 };
    const migrated = restore(JSON.stringify(v1), 0);
    expect(migrated.board[21]).toEqual({ kind: 2, level: 1 });
    expect(migrated.board[20]).toEqual({ kind: 3, level: 2 });
    expect(migrated.undo).toBeNull();
  });
});
