// 머지 코어 E v3 입력 판정 (순수 로직 · Phaser 비의존)
// 일반 프로젝트 게임 화면과 같은 '탭 선택 → 대상 탭' 흐름을 기본으로 하고, 드래그 놓기도 같은 규칙으로 판정합니다.
import { KINDS, MAX_LEVEL, canMerge, mergeTargets, nextSlot, type State } from './merge-placement-state';

export const NONE = -1;
export type InputOutcome = {
  selected: number;
  merge?: { from: number; to: number };
  message: string;
  tone: 'info' | 'error';
};

function label(s: State, index: number) {
  const part = s.board[index]!;
  return `${KINDS[part.kind]} Lv.${part.level}`;
}

function selectMessage(s: State, index: number) {
  return mergeTargets(s, index).length > 0
    ? `${label(s, index)} 선택 · 반짝이는 이웃 부품을 누르면 그 칸에서 합성돼요.`
    : `${label(s, index)} 선택 · 맞닿은 같은 부품이 없어요. 다음 입고를 기다리거나 반품할 수 있어요.`;
}

/** 보드 칸을 탭했을 때의 결과: 선택·선택 변경·선택 해제·합성 */
export function resolveTap(s: State, selected: number, index: number): InputOutcome {
  const part = s.board[index];
  if (selected === NONE || !s.board[selected]) {
    if (part) return { selected: index, message: selectMessage(s, index), tone: 'info' };
    return index === nextSlot(s)
      ? { selected: NONE, message: '점선 칸은 다음 부품이 들어올 자리예요. 아래 부품 상자를 열어 보세요.', tone: 'info' }
      : { selected: NONE, message: '빈칸이에요. 부품은 상자를 열면 점선 칸에 들어와요.', tone: 'info' };
  }
  if (selected === index) return { selected: NONE, message: '선택을 취소했어요.', tone: 'info' };
  if (canMerge(s, selected, index)) return { selected: NONE, merge: { from: selected, to: index }, message: '', tone: 'info' };
  if (part) return { selected: index, message: selectMessage(s, index), tone: 'info' };
  return { selected, message: '부품은 빈칸으로 옮길 수 없어요. 맞닿은 같은 부품에 겹쳐 합성하세요.', tone: 'error' };
}

/** 드래그한 부품을 놓았을 때의 결과. 합성할 수 없으면 원래 부품을 선택 상태로 남깁니다. */
export function resolveDrop(s: State, from: number, to: number): InputOutcome {
  if (to === from || to === NONE) return { selected: from, message: selectMessage(s, from), tone: 'info' };
  if (canMerge(s, from, to)) return { selected: NONE, merge: { from, to }, message: '', tone: 'info' };
  const source = s.board[from]!, target = s.board[to];
  const message = !target
    ? '부품은 빈칸으로 옮길 수 없어요. 맞닿은 같은 부품에 겹쳐 합성하세요.'
    : target.kind !== source.kind || target.level !== source.level
      ? '같은 종류·같은 레벨 부품끼리만 합성할 수 있어요.'
      : source.level >= MAX_LEVEL
        ? `Lv.${MAX_LEVEL}은 최고 레벨이라 더 합성할 수 없어요.`
        : '상하좌우로 맞닿은 부품끼리만 합성할 수 있어요.';
  return { selected: from, message, tone: 'error' };
}
