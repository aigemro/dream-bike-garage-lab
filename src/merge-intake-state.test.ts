import { describe, it, expect, vi } from 'vitest';
import {
  fresh, supply, supplyBlock, nextSlot, canMerge, mergeTargets, drop, installBlock, canInstall, install, returnPart, restore,
  requirements, CAP, RECOVERY, type State,
} from './merge-intake-state';

const cleared = (s = fresh(0)) => { s.board.fill(null); return s; };
const put = (s: State, index: number, kind: number, level: number) => { s.board[index] = { kind, level }; };

describe('D v3 주문·직접 장착', () => {
  it('첫 주문은 지급 부품만으로 합성·장착하고, 4종이 모이면 1,000 C를 받고 자동 납품한다', () => {
    const s = fresh(0);
    expect(s.installed).toEqual([false, false, false, false]);
    expect(drop(s, 1, 0)).toBe('merged');
    expect(drop(s, 3, 2)).toBe('merged');
    for (const index of [0, 2, 4]) expect(install(s, index)!.events.map(event => event.type)).toEqual(['installed']);
    const last = install(s, 5)!;
    expect(last.events.at(-1)).toEqual({ type: 'delivered', order: 1, reward: 1000, name: '통학용 어반 로드' });
    expect(s.coins).toBe(1000);
    expect(s.energy).toBe(CAP);
    expect(s.installed).toEqual([false, false, false, false]);
    expect(requirements(s)).toEqual([3, 2, 2, 1]);
  });

  it('비어 있거나·이미 장착했거나·레벨이 낮은 부품은 장착하지 않는다', () => {
    const s = cleared();
    put(s, 0, 0, 1); put(s, 1, 0, 2); put(s, 2, 0, 2);
    expect(installBlock(s, 10)).toBe('empty');
    expect(installBlock(s, 0)).toBe('level');
    expect(canInstall(s, 1)).toBe(true);
    install(s, 1);
    expect(installBlock(s, 2)).toBe('installed');
    const before = structuredClone(s);
    expect(install(s, 2)).toBeNull();
    expect(install(s, 0)).toBeNull();
    expect(s).toEqual(before);
  });

  it('납품 뒤 남은 부품은 보드에 그대로 두고 다음 주문으로 넘어간다', () => {
    const s = cleared();
    s.installed = [true, true, true, false];
    s.misses = 3;
    put(s, 0, 3, 1); put(s, 20, 0, 1);
    install(s, 0);
    expect(s.order).toBe(1);
    expect(s.misses).toBe(0);
    expect(s.board[20]).toEqual({ kind: 0, level: 1 });
  });
});

describe('D v3 자유 이동·거리 무관 합성', () => {
  it('떨어진 같은 부품 2개를 대상 칸에서 합성하고 체력을 쓰지 않는다', () => {
    const s = cleared();
    [0, 20, 41].forEach(i => put(s, i, 0, 1));
    expect(mergeTargets(s, 0)).toEqual([20, 41]);
    expect(canMerge(s, 0, 41)).toBe(true);
    expect(drop(s, 0, 41)).toBe('merged');
    expect(s.board[0]).toBeNull();
    expect(s.board[41]).toEqual({ kind: 0, level: 2 });
    expect(s.board[20]).toEqual({ kind: 0, level: 1 });
    expect(s.merges).toBe(1);
    expect(s.energy).toBe(CAP);
  });

  it('다른 종류·다른 레벨·최고 레벨 부품은 잃지 않고 자리를 바꾼다', () => {
    for (const other of [{ kind: 1, level: 1 }, { kind: 0, level: 2 }, { kind: 0, level: 4 }]) {
      const s = fresh(0);
      s.board[0] = { kind: 0, level: other.level === 4 ? 4 : 1 };
      s.board[41] = other;
      const before = structuredClone(s.board);
      expect(canMerge(s, 0, 41)).toBe(false);
      expect(drop(s, 0, 41)).toBe('swapped');
      expect(s.board[0]).toEqual(before[41]);
      expect(s.board[41]).toEqual(before[0]);
      expect(s.merges).toBe(0);
    }
  });

  it('같은 칸·빈 출발 칸·보드 밖 놓기는 아무것도 바꾸지 않는다', () => {
    const s = fresh(0);
    const before = structuredClone(s);
    for (const [from, to] of [[0, 0], [0, -1], [0, 42], [42, 0], [20, 0], [0, 1.2]]) expect(drop(s, from, to)).toBe('none');
    expect(s).toEqual(before);
  });

  it('같은 부품 옆에 옮겨도 자동으로 합성하지 않는다', () => {
    const s = fresh(0);
    expect(drop(s, 6, 7)).toBe('moved');
    expect(s.board[7]?.level).toBe(1);
    expect(s.merges).toBe(0);
  });
});

