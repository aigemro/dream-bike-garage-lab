// 머지 코어 E v3 규칙 (순수 로직 · Phaser 비의존)
// 예정 칸 자동 입고·이동 금지·상하좌우 2개 합성을 유지하고, 주문·입고 순서·체력·입고 확률은
// D안과 같은 merge-core-shared를 사용합니다(일반 프로젝트 주문 3종, 가운데→바깥 입고).
// v3 추가: 연쇄 합성 보너스, 납품 직후 다음 주문 자동 장착, 요구 레벨에 가장 가까운 부품 우선 장착.
import {
  KINDS, SIZE, CAP, MAX_LEVEL, COLS, orderMeta, requirements, starterBoard, nextIntakeSlot, recoverEnergy, rollPart,
  isInteger, validPart, validBoard, validInstalled, type Part,
} from './merge-core-shared';

export { KINDS, PART_TYPES, COLS, ROWS, SIZE, CAP, RECOVERY, MAX_LEVEL, ORDER_LEVELS, orderMeta, requirements } from './merge-core-shared';
export type { Part, PartType } from './merge-core-shared';
// 상자를 열지 않고 이어서 합성한 횟수(연쇄)가 기준에 닿으면 보너스를 받습니다.
export const COMBO_FREE_BOX = 3, COMBO_GUARANTEE = 5;

export type Snapshot = {
  board: (Part | null)[]; installed: boolean[]; order: number; coins: number;
  merges: number; returned: number; combo: number; freeBoxes: number; guarantees: number;
};
export type State = Snapshot & {
  version: 3; undo: Snapshot | null; energy: number; anchor: number;
  misses: number; supplied: number; freeUsed: number;
};
export type BonusType = 'free-box' | 'guarantee';
export type ProgressEvent =
  | { type: 'placed'; index: number; part: Part; free: boolean; guaranteed: boolean }
  | { type: 'merged'; from: number; to: number; part: Part; combo: number }
  | { type: 'bonus'; bonus: BonusType; combo: number }
  | { type: 'installed'; from: number; kind: number; part: Part; order: number }
  | { type: 'delivered'; order: number; reward: number; name: string };
export type ActionResult = { events: ProgressEvent[] };
export type SupplyBlock = 'full' | 'energy';

export function fresh(now = Date.now()): State {
  const s: State = {
    version: 3, board: starterBoard(), energy: CAP, anchor: now, order: 0, installed: [false, false, false, false], coins: 0,
    misses: 0, supplied: 0, merges: 0, returned: 0, combo: 0, freeBoxes: 0, guarantees: 0, freeUsed: 0, undo: null,
  };
  settle(s, []); // 첫 주문의 Lv.1 구동계·핸들바는 시작과 함께 장착됩니다.
  return s;
}

export function recover(s: State, now = Date.now()) { recoverEnergy(s, now); }

/** 다음 입고 칸 (보드 가운데에서 바깥 고리 순, 고리 안은 시계 방향). 없으면 -1 */
export function nextSlot(s: Pick<Snapshot, 'board'>): number { return nextIntakeSlot(s.board); }

// 요구 레벨 이상 부품 중 가장 낮은 레벨을 먼저 쓰고, 레벨이 같으면 칸 순서가 빠른 부품을 씁니다.
function pickInstall(board: (Part | null)[], kind: number, level: number): number {
  let best = -1;
  board.forEach((part, i) => {
    if (part && part.kind === kind && part.level >= level && (best < 0 || part.level < board[best]!.level)) best = i;
  });
  return best;
}

// 장착 → 납품 → 다음 주문 장착을 더 진행할 수 없을 때까지 정리합니다.
// 납품마다 부품이 소비되므로 반복은 반드시 끝나며, 안전장치로 횟수를 제한합니다.
function settle(s: State, events: ProgressEvent[]) {
  for (let guard = 0; guard <= SIZE; guard++) {
    const req = requirements(s);
    for (let kind = 0; kind < KINDS.length; kind++) {
      if (s.installed[kind]) continue;
      const from = pickInstall(s.board, kind, req[kind]);
      if (from < 0) continue;
      const part = s.board[from]!;
      s.board[from] = null; s.installed[kind] = true;
      events.push({ type: 'installed', from, kind, part: { ...part }, order: s.order });
    }
    if (!s.installed.every(Boolean)) return;
    const meta = orderMeta(s.order);
    s.coins += meta.reward; s.order++; s.installed = [false, false, false, false]; s.misses = 0;
    events.push({ type: 'delivered', order: s.order, reward: meta.reward, name: meta.name });
  }
}

export function supplyBlock(s: State): SupplyBlock | null {
  if (nextSlot(s) < 0) return 'full';
  if (s.freeBoxes < 1 && s.energy < 1) return 'energy';
  return null;
}

/** 부품 상자를 열어 예정 칸에 랜덤 부품 1개를 배치합니다. 무료 상자가 있으면 체력 대신 사용합니다. */
export function supply(s: State, now = Date.now(), rng = Math.random): ActionResult | null {
  recover(s, now);
  const index = nextSlot(s);
  if (index < 0 || (s.freeBoxes < 1 && s.energy < 1)) return null;
  const roll = rollPart(s.installed, s.misses, rng, s.guarantees > 0);
  s.misses = roll.misses;
  const free = s.freeBoxes > 0;
  if (free) { s.freeBoxes--; s.freeUsed++; } else { if (s.energy >= CAP) s.anchor = now; s.energy--; }
  if (roll.guaranteed) s.guarantees--;
  s.board[index] = roll.part; s.supplied++; s.combo = 0; s.undo = null;
  const events: ProgressEvent[] = [{ type: 'placed', index, part: { ...roll.part }, free, guaranteed: roll.guaranteed }];
  settle(s, events);
  return { events };
}

