import { describe, it, expect } from 'vitest';
import { NONE, resolveTap, resolveDrop } from './merge-placement-input';
import { fresh, type State } from './merge-placement-state';

function board(parts: Record<number, [number, number]> = {}): State {
  const s = fresh(0);
  s.board.fill(null);
  Object.entries(parts).forEach(([index, [kind, level]]) => { s.board[Number(index)] = { kind, level }; });
  return s;
}

describe('E v3 입력 판정 (게임 화면 B안과 같은 탭 선택 → 대상 탭)', () => {
  it('빈칸 탭은 선택하지 않고, 점선 칸이면 부품 상자를 안내한다', () => {
    const s = board();
    expect(resolveTap(s, NONE, 38)).toMatchObject({ selected: NONE, tone: 'info' });
    expect(resolveTap(s, NONE, 38).message).toContain('부품 상자');
    expect(resolveTap(s, NONE, 0).message).toContain('빈칸');
  });

  it('부품을 탭하면 선택하고, 맞닿은 같은 부품을 탭하면 그 칸에서 합성한다', () => {
    const s = board({ 0: [0, 1], 1: [0, 1] });
    const selected = resolveTap(s, NONE, 0);
    expect(selected).toMatchObject({ selected: 0, tone: 'info' });
    expect(selected.message).toContain('반짝이는');
    expect(resolveTap(s, 0, 1)).toMatchObject({ selected: NONE, merge: { from: 0, to: 1 } });
  });

  it('합성할 이웃이 없으면 선택하면서 반품·다음 입고를 안내한다', () => {
    const s = board({ 0: [0, 1], 20: [0, 1] });
    expect(resolveTap(s, NONE, 0).message).toContain('반품');
  });

  it('떨어진 부품을 탭하면 선택을 옮기고, 같은 부품을 다시 탭하면 선택을 해제한다', () => {
    const s = board({ 0: [0, 1], 20: [0, 1] });
    expect(resolveTap(s, 0, 20)).toMatchObject({ selected: 20 });
    expect(resolveTap(s, 0, 0)).toMatchObject({ selected: NONE });
  });

  it('선택 중 빈칸을 탭해도 이동하지 않고 오류로 안내한다', () => {
    const s = board({ 0: [0, 1] });
    expect(resolveTap(s, 0, 1)).toMatchObject({ selected: 0, tone: 'error' });
  });

  it('드래그를 놓으면 합성하거나, 합성할 수 없는 이유를 알리고 원래 부품을 선택한다', () => {
    const s = board({ 0: [0, 1], 1: [0, 1], 6: [1, 1], 12: [0, 1], 2: [3, 4], 3: [3, 4] });
    expect(resolveDrop(s, 0, 1)).toMatchObject({ selected: NONE, merge: { from: 0, to: 1 } });
    expect(resolveDrop(s, 0, 7)).toMatchObject({ selected: 0, tone: 'error' });
    expect(resolveDrop(s, 0, 7).message).toContain('빈칸');
    expect(resolveDrop(s, 0, 6).message).toContain('같은 종류');
    expect(resolveDrop(s, 0, 12).message).toContain('맞닿은');
    expect(resolveDrop(s, 2, 3).message).toContain('최고 레벨');
    expect(resolveDrop(s, 0, NONE)).toMatchObject({ selected: 0, tone: 'info' });
  });
});
