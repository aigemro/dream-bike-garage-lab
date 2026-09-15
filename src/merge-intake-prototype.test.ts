// @vitest-environment happy-dom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {startMergeIntake} from './merge-intake-prototype';
import {fresh, type State} from './merge-intake-state';
const KEY='dbg-lab-merge-intake-v1';
let handle:ReturnType<typeof startMergeIntake>;
let root:HTMLElement;
const cell=(i:number)=>root.querySelector<HTMLButtonElement>(`[data-cell="${i}"]`)!;
const button=(action:string)=>root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
const state=()=>JSON.parse(localStorage.getItem(KEY)!) as State;
function event(target:EventTarget,type:string,x=10,y=10,id=1){target.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,isPrimary:true,button:0,clientX:x,clientY:y}));}
beforeEach(()=>{
 vi.useFakeTimers();localStorage.clear();document.body.innerHTML='<div id="game-root"></div>';root=document.getElementById('game-root')!;
 // DOM simulation supplies hit testing/capture; actual browser layout is a separate manual check.
 root.setPointerCapture=vi.fn();root.hasPointerCapture=vi.fn(()=>false);root.releasePointerCapture=vi.fn();
 handle=startMergeIntake('game-root');
});
afterEach(()=>{handle.destroy();vi.restoreAllMocks();vi.useRealTimers();document.body.innerHTML='';});
describe('D overlap input',()=>{
 it('completes an order through tap-target merge and keeps progress after remount',()=>{
  expect(root.querySelector('[data-action="merge"]')).toBeNull();
  cell(1).click();cell(0).click();button('install').click();
  cell(3).click();cell(2).click();button('install').click();
  cell(4).click();button('install').click();cell(5).click();button('install').click();
  expect(button('deliver').disabled).toBe(false);button('deliver').click();
  expect(state().order).toBe(1);expect(state().coins).toBe(500);
  const before=state();handle.destroy();handle=startMergeIntake('game-root');expect(state().board).toEqual(before.board);expect(state().order).toBe(1);
 });
 it('shows a moving ghost and matching target, merges once on release, ignores generated click',()=>{
  vi.spyOn(document,'elementFromPoint').mockImplementation(()=>cell(0));
  event(cell(1),'pointerdown');event(window,'pointermove',60,60);
  expect(document.querySelector('.intake-drag-ghost')).not.toBeNull();expect(cell(0).classList.contains('drop-merge')).toBe(true);
  event(window,'pointerup',60,60);root.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}));
  expect(state().merges).toBe(1);expect(state().board[0]?.level).toBe(2);expect(state().board[1]).toBeNull();expect(document.querySelector('.intake-drag-ghost')).toBeNull();
 });
 it('cancels outside release and pointer cancellation without losing parts',()=>{
  const before=state().board;vi.spyOn(document,'elementFromPoint').mockReturnValue(null);
  event(cell(1),'pointerdown');event(window,'pointermove',60,60);event(window,'pointerup',60,60);expect(state().board).toEqual(before);
  event(cell(1),'pointerdown');event(window,'pointermove',60,60);event(window,'pointercancel',60,60);expect(document.querySelector('.intake-drag-ghost')).toBeNull();expect(state().board).toEqual(before);
 });
 it('moves to empty cells and swaps unlike parts by drag',()=>{
  const hit=vi.spyOn(document,'elementFromPoint').mockImplementation(()=>cell(41));
  event(cell(1),'pointerdown');event(window,'pointermove',60,60);expect(cell(41).classList.contains('drop-move')).toBe(true);event(window,'pointerup',60,60);expect(state().board[41]?.kind).toBe(0);
  hit.mockImplementation(()=>cell(4));event(cell(41),'pointerdown');event(window,'pointermove',60,60);expect(cell(4).classList.contains('drop-swap')).toBe(true);event(window,'pointerup',60,60);expect(state().board[41]?.kind).toBe(2);expect(state().board[4]?.kind).toBe(0);
 });
 it('keeps details open after an action and preserves drag during recovery refresh',()=>{
  root.querySelector('details')!.open=true;button('supply').click();expect(root.querySelector('details')!.open).toBe(true);
  vi.spyOn(document,'elementFromPoint').mockImplementation(()=>cell(0));event(cell(1),'pointerdown');event(window,'pointermove',60,60);vi.advanceTimersByTime(600_000);expect(document.querySelector('.intake-drag-ghost')).not.toBeNull();event(window,'pointerup',60,60);expect(state().merges).toBe(1);
 });
 it('disables intake on a full board or zero energy, without charging',()=>{
  handle.destroy();const s=fresh();s.board.fill({kind:0,level:1});localStorage.setItem(KEY,JSON.stringify(s));handle=startMergeIntake('game-root');expect(button('supply').disabled).toBe(true);button('supply').click();expect(state().energy).toBe(30);
  handle.destroy();s.board[38]=null;s.energy=0;localStorage.setItem(KEY,JSON.stringify(s));handle=startMergeIntake('game-root');expect(button('supply').disabled).toBe(true);expect(state().board[38]).toBeNull();
 });
 it('destroys active drag and removes listeners and recovery timer',()=>{
  vi.spyOn(document,'elementFromPoint').mockImplementation(()=>cell(0));event(cell(1),'pointerdown');event(window,'pointermove',60,60);handle.destroy();expect(document.querySelector('.intake-drag-ghost')).toBeNull();expect(root.childElementCount).toBe(0);expect(vi.getTimerCount()).toBe(0);
 });
});
