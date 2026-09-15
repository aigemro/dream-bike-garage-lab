import { KINDS, CAP, RECOVERY, fresh, restore, recover, requirements, nextSlot, supply, canMerge, drop, install, deliver, upgrade } from './merge-intake-state';
import './merge-intake.css';
const KEY='dbg-lab-merge-intake-v1';
const icons=['△','◉','⚙','┬'];
export function startMergeIntake(parent: string) {
  const root=document.getElementById(parent)!;
  let storageOK=true;
  let raw: string|null=null; try { raw=localStorage.getItem(KEY); } catch { storageOK=false; }
  let s=restore(raw), selected=-1, message='사장님: 입고 부품을 정리해 고객 자전거를 조립해 주세요. 같은 부품 2개를 끌어 겹쳐 보세요.', accelerated=false;
  let pointer: { index: number; id: number; x: number; y: number; dragging: boolean } | null = null;
  let ghost: HTMLElement | null = null;
  let blockClickUntil = 0;
  let effect: { index: number; origin?: DOMRect } | null = null;
  const save=()=>{ try {localStorage.setItem(KEY,JSON.stringify(s));} catch {storageOK=false;} };
  function bike() {
    const [frame,wheels,drive,bar]=s.installed;
    return `<svg viewBox="0 0 260 105" aria-label="고객 자전거 조립 ${s.installed.filter(Boolean).length}/4" role="img"><g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="5"><g stroke="${wheels?'#425d53':'#d7d8d1'}"><circle cx="60" cy="70" r="28"/><circle cx="200" cy="70" r="28"/></g><path stroke="${frame?'#c77432':'#d7d8d1'}" d="M60 70L99 25L125 70L60 70M99 25L183 25L125 70M183 25L200 70M99 25L94 15M85 15H105"/><g stroke="${drive?'#425d53':'#d7d8d1'}"><circle cx="125" cy="70" r="9"/><path d="M125 70L139 80L147 80"/></g><path stroke="${bar?'#425d53':'#d7d8d1'}" d="M183 25L178 10H202L207 17"/></g></svg>`;
  }
  function render() {
    const slot=nextSlot(s), p=s.board[selected], req=requirements(s);
    const detailsOpen = root.querySelector('details')?.open ?? false;
    const focused = (document.activeElement as HTMLElement | null)?.dataset.cell;
    root.innerHTML=`<section class="intake-game" aria-label="입고 정리형 머지 D안">
      <header><strong>자전거 가게 · 입고 정리</strong><span>급여 ${s.coins} C</span></header>
      <div class="intake-energy"><b>⚡ 알바 체력 ${s.energy}/${CAP}</b><span data-clock></span></div>
      <div class="intake-order"><div><b>고객 주문 ${s.order+1} · ${['통학 자전거','시티 자전거','주말 자전거'][s.order%3]}</b><small>부품 선택 → 장착 · 모두 장착하면 납품 +500 C</small></div>${bike()}<div class="intake-slots">${KINDS.map((k,i)=>`<span class="${s.installed[i]?'done':''}">${icons[i]} ${k}<br>${s.installed[i]?'장착 완료':`Lv.${req[i]} 필요`}</span>`).join('')}</div></div>
      <div class="intake-board" role="group" aria-label="6열 7행 작업대">${s.board.map((part,i)=>`<button data-cell="${i}" class="intake-cell ${part?`kind-${part.kind}`:''} ${selected===i?'selected':''} ${canMerge(s,selected,i)?'merge-target':''} ${slot===i?'next-slot':''}" aria-pressed="${selected===i}" aria-label="${Math.floor(i/6)+1}행 ${i%6+1}열 ${part?`${KINDS[part.kind]} 레벨 ${part.level}`:slot===i?'다음 입고 위치':'빈칸'}">${part?`<b>${icons[part.kind]}</b><span>${KINDS[part.kind]}</span><small>Lv.${part.level}</small>`:slot===i?'<small>다음 입고</small>':''}</button>`).join('')}</div>
      <div class="intake-tray"><button data-action="supply" ${slot<0||s.energy<1?'disabled':''}><b>📦 입고 상자</b><span>${slot<0?'작업대가 가득 찼어요':s.energy<1?'체력 회복 중':'눌러서 부품 꺼내기 · −1⚡'}</span></button><small>상자 가까운 점선 칸에 자동 배치</small></div>
      <div class="intake-actions"><button data-action="install" ${p&&!s.installed[p.kind]&&p.level>=req[p.kind]?'':'disabled'}>자전거에 장착</button><button data-action="cancel" ${selected<0?'disabled':''}>선택 취소</button><button data-action="return" ${p?'':'disabled'}>재고 반납</button><button data-action="deliver" ${s.installed.every(Boolean)?'':'disabled'}>자전거 납품</button></div>
      <p class="intake-message" role="status">${message}</p>
      <footer><span>내 드림 바이크 ${'★'.repeat(s.growth)}${'☆'.repeat(3-s.growth)}</span><button data-action="upgrade" ${s.growth>=3||s.coins<500?'disabled':''}>${s.growth>=3?'성장 완료':'성장 −500 C'}</button></footer>
      <details ${detailsOpen?'open':''}><summary>조작 안내 · 랩 테스트 도구</summary><p>같은 종류·레벨 2개를 끌어 겹치면 바로 합쳐집니다. 거리는 상관없습니다. 빈칸에 놓으면 이동하고 다른 부품에 놓으면 서로 자리를 바꿉니다. 드래그 대신 부품 선택 후 대상 칸을 눌러도 됩니다. 선택 부품과 합칠 수 있는 대상을 테두리로 표시합니다. Lv.4는 최대이며 같은 Lv.4끼리는 위치만 교환합니다. 반납한 부품은 사라지고 체력은 반환되지 않습니다.</p><p>입고 부품: Lv.1 80% / Lv.2 20%. 70%는 미장착 종류 중 선택, 나머지는 전체 종류 중 선택합니다. 미장착 종류가 4회 연속 안 나오면 다음에 보장합니다. 체력은 실제 10분마다 1 회복하며 Day와 무관합니다.</p><button data-action="charge">테스트: 체력 충전</button><button data-action="speed">테스트: 10초 회복 ${accelerated?'ON':'OFF'}</button><button data-action="reset">D안 저장 초기화</button><p>공급 ${s.supplied}회 · 머지 ${s.merges}회 · 납품 ${s.order}대</p></details><small data-save>${storageOK?'D안 자동 저장 · 기존 실험과 별도':'저장 불가: 이 화면에서만 진행됩니다.'}</small>
    </section>`;
    updateClock();
    if (focused !== undefined) root.querySelector<HTMLButtonElement>(`[data-cell="${focused}"]`)?.focus({preventScroll:true});
    if (effect) {
      const cell = root.querySelector<HTMLElement>(`[data-cell="${effect.index}"]`);
      if (cell && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && typeof cell.animate === 'function') {
        const dest = cell.getBoundingClientRect(), origin = effect.origin;
        cell.animate(origin ? [
          { transform: `translate(${origin.x+origin.width/2-dest.x-dest.width/2}px,${origin.y+origin.height/2-dest.y-dest.height/2}px) scale(.55)`, opacity: .3 },
          { transform: 'translate(0,0) scale(1)', opacity: 1 }
        ] : [{ transform: 'scale(1.15)', backgroundColor: '#ffe19a' }, { transform: 'scale(1)' }], {duration:240,easing:'ease-out'});
      }
      effect = null;
    }
  }
  function updateClock() {
    const remaining=Math.max(0,Math.ceil((RECOVERY-(Date.now()-s.anchor))/1000));
    const el=root.querySelector('[data-clock]'); if(el) el.textContent=s.energy===CAP?'충전 완료':accelerated?'랩: 10초마다 +1':`다음 +1 ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
  }
  const click=(e:Event)=>{
    if(pointer?.dragging || (performance.now() < blockClickUntil && (e as MouseEvent).detail !== 0)) return;
    const target=(e.target as Element).closest<HTMLButtonElement>('button'); if(!target) return;
    if(target.dataset.cell!==undefined) {
      const i=Number(target.dataset.cell);
      if(selected===i) selected=-1;
      else if(selected>=0) applyDrop(selected,i);
      else if(s.board[i]) { selected=i; message='같은 부품에 겹치면 머지, 빈칸은 이동, 다른 부품은 위치 교환입니다.'; }
    } else switch(target.dataset.action) {
      case 'supply': {
        const index=nextSlot(s), origin=target.getBoundingClientRect();
        if(supply(s)) { effect={index,origin}; selected=-1; message=`${KINDS[s.board[index]!.kind]} Lv.${s.board[index]!.level} 입고! 같은 부품에 끌어 겹쳐 보세요.`; }
        break;
      }
      case 'install': if(install(s,selected)) {selected=-1;message='고객 자전거에 부품을 장착했어요.';} break;
      case 'cancel': selected=-1; break;
      case 'return': if(s.board[selected] && window.confirm('선택한 부품을 재고로 반납할까요? 부품이 사라지며 체력은 돌아오지 않습니다.')) {s.board[selected]=null;selected=-1;message='반납하여 빈칸을 확보했어요.';} break;
      case 'deliver': if(deliver(s)) {selected=-1;message='납품 완료! 급여 500 C를 받았어요. 남은 부품으로 다음 주문을 준비하세요.';} break;
      case 'upgrade': if(upgrade(s)) message='급여로 내 드림 바이크를 성장시켰어요!'; break;
      case 'charge': s.energy=CAP;s.anchor=Date.now();message='랩 테스트용 체력을 충전했습니다.';break;
      case 'speed': accelerated=!accelerated;message=`랩 회복 가속 ${accelerated?'ON':'OFF'} · 화면을 나가면 해제됩니다.`;break;
      case 'reset': if(window.confirm('D안의 보드·체력·급여·성장을 초기화할까요?')) {s=fresh();selected=-1;message='첫 주문을 시작합니다. 같은 부품 2개를 겹쳐 머지하세요.';} break;
    }
    save();render();
  };
  function applyDrop(from: number, to: number) {
    const result=drop(s,from,to);
    selected=to;
    message=result==='merged'?'두 부품을 합쳤어요! 필요한 레벨이면 자전거에 장착하세요.':result==='swapped'?'두 부품의 자리를 바꿨어요.':result==='moved'?'빈칸으로 옮겼어요.':'원래 위치에 놓았어요.';
    if(result==='merged') effect={index:to};
  }
  function clearDrag() {
    const id=pointer?.id;
    pointer=null;
    if(id!==undefined && root.hasPointerCapture?.(id)) root.releasePointerCapture(id);
    ghost?.remove();ghost=null;
    root.querySelectorAll('.drag-source,.drop-merge,.drop-move,.drop-swap').forEach(el=>el.classList.remove('drag-source','drop-merge','drop-move','drop-swap'));
  }
  const down=(e:PointerEvent)=>{
    if(pointer || e.isPrimary===false || e.button!==0) return;
    blockClickUntil=0;
    const cell=(e.target as Element).closest<HTMLElement>('[data-cell]');
    if(cell&&s.board[Number(cell.dataset.cell)]) pointer={index:Number(cell.dataset.cell),id:e.pointerId,x:e.clientX,y:e.clientY,dragging:false};
  };
  const drag=(e:PointerEvent)=>{
    if(!pointer || pointer.id!==e.pointerId) return;
    if(!pointer.dragging && Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)<8) return;
    e.preventDefault();
    if(!pointer.dragging) {
      pointer.dragging=true;
      root.setPointerCapture(e.pointerId);
      const source=root.querySelector<HTMLElement>(`[data-cell="${pointer.index}"]`)!;
      ghost=source.cloneNode(true) as HTMLElement;
      ghost.removeAttribute('data-cell');ghost.removeAttribute('aria-pressed');ghost.setAttribute('aria-hidden','true');ghost.tabIndex=-1;
      ghost.className='intake-drag-ghost';ghost.style.width=`${source.getBoundingClientRect().width}px`;
      document.body.append(ghost);source.classList.add('drag-source');
    }
    ghost!.style.left=`${e.clientX}px`;ghost!.style.top=`${e.clientY-18}px`;
    root.querySelectorAll('.drop-merge,.drop-move,.drop-swap').forEach(el=>el.classList.remove('drop-merge','drop-move','drop-swap'));
    const cell=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-cell]');
    if(cell&&root.contains(cell)&&Number(cell.dataset.cell)!==pointer.index) {
      const to=Number(cell.dataset.cell);
      cell.classList.add(canMerge(s,pointer.index,to)?'drop-merge':s.board[to]?'drop-swap':'drop-move');
    }
  };
  const up=(e:PointerEvent)=>{
    if(!pointer || pointer.id!==e.pointerId) return;
    const from=pointer;
    if(!from.dragging) {clearDrag();return;}
    const cell=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-cell]');
    clearDrag();blockClickUntil=performance.now()+500;
    if(cell&&root.contains(cell)) applyDrop(from.index,Number(cell.dataset.cell));
    else {selected=from.index;message='작업대 밖에 놓아 이동을 취소했어요.';}
    save();render();
  };
  const cancel=()=>{if(pointer?.dragging)blockClickUntil=performance.now()+500;clearDrag();};
  root.addEventListener('click',click);root.addEventListener('pointerdown',down);
  window.addEventListener('pointermove',drag,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);
  root.addEventListener('lostpointercapture',cancel);window.addEventListener('blur',cancel);
  const flush=()=>{recover(s);save();};window.addEventListener('pagehide',flush);
  const visibility=()=>{cancel();flush();if(!document.hidden)render();};document.addEventListener('visibilitychange',visibility);
  let ticks=0;
  const timer=window.setInterval(()=>{const before=s.energy;recover(s);if(accelerated && ++ticks%10===0 && s.energy<CAP){s.energy++;s.anchor=Date.now();}if(before!==s.energy){save();if(!pointer)render();}else updateClock();},1000);
  save();render();
  return {destroy(){cancel();flush();clearInterval(timer);root.removeEventListener('lostpointercapture',cancel);window.removeEventListener('blur',cancel);window.removeEventListener('pointermove',drag);root.removeEventListener('click',click);root.removeEventListener('pointerdown',down);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',visibility);root.innerHTML='';}};
}
