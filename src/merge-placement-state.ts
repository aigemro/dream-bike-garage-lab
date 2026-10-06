// 머지 코어 E v3 규칙 (순수 로직 · Phaser 비의존)
// E v2의 예정 칸 자동 입고·이동 금지·상하좌우 2개 합성은 유지하고,
// 주문은 일반 프로젝트와 같은 3종(요구 레벨·이름·보상)을 사용합니다.
// v3 추가: 연쇄 합성 보너스, 납품 직후 다음 주문 자동 장착, 요구 레벨에 가장 가까운 부품 우선 장착.
import { ORDER_METAS, type OrderMeta } from './meta-progress';

export const KINDS = ['프레임', '휠셋', '구동계', '핸들바'] as const;
// bike-pixel-sprite의 부품 그룹과 같은 순서 (kind 인덱스 → 픽셀 아이콘·대표색)
export const PART_TYPES = ['frame', 'wheel', 'drivetrain', 'handlebar'] as const;
export type PartType = (typeof PART_TYPES)[number];
export const COLS = 6, ROWS = 7, SIZE = COLS * ROWS, CAP = 30, RECOVERY = 600_000, MAX_LEVEL = 4;
// 일반 프로젝트 주문 3종의 부품별 요구 레벨 (merge-prototype ORDERS와 같은 값 · 프레임·휠셋·구동계·핸들바 순)
export const ORDER_LEVELS: readonly (readonly number[])[] = [[2, 2, 1, 1], [3, 2, 2, 1], [2, 3, 2, 2]];
// 상자를 열지 않고 이어서 합성한 횟수(연쇄)가 기준에 닿으면 보너스를 받습니다.
export const COMBO_FREE_BOX = 3, COMBO_GUARANTEE = 5;

export type Part = { kind: number; level: number };
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

/** 누적 납품 수로 현재 주문 메타(이름·보상·자전거 종류)를 찾습니다. */
export function orderMeta(order: number): OrderMeta { return ORDER_METAS[order % ORDER_METAS.length]; }
export function requirements(s: Pick<Snapshot, 'order'>): readonly number[] { return ORDER_LEVELS[s.order % ORDER_LEVELS.length]; }

export function fresh(now = Date.now()): State {
  const board: (Part | null)[] = Array(SIZE).fill(null);
  [0, 1, 6].forEach(i => board[i] = { kind: 0, level: 1 });
  [2, 3, 8].forEach(i => board[i] = { kind: 1, level: 1 });
  board[4] = { kind: 2, level: 1 }; board[5] = { kind: 3, level: 1 };
  const s: State = {
    version: 3, board, energy: CAP, anchor: now, order: 0, installed: [false, false, false, false], coins: 0,
    misses: 0, supplied: 0, merges: 0, returned: 0, combo: 0, freeBoxes: 0, guarantees: 0, freeUsed: 0, undo: null,
  };
  settle(s, []); // 첫 주문의 Lv.1 구동계·핸들바는 시작과 함께 장착됩니다.
  return s;
}

export function recover(s: State, now = Date.now()) {
  if (now < s.anchor) { s.anchor = now; return; }
  if (s.energy >= CAP) { s.anchor = now; return; }
  const ticks = Math.floor((now - s.anchor) / RECOVERY);
  s.energy = Math.min(CAP, s.energy + ticks);
  s.anchor = s.energy === CAP ? now : s.anchor + ticks * RECOVERY;
}

/** 보드 아래 중앙에서 가까운 빈칸 (아래 행 우선 · 가운데 열 우선 · 같으면 왼쪽). 없으면 -1 */
export function nextSlot(s: Pick<Snapshot, 'board'>): number {
  let best = -1, score = Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < SIZE; i++) if (!s.board[i]) {
    const row = Math.floor(i / COLS), col = i % COLS;
    const value = (ROWS - 1 - row) * 10 + Math.min(Math.abs(col - 2), Math.abs(col - 3));
    if (value < score) { score = value; best = i; }
  }
  return best;
}

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
  const needs = KINDS.map((_, k) => k).filter(k => !s.installed[k]);
  const guaranteed = s.guarantees > 0 && needs.length > 0;
  const focus = needs.length > 0 && (guaranteed || s.misses >= 4 || rng() < .7);
  const pool = focus ? needs : [0, 1, 2, 3];
  const kind = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  const level = rng() < .2 ? 2 : 1;
  s.misses = needs.includes(kind) ? 0 : s.misses + 1;
  const free = s.freeBoxes > 0;
  if (free) { s.freeBoxes--; s.freeUsed++; } else { if (s.energy >= CAP) s.anchor = now; s.energy--; }
  if (guaranteed) s.guarantees--;
  const part = { kind, level };
  s.board[index] = part; s.supplied++; s.combo = 0; s.undo = null;
  const events: ProgressEvent[] = [{ type: 'placed', index, part: { ...part }, free, guaranteed }];
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

const integer = (x: unknown, min: number, max = Number.MAX_SAFE_INTEGER): x is number =>
  typeof x === 'number' && Number.isSafeInteger(x) && x >= min && x <= max;
function validPart(p: unknown): boolean {
  if (p === null) return true;
  if (!p || typeof p !== 'object') return false;
  const part = p as Part;
  return integer(part.kind, 0, KINDS.length - 1) && integer(part.level, 1, MAX_LEVEL);
}
function validBase(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object') return false;
  const s = value as Snapshot;
  return Array.isArray(s.board) && s.board.length === SIZE && s.board.every(validPart)
    && Array.isArray(s.installed) && s.installed.length === KINDS.length && s.installed.every(x => typeof x === 'boolean')
    && integer(s.order, 0) && integer(s.coins, 0) && integer(s.merges, 0) && integer(s.returned, 0);
}
function validSnapshot(value: unknown): value is Snapshot {
  if (!validBase(value)) return false;
  const s = value as Snapshot;
  return integer(s.combo, 0) && integer(s.freeBoxes, 0) && integer(s.guarantees, 0);
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
    if (!integer(input.energy, 0, CAP) || !integer(input.anchor, 0) || !integer(input.misses, 0) || !integer(input.supplied, 0)) return fresh(now);
    if (v3 && !integer(input.freeUsed, 0)) return fresh(now);
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
