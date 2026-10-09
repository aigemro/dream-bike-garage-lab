// 첫 영업 튜토리얼 규칙 테스트 (#265)
import { describe, expect, it } from 'vitest';
import { drop, fresh, supply } from './merge-placement-state';
import {
  GUIDED_STEPS, MISS_REPEAT, HINT_IDLE_MS, STATIC_STEPS, advanceTutorial, allowsAction, cellSpan, classifyMiss, contextualHint,
  createTutorial, currentStep, type HintContext,
} from './first-shift-tutorial';

const quiet: HintContext = { idleMs: 0, untouched: true, misses: { 'empty-move': 0, 'not-adjacent': 0, mismatch: 0 }, boxesOpened: 0 };

describe('B안 단계 안내', () => {
  it('시작 보드에서 지정한 합성만으로 첫 주문을 납품할 수 있다', () => {
    const s = fresh(0);
    expect(drop(s, 0, 1)!.events.some((e) => e.type === 'installed')).toBe(true);
    const events = drop(s, 2, 3)!.events;
    expect(events.some((e) => e.type === 'delivered')).toBe(true);
  });

  it('단계 순서대로 지정한 행동이 일어날 때만 넘어간다', () => {
    let t = createTutorial('guided');
    expect(currentStep(t)?.id).toBe('order');
    t = advanceTutorial(t, { type: 'merge', from: 0, to: 1 });
    expect(currentStep(t)?.id).toBe('order'); // 다음 버튼 단계에서는 합성으로 넘어가지 않음
    t = advanceTutorial(t, { type: 'next' });
    expect(currentStep(t)?.id).toBe('frame');
    t = advanceTutorial(t, { type: 'merge', from: 2, to: 3 });
    expect(currentStep(t)?.id).toBe('frame');
    t = advanceTutorial(t, { type: 'merge', from: 1, to: 0 }); // 방향은 상관없음
    expect(currentStep(t)?.id).toBe('wheel');
    t = advanceTutorial(t, { type: 'merge', from: 2, to: 3 });
    t = advanceTutorial(t, { type: 'next' });
    expect(currentStep(t)?.id).toBe('box');
    t = advanceTutorial(t, { type: 'box' });
    t = advanceTutorial(t, { type: 'next' });
    t = advanceTutorial(t, { type: 'next' });
    expect(t.done).toBe(true);
    expect(t.step).toBe(GUIDED_STEPS.length);
  });

  it('지정한 칸·상자만 허용하고, 다음 버튼 단계에서는 작업대 입력을 막는다', () => {
    let t = createTutorial('guided');
    expect(allowsAction(t, { type: 'cell', index: 0 })).toBe(false);
    t = advanceTutorial(t, { type: 'next' });
    expect(allowsAction(t, { type: 'cell', index: 0 })).toBe(true);
    expect(allowsAction(t, { type: 'cell', index: 2 })).toBe(false);
    expect(allowsAction(t, { type: 'merge', from: 1, to: 0 })).toBe(true);
    expect(allowsAction(t, { type: 'box' })).toBe(false);
    expect(allowsAction(t, { type: 'tool' })).toBe(false);
  });

  it('건너뛰면 끝나고, 끝난 뒤에는 모든 입력을 허용한다', () => {
    const t = advanceTutorial(createTutorial('guided'), { type: 'skip' });
    expect(t.done).toBe(true);
    expect(allowsAction(t, { type: 'box' })).toBe(true);
  });
});

describe('A안 정지 안내', () => {
  it('안내 중에는 모든 입력을 막고, 6단계를 넘기면 자유 플레이', () => {
    let t = createTutorial('static');
    expect(allowsAction(t, { type: 'cell', index: 0 })).toBe(false);
    for (let i = 0; i < STATIC_STEPS.length; i += 1) t = advanceTutorial(t, { type: 'next' });
    expect(t.done).toBe(true);
    expect(allowsAction(t, { type: 'cell', index: 0 })).toBe(true);
  });

  it('C안은 단계가 없어 처음부터 자유 플레이', () => {
    const t = createTutorial('contextual');
    expect(t.done).toBe(true);
    expect(allowsAction(t, { type: 'box' })).toBe(true);
  });
});

describe('C안 맥락 힌트', () => {
  it('잘못 누른 이유를 분류한다', () => {
    const s = fresh(0); // 0·1·6 프레임, 2·3·8 휠셋 (모두 Lv.1)
    expect(classifyMiss(s, 0, 1)).toBeNull(); // 합성 가능
    expect(classifyMiss(s, 0, 20)).toBe('empty-move');
    expect(classifyMiss(s, 1, 6)).toBe('not-adjacent'); // 같은 프레임이지만 떨어짐
    expect(classifyMiss(s, 0, 2)).toBe('mismatch');
  });

  it('같은 실수가 반복되면 그 이유를 알려 준다', () => {
    const s = fresh(0);
    const ctx = { ...quiet, misses: { ...quiet.misses, 'empty-move': MISS_REPEAT } };
    expect(contextualHint(s, ctx, new Set())?.id).toBe('empty-move');
    expect(contextualHint(s, ctx, new Set(['empty-move']))).toBeNull();
  });

  it('한동안 입력이 없으면 첫 합성을 짚어 주고, 합칠 쌍이 없으면 상자를 권한다', () => {
    const s = fresh(0);
    expect(contextualHint(s, quiet, new Set())).toBeNull();
    const idle = { ...quiet, idleMs: HINT_IDLE_MS };
    const first = contextualHint(s, idle, new Set())!;
    expect(first.id).toBe('first-merge');
    expect(first.cells).toBeDefined();
    const empty = fresh(0);
    empty.board = empty.board.map(() => null);
    expect(contextualHint(empty, { ...idle, untouched: false }, new Set())?.id).toBe('open-box');
    supply(empty, 0, () => 0.5);
    expect(contextualHint(empty, { ...idle, untouched: false, boxesOpened: 1 }, new Set())).toBeNull();
  });
});

describe('강조 영역', () => {
  it('칸 목록을 감싸는 행·열 범위', () => {
    expect(cellSpan([0, 1])).toEqual({ row: 0, col: 0, rows: 1, cols: 2 });
    expect(cellSpan([2, 3])).toEqual({ row: 0, col: 2, rows: 1, cols: 2 });
    expect(cellSpan([7, 13])).toEqual({ row: 1, col: 1, rows: 2, cols: 1 });
  });
});