describe('D v3 입고·반납·저장', () => {
  it('보드 가운데부터 바깥으로 입고하고, 비운 가운데 칸을 다시 먼저 쓴다', () => {
    const s = fresh(0);
    expect(nextSlot(s)).toBe(21);
    expect(supply(s, 0, () => 0)!.events[0]).toMatchObject({ type: 'placed', index: 21, part: { kind: 0 } });
    expect(s.energy).toBe(CAP - 1);
    expect(nextSlot(s)).toBe(20);
    supply(s, 0, () => 0);
    expect(nextSlot(s)).toBe(15);
    s.board[21] = null;
    expect(nextSlot(s)).toBe(21);
  });

  it('작업대가 가득 차거나 체력이 없으면 추첨·차감하지 않는다', () => {
    const s = fresh(0), rng = vi.fn(() => 0);
    s.board.fill({ kind: 0, level: 1 });
    expect(supplyBlock(s)).toBe('full');
    expect(supply(s, 0, rng)).toBeNull();
    expect(s.energy).toBe(CAP);
    s.board[21] = null; s.energy = 0;
    expect(supplyBlock(s)).toBe('energy');
    expect(supply(s, 0, rng)).toBeNull();
    expect(s.board[21]).toBeNull();
    expect(rng).not.toHaveBeenCalled();
  });

  it('반납은 부품을 지우고 체력은 돌려주지 않는다', () => {
    const s = fresh(0);
    s.energy = 10;
    expect(returnPart(s, 0)).toBe(true);
    expect(s.board[0]).toBeNull();
    expect(s.returned).toBe(1);
    expect(s.energy).toBe(10);
    expect(returnPart(s, 0)).toBe(false);
    expect(returnPart(s, 99)).toBe(false);
  });

  it('v2 진행을 그대로 복구하고, 복구할 때 지난 시간만큼 체력을 회복한다', () => {
    const s = fresh(0);
    drop(s, 1, 0);
    s.returned = 2;
    expect(restore(JSON.stringify(s), 0)).toEqual(s);
    s.energy = 20;
    expect(restore(JSON.stringify(s), RECOVERY * 2).energy).toBe(22);
  });

  it('D v1·v2 저장(성장 포함)을 v3 저장으로 옮긴다', () => {
    const v1 = { ...fresh(0), version: 1, growth: 2, order: 4, coins: 1500 } as Record<string, unknown>;
    delete v1.returned;
    const migrated = restore(JSON.stringify(v1), 0);
    expect(migrated).toMatchObject({ version: 2, order: 4, coins: 1500, returned: 0 });
    expect('growth' in migrated).toBe(false);
  });

  it('손상된 저장은 처음부터 시작한다', () => {
    const s = fresh(0);
    expect(restore('{', 100)).toEqual(fresh(100));
    expect(restore(JSON.stringify({ ...s, board: [] }), 100)).toEqual(fresh(100));
    expect(restore(JSON.stringify({ ...s, energy: 99 }), 100)).toEqual(fresh(100));
    expect(restore(JSON.stringify({ ...s, version: 7 }), 100)).toEqual(fresh(100));
  });
});
