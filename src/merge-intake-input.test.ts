import { describe, it, expect } from 'vitest';
import { NONE, resolveTap, resolveDrop, resolveInstall } from './merge-intake-input';
import { fresh, type State } from './merge-intake-state';

function board(parts: Record<number, [number, number]> = {}, installed = [false, false, false, false]): State {
  const s = fresh(0);
  s.board.fill(null);
  s.installed = installed;
  Object.entries(parts).forEach(([index, [kind, level]]) => { s.board[Number(index)] = { kind, level }; });
  return s;
}

describe('D v3 입력 판정 (게임 화면 B안과 같은 탭 선택 → 대상 탭)', () => {
  it('선택 없이 빈칸을 누르면 고르지 않고, 가운데 점선 칸이면 입고 상자를 안내한다', () => {
    const s = board();
    expect(resolveTap(s, NONE, 21)).toMatchObject({ selected: NONE, tone: 'info' });
    expect(resolveTap(s, NONE, 21).message).toContain('입고 상자');
    expect(resolveTap(s, NONE, 0).message).toContain('빈칸');
  });

  it('부품을 누르면 고르고, 장착할 수 있으면 장착 방법을 알려 준다', () => {
    const s = board({ 0: [0, 1], 1: [0, 2] });
    expect(resolveTap(s, NONE, 0)).toMatchObject({ selected: 0 });
    expect(resolveTap(s, NONE, 0).message).toContain('합성');
    expect(resolveTap(s, NONE, 1).message).toContain('장착할 수 있어요');
  });

  it('고른 상태에서 다른 칸을 누르면 그 칸으로 놓고(합성·이동·교환) 놓은 칸을 계속 고른다', () => {
    const s = board({ 0: [0, 1], 30: [0, 1] });
    expect(resolveTap(s, 0, 30)).toMatchObject({ selected: 30, drop: { from: 0, to: 30 } });
    expect(resolveTap(s, 0, 7)).toMatchObject({ selected: 7, drop: { from: 0, to: 7 } });
    expect(resolveTap(s, 0, 0)).toMatchObject({ selected: NONE });
  });

  it('드래그는 보드 밖이면 취소하고, 같은 칸이면 고르고, 다른 칸이면 놓는다', () => {
    const s = board({ 0: [0, 1] });
    expect(resolveDrop(s, 0, NONE)).toMatchObject({ selected: 0, tone: 'info' });
    expect(resolveDrop(s, 0, NONE).message).toContain('취소');
    expect(resolveDrop(s, 0, 0)).toMatchObject({ selected: 0 });
    expect(resolveDrop(s, 0, 9)).toMatchObject({ selected: 9, drop: { from: 0, to: 9 } });
  });

  it('장착은 고른 부품·칩 종류·장착 여부·요구 레벨을 확인하고 이유를 알려 준다', () => {
    const s = board({ 0: [0, 1], 1: [0, 2], 2: [1, 2] }, [false, true, false, false]);
    expect(resolveInstall(s, NONE)).toMatchObject({ selected: NONE, tone: 'error' });
    expect(resolveInstall(s, 1, 1).message).toContain('자리예요');
    expect(resolveInstall(s, 2).message).toContain('이미 장착');
    expect(resolveInstall(s, 0).message).toContain('Lv.2 이상');
    expect(resolveInstall(s, 1)).toMatchObject({ selected: NONE, install: 1 });
    expect(resolveInstall(s, 1, 0)).toMatchObject({ install: 1 });
  });
});
