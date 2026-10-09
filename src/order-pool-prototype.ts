// 주문 풀·도감 해금 체험 화면 (#266 · DOM)
// 작업대 플레이는 생략하고 '납품' 버튼으로 주문을 하나씩 끝내며, Day마다 어떤 주문이 오고
// 도감 자전거가 언제 열리는지(등록·제작·강화)를 방안별로 빠르게 체감하는 화면입니다.
import { CATALOG_BIKES, type BikeCategoryKorean } from './bike-catalog';
import { DREAM_STAT_KEYS, bikeStats, bikeUnderstanding, isBikeCrafted, isBikeRegistered } from './meta-progress';
import {
  BOARD_SIZE, ORDER_POOL, ORDERS_PER_DAY, POOL_VARIANT_LABELS, REGULAR_CUSTOMERS, activeRegular, autoChooseBoard, chooseFromBoard, createPoolState,
  deliverNext, nextPoolGoal, orderableBikeCount, poolOrder, spendCoins, workUnits, type PoolOrder, type PoolState, type PoolVariant,
} from './order-pool';
import './order-pool.css';

const PART_SHORT = ['프레임', '휠셋', '구동계', '핸들바'];
const CATEGORIES: BikeCategoryKorean[] = ['로드', 'MTB', '그래블', '미니벨로'];
const UNLOCK_STEPS = [
  { day: 3, label: '입문 6종' },
  { day: 6, label: '중급 7종' },
  { day: 10, label: '고급 4종' },
];

const escape = (text: string) => text.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
const bikeName = (bikeId: string) => CATALOG_BIKES.find((bike) => bike.id === bikeId)?.name ?? bikeId;

