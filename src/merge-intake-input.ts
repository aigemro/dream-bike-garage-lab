// 머지 코어 D v3 입력 판정 (순수 로직 · Phaser 비의존)
// 일반 프로젝트 게임 화면과 같은 '탭 선택 → 대상 탭' 흐름: 같은 부품이면 합성, 빈칸이면 이동, 다른 부품이면 자리 교환.
// 선택한 부품은 [장착] 버튼·주문 칩 탭·주문 카드로 끌어 놓기로 자전거에 직접 장착합니다.
import { KINDS, canInstall, installBlock, nextSlot, requirements, type State } from './merge-intake-state';

export const NONE = -1;
export type InputOutcome = {
  selected: number;
  drop?: { from: number; to: number };
  install?: number;
  message: string;
  tone: 'info' | 'error';
};

function label(s: State, index: number) {
  const part = s.board[index]!;
  return `${KINDS[part.kind]} Lv.${part.level}`;
}

function selectMessage(s: State, index: number) {
  return canInstall(s, index)
    ? `${label(s, index)} 선택 · 장착할 수 있어요. [장착]을 누르거나 주문 카드로 끌어 놓으세요.`
    : `${label(s, index)} 선택 · 같은 부품에 겹치면 합성, 빈칸은 이동, 다른 부품은 자리 교환이에요.`;
}

/** 보드 칸을 탭했을 때의 결과: 선택, 선택 해제, 또는 선택 부품을 그 칸으로 놓기(합성·이동·교환) */
export function resolveTap(s: State, selected: number, index: number): InputOutcome {
  if (selected === NONE || !s.board[selected]) {
    if (s.board[index]) return { selected: index, message: selectMessage(s, index), tone: 'info' };
    return index === nextSlot(s)
      ? { selected: NONE, message: '점선 칸은 다음 입고 자리예요. 아래 입고 상자를 열어 보세요.', tone: 'info' }
      : { selected: NONE, message: '빈칸이에요. 부품을 먼저 고른 뒤 누르면 이곳으로 옮겨요.', tone: 'info' };
  }
  if (selected === index) return { selected: NONE, message: '선택을 취소했어요.', tone: 'info' };
  return { selected: index, drop: { from: selected, to: index }, message: '', tone: 'info' };
}

/** 드래그한 부품을 보드 칸에 놓았을 때의 결과. 보드 밖이면 이동을 취소하고 원래 부품을 선택합니다. */
export function resolveDrop(s: State, from: number, to: number): InputOutcome {
  if (to === NONE) return { selected: from, message: '작업대 밖에 놓아 이동을 취소했어요.', tone: 'info' };
  if (to === from) return { selected: from, message: selectMessage(s, from), tone: 'info' };
  return { selected: to, drop: { from, to }, message: '', tone: 'info' };
}

/** 장착 시도: [장착] 버튼(kind 없음)·주문 칩 탭(kind)·주문 카드로 끌어 놓기(kind 없음) */
export function resolveInstall(s: State, selected: number, kind?: number): InputOutcome {
  const part = selected === NONE ? null : s.board[selected];
  if (!part) return { selected: NONE, message: '장착할 부품을 먼저 눌러 고르세요.', tone: 'error' };
  if (kind !== undefined && kind !== part.kind) {
    return { selected, message: `이 칩은 ${KINDS[kind]} 자리예요. 고른 부품과 종류가 달라요.`, tone: 'error' };
  }
  const block = installBlock(s, selected);
  if (block === 'installed') return { selected, message: '이미 장착한 종류예요. 남은 부품은 다음 주문에 쓸 수 있어요.', tone: 'error' };
  if (block === 'level') {
    return { selected, message: `Lv.${requirements(s)[part.kind]} 이상이 필요해요. 같은 부품을 겹쳐 레벨을 올리세요.`, tone: 'error' };
  }
  return { selected: NONE, install: selected, message: '', tone: 'info' };
}
