export const KINDS = ['프레임', '휠셋', '구동계', '핸들바'] as const;
export const COLS = 6, SIZE = 42, CAP = 30, RECOVERY = 600_000;
export type Part = { kind: number; level: number };
export type Snapshot = { board: (Part | null)[]; pending: Part | null; held: Part | null; installed: boolean[]; order: number; coins: number; growth: number; merges: number; returned: number };
export type State = { pending: Part | null; held: Part | null; undo: Snapshot | null; returned: number; version: 1; board: (Part | null)[]; energy: number; anchor: number; order: number; installed: boolean[]; coins: number; growth: number; misses: number; supplied: number; merges: number };
export function fresh(now = Date.now()): State {
  // First order is guaranteed playable without waiting or random draws.
  const board: (Part | null)[] = Array(SIZE).fill(null);
  [0, 1, 6].forEach(i => board[i] = { kind: 0, level: 1 });
  [2, 3, 8].forEach(i => board[i] = { kind: 1, level: 1 });
  board[4] = { kind: 2, level: 1 }; board[5] = { kind: 3, level: 1 };
  return { pending: null, held: null, undo: null, returned: 0, version: 1, board, energy: CAP, anchor: now, order: 0, installed: [false,false,false,false], coins: 0, growth: 0, misses: 0, supplied: 0, merges: 0 };
}
export function recover(s: State, now = Date.now()) {
  if (now < s.anchor) { s.anchor = now; return; }
  if (s.energy === CAP) { s.anchor = now; return; }
  const ticks = Math.floor((now - s.anchor) / RECOVERY);
  s.energy = Math.min(CAP, s.energy + ticks);
  s.anchor = s.energy === CAP ? now : s.anchor + ticks * RECOVERY;
}
export function requirements(s: State): number[] { return [[2,2,1,1],[1,2,2,1],[2,1,1,2]][s.order % 3]; }
export function supply(s: State, now = Date.now(), rng = Math.random): boolean {
  recover(s, now);
  if (s.pending || !s.board.includes(null) || s.energy < 1) return false;
  const needs = KINDS.map((_,k) => k).filter(k => !s.installed[k]);
  const focus = needs.length > 0 && (s.misses >= 4 || rng() < .7);
  const pool = focus ? needs : [0,1,2,3];
  const kind = pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))];
  const level = rng() < .2 ? 2 : 1;
  s.misses = needs.includes(kind) ? 0 : s.misses + 1;
  if (s.energy === CAP) s.anchor = now;
  s.energy--; s.supplied++; s.pending = {kind,level}; s.undo = null; return true;
}
export type DropResult = 'merged' | 'none';
export function neighbors(i: number): number[] {
  if (!validCell(i)) return [];
  return [i-COLS,i-1,i+1,i+COLS].filter(j => validCell(j) && Math.abs(i%COLS-j%COLS)+Math.abs(Math.floor(i/COLS)-Math.floor(j/COLS))===1);
}
function validCell(i: number) { return Number.isInteger(i) && i>=0 && i<SIZE; }
export function canMerge(s: State, from: number, to: number): boolean {
  const a = s.board[from], b = s.board[to];
  return neighbors(from).includes(to) && !!a && !!b && a.kind === b.kind && a.level === b.level && a.level < 4;
}
/** Only an orthogonally adjacent merge may relocate a placed part. */
export function drop(s: State, from: number, to: number): DropResult {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= SIZE || to >= SIZE || from === to || !s.board[from]) return 'none';
  if (canMerge(s, from, to)) {
    remember(s);
    s.board[to] = { kind: s.board[from]!.kind, level: s.board[from]!.level + 1 };
    s.board[from] = null;
    s.merges++;
    return 'merged';
  }
  return 'none';
}
export function install(s: State, i: number) {
  const p=s.board[i]; if (!p || s.installed[p.kind] || p.level<requirements(s)[p.kind]) return false;
  remember(s); s.installed[p.kind]=true; s.board[i]=null; return true;
}
export function deliver(s: State) {
  if (!s.installed.every(Boolean)) return false;
  remember(s); s.coins+=500; s.order++; s.installed=[false,false,false,false]; s.misses=0; return true;
}
export function upgrade(s: State) { if(s.growth>=3 || s.coins<500) return false; remember(s); s.coins-=500; s.growth++; return true; }
export function snapshot(s: State): Snapshot {
  return structuredClone({board:s.board, pending:s.pending, held:s.held, installed:s.installed, order:s.order, coins:s.coins, growth:s.growth, merges:s.merges, returned:s.returned});
}
function remember(s: State) { s.undo = snapshot(s); }
export function undo(s: State) {
  if (!s.undo) return false;
  const previous=s.undo;
  Object.assign(s, structuredClone(previous)); s.undo=null;
  return true;
}
export function place(s: State, to: number) {
  if (!s.pending || !validCell(to) || s.board[to]) return false;
  remember(s); s.board[to]=s.pending; s.pending=null; return true;
}
export function hold(s: State) {
  if (!s.pending && !s.held) return false;
  remember(s); [s.pending,s.held]=[s.held,s.pending]; return true;
}
export function returnPart(s: State, index: number) {
  if (!validCell(index) || !s.board[index]) return false;
  remember(s); s.board[index]=null; s.returned++; return true;
}
export function placementMatches(s: State, to: number): number[] {
  const p=s.pending;
  if (!p || p.level>=4 || !validCell(to) || s.board[to]) return [];
  return neighbors(to).filter(i=>s.board[i]?.kind===p.kind && s.board[i]?.level===p.level);
}
const integer=(x: unknown,min:number,max=Number.MAX_SAFE_INTEGER): boolean => typeof x==='number' && Number.isSafeInteger(x) && x>=min && x<=max;
function validPart(p: unknown): boolean {
  if(p===null) return true;
  if(!p || typeof p!=='object') return false;
  const part=p as Part; return integer(part.kind,0,3)&&integer(part.level,1,4);
}
function validSnapshot(value: unknown): value is Snapshot {
  if(!value || typeof value!=='object') return false;
  const s=value as Snapshot;
  return Array.isArray(s.board) && s.board.length===SIZE && s.board.every(validPart)
    && validPart(s.pending) && validPart(s.held)
    && Array.isArray(s.installed) && s.installed.length===4 && s.installed.every(x=>typeof x==='boolean')
    && integer(s.order,0) && integer(s.coins,0) && integer(s.growth,0,3) && integer(s.merges,0) && integer(s.returned,0);
}
export function restore(raw: string | null, now=Date.now()): State {
  try {
    const s=JSON.parse(raw || 'null') as State;
    if (!validSnapshot(s) || s.version!==1 || !integer(s.energy,0,CAP) || !integer(s.anchor,0)
      || !integer(s.misses,0) || !integer(s.supplied,0)) return fresh(now);
    // Invalid history must not discard otherwise valid progress. Whitelist fields:
    // history never restores energy, the recovery clock, or random supply counters.
    const restored: State={...snapshot(s),version:1,energy:s.energy,anchor:s.anchor,misses:s.misses,supplied:s.supplied,
      undo:validSnapshot(s.undo)?snapshot(s.undo as State):null};
    recover(restored,now); return restored;
  } catch { return fresh(now); }
}
