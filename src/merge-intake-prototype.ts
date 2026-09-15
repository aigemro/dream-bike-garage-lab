import { KINDS, CAP, RECOVERY, fresh, restore, recover, requirements, nextSlot, supply, mergeGroup, merge, move, install, deliver, upgrade } from './merge-intake-state';
import './merge-intake.css';
const KEY='dbg-lab-merge-intake-v1';
const icons=['△','◉','⚙','┬'];
export function startMergeIntake(parent: string) {
  const root=document.getElementById(parent)!;
  let storageOK=true;
  let raw: string|null=null; try { raw=localStorage.getItem(KEY); } catch { storageOK=false; }
  let s=restore(raw), selected=-1, message='사장님: 입고 부품을 정리해 고객 자전거를 조립해 주세요. 빛나는 3칸을 머지해 보세요.', accelerated=false;
  let pointer: {index:number;x:number;y:number}|null=null;
  let suppressClick=false;
  const save=()=>{ try {localStorage.setItem(KEY,JSON.stringify(s));} catch {storageOK=false;} };
  function bike() {
    const [frame,wheels,drive,bar]=s.installed;
    return `<svg viewBox="0 0 260 105" aria-label="고객 자전거 조립 ${s.installed.filter(Boolean).length}/4" role="img"><g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="5"><g stroke="${wheels?'#425d53':'#d7d8d1'}"><circle cx="60" cy="70" r="28"/><circle cx="200" cy="70" r="28"/></g><path stroke="${frame?'#c77432':'#d7d8d1'}" d="M60 70L99 25L125 70L60 70M99 25L183 25L125 70M183 25L200 70M99 25L94 15M85 15H105"/><g stroke="${drive?'#425d53':'#d7d8d1'}"><circle cx="125" cy="70" r="9"/><path d="M125 70L139 80L147 80"/></g><path stroke="${bar?'#425d53':'#d7d8d1'}" d="M183 25L178 10H202L207 17"/></g></svg>`;
  }
  function render() {
    const group=mergeGroup(s,selected), slot=nextSlot(s), p=s.board[selected], req=requirements(s);
    root.innerHTML=`<section class="intake-game" aria-label="입고 정리형 머지 D안">
      <header><strong>자전거 가게 · 입고 정리</strong><span>급여 ${s.coins} C</span></header>
      <div class="intake-energy"><b>⚡ 알바 체력 ${s.energy}/${CAP}</b><span data-clock></span></div>
      <div class="intake-order"><div><b>고객 주문 ${s.order+1} · ${['통학 자전거','시티 자전거','주말 자전거'][s.order%3]}</b><small>부품 선택 → 장착 · 모두 장착하면 납품 +500 C</small></div>${bike()}<div class="intake-slots">${KINDS.map((k,i)=>`<span class="${s.installed[i]?'done':''}">${icons[i]} ${k}<br>${s.installed[i]?'장착 완료':`Lv.${req[i]} 필요`}</span>`).join('')}</div></div>
      <div class="intake-board" role="group" aria-label="6열 7행 작업대">${s.board.map((part,i)=>`<button data-cell="${i}" class="intake-cell ${part?`kind-${part.kind}`:''} ${selected===i?'selected':''} ${group.includes(i)?'merge-target':''} ${slot===i?'next-slot':''}" aria-pressed="${selected===i}" aria-label="${Math.floor(i/6)+1}행 ${i%6+1}열 ${part?`${KINDS[part.kind]} 레벨 ${part.level}`:slot===i?'다음 입고 위치':'빈칸'}">${part?`<b>${icons[part.kind]}</b><span>${KINDS[part.kind]}</span><small>Lv.${part.level}</small>`:slot===i?'<small>다음 입고</small>':''}</button>`).join('')}</div>
      <div class="intake-actions"><button data-action="supply" ${slot<0||s.energy<1?'disabled':''}>📦 입고 정리 −1⚡</button><button data-action="merge" ${group.length?'':'disabled'}>3개 머지</button><button data-action="install" ${p&&!s.installed[p.kind]&&p.level>=req[p.kind]?'':'disabled'}>장착</button><button data-action="cancel" ${selected<0?'disabled':''}>선택 취소</button><button data-action="return" ${p?'':'disabled'}>재고 반납</button><button data-action="deliver" ${s.installed.every(Boolean)?'':'disabled'}>자전거 납품</button></div>
      <p class="intake-message" role="status">${message}</p>
      <footer><span>내 드림 바이크 ${'★'.repeat(s.growth)}${'☆'.repeat(3-s.growth)}</span><button data-action="upgrade" ${s.growth>=3||s.coins<500?'disabled':''}>${s.growth>=3?'성장 완료':'성장 −500 C'}</button></footer>
      <details><summary>조작 안내 · 랩 테스트 도구</summary><p>부품을 누른 뒤 다른 칸을 누르거나 드래그하면 이동·교환합니다. 같은 종류·레벨의 상하좌우 연결 3개를 강조 표시대로 합칩니다. 대각선은 제외하며 Lv.4는 최대입니다. 반납한 부품은 사라지고 체력은 반환되지 않습니다.</p><p>입고 부품: Lv.1 80% / Lv.2 20%. 70%는 미장착 종류 중 선택, 나머지는 전체 종류 중 선택합니다. 미장착 종류가 4회 연속 안 나오면 다음에 보장합니다. 체력은 실제 10분마다 1 회복하며 Day와 무관합니다.</p><button data-action="charge">테스트: 체력 충전</button><button data-action="speed">테스트: 10초 회복 ${accelerated?'ON':'OFF'}</button><button data-action="reset">D안 저장 초기화</button><p>공급 ${s.supplied}회 · 머지 ${s.merges}회 · 납품 ${s.order}대</p></details><small data-save>${storageOK?'D안 자동 저장 · 기존 실험과 별도':'저장 불가: 이 화면에서만 진행됩니다.'}</small>
    </section>`;
    updateClock();
  }
  function updateClock() {
    const remaining=Math.max(0,Math.ceil((RECOVERY-(Date.now()-s.anchor))/1000));
    const el=root.querySelector('[data-clock]'); if(el) el.textContent=s.energy===CAP?'충전 완료':accelerated?'랩: 10초마다 +1':`다음 +1 ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
  }
  const click=(e:Event)=>{
    if(suppressClick) { suppressClick=false; return; }
    const target=(e.target as Element).closest<HTMLButtonElement>('button'); if(!target) return;
    if(target.dataset.cell!==undefined) {
      const i=Number(target.dataset.cell);
      if(selected===i) selected=-1;
      else if(selected>=0) {move(s,selected,i); selected=i; message='배치했습니다. 강조된 3칸을 확인하고 머지하세요.';}
      else if(s.board[i]) selected=i;
    } else switch(target.dataset.action) {
      case 'supply': if(supply(s)) message='혼합 입고 상자에서 부품을 꺼냈어요. 같은 부품끼리 모아 보세요.'; break;
      case 'merge': if(merge(s,selected)) message='부품 레벨 상승! 주문에 필요한 레벨이면 장착하세요.'; break;
      case 'install': if(install(s,selected)) {selected=-1;message='고객 자전거에 부품을 장착했어요.';} break;
      case 'cancel': selected=-1; break;
      case 'return': if(s.board[selected] && window.confirm('선택한 부품을 재고로 반납할까요? 부품이 사라지며 체력은 돌아오지 않습니다.')) {s.board[selected]=null;selected=-1;message='반납하여 빈칸을 확보했어요.';} break;
      case 'deliver': if(deliver(s)) {selected=-1;message='납품 완료! 급여 500 C를 받았어요. 남은 부품으로 다음 주문을 준비하세요.';} break;
      case 'upgrade': if(upgrade(s)) message='급여로 내 드림 바이크를 성장시켰어요!'; break;
      case 'charge': s.energy=CAP;s.anchor=Date.now();message='랩 테스트용 체력을 충전했습니다.';break;
      case 'speed': accelerated=!accelerated;message=`랩 회복 가속 ${accelerated?'ON':'OFF'} · 화면을 나가면 해제됩니다.`;break;
      case 'reset': if(window.confirm('D안의 보드·체력·급여·성장을 초기화할까요?')) {s=fresh();selected=-1;message='첫 주문을 시작합니다. 같은 부품 3개를 선택해 머지하세요.';} break;
    }
    save();render();
  };
  const down=(e:PointerEvent)=>{const cell=(e.target as Element).closest<HTMLElement>('[data-cell]');if(cell&&s.board[Number(cell.dataset.cell)]) pointer={index:Number(cell.dataset.cell),x:e.clientX,y:e.clientY};};
  const up=(e:PointerEvent)=>{
    if(!pointer) return; const from=pointer;pointer=null;
    if(Math.hypot(e.clientX-from.x,e.clientY-from.y)<8) return;
    const cell=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-cell]');
    if(cell&&root.contains(cell)) {const to=Number(cell.dataset.cell);move(s,from.index,to);selected=to;message='이동·교환했습니다. 강조된 3칸을 합칠 수 있어요.';save();render();}
    suppressClick=true;setTimeout(()=>suppressClick=false,0);
  };
  const cancel=()=>{pointer=null;};
  root.addEventListener('click',click);root.addEventListener('pointerdown',down);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);
  const flush=()=>{recover(s);save();};window.addEventListener('pagehide',flush);
  const visibility=()=>{flush();if(!document.hidden)render();};document.addEventListener('visibilitychange',visibility);
  let ticks=0;
  const timer=window.setInterval(()=>{const before=s.energy;recover(s);if(accelerated && ++ticks%10===0 && s.energy<CAP){s.energy++;s.anchor=Date.now();}if(before!==s.energy){save();render();}else updateClock();},1000);
  save();render();
  return {destroy(){flush();clearInterval(timer);root.removeEventListener('click',click);root.removeEventListener('pointerdown',down);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',visibility);root.innerHTML='';}};
}