export function startOrderPoolPrototype(parent: string, variant: PoolVariant) {
  const root = document.getElementById(parent);
  if (!root) throw new Error(`order pool parent not found: ${parent}`);
  const state: PoolState = createPoolState(variant);
  let autoSpend = true;
  let picks: string[] = [];
  const log: string[] = [`Day 1 시작 · ${POOL_VARIANT_LABELS[variant]}`];
  const note = (line: string) => { log.unshift(line); log.length = Math.min(log.length, 10); };

  const deliverOne = () => {
    const dayBefore = state.day;
    const result = deliverNext(state);
    if (!result) return;
    note(`납품 · ${result.order.name} +${result.order.reward.toLocaleString()} C${result.registeredNow ? ` · 🆕 ${bikeName(result.order.bikeId)} 도감 등록` : ''}`);
    if (result.storyUnlock) note(`📖 단골 손님 이야기 완료 · ${bikeName(result.storyUnlock)} 도감 등록`);
    if (autoSpend) {
      const crafted = state.collection.craftedBikeIds.length;
      spendCoins(state);
      if (state.collection.craftedBikeIds.length > crafted) note(`🔧 급여로 ${state.collection.craftedBikeIds.length - crafted}대 제작 완료`);
    }
    if (state.day !== dayBefore) {
      note(`Day ${state.day} 시작`);
      const unlock = UNLOCK_STEPS.find((step) => step.day === state.day);
      if (unlock && variant !== 'cycle') note(`✨ 주문 풀 확장 · ${unlock.label}`);
      picks = [];
    }
  };

  const orderCard = (order: PoolOrder, extra: string) => {
    const understanding = bikeUnderstanding(state.collection, order.bikeId);
    const registered = isBikeRegistered(state.collection, order.bikeId);
    const regular = REGULAR_CUSTOMERS.find((c) => variant === 'regulars' && c.orderIds.includes(order.id) && activeRegular(state)?.id === c.id);
    const tag = regular ? `<em class="op-tag op-regular">단골 · ${escape(regular.name)}</em>` : registered ? '<em class="op-tag">도감 등록됨</em>' : `<em class="op-tag op-new">이해도 ${understanding}%</em>`;
    const levels = order.levels.map((level, index) => `${PART_SHORT[index]} Lv.${level}`).join(' · ');
    return `<article class="op-order">
      <header><strong>${escape(order.name)}</strong>${tag}</header>
      <p>${escape(bikeName(order.bikeId))} · ${order.grade}</p>
      <p class="op-levels">${levels}</p>
      <footer><span>보상 ${order.reward.toLocaleString()} C · 작업량 ${workUnits(order.levels)}</span>${extra}</footer>
    </article>`;
  };

  const render = () => {
    const registered = state.collection.registeredBikeIds.length - 1;
    const owned = state.collection.craftedBikeIds.length - 1;
    const goal = nextPoolGoal(state);
    const goalLabel = goal.kind === 'repeat' ? '모든 목표 달성 · 반복 주문만 남음' : `${{ craft: '제작', understand: '이해도', upgrade: '강화' }[goal.kind]} · ${escape(bikeName(goal.bikeId))}`;
    const regular = activeRegular(state);
    let today = '';
    if (variant === 'board' && state.today.length === 0) {
      today = `<h3>주문 게시판 · ${ORDERS_PER_DAY}건 고르기 (${picks.length}/${ORDERS_PER_DAY})</h3>
        ${state.board.map((id) => orderCard(poolOrder(id)!, `<label class="op-pick"><input type="checkbox" data-pick="${id}" ${picks.includes(id) ? 'checked' : ''}/> 고르기</label>`)).join('')}
        <button type="button" data-action="confirm" ${picks.length === ORDERS_PER_DAY ? '' : 'disabled'}>오늘 주문 확정</button>
        <small>후보는 최대 ${BOARD_SIZE}건이며, Day 1·2는 풀에 3종뿐이라 3건 모두 고릅니다.</small>`;
    } else {
      today = `<h3>오늘 주문 (${ORDERS_PER_DAY - state.today.length}/${ORDERS_PER_DAY} 납품)</h3>
        ${state.today.map((id, index) => orderCard(poolOrder(id)!, index === 0 ? '<button type="button" data-action="deliver">납품</button>' : '<span class="op-wait">대기</span>')).join('')}`;
    }
    const unlocks = variant === 'cycle' ? '<p>현행: 주문 3종이 같은 순서로 반복됩니다.</p>'
      : `<ol class="op-unlocks">${UNLOCK_STEPS.map((step) => `<li class="${state.day >= step.day ? 'done' : ''}">Day ${step.day} · ${step.label}</li>`).join('')}</ol>`;
    const regularPanel = variant !== 'regulars' ? '' : `<section class="op-regulars"><h3>단골 손님</h3>${REGULAR_CUSTOMERS.map((customer) => {
      const step = state.regularStep[customer.id] ?? 0;
      const status = step >= 3 ? '완료' : customer.arriveDay > state.day ? `Day ${customer.arriveDay} 방문 예정` : `${step}/3 진행 중`;
      return `<p class="${regular?.id === customer.id ? 'active' : ''}"><strong>${escape(customer.name)}</strong> · ${status}<br><small>${escape(customer.story)} → ${escape(bikeName(poolOrder(customer.orderIds[2])!.bikeId))}</small></p>`;
    }).join('')}</section>`;
    const grid = CATEGORIES.map((category) => `<div class="op-category"><h4>${category}</h4>${CATALOG_BIKES.filter((bike) => bike.category === category).map((bike) => {
      const inPool = bike.id === 'dream-road' || (variant === 'cycle' ? ['urban-road', 'trail-mtb', 'aero-sprinter'].includes(bike.id) : ORDER_POOL.some((order) => order.bikeId === bike.id));
      const crafted = isBikeCrafted(state.collection, bike.id);
      const statLevel = crafted ? DREAM_STAT_KEYS.reduce((sum, key) => sum + bikeStats(state.growth, bike.id)[key], 0) : 0;
      const status = crafted ? `보유 · 강화 ${statLevel}/12` : isBikeRegistered(state.collection, bike.id) ? '등록 · 제작 중' : !inPool ? (bike.grade === '드림' ? '드림 승급 보상' : '주문 없음') : `이해도 ${bikeUnderstanding(state.collection, bike.id)}%`;
      const cls = crafted ? 'owned' : isBikeRegistered(state.collection, bike.id) ? 'registered' : !inPool ? 'locked' : '';
      return `<p class="op-bike ${cls}"><span>${escape(bike.name)}</span><small>${status}</small></p>`;
    }).join('')}</div>`).join('');

    root.innerHTML = `<div class="op-shell">
      <header class="op-head">
        <div><span>${POOL_VARIANT_LABELS[variant]}</span><strong>DAY ${state.day} · 코인 ${state.coins.toLocaleString()} C</strong>
        <small>도감 등록 ${registered}/${orderableBikeCount(variant)} · 보유 ${owned} · 납품 ${state.ordersDelivered}건 · 다음 목표: ${goalLabel}</small></div>
        <div class="op-actions">
          <button type="button" data-action="day">오늘 일정 모두 납품</button>
          <button type="button" data-action="ten">10일 자동 진행</button>
          <label><input type="checkbox" data-action="spend" ${autoSpend ? 'checked' : ''}/> 급여로 자동 제작·강화</label>
        </div>
      </header>
      <div class="op-body">
        <section class="op-today">${today}</section>
        <aside class="op-side"><h3>주문 풀 확장</h3>${unlocks}${regularPanel}<h3>기록</h3><ul class="op-log">${log.map((line) => `<li>${escape(line)}</li>`).join('')}</ul></aside>
      </div>
      <section class="op-grid">${grid}</section>
    </div>`;
  };

  // 자동 진행에서는 시뮬레이터와 같은 정책으로 게시판 주문을 고릅니다(도감 등록 전 우선, 보상 ÷ 작업량).
  const autoPickIfBoard = () => {
    if (variant === 'board' && state.today.length === 0) chooseFromBoard(state, autoChooseBoard(state));
  };

  const onClick = (event: Event) => {
    const target = event.target as HTMLElement;
    const pick = target.closest<HTMLInputElement>('input[data-pick]');
    if (pick) {
      const id = pick.dataset.pick!;
      picks = pick.checked ? [...picks, id].slice(-ORDERS_PER_DAY) : picks.filter((value) => value !== id);
      render();
      return;
    }
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === 'spend') { autoSpend = (target as HTMLInputElement).checked; if (autoSpend) spendCoins(state); render(); return; }
    if (action === 'confirm') { if (chooseFromBoard(state, picks)) { note(`게시판에서 ${picks.map((id) => poolOrder(id)!.name).join(', ')} 선택`); picks = []; } render(); return; }
    if (action === 'deliver') { deliverOne(); render(); return; }
    if (action === 'day') { autoPickIfBoard(); const day = state.day; for (let i = 0; i < ORDERS_PER_DAY && state.day === day; i += 1) deliverOne(); render(); return; }
    if (action === 'ten') { const end = state.day + 10; for (let guard = 0; guard < 40 && state.day < end; guard += 1) { autoPickIfBoard(); deliverOne(); } render(); }
  };

  root.addEventListener('click', onClick);
  render();
  return {
    destroy() { root.removeEventListener('click', onClick); root.innerHTML = ''; },
  };
}