export function neighbors(i: number): number[] {
  if (!validCell(i)) return [];
  return [i - COLS, i - 1, i + 1, i + COLS].filter(j => validCell(j)
    && Math.abs(i % COLS - j % COLS) + Math.abs(Math.floor(i / COLS) - Math.floor(j / COLS)) === 1);
}
function validCell(i: number) { return Number.isInteger(i) && i >= 0 && i < SIZE; }

export function canMerge(s: Pick<Snapshot, 'board'>, from: number, to: number): boolean {
  const a = s.board[from], b = s.board[to];
  return neighbors(from).includes(to) && !!a && !!b && a.kind === b.kind && a.level === b.level && a.level < MAX_LEVEL;
}
/** 선택한 칸과 합성할 수 있는 상하좌우 이웃 칸 */
export function mergeTargets(s: Pick<Snapshot, 'board'>, from: number): number[] {
  return neighbors(from).filter(to => canMerge(s, from, to));
}

/** 이웃한 같은 부품 2개를 대상 칸에서 합성합니다. 연쇄 기준에 닿으면 보너스를 지급합니다. */
export function drop(s: State, from: number, to: number): ActionResult | null {
  if (!canMerge(s, from, to)) return null;
  remember(s);
  const source = s.board[from]!;
  const part = { kind: source.kind, level: source.level + 1 };
  s.board[to] = part; s.board[from] = null; s.merges++; s.combo++;
  const events: ProgressEvent[] = [{ type: 'merged', from, to, part: { ...part }, combo: s.combo }];
  if (s.combo === COMBO_FREE_BOX) { s.freeBoxes++; events.push({ type: 'bonus', bonus: 'free-box', combo: s.combo }); }
  if (s.combo === COMBO_GUARANTEE) { s.guarantees++; events.push({ type: 'bonus', bonus: 'guarantee', combo: s.combo }); }
  settle(s, events);
  return { events };
}

export function snapshot(s: Snapshot): Snapshot {
  return structuredClone({
    board: s.board, installed: s.installed, order: s.order, coins: s.coins, merges: s.merges,
    returned: s.returned, combo: s.combo, freeBoxes: s.freeBoxes, guarantees: s.guarantees,
  });
}
function remember(s: State) { s.undo = snapshot(s); }
/** 직전 합성·반품 1회를 자동 장착·납품·연쇄 보너스까지 함께 되돌립니다. 새 상자를 열면 지워집니다. */
export function undo(s: State) {
  if (!s.undo) return false;
  Object.assign(s, snapshot(s.undo));
  s.undo = null;
  return true;
}
/** 선택 부품을 반품합니다. 체력은 돌려주지 않으며 연쇄는 끊지 않습니다. */
export function returnPart(s: State, index: number) {
  if (!validCell(index) || !s.board[index]) return false;
  remember(s); s.board[index] = null; s.returned++;
  return true;
}

function validBase(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object') return false;
  const s = value as Snapshot;
  return validBoard(s.board) && validInstalled(s.installed)
    && isInteger(s.order, 0) && isInteger(s.coins, 0) && isInteger(s.merges, 0) && isInteger(s.returned, 0);
}
function validSnapshot(value: unknown): value is Snapshot {
  if (!validBase(value)) return false;
  const s = value as Snapshot;
  return isInteger(s.combo, 0) && isInteger(s.freeBoxes, 0) && isInteger(s.guarantees, 0);
}

/**
 * 저장 데이터를 복구합니다. v1(대기·보류 부품)과 v2(성장 포함) 저장도 v3로 이전합니다.
 * 손상된 데이터나 기록에 끼워 넣은 체력·시간 값은 받아들이지 않고 초기 상태로 시작합니다.
 */
export function restore(raw: string | null, now = Date.now()): State {
  try {
    const input = JSON.parse(raw || 'null') as Omit<Partial<State>, 'version'> & { version: number; pending?: Part | null; held?: Part | null };
    if (!input || typeof input !== 'object' || ![1, 2, 3].includes(input.version)) return fresh(now);
    const v3 = input.version === 3;
    if (!(v3 ? validSnapshot(input) : validBase(input))) return fresh(now);
    if (!isInteger(input.energy, 0, CAP) || !isInteger(input.anchor, 0) || !isInteger(input.misses, 0) || !isInteger(input.supplied, 0)) return fresh(now);
    if (v3 && !isInteger(input.freeUsed, 0)) return fresh(now);
    const base = input as Snapshot;
    const restored: State = {
      ...snapshot({ ...base, combo: v3 ? base.combo : 0, freeBoxes: v3 ? base.freeBoxes : 0, guarantees: v3 ? base.guarantees : 0 }),
      version: 3, energy: input.energy, anchor: input.anchor, misses: input.misses, supplied: input.supplied,
      freeUsed: v3 ? input.freeUsed! : 0,
      undo: v3 && validSnapshot(input.undo) ? snapshot(input.undo) : null,
    };
    if (input.version === 1) for (const part of [input.pending, input.held]) if (part && validPart(part)) {
      const at = nextSlot(restored);
      if (at >= 0) restored.board[at] = { ...part };
    }
    if (!v3) settle(restored, []); // 이전 저장은 v3 주문·자동 장착 규칙으로 한 번 정리합니다.
    recover(restored, now);
    return restored;
  } catch { return fresh(now); }
}
