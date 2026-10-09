// E v3 작업대 막힘 완화 보조 규칙 (#264 · 순수 로직, Phaser·DOM 비의존)
// B안 합성 추천: 납품·장착이 일어나는 쌍 > 합성 뒤 남는 합성 가능 쌍이 많은 쌍 순서로 '먼저 합칠 쌍' 1개를 고릅니다.
// C안 막힘 구제: 꽉 찼는데 합성할 쌍이 없으면 하루 1회 '정리'로 불필요 부품 2개를 회수하고,
//               다음 상자 1개를 무료·필수 부품 확정으로 바꿉니다(기존 연쇄 보너스와 같은 장치 재사용).
import { SIZE, drop, mergeTargets, nextSlot, requirements, type Part, type State } from './merge-placement-state';

/** 빈칸이 이 수 이하로 남으면 막힘 직전으로 보고 추천을 바로 보여 줍니다. */
export const HINT_EMPTY_THRESHOLD = 6;
/** 이 시간 동안 아무 입력이 없으면 추천을 보여 줍니다. */
export const HINT_IDLE_MS = 8000;
export const RESCUE_PER_DAY = 1;
export const RESCUE_REMOVE_COUNT = 2;

const clone = (s: State): State => ({ ...s, board: s.board.map((part) => (part ? { ...part } : null)), installed: [...s.installed], undo: null });

function mergePairCount(s: State) {
  let count = 0;
  for (let index = 0; index < SIZE; index += 1) for (const to of mergeTargets(s, index)) if (to > index) count += 1;
  return count;
}

export const emptyCells = (s: Pick<State, 'board'>) => s.board.filter((part) => !part).length;

/** 합성할 수 있는 쌍이 하나라도 있는지 */
export function hasMerge(s: State) {
  for (let index = 0; index < SIZE; index += 1) if (mergeTargets(s, index).length > 0) return true;
  return false;
}

/** 막힘: 다음 입고 칸이 없고(꽉 참) 합성할 쌍도 없음. 반품·정리 말고는 진행할 수 없는 상태입니다. */
export function isStuck(s: State) {
  return nextSlot(s) < 0 && !hasMerge(s);
}

export type MergeRecommendation = { from: number; to: number; part: Part; delivers: boolean; installs: number };

/**
 * 먼저 합칠 쌍을 추천합니다. 같은 상태면 항상 같은 쌍을 고릅니다(점수가 같으면 칸 순서가 빠른 쪽).
 * 점수: 납품 수 × 10000 + 장착 수 × 100 + 합성 뒤 남는 합성 가능 쌍 수 × 10
 */
export function recommendMerge(s: State): MergeRecommendation | null {
  let best: MergeRecommendation | null = null;
  let bestScore = -Infinity;
  const installedBefore = s.installed.filter(Boolean).length;
  for (let from = 0; from < SIZE; from += 1) {
    for (const to of mergeTargets(s, from)) {
      const next = clone(s);
      drop(next, from, to);
      const delivered = next.order - s.order;
      const installedAfter = next.installed.filter(Boolean).length;
      const score = delivered * 1e4 + installedAfter * 100 + mergePairCount(next) * 10;
      if (score > bestScore) {
        bestScore = score;
        // installs: 납품까지 가지 않을 때 이번 합성으로 새로 장착되는 부품 수
        best = { from, to, part: { ...s.board[from]! }, delivers: delivered > 0, installs: delivered > 0 ? 0 : Math.max(0, installedAfter - installedBefore) };
      }
    }
  }
  return best;
}

/** 추천을 보여 줄지: 선택 중이 아니고, 막힘 직전이거나 한동안 입력이 없을 때 */
export function shouldShowHint(s: State, idleMs: number, selecting: boolean) {
  if (selecting || !hasMerge(s)) return false;
  return emptyCells(s) <= HINT_EMPTY_THRESHOLD || idleMs >= HINT_IDLE_MS;
}

// ── C안 막힘 구제(정리) ──
export type RescueRecord = { date: string; used: number };

/** 기기 날짜(YYYY-MM-DD). 하루 횟수 초기화 기준입니다(서버 시간은 메인 SDK 이후). */
export function localDate(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function rescueRemaining(record: RescueRecord | null, today: string) {
  const used = record && record.date === today ? record.used : 0;
  return Math.max(0, RESCUE_PER_DAY - used);
}

export function parseRescueRecord(raw: string | null): RescueRecord | null {
  try {
    const value = JSON.parse(raw ?? 'null') as Partial<RescueRecord> | null;
    if (!value || typeof value.date !== 'string' || !Number.isSafeInteger(value.used) || value.used! < 0) return null;
    return { date: value.date, used: value.used! };
  } catch {
    return null;
  }
}

// 회수할 부품: 지금 주문에 필요 없는 것부터, 레벨이 낮은 것부터, 칸 순서대로
function rescueTargets(s: State): number[] {
  const req = requirements(s);
  return s.board
    .map((part, index) => ({ part, index }))
    .filter((cell): cell is { part: Part; index: number } => cell.part !== null)
    .map(({ part, index }) => ({ index, value: (!s.installed[part.kind] && part.level < req[part.kind] ? 100 : 0) + 2 ** (part.level - 1) }))
    .sort((a, b) => a.value - b.value || a.index - b.index)
    .slice(0, RESCUE_REMOVE_COUNT)
    .map((cell) => cell.index);
}

export type RescueResult = { removed: Array<{ index: number; part: Part }> };

/**
 * 막힘일 때만 정리합니다. 부품 2개를 회수하고 무료 상자·필수 부품 확정을 1개씩 줍니다.
 * 체력은 쓰지 않으며, 되돌리기 대상이 아닙니다. 연쇄 수는 그대로 둡니다.
 */
export function applyRescue(s: State): RescueResult | null {
  if (!isStuck(s)) return null;
  const removed = rescueTargets(s).map((index) => ({ index, part: { ...s.board[index]! } }));
  removed.forEach(({ index }) => { s.board[index] = null; });
  s.freeBoxes += 1;
  s.guarantees += 1;
  s.undo = null;
  return { removed };
}

export function useRescue(record: RescueRecord | null, today: string): RescueRecord {
  return { date: today, used: (record && record.date === today ? record.used : 0) + 1 };
}
