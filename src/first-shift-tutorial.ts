// 첫 영업 튜토리얼 규칙 (#265 · 순수 로직, Phaser·DOM 비의존)
// E v3 시작 보드(프레임 0·1·6, 휠셋 2·3·8, 구동계 4·핸들바 5 → 구동계·핸들바는 바로 장착)에서
// 첫 주문(어반 로드: 프레임·휠셋 Lv.2)을 끝내기까지의 안내를 세 방안으로 비교합니다.
// - static(A안): 메인 현행과 같은 정지 안내 6단계. 다 읽으면 자유 플레이
// - guided(B안): 실제 작업대에서 지정한 행동만 허용하는 단계 안내(프레임 합성 → 휠셋 합성 → 납품 → 상자 열기)
// - contextual(C안): 안내 없이 시작하고, 무입력·잘못된 탭이 반복될 때만 그 상황의 한 줄 힌트
import { COLS, mergeTargets, nextSlot, type State } from './merge-placement-state';
import { hasMerge, recommendMerge } from './merge-assist';

export type TutorialMode = 'static' | 'guided' | 'contextual';
export const TUTORIAL_LABELS: Record<TutorialMode, string> = {
  static: 'A안 정지 안내 6단계',
  guided: 'B안 단계 잠금 안내',
  contextual: 'C안 맥락 힌트',
};

// 강조 영역: 주문 카드·보드 칸·부품 상자·보드 전체·선반 2행
export type TutorialTarget =
  | { kind: 'order' }
  | { kind: 'cells'; cells: number[] }
  | { kind: 'box' }
  | { kind: 'board' }
  | { kind: 'shelf-info' };

// 단계가 끝나는 조건: 다음 버튼 / 지정 칸 합성 / 납품 / 상자 열기
export type StepAdvance = { on: 'next' } | { on: 'merge'; cells: [number, number] } | { on: 'deliver' } | { on: 'box' };

export type TutorialStep = { id: string; title: string; text: string; target: TutorialTarget; advance: StepAdvance };

/** A안: 메인 현행 안내와 같은 정지 6단계 (실제 조작 없음) */
export const STATIC_STEPS: TutorialStep[] = [
  { id: 'order', title: '1 · 주문 확인', text: '고객 주문이 도착했어요!\n필요한 부품 4종과 레벨을\n먼저 확인해 주세요.', target: { kind: 'order' }, advance: { on: 'next' } },
  { id: 'box', title: '2 · 부품 상자', text: '상자를 열면 알바 체력 1을 쓰고\n점선 칸에 부품이 들어와요.\n가운데부터 바깥으로 채워져요.', target: { kind: 'box' }, advance: { on: 'next' } },
  { id: 'merge', title: '3 · 이웃 합성', text: '부품은 옮길 수 없어요.\n맞닿은 같은 부품 2개를\n차례로 누르면 합성돼요.', target: { kind: 'board' }, advance: { on: 'next' } },
  { id: 'combo', title: '4 · 연쇄 보너스', text: '상자 없이 이어서 3번 합성하면\n무료 상자, 5번이면 필요한\n부품이 확정으로 나와요!', target: { kind: 'shelf-info' }, advance: { on: 'next' } },
  { id: 'install', title: '5 · 장착·납품', text: '목표 레벨이 되면 바로 장착!\n4종을 모두 달면 납품되고\n다음 주문이 이어져요.', target: { kind: 'order' }, advance: { on: 'next' } },
  { id: 'energy', title: '6 · 알바 체력', text: '체력은 10분마다 1씩 차요.\n체력이 떨어지면 쉬었다가\n이어서 하면 돼요.', target: { kind: 'shelf-info' }, advance: { on: 'next' } },
];

