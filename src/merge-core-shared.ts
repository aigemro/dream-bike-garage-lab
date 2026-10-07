// 머지 코어 D·E 공통 규칙 데이터 (순수 로직 · Phaser 비의존)
// 두 방안이 같은 주문·입고 순서·체력·입고 확률로 비교되도록 한 곳에서 관리합니다.
import { ORDER_METAS, type OrderMeta } from './meta-progress';

export const KINDS = ['프레임', '휠셋', '구동계', '핸들바'] as const;
// bike-pixel-sprite의 부품 그룹과 같은 순서 (kind 인덱스 → 픽셀 아이콘·대표색)
export const PART_TYPES = ['frame', 'wheel', 'drivetrain', 'handlebar'] as const;
export type PartType = (typeof PART_TYPES)[number];
export type Part = { kind: number; level: number };
export const COLS = 6, ROWS = 7, SIZE = COLS * ROWS, MAX_LEVEL = 4;
export const CAP = 30, RECOVERY = 600_000;
// 일반 프로젝트 주문 3종의 부품별 요구 레벨 (merge-prototype ORDERS와 같은 값 · 프레임·휠셋·구동계·핸들바 순)
export const ORDER_LEVELS: readonly (readonly number[])[] = [[2, 2, 1, 1], [3, 2, 2, 1], [2, 3, 2, 2]];

/** 누적 납품 수로 현재 주문 메타(이름·보상·자전거 종류)를 찾습니다. */
export function orderMeta(order: number): OrderMeta { return ORDER_METAS[order % ORDER_METAS.length]; }
export function requirements(s: { order: number }): readonly number[] { return ORDER_LEVELS[s.order % ORDER_LEVELS.length]; }

/** 첫 주문을 지급 부품만으로 완료할 수 있는 시작 보드 */
export function starterBoard(): (Part | null)[] {
  const board: (Part | null)[] = Array(SIZE).fill(null);
  [0, 1, 6].forEach(i => board[i] = { kind: 0, level: 1 });
  [2, 3, 8].forEach(i => board[i] = { kind: 1, level: 1 });
  board[4] = { kind: 2, level: 1 }; board[5] = { kind: 3, level: 1 };
  return board;
}

// 다음 입고 순서: 보드 가운데(2.5열, 3행)에서 가까운 칸부터 바깥 고리로 나갑니다.
// 같은 고리 안에서는 12시 방향부터 시계 방향으로 돌아 나선형으로 채웁니다.
export const INTAKE_ORDER: readonly number[] = Array.from({ length: SIZE }, (_, index) => {
  const dx = index % COLS - (COLS - 1) / 2, dy = Math.floor(index / COLS) - (ROWS - 1) / 2;
  return { index, distance: dx * dx + dy * dy, angle: (Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI) };
}).sort((a, b) => a.distance - b.distance || a.angle - b.angle).map(cell => cell.index);

/** 다음 입고 칸: 가운데에서 바깥 순서로 첫 빈칸. 없으면 -1 */
export function nextIntakeSlot(board: readonly (Part | null)[]): number {
  return INTAKE_ORDER.find(index => !board[index]) ?? -1;
}

/** 실제 시간 RECOVERY마다 체력 1 회복. 가득 찬 뒤의 시간은 쌓지 않고, 시계가 뒤로 가면 기준만 옮깁니다. */
export function recoverEnergy(s: { energy: number; anchor: number }, now = Date.now()) {
  if (now < s.anchor) { s.anchor = now; return; }
  if (s.energy >= CAP) { s.anchor = now; return; }
  const ticks = Math.floor((now - s.anchor) / RECOVERY);
  s.energy = Math.min(CAP, s.energy + ticks);
  s.anchor = s.energy === CAP ? now : s.anchor + ticks * RECOVERY;
}

/**
 * 입고 부품 추첨: Lv.1 80%·Lv.2 20%, 70%는 아직 장착하지 않은 종류에서 고릅니다.
 * 미장착 종류가 4회 연속 안 나오면 다음 입고에서 보장하고, guaranteed면 이번 입고에서 보장합니다.
 */
export function rollPart(installed: readonly boolean[], misses: number, rng: () => number, guaranteed = false) {
  const needs = KINDS.map((_, kind) => kind).filter(kind => !installed[kind]);
  const applied = guaranteed && needs.length > 0;
  const focus = needs.length > 0 && (applied || misses >= 4 || rng() < .7);
  const pool = focus ? needs : [0, 1, 2, 3];
  const kind = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  const level = rng() < .2 ? 2 : 1;
  return { part: { kind, level }, misses: needs.includes(kind) ? 0 : misses + 1, guaranteed: applied };
}

// ── 저장 데이터 검증 ──
export const isInteger = (x: unknown, min: number, max = Number.MAX_SAFE_INTEGER): x is number =>
  typeof x === 'number' && Number.isSafeInteger(x) && x >= min && x <= max;
export function validPart(p: unknown): boolean {
  if (p === null) return true;
  if (!p || typeof p !== 'object') return false;
  const part = p as Part;
  return isInteger(part.kind, 0, KINDS.length - 1) && isInteger(part.level, 1, MAX_LEVEL);
}
export const validBoard = (board: unknown): board is (Part | null)[] => Array.isArray(board) && board.length === SIZE && board.every(validPart);
export const validInstalled = (installed: unknown): installed is boolean[] =>
  Array.isArray(installed) && installed.length === KINDS.length && installed.every(x => typeof x === 'boolean');
