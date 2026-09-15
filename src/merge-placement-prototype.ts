import { KINDS, CAP, RECOVERY, fresh, restore, recover, requirements, supply, canMerge, drop, install, deliver, upgrade, place, hold, undo, returnPart, placementMatches, type Part } from './merge-placement-state';
import './merge-placement.css';
export const KEY='dbg-lab-merge-placement-e-v1';
const PENDING=-2, NONE=-1;
const icons=['△','◉','⚙','┬'];
const partHTML=(p:Part)=>`<b>${icons[p.kind]}</b><span>${KINDS[p.kind]}</span><small>Lv.${p.level}</small>`;
export function startMergePlacement(parent:string) {
  const root=document.getElementById(parent)!;
  let storageOK=true, raw:string|null=null;
  try { raw=localStorage.getItem(KEY); } catch { storageOK=false; }
  let s=restore(raw), selected=s.pending?PENDING:NONE;
  let message='부품은 처음 놓은 자리에 고정됩니다. 맞닿은 같은 부품 2개를 겹쳐 조립해 보세요.';
  let accelerated=false, ticks=0, blockClickUntil=0;
  let pointer:{index:number;id:number;x:number;y:number;dragging:boolean}|null=null;
  let ghost:HTMLElement|null=null;
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(s));}catch{storageOK=false;}};
  function bike() {
    const [frame,wheels,drive,bar]=s.installed;
    return `<svg viewBox="0 0 260 105" aria-label="고객 자전거 조립 ${s.installed.filter(Boolean).length}/4" role="img"><g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="5"><g stroke="${wheels?'#425d53':'#d7d8d1'}"><circle cx="60" cy="70" r="28"/><circle cx="200" cy="70" r="28"/></g><path stroke="${frame?'#c77432':'#d7d8d1'}" d="M60 70L99 25L125 70L60 70M99 25L183 25L125 70M183 25L200 70M99 25L94 15M85 15H105"/><g stroke="${drive?'#425d53':'#d7d8d1'}"><circle cx="125" cy="70" r="9"/><path d="M125 70L139 80L147 80"/></g><path stroke="${bar?'#425d53':'#d7d8d1'}" d="M183 25L178 10H202L207 17"/></g></svg>`;
  }

  function render() {
    const p=s.board[selected], req=requirements(s);
    const detailsOpen=root.querySelector('details')?.open ?? false;
    const focused=document.activeElement as HTMLElement|null;
    const focusSelector=focused && root.contains(focused) ? focused.dataset.cell!==undefined ? `[data-cell="${focused.dataset.cell}"]` : focused.dataset.action ? `[data-action="${focused.dataset.action}"]` : null : null;
    root.innerHTML=`<section class="placement-game" aria-label="직접 배치·인접 머지 E안">
      <header><strong>자전거 가게 · 작업대 정리</strong><span>급여 ${s.coins} C</span></header>
      <div class="placement-energy"><b data-energy></b><span data-clock></span></div>
      <div class="placement-order"><b>고객 주문 ${s.order+1} · ${['통학 자전거','시티 자전거','주말 자전거'][s.order%3]}</b>${bike()}<div class="placement-slots">${KINDS.map((k,i)=>`<span class="${s.installed[i]?'done':''}">${icons[i]} ${k}<br>${s.installed[i]?'장착 완료':`Lv.${req[i]} 필요`}</span>`).join('')}</div></div>
      <p class="placement-rule">빈칸에 직접 배치 · 이동 불가 · 상하좌우 2개 합성</p>
      <div class="placement-board" role="group" aria-label="6열 7행 작업대">${s.board.map((part,i)=>`<button data-cell="${i}" class="placement-cell ${part?`kind-${part.kind}`:''} ${selected===i?'selected':''} ${canMerge(s,selected,i)?'merge-target':''}" aria-pressed="${selected===i}" aria-label="${Math.floor(i/6)+1}행 ${i%6+1}열 ${part?`${KINDS[part.kind]} 레벨 ${part.level}`:'빈칸'}">${part?partHTML(part):''}</button>`).join('')}</div>
      <div class="placement-intake">
        <button data-action="supply"><b>📦 상자 열기</b><small>−1 체력</small></button>
        <button data-action="pending" ${s.pending?'':'disabled'} aria-pressed="${selected===PENDING}" class="${selected===PENDING?'selected':''}"><small>입고 대기</small>${s.pending?partHTML(s.pending):'<span>상자를 열어 주세요</span>'}</button>
        <button data-action="hold" ${s.pending||s.held?'':'disabled'}><small>보류 1칸</small>${s.held?partHTML(s.held):'<span>입고 부품 보관</span>'}<small>${s.held?s.pending?'눌러서 교환':'눌러서 꺼내기':''}</small></button>
      </div>
      <div class="placement-actions">
        <button data-action="install" ${p&&!s.installed[p.kind]&&p.level>=req[p.kind]?'':'disabled'}>자전거에 장착</button>
        <button data-action="deliver" ${s.installed.every(Boolean)?'':'disabled'}>납품 +500 C</button>
        <button data-action="undo" ${s.undo?'':'disabled'}>직전 행동 되돌리기</button>
        <button data-action="cancel" ${selected!==NONE?'':'disabled'}>선택 취소</button>
        <button data-action="return" ${p?'':'disabled'}>선택 부품 반품</button>
        <button data-action="upgrade" ${s.growth>=3||s.coins<500?'disabled':''}>내 자전거 성장 −500 C</button>
      </div>
      <p class="placement-message" role="status">${message}</p>
      <footer>내 드림 바이크 ${'★'.repeat(s.growth)}${'☆'.repeat(3-s.growth)} · 빈칸 ${s.board.filter(p=>!p).length}/42</footer>
      <details ${detailsOpen?'open':''}><summary>조작 안내 · 랩 테스트 도구</summary>
        <p>상자를 열면 입고 대기에 부품 1개가 나옵니다. 빈칸을 누르거나 입고 부품을 끌어 놓으세요. 배치 후 이동·교환은 불가능합니다. 같은 종류·레벨의 상하좌우 이웃에게만 드래그하면 합쳐지고, 놓은 대상 칸에 결과가 남습니다. 부품 선택 후 대상 탭도 가능합니다. 대각선·Lv.4 합성·자동 합성은 없습니다.</p>
        <p>보류 칸을 누르면 입고 부품을 보관하거나 교환합니다. 취소는 선택만 해제합니다. 되돌리기는 최근 배치·합성·보류·장착·납품·성장·반품 1회에 적용됩니다. 새 상자를 열면 이전 되돌리기는 지워집니다. 체력과 뽑힌 부품은 되돌려 재추첨할 수 없습니다. 보드가 가득 차면 합성·장착 또는 반품으로 공간을 확보하세요.</p>
        <p>체력 30, 상자당 1, 실제 10분당 1 회복. Lv.1 80% / Lv.2 20%. 종류는 70% 미장착 종류, 30% 전체 종류 중 추첨. 미장착 종류가 4회 연속 나오지 않으면 다음에 보장합니다. 모두 비교용 임시 수치입니다.</p>
        <button data-action="charge">테스트: 체력 충전</button><button data-action="speed">테스트: 10초 회복 ${accelerated?'ON':'OFF'}</button><button data-action="reset">E안 저장 초기화</button>
        <p>공급 ${s.supplied} · 합성 ${s.merges} · 반품 ${s.returned} · 납품 ${s.order}</p>
      </details><small data-save>${storageOK?'E안 자동 저장 · D안과 별도':'저장 불가: 이 화면에서만 진행됩니다.'}</small>
    </section>`;
    updateClock();
    if(focusSelector) root.querySelector<HTMLElement>(focusSelector)?.focus({preventScroll:true});
  }
  function updateClock() {
    const remaining=Math.max(0,Math.ceil((RECOVERY-(Date.now()-s.anchor))/1000));
    const clock=root.querySelector('[data-clock]');
    if(clock) clock.textContent=s.energy===CAP?'충전 완료':accelerated?'랩: 10초마다 +1':`다음 +1 ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
    const energy=root.querySelector('[data-energy]'); if(energy) energy.textContent=`⚡ 알바 체력 ${s.energy}/${CAP}`;
    const btn=root.querySelector<HTMLButtonElement>('[data-action=supply]');
    if(btn) {btn.disabled=!!s.pending||s.energy<1||!s.board.includes(null);btn.querySelector('small')!.textContent=s.pending?'입고 부품을 먼저 배치':!s.board.includes(null)?'작업대 공간 확보 필요':s.energy<1?'체력 회복 중':'−1 체력';}
  }
  function applyDrop(from:number,to:number) {
    if(from===PENDING) {
      if(place(s,to)) {selected=to;message='배치했어요. 이 자리에 고정되며 맞닿은 같은 부품과 합칠 수 있어요.';}
      else {selected=PENDING;message='입고 부품은 빈칸에만 놓을 수 있어요.';}
    } else if(drop(s,from,to)==='merged') {selected=to;message='인접한 두 부품을 합쳤어요. 결과는 놓은 칸에 남습니다.';}
    else {selected=from;message='이동은 불가해요. 상하좌우 같은 종류·레벨 부품에만 겹쳐 주세요.';}
  }
  function clearPreview() {
    root.querySelectorAll('.drop-merge,.drop-place,.drop-invalid,.preview-match').forEach(el=>el.classList.remove('drop-merge','drop-place','drop-invalid','preview-match'));
    root.querySelectorAll('[data-preview]').forEach(el=>el.remove());
  }
  function preview(to:number,from:number) {
    clearPreview();
    const cell=root.querySelector<HTMLElement>(`[data-cell="${to}"]`); if(!cell) return;
    if(from===PENDING && s.pending && !s.board[to]) {
      cell.classList.add('drop-place');
      const tile=document.createElement('div');tile.dataset.preview='';tile.className='placement-preview';tile.innerHTML=partHTML(s.pending);cell.append(tile);
      for(const i of placementMatches(s,to)) root.querySelector(`[data-cell="${i}"]`)?.classList.add('preview-match');
    } else if(from!==NONE) cell.classList.add(canMerge(s,from,to)?'drop-merge':'drop-invalid');
  }
  const click=(e:Event)=>{
    if(pointer?.dragging || (performance.now()<blockClickUntil && (e as MouseEvent).detail!==0)) return;
    const target=(e.target as Element).closest<HTMLButtonElement>('button');if(!target||target.disabled) return;
    if(target.dataset.cell!==undefined) {
      const i=Number(target.dataset.cell);
      if(selected===i) selected=NONE;
      else if(selected===PENDING) applyDrop(PENDING,i);
      else if(selected>=0 && canMerge(s,selected,i)) applyDrop(selected,i);
      else if(s.board[i]) {selected=i;message='옆의 같은 부품을 선택하면 합성합니다. 장착·반품도 선택할 수 있어요.';}
      else {selected=NONE;message='기존 부품은 빈칸으로 이동할 수 없어요. 입고 대기를 선택하면 새 부품을 배치할 수 있습니다.';}
    } else switch(target.dataset.action) {
      case 'supply':if(supply(s)){selected=PENDING;message='입고 부품이 나왔어요. 원하는 빈칸을 누르거나 끌어 놓으세요.';}break;
      case 'pending':selected=selected===PENDING?NONE:PENDING;break;
      case 'hold':if(hold(s)){selected=s.pending?PENDING:NONE;message=s.pending?'보류 부품을 입고 대기로 꺼냈어요.':'부품을 보류했어요. 다음 상자를 열 수 있습니다.';}break;
      case 'undo':if(undo(s)){selected=s.pending?PENDING:NONE;message='직전 행동을 되돌렸어요. 체력과 배송 추첨 결과는 유지됩니다.';}break;
      case 'cancel':selected=NONE;message='선택을 취소했어요. 입고 부품은 대기 칸에 보존됩니다.';break;
      case 'install':if(install(s,selected)){selected=NONE;message='부품을 장착했어요. 비워진 작업대 공간을 활용해 보세요.';}break;
      case 'return':if(s.board[selected]&&window.confirm('선택한 부품을 반품할까요? 부품은 사라지고 체력은 반환되지 않습니다.')){returnPart(s,selected);selected=NONE;message='반품하여 공간을 확보했어요. 직전 행동 되돌리기로 복구할 수 있습니다.';}break;
      case 'deliver':if(deliver(s)){selected=NONE;message='자전거 납품 완료! 급여 500 C를 받았어요.';}break;
      case 'upgrade':if(upgrade(s))message='급여로 내 드림 바이크를 성장시켰어요!';break;
      case 'charge':s.energy=CAP;s.anchor=Date.now();message='테스트용 체력을 충전했어요.';break;
      case 'speed':accelerated=!accelerated;ticks=0;break;
      case 'reset':if(window.confirm('E안의 보드·체력·급여·성장을 초기화할까요?')){s=fresh();selected=NONE;message='E안 첫 주문을 시작합니다.';}break;
    }
    save();render();
  };
  function clearDrag() {
    const id=pointer?.id;pointer=null;
    if(id!==undefined&&root.hasPointerCapture?.(id))root.releasePointerCapture(id);
    ghost?.remove();ghost=null;clearPreview();
    root.querySelectorAll('.drag-source').forEach(el=>el.classList.remove('drag-source'));
  }
  const down=(e:PointerEvent)=>{
    if(pointer||e.isPrimary===false||e.button!==0)return;
    blockClickUntil=0;
    const el=(e.target as Element).closest<HTMLElement>('[data-cell],[data-action=pending]');
    if(!el)return;
    const index=el.dataset.cell===undefined?PENDING:Number(el.dataset.cell);
    if(index===PENDING?s.pending:s.board[index])pointer={index,id:e.pointerId,x:e.clientX,y:e.clientY,dragging:false};
  };
  const drag=(e:PointerEvent)=>{
    if(!pointer||pointer.id!==e.pointerId)return;
    if(!pointer.dragging&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)<8)return;
    e.preventDefault();
    if(!pointer.dragging){
      pointer.dragging=true;root.setPointerCapture(e.pointerId);
      const source=root.querySelector<HTMLElement>(pointer.index===PENDING?'[data-action=pending]':`[data-cell="${pointer.index}"]`)!;
      ghost=document.createElement('div');ghost.className='placement-drag-ghost';ghost.setAttribute('aria-hidden','true');
      ghost.innerHTML=partHTML((pointer.index===PENDING?s.pending:s.board[pointer.index])!);
      ghost.style.width=`${root.querySelector('[data-cell]')!.getBoundingClientRect().width}px`;
      document.body.append(ghost);source.classList.add('drag-source');
    }
    ghost!.style.left=`${e.clientX}px`;ghost!.style.top=`${e.clientY-18}px`;
    const cell=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-cell]');
    if(cell&&root.contains(cell))preview(Number(cell.dataset.cell),pointer.index);else clearPreview();
  };
  const up=(e:PointerEvent)=>{
    if(!pointer||pointer.id!==e.pointerId)return;
    const from=pointer;
    if(!from.dragging){clearDrag();return;}
    const cell=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-cell]');
    clearDrag();blockClickUntil=performance.now()+500;
    if(cell&&root.contains(cell))applyDrop(from.index,Number(cell.dataset.cell));
    else {selected=from.index;message='배치를 취소했어요. 부품은 원래 위치에 남습니다.';}
    save();render();
  };
  const cancel=()=>{if(pointer?.dragging)blockClickUntil=performance.now()+500;clearDrag();};
  const hover=(e:Event)=>{if(pointer)return;const el=(e.target as Element).closest<HTMLElement>('[data-cell]');if(el)preview(Number(el.dataset.cell),selected);};
  const leave=()=>{if(!pointer)clearPreview();};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){cancel();selected=NONE;message='선택을 취소했어요.';render();}};
  const flush=()=>{recover(s);save();};
  const hide=()=>{cancel();flush();};
  const visibility=()=>{hide();if(!document.hidden)render();};
  root.addEventListener('click',click);root.addEventListener('pointerdown',down);root.addEventListener('pointerover',hover);root.addEventListener('focusin',hover);root.addEventListener('pointerleave',leave);root.addEventListener('keydown',key);
  window.addEventListener('pointermove',drag,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);root.addEventListener('lostpointercapture',cancel);window.addEventListener('blur',cancel);window.addEventListener('pagehide',hide);document.addEventListener('visibilitychange',visibility);
  const timer=window.setInterval(()=>{const before=s.energy;recover(s);if(accelerated&&++ticks%10===0&&s.energy<CAP){s.energy++;s.anchor=Date.now();}if(before!==s.energy)save();updateClock();},1000);
  save();render();
  return {destroy(){cancel();flush();clearInterval(timer);root.removeEventListener('click',click);root.removeEventListener('pointerdown',down);root.removeEventListener('pointerover',hover);root.removeEventListener('focusin',hover);root.removeEventListener('pointerleave',leave);root.removeEventListener('keydown',key);window.removeEventListener('pointermove',drag);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);root.removeEventListener('lostpointercapture',cancel);window.removeEventListener('blur',cancel);window.removeEventListener('pagehide',hide);document.removeEventListener('visibilitychange',visibility);root.innerHTML='';}};
}