/** B안: 시작 보드로 첫 주문을 손으로 끝내게 하는 단계 안내 */
export const GUIDED_STEPS: TutorialStep[] = [
  { id: 'order', title: '첫 주문이 왔어요', text: '어반 로드에 프레임·휠셋 Lv.2가\n필요해요. 구동계·핸들바는 지급\n부품으로 이미 달았어요.', target: { kind: 'order' }, advance: { on: 'next' } },
  { id: 'frame', title: '프레임 합치기', text: '맞닿은 프레임 두 개를\n차례로 눌러 합쳐 보세요.\n(끌어다 놓아도 돼요)', target: { kind: 'cells', cells: [0, 1] }, advance: { on: 'merge', cells: [0, 1] } },
  { id: 'wheel', title: '휠셋 합치기', text: 'Lv.2 프레임이 바로 장착됐어요!\n이번엔 휠셋 두 개를\n합쳐 보세요.', target: { kind: 'cells', cells: [2, 3] }, advance: { on: 'merge', cells: [2, 3] } },
  { id: 'delivered', title: '납품 완료!', text: '4종을 다 달면 바로 납품되고\n급여를 받아요. 다음 주문도\n이어서 들어와요.', target: { kind: 'order' }, advance: { on: 'next' } },
  { id: 'box', title: '부품 상자 열기', text: '새 부품은 상자에서 나와요.\n상자는 알바 체력 1을 써요.\n상자를 열어 보세요.', target: { kind: 'box' }, advance: { on: 'box' } },
  { id: 'rules', title: '작업대 규칙', text: '부품은 점선 칸에 들어오고\n옮길 수 없어요. 맞닿은 같은\n부품끼리만 합쳐져요.', target: { kind: 'board' }, advance: { on: 'next' } },
  { id: 'combo', title: '연쇄 보너스', text: '상자 없이 3번 이어 합치면\n무료 상자! 합칠 쌍을 모아 두면\n체력을 아낄 수 있어요.', target: { kind: 'shelf-info' }, advance: { on: 'next' } },
];

export function tutorialSteps(mode: TutorialMode): TutorialStep[] {
  return mode === 'static' ? STATIC_STEPS : mode === 'guided' ? GUIDED_STEPS : [];
}

export type TutorialProgress = { mode: TutorialMode; step: number; done: boolean };

export function createTutorial(mode: TutorialMode): TutorialProgress {
  return { mode, step: 0, done: tutorialSteps(mode).length === 0 };
}

export function currentStep(progress: TutorialProgress): TutorialStep | null {
  return progress.done ? null : tutorialSteps(progress.mode)[progress.step] ?? null;
}

export type TutorialEvent = { type: 'next' } | { type: 'merge'; from: number; to: number } | { type: 'deliver' } | { type: 'box' } | { type: 'skip' };

const samePair = (a: [number, number], from: number, to: number) => (a[0] === from && a[1] === to) || (a[0] === to && a[1] === from);

/** 사건이 지금 단계를 끝내면 다음 단계로 넘깁니다. 마지막 단계가 끝나면 done */
export function advanceTutorial(progress: TutorialProgress, event: TutorialEvent): TutorialProgress {
  const step = currentStep(progress);
  if (!step) return progress;
  if (event.type === 'skip') return { ...progress, done: true };
  const a = step.advance;
  const matches = (a.on === 'next' && event.type === 'next')
    || (a.on === 'merge' && event.type === 'merge' && samePair(a.cells, event.from, event.to))
    || (a.on === 'deliver' && event.type === 'deliver')
    || (a.on === 'box' && event.type === 'box');
  if (!matches) return progress;
  const next = progress.step + 1;
  return { ...progress, step: next, done: next >= tutorialSteps(progress.mode).length };
}

export type TutorialAction = { type: 'cell'; index: number } | { type: 'merge'; from: number; to: number } | { type: 'box' } | { type: 'tool' };

/**
 * 지금 단계에서 이 행동을 허용하는지. B안만 잠그며, A안은 안내 중 모든 입력을 막고(안내가 화면을 덮음),
 * C안·안내 종료 뒤에는 모두 허용합니다.
 */
