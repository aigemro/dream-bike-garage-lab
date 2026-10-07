// 머지 코어 D v3 규칙 (순수 로직 · Phaser 비의존)
// 입고 상자로 부품을 꺼내 1칸 작업대에서 자유롭게 옮기고, 거리와 관계없이 같은 부품 2개를 겹쳐 합성합니다.
// 요구 레벨 이상 부품은 플레이어가 직접 장착하고, 4종이 모이면 자동 납품합니다(메인 흐름과 동일).
// 주문·입고 순서(가운데→바깥)·체력·입고 확률은 E안과 같은 merge-core-shared를 사용합니다.
import {
  SIZE, CAP, MAX_LEVEL, orderMeta, requirements, starterBoard, nextIntakeSlot, recoverEnergy, rollPart,
  isInteger, validBoard, validInstalled, type Part,
} from './merge-core-shared';

export { KINDS, PART_TYPES, COLS, ROWS, SIZE, CAP, RECOVERY, MAX_LEVEL, ORDER_LEVELS, orderMeta, requirements } from './merge-core-shared';
export type { Part, PartType } from './merge-core-shared';

export type State = {
  version: 2; board: (Part | null)[]; energy: number; anchor: number; order: number; installed: boolean[];
  coins: number; misses: number; supplied: number; merges: number; returned: number;
};
export type ProgressEvent =
  | { type: 'placed'; index: number; part: Part }
  | { type: 'installed'; from: number; kind: number; part: Part; order: number }
  | { type: 'delivered'; order: number; reward: number; name: string };
export type ActionResult = { events: ProgressEvent[] };
export type DropResult = 'merged' | 'moved' | 'swapped' | 'none';
export type SupplyBlock = 'full' | 'energy';
export type InstallBlock = 'empty' | 'installed' | 'level';

export function fresh(now = Date.now()): State {
  return {
    version: 2, board: starterBoard(), energy: CAP, anchor: now, order: 0, installed: [false, false, false, false],
    coins: 0, misses: 0, supplied: 0, merges: 0, returned: 0,
  };
}

export function recover(s: State, now = Date.now()) { recoverEnergy(s, now); }

/** 다음 입고 칸 (보드 가운데에서 바깥 고리 순, 고리 안은 시계 방향). 없으면 -1 */
export function nextSlot(s: Pick<State, 'board'>): number { return nextIntakeSlot(s.board); }

export function supplyBlock(s: State): SupplyBlock | null {
  if (nextSlot(s) < 0) return 'full';
  if (s.energy < 1) return 'energy';
  return null;
}

/** 입고 상자를 열어 다음 입고 칸에 랜덤 부품 1개를 꺼냅니다. 빈칸이나 체력이 없으면 추첨·차감하지 않습니다. */
export function supply(s: State, now = Date.now(), rng = Math.random): ActionResult | null {
  recover(s, now);
  const index = nextSlot(s);
  if (index < 0 || s.energy < 1) return null;
  const roll = rollPart(s.installed, s.misses, rng);
  s.misses = roll.misses;
  if (s.energy >= CAP) s.anchor = now;
  s.energy--; s.supplied++; s.board[index] = roll.part;
  return { events: [{ type: 'placed', index, part: { ...roll.part } }] };
}

const validCell = (i: number) => Number.isInteger(i) && i >= 0 && i < SIZE;

export function canMerge(s: Pick<State, 'board'>, from: number, to: number): boolean {
  const a = s.board[from], b = s.board[to];
  return from !== to && !!a && !!b && a.kind === b.kind && a.level === b.level && a.level < MAX_LEVEL;
}
/** 선택한 부품과 합성할 수 있는 칸 (거리 무관) */
export function mergeTargets(s: Pick<State, 'board'>, from: number): number[] {
  return s.board.flatMap((_, to) => (canMerge(s, from, to) ? [to] : []));
}

/** 한 번 놓기 = 한 번의 처리. 같은 부품이면 대상 칸에서 합성, 빈칸이면 이동, 다른 부품이면 자리 교환. 자동 연쇄 합성은 없습니다. */
export function drop(s: State, from: number, to: number): DropResult {
  if (!validCell(from) || !validCell(to) || from === to || !s.board[from]) return 'none';
  if (canMerge(s, from, to)) {
    s.board[to] = { kind: s.board[from]!.kind, level: s.board[from]!.level + 1 };
    s.board[from] = null;
    s.merges++;
    return 'merged';
  }
  const occupied = !!s.board[to];
  [s.board[from], s.board[to]] = [s.board[to], s.board[from]];
  return occupied ? 'swapped' : 'moved';
}

/** 장착할 수 없는 이유. 장착할 수 있으면 null */
export function installBlock(s: State, index: number): InstallBlock | null {
  const part = validCell(index) ? s.board[index] : null;
  if (!part) return 'empty';
  if (s.installed[part.kind]) return 'installed';
  if (part.level < requirements(s)[part.kind]) return 'level';
  return null;
}
export function canInstall(s: State, index: number) { return installBlock(s, index) === null; }

/** 선택 부품을 고객 자전거에 직접 장착합니다. 4종이 모이면 급여를 받고 다음 주문으로 넘어갑니다. */
export function install(s: State, index: number): ActionResult | null {
  if (!canInstall(s, index)) return null;
  const part = s.board[index]!;
  s.board[index] = null; s.installed[part.kind] = true;
  const events: ProgressEvent[] = [{ type: 'installed', from: index, kind: part.kind, part: { ...part }, order: s.order }];
  if (s.installed.every(Boolean)) {
    const meta = orderMeta(s.order);
    s.coins += meta.reward; s.order++; s.installed = [false, false, false, false]; s.misses = 0;
    events.push({ type: 'delivered', order: s.order, reward: meta.reward, name: meta.name });
  }
  return { events };
}

/** 선택 부품을 재고로 반납합니다. 부품은 사라지고 체력은 돌려주지 않습니다. */
export function returnPart(s: State, index: number) {
  if (!validCell(index) || !s.board[index]) return false;
  s.board[index] = null; s.returned++;
  return true;
}

/**
 * 저장 데이터를 복구합니다. v1(D v1·v2 저장, 성장 포함)은 성장을 빼고 v2로 이전합니다.
 * 손상된 데이터는 받아들이지 않고 처음부터 시작합니다.
 */
export function restore(raw: string | null, now = Date.now()): State {
  try {
    const input = JSON.parse(raw || 'null') as Omit<Partial<State>, 'version'> & { version: number };
    if (!input || typeof input !== 'object' || ![1, 2].includes(input.version)) return fresh(now);
    if (!validBoard(input.board) || !validInstalled(input.installed)) return fresh(now);
    if (!isInteger(input.energy, 0, CAP) || !isInteger(input.anchor, 0) || !isInteger(input.order, 0) || !isInteger(input.coins, 0)
      || !isInteger(input.misses, 0) || !isInteger(input.supplied, 0) || !isInteger(input.merges, 0)) return fresh(now);
    const returned = input.version === 2 ? input.returned : 0;
    if (!isInteger(returned, 0)) return fresh(now);
    const restored: State = {
      version: 2, board: input.board.map(part => part && { ...part }), energy: input.energy, anchor: input.anchor,
      order: input.order, installed: [...input.installed], coins: input.coins, misses: input.misses,
      supplied: input.supplied, merges: input.merges, returned,
    };
    recover(restored, now);
    return restored;
  } catch { return fresh(now); }
}
