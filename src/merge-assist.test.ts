// E v3 막힘 완화 보조 규칙 테스트 (#264)
import { describe, expect, it } from 'vitest';
import { COLS, SIZE, fresh, supply, type Part, type State } from './merge-placement-state';
import {
  HINT_IDLE_MS, applyRescue, hasMerge, isStuck, localDate, parseRescueRecord, recommendMerge, rescueRemaining, shouldShowHint, useRescue,
} from './merge-assist';

// 상하좌우로 같은 부품이 맞닿지 않게 채운 꽉 찬 보드: 종류 = (열 + 2 × 행) % 4, 모두 Lv.1
function stuckBoard(): State {
  const s = fresh(0); // 첫 주문(프레임·휠셋 Lv.2, 구동계·핸들바 Lv.1) · 구동계·핸들바 장착됨
  s.board = Array.from({ length: SIZE }, (_, index): Part => ({ kind: (index % COLS + 2 * Math.floor(index / COLS)) % 4, level: 1 }));
  return s;
}

describe('막힘 판정', () => {
  it('꽉 찼고 합성할 쌍이 없을 때만 막힘이다', () => {
    const s = stuckBoard();
    expect(hasMerge(s)).toBe(false);
    expect(isStuck(s)).toBe(true);
    s.board[1] = { kind: 0, level: 1 }; // 0번 칸(프레임 Lv.1)과 맞닿은 같은 부품
    expect(isStuck(s)).toBe(false);
    const open = stuckBoard();
    open.board[20] = null;
    expect(isStuck(open)).toBe(false);
  });
});

describe('B안 합성 추천', () => {
  it('합성할 쌍이 없으면 추천하지 않는다', () => {
    expect(recommendMerge(stuckBoard())).toBeNull();
  });

  it('납품이 일어나는 쌍을 먼저 추천하고, 같은 상태면 항상 같은 쌍을 고른다', () => {
    const s = fresh(0);
    s.board = s.board.map(() => null);
    s.board[0] = { kind: 2, level: 1 }; // 이미 장착된 구동계 쌍(합쳐도 납품 없음)
    s.board[1] = { kind: 2, level: 1 };
    s.board[10] = { kind: 0, level: 2 }; // 합성 쌍이 없는 남는 프레임
    s.installed = [true, false, true, true]; // 휠셋만 남은 상태
    s.board[20] = { kind: 1, level: 1 }; // 휠셋 쌍을 합치면 Lv.2 장착 → 납품
    s.board[21] = { kind: 1, level: 1 };
    const pick = recommendMerge(s)!;
    expect(pick).toMatchObject({ from: 20, to: 21, delivers: true });
    expect(recommendMerge(s)).toEqual(pick);
  });

  it('선택 중이 아니고 막힘 직전이거나 한동안 입력이 없을 때만 추천을 보여 준다', () => {
    const s = fresh(0);
    expect(shouldShowHint(s, 0, false)).toBe(false);
    expect(shouldShowHint(s, HINT_IDLE_MS, false)).toBe(true);
    expect(shouldShowHint(s, HINT_IDLE_MS, true)).toBe(false);
    const crowded = stuckBoard();
    crowded.board[1] = { kind: 0, level: 1 };
    expect(shouldShowHint(crowded, 0, false)).toBe(true);
    expect(shouldShowHint(stuckBoard(), HINT_IDLE_MS, false)).toBe(false);
  });
});

describe('C안 막힘 구제(정리)', () => {
  it('막힘이 아니면 정리하지 않는다', () => {
    const s = fresh(0);
    expect(applyRescue(s)).toBeNull();
    expect(s.freeBoxes).toBe(0);
  });

  it('필요 없는 낮은 레벨 부품 2개를 회수하고 다음 상자를 무료·필수 부품 확정으로 바꾼다', () => {
    const s = stuckBoard();
    s.combo = 2;
    const result = applyRescue(s)!;
    // 장착이 끝난 구동계(2)·핸들바(3) 중 칸 순서가 빠른 두 개를 회수합니다.
    expect(result.removed.map((cell) => cell.index)).toEqual([2, 3]);
    expect(result.removed.every((cell) => cell.part.kind >= 2)).toBe(true);
    expect(s).toMatchObject({ freeBoxes: 1, guarantees: 1, combo: 2, undo: null });
    const energy = s.energy;
    const box = supply(s, 0, () => 0.99)!;
    const placed = box.events[0];
    if (placed.type !== 'placed') throw new Error('첫 이벤트가 입고가 아닙니다');
    expect(placed).toMatchObject({ free: true, guaranteed: true });
    expect([0, 1]).toContain(placed.part.kind); // 아직 장착하지 않은 프레임·휠셋 중 하나
    expect(s.energy).toBe(energy);
  });

  it('하루 1회이며 날짜가 바뀌면 다시 쓸 수 있다', () => {
    expect(rescueRemaining(null, '2026-10-09')).toBe(1);
    const used = useRescue(null, '2026-10-09');
    expect(rescueRemaining(used, '2026-10-09')).toBe(0);
    expect(rescueRemaining(used, '2026-10-10')).toBe(1);
    expect(useRescue(used, '2026-10-10')).toEqual({ date: '2026-10-10', used: 1 });
  });

  it('저장 기록이 손상됐으면 기록 없음으로 본다', () => {
    expect(parseRescueRecord(null)).toBeNull();
    expect(parseRescueRecord('{bad')).toBeNull();
    expect(parseRescueRecord(JSON.stringify({ date: '2026-10-09', used: -1 }))).toBeNull();
    expect(parseRescueRecord(JSON.stringify({ date: '2026-10-09', used: 1 }))).toEqual({ date: '2026-10-09', used: 1 });
    expect(localDate(new Date(2026, 9, 9, 23, 59))).toBe('2026-10-09');
  });
});