export function allowsAction(progress: TutorialProgress, action: TutorialAction): boolean {
  const step = currentStep(progress);
  if (!step) return true;
  if (progress.mode === 'static') return false;
  if (progress.mode !== 'guided') return true;
  const a = step.advance;
  if (a.on === 'merge') {
    if (action.type === 'cell') return a.cells.includes(action.index);
    if (action.type === 'merge') return samePair(a.cells, action.from, action.to);
    return false;
  }
  if (a.on === 'box') return action.type === 'box';
  return false; // 다음 버튼으로 넘기는 단계에서는 작업대 입력을 받지 않습니다.
}

// ── C안 맥락 힌트 ──
export type MissKind = 'empty-move' | 'not-adjacent' | 'mismatch';

/** 선택한 부품(selected)으로 다른 칸(index)을 눌렀는데 합성이 안 될 때, 왜 안 되는지 분류합니다. */
export function classifyMiss(s: State, selected: number, index: number): MissKind | null {
  const source = s.board[selected];
  if (!source || selected === index || mergeTargets(s, selected).includes(index)) return null;
  const target = s.board[index];
  if (!target) return 'empty-move';
  if (target.kind === source.kind && target.level === source.level) return 'not-adjacent';
  return 'mismatch';
}

export type HintContext = {
  idleMs: number;
  // 지금까지 합성·상자 열기를 한 번도 하지 않았는지
  untouched: boolean;
  misses: Record<MissKind, number>;
  boxesOpened: number;
};

export type ContextHint = { id: 'first-merge' | 'empty-move' | 'not-adjacent' | 'open-box'; text: string; cells?: [number, number] };

export const HINT_IDLE_MS = 6000;
export const MISS_REPEAT = 2;

/** C안: 지금 보여 줄 한 줄 힌트. 같은 힌트를 반복하지 않도록 이미 보여 준 id는 호출 측이 넘깁니다. */
export function contextualHint(s: State, ctx: HintContext, shown: ReadonlySet<string>): ContextHint | null {
  const pick = (hint: ContextHint) => (shown.has(hint.id) ? null : hint);
  if (ctx.misses['empty-move'] >= MISS_REPEAT) {
    const hint = pick({ id: 'empty-move', text: '부품은 빈칸으로 옮길 수 없어요. 맞닿은 같은 부품을 차례로 눌러 합치세요.' });
    if (hint) return hint;
  }
  if (ctx.misses['not-adjacent'] >= MISS_REPEAT) {
    const hint = pick({ id: 'not-adjacent', text: '같은 부품이라도 상하좌우로 맞닿아야 합쳐져요. 붙어 있는 쌍을 찾아보세요.' });
    if (hint) return hint;
  }
  if (ctx.idleMs < HINT_IDLE_MS) return null;
  if (ctx.untouched && hasMerge(s)) {
    const best = recommendMerge(s);
    return pick({ id: 'first-merge', text: '반짝이는 같은 부품 두 개를 차례로 눌러 보세요. 한 단계 위 부품으로 합쳐져요.', cells: best ? [best.from, best.to] : undefined });
  }
  if (ctx.boxesOpened === 0 && !hasMerge(s) && nextSlot(s) >= 0) {
    return pick({ id: 'open-box', text: '합칠 부품이 없으면 아래 부품 상자를 열어 보세요. 체력 1을 쓰고 점선 칸에 들어와요.' });
  }
  return null;
}

/** 보드 칸들의 화면 영역을 감싸는 사각형(행·열 기준). 화면 좌표 변환은 호출 측이 합니다. */
export function cellSpan(cells: number[]) {
  const rows = cells.map((index) => Math.floor(index / COLS));
  const cols = cells.map((index) => index % COLS);
  return { row: Math.min(...rows), col: Math.min(...cols), rows: Math.max(...rows) - Math.min(...rows) + 1, cols: Math.max(...cols) - Math.min(...cols) + 1 };
}
