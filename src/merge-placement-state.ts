export const KINDS = ['프레임', '휠셋', '구동계', '핸들바'] as const;
export const COLS = 6, SIZE = 42, CAP = 30, RECOVERY = 600_000;
export type Part = { kind: number; level: number };
export type Snapshot = { board: (Part | null)[]; installed: boolean[]; order: number; coins: number; growth: number; merges: number; returned: number };
export type State = Snapshot & { undo: Snapshot | null; version: 2; energy: number; anchor: number; misses: number; supplied: number };
export type ProgressEvent = { type: 'placed'; index: number; part: Part } | { type: 'merged'; from: number; to: number; part: Part } | { type: 'installed'; from: number; kind: number; part: Part } | { type: 'delivered'; reward: number; order: number };
export type ActionResult = { events: ProgressEvent[] };

export function fresh(now = Date.now()): State {
  const board: (Part | null)[] = Array(SIZE).fill(null);
  [0, 1, 6].forEach(i => board[i] = { kind: 0, level: 1 });
  [2, 3, 8].forEach(i => board[i] = { kind: 1, level: 1 });
  board[4] = { kind: 2, level: 1 }; board[5] = { kind: 3, level: 1 };
  return { version: 2, board, energy: CAP, anchor: now, order: 0, installed: [false,false,false,false], coins: 0, growth: 0, misses: 0, supplied: 0, merges: 0, returned: 0, undo: null };
}
export function recover(s: State, now = Date.now()) {
  if (now < s.anchor) { s.anchor = now; return; }
  if (s.energy === CAP) { s.anchor = now; return; }
  const ticks = Math.floor((now - s.anchor) / RECOVERY);
  s.energy = Math.min(CAP, s.energy + ticks);
  s.anchor = s.energy === CAP ? now : s.anchor + ticks * RECOVERY;
}
export function requirements(s: State): number[] { return [[2,2,1,1],[1,2,2,1],[2,1,1,2]][s.order % 3]; }
export function nextSlot(s: Pick<State,'board'>): number {
  let best = -1, score = Number.MAX_SAFE_INTEGER;
  for (let i=0;i<SIZE;i++) if (!s.board[i]) {
    const row=Math.floor(i/COLS), col=i%COLS;
    const value=(SIZE/COLS-1-row)*10+Math.min(Math.abs(col-2),Math.abs(col-3));
    if(value<score){score=value;best=i;}
  }
  return best;
}
function resolveProgress(s: State, events: ProgressEvent[]) {
  const req=requirements(s);
  for(let kind=0;kind<KINDS.length;kind++) {
    if(s.installed[kind]) continue;
    const from=s.board.findIndex(p=>p?.kind===kind && p.level>=req[kind]);
    if(from<0) continue;
    const part=s.board[from]!;s.board[from]=null;s.installed[kind]=true;
    events.push({type:'installed',from,kind,part:{...part}});
  }
  if(s.installed.every(Boolean)) {
    s.coins+=500;s.order++;s.installed=[false,false,false,false];s.misses=0;
    events.push({type:'delivered',reward:500,order:s.order});
  }
}
export function supply(s: State, now = Date.now(), rng = Math.random): ActionResult | null {
  recover(s, now);const index=nextSlot(s);
  if(index<0 || s.energy<1) return null;
  const needs = KINDS.map((_,k) => k).filter(k => !s.installed[k]);
  const focus = needs.length > 0 && (s.misses >= 4 || rng() < .7);
  const pool = focus ? needs : [0,1,2,3];
  const kind = pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))];
  const level = rng() < .2 ? 2 : 1;
  s.misses = needs.includes(kind) ? 0 : s.misses + 1;
  if (s.energy === CAP) s.anchor = now;
  const part={kind,level};s.energy--;s.supplied++;s.board[index]=part;s.undo=null;
  const events:ProgressEvent[]=[{type:'placed',index,part:{...part}}];resolveProgress(s,events);
  return {events};
}
export function neighbors(i: number): number[] {
  if (!validCell(i)) return [];
  return [i-COLS,i-1,i+1,i+COLS].filter(j => validCell(j) && Math.abs(i%COLS-j%COLS)+Math.abs(Math.floor(i/COLS)-Math.floor(j/COLS))===1);
}
function validCell(i: number) { return Number.isInteger(i) && i>=0 && i<SIZE; }
export function canMerge(s: State, from: number, to: number): boolean {
  const a = s.board[from], b = s.board[to];
  return neighbors(from).includes(to) && !!a && !!b && a.kind === b.kind && a.level === b.level && a.level < 4;
}
export function drop(s: State, from: number, to: number): ActionResult | null {
  if(!canMerge(s,from,to)) return null;
  remember(s);const source=s.board[from]!;const part={kind:source.kind,level:source.level+1};
  s.board[to]=part;s.board[from]=null;s.merges++;
  const events:ProgressEvent[]=[{type:'merged',from,to,part:{...part}}];resolveProgress(s,events);
  return {events};
}
export function upgrade(s: State) { if(s.growth>=3 || s.coins<500) return false; remember(s); s.coins-=500; s.growth++; return true; }
export function snapshot(s: Snapshot): Snapshot { return structuredClone({board:s.board,installed:s.installed,order:s.order,coins:s.coins,growth:s.growth,merges:s.merges,returned:s.returned}); }
function remember(s: State) { s.undo = snapshot(s); }
export function undo(s: State) { if (!s.undo) return false;const previous=s.undo;Object.assign(s,structuredClone(previous));s.undo=null;return true; }
export function returnPart(s: State, index: number) { if (!validCell(index) || !s.board[index]) return false;remember(s);s.board[index]=null;s.returned++;return true; }
const integer=(x: unknown,min:number,max=Number.MAX_SAFE_INTEGER): boolean => typeof x==='number' && Number.isSafeInteger(x) && x>=min && x<=max;
function validPart(p: unknown): boolean { if(p===null)return true;if(!p||typeof p!=='object')return false;const part=p as Part;return integer(part.kind,0,3)&&integer(part.level,1,4); }
function validSnapshot(value: unknown): value is Snapshot {
  if(!value||typeof value!=='object')return false;const s=value as Snapshot;
  return Array.isArray(s.board)&&s.board.length===SIZE&&s.board.every(validPart)&&Array.isArray(s.installed)&&s.installed.length===4&&s.installed.every(x=>typeof x==='boolean')&&integer(s.order,0)&&integer(s.coins,0)&&integer(s.growth,0,3)&&integer(s.merges,0)&&integer(s.returned,0);
}
export function restore(raw: string | null, now=Date.now()): State {
  try {
    const input=JSON.parse(raw||'null') as Omit<State,'version'> & {version:number;pending?:Part|null;held?:Part|null};
    if(!validSnapshot(input)||![1,2].includes(input.version)||!integer(input.energy,0,CAP)||!integer(input.anchor,0)||!integer(input.misses,0)||!integer(input.supplied,0))return fresh(now);
    const restored:State={...snapshot(input),version:2,energy:input.energy,anchor:input.anchor,misses:input.misses,supplied:input.supplied,undo:input.version===2&&validSnapshot(input.undo)?snapshot(input.undo as State):null};
    if(input.version===1) for(const part of [input.pending,input.held]) if(part&&validPart(part)){const at=nextSlot(restored);if(at>=0)restored.board[at]={...part};}
    recover(restored,now);return restored;
  } catch { return fresh(now); }
}
