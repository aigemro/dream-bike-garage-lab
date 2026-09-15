export const KINDS = ['프레임', '휠셋', '구동계', '핸들바'] as const;
export const COLS = 6, SIZE = 42, CAP = 30, RECOVERY = 600_000;
export type Part = { kind: number; level: number };
export type State = { version: 1; board: (Part | null)[]; energy: number; anchor: number; order: number; installed: boolean[]; coins: number; growth: number; misses: number; supplied: number; merges: number };
export function fresh(now = Date.now()): State {
  // First order is guaranteed playable without waiting or random draws.
  const board: (Part | null)[] = Array(SIZE).fill(null);
  [0, 1, 6].forEach(i => board[i] = { kind: 0, level: 1 });
  [2, 3, 8].forEach(i => board[i] = { kind: 1, level: 1 });
  board[4] = { kind: 2, level: 1 }; board[5] = { kind: 3, level: 1 };
  return { version: 1, board, energy: CAP, anchor: now, order: 0, installed: [false,false,false,false], coins: 0, growth: 0, misses: 0, supplied: 0, merges: 0 };
}
export function recover(s: State, now = Date.now()) {
  if (now < s.anchor) { s.anchor = now; return; }
  if (s.energy === CAP) { s.anchor = now; return; }
  const ticks = Math.floor((now - s.anchor) / RECOVERY);
  s.energy = Math.min(CAP, s.energy + ticks);
  s.anchor = s.energy === CAP ? now : s.anchor + ticks * RECOVERY;
}
export function requirements(s: State): number[] { return [[2,2,1,1],[1,2,2,1],[2,1,1,2]][s.order % 3]; }
export function nextSlot(s: State): number {
  // Fixed tray under the board centre. Nearest empty cell first; ties go left.
  const distance = (i: number) => (i % COLS - 2.5) ** 2 + (Math.floor(i / COLS) - 7) ** 2;
  const slots = s.board.map((_, i) => i).filter(i => !s.board[i]);
  slots.sort((a, b) => distance(a) - distance(b) || a - b);
  return slots[0] ?? -1;
}
export function supply(s: State, now = Date.now(), rng = Math.random): boolean {
  recover(s, now); const slot = nextSlot(s);
  if (slot < 0 || s.energy < 1) return false;
  const needs = KINDS.map((_,k) => k).filter(k => !s.installed[k]);
  const focus = needs.length > 0 && (s.misses >= 4 || rng() < .7);
  const pool = focus ? needs : [0,1,2,3];
  const kind = pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))];
  const level = rng() < .2 ? 2 : 1;
  s.misses = needs.includes(kind) ? 0 : s.misses + 1;
  if (s.energy === CAP) s.anchor = now;
  s.energy--; s.supplied++; s.board[slot] = {kind,level}; return true;
}
export type DropResult = 'merged' | 'moved' | 'swapped' | 'none';
export function canMerge(s: State, from: number, to: number): boolean {
  const a = s.board[from], b = s.board[to];
  return from !== to && !!a && !!b && a.kind === b.kind && a.level === b.level && a.level < 4;
}
/** One release = one transaction. Adjacency is irrelevant and no chain is triggered. */
export function drop(s: State, from: number, to: number): DropResult {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= SIZE || to >= SIZE || from === to || !s.board[from]) return 'none';
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
export function install(s: State, i: number) {
  const p=s.board[i]; if (!p || s.installed[p.kind] || p.level<requirements(s)[p.kind]) return false;
  s.installed[p.kind]=true; s.board[i]=null; return true;
}
export function deliver(s: State) {
  if (!s.installed.every(Boolean)) return false;
  s.coins+=500; s.order++; s.installed=[false,false,false,false]; s.misses=0; return true;
}
export function upgrade(s: State) { if(s.growth>=3 || s.coins<500) return false; s.coins-=500; s.growth++; return true; }
export function restore(raw: string | null, now=Date.now()): State {
  try {
    const s=JSON.parse(raw || 'null') as State;
    const integer=(x: unknown,min:number,max=Number.MAX_SAFE_INTEGER) => typeof x==='number' && Number.isSafeInteger(x) && x>=min && x<=max;
    if (!s || s.version!==1 || !Array.isArray(s.board)||s.board.length!==SIZE || !s.board.every(p=>p===null || (p && integer(p.kind,0,3)&&integer(p.level,1,4))) || !Array.isArray(s.installed)||s.installed.length!==4||!s.installed.every(x=>typeof x==='boolean') || !integer(s.energy,0,CAP)||!integer(s.anchor,0)||!integer(s.order,0)||!integer(s.coins,0)||!integer(s.growth,0,3)||!integer(s.misses,0)||!integer(s.supplied,0)||!integer(s.merges,0)) return fresh(now);
    recover(s,now); return s;
  } catch { return fresh(now); }
}
