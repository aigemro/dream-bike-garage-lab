import { describe, it, expect } from 'vitest';
import { COLS, ROWS, SIZE, CAP, RECOVERY, INTAKE_ORDER, nextIntakeSlot, recoverEnergy, rollPart, starterBoard, orderMeta, requirements } from './merge-core-shared';

const distance = (index: number) => (index % COLS - (COLS - 1) / 2) ** 2 + (Math.floor(index / COLS) - (ROWS - 1) / 2) ** 2;

describe('D·E 공통 입고 순서 (가운데 → 바깥)', () => {
  it('보드의 모든 칸을 한 번씩 포함한다', () => {
    expect([...INTAKE_ORDER].sort((a, b) => a - b)).toEqual(Array.from({ length: SIZE }, (_, i) => i));
  });

  it('가운데 두 칸에서 시작해 첫 고리를 12시 방향부터 시계 방향으로 돈다', () => {
    expect(INTAKE_ORDER.slice(0, 6)).toEqual([21, 20, 15, 27, 26, 14]);
  });

  it('가운데에서 멀어지는 순서를 지키고 모서리 칸이 마지막이다', () => {
    for (let i = 1; i < SIZE; i++) expect(distance(INTAKE_ORDER[i])).toBeGreaterThanOrEqual(distance(INTAKE_ORDER[i - 1]));
    expect(INTAKE_ORDER.slice(-4).sort((a, b) => a - b)).toEqual([0, 5, 36, 41]);
  });

  it('차 있는 칸은 건너뛰고, 빈칸이 없으면 -1을 돌려준다', () => {
    const board = starterBoard();
    expect(nextIntakeSlot(board)).toBe(21);
    board[21] = { kind: 0, level: 1 };
    expect(nextIntakeSlot(board)).toBe(20);
    board.fill({ kind: 0, level: 1 });
    expect(nextIntakeSlot(board)).toBe(-1);
  });
});

describe('D·E 공통 주문·체력·입고 추첨', () => {
  it('일반 프로젝트 주문 3종을 순환한다', () => {
    expect([0, 1, 2, 3].map(order => orderMeta(order).reward)).toEqual([1000, 1400, 1800, 1000]);
    expect(requirements({ order: 2 })).toEqual([2, 3, 2, 2]);
  });

  it('오프라인 시간의 남은 회복 간격을 보존하고 가득 찬 뒤 시간은 버린다', () => {
    const s = { energy: 25, anchor: 0 };
    recoverEnergy(s, RECOVERY * 2 + 500);
    expect(s).toEqual({ energy: 27, anchor: RECOVERY * 2 });
    recoverEnergy(s, RECOVERY * 20);
    expect(s).toEqual({ energy: CAP, anchor: RECOVERY * 20 });
  });

  it('시계가 뒤로 가면 체력은 그대로 두고 기준 시각만 옮긴다', () => {
    const s = { energy: 20, anchor: 1000 };
    recoverEnergy(s, 500);
    expect(s).toEqual({ energy: 20, anchor: 500 });
  });

  it('미장착 종류가 4회 연속 안 나오면 다음 추첨에서 보장한다', () => {
    const installed = [true, true, true, false];
    const sequence = (...values: number[]) => () => values.shift() ?? 0;
    // 전체 종류 추첨(.9) → 프레임(0) → Lv.1(.99): 미장착 종류가 아니어서 미출현 횟수가 늘어납니다.
    expect(rollPart(installed, 3, sequence(.9, 0, .99))).toMatchObject({ part: { kind: 0, level: 1 }, misses: 4 });
    expect(rollPart(installed, 4, sequence(0, .99))).toMatchObject({ part: { kind: 3, level: 1 }, misses: 0 });
  });

  it('보장 입고는 미장착 종류에서만 고르고, 미장착 종류가 없으면 적용하지 않는다', () => {
    expect(rollPart([true, false, true, true], 0, () => .99, true)).toMatchObject({ part: { kind: 1 }, guaranteed: true });
    expect(rollPart([true, true, true, true], 0, () => .99, true)).toMatchObject({ guaranteed: false });
  });
});
