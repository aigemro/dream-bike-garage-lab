export type CoreLoopPrototypeMode = 'order-cycle' | 'free-cleanup';

type Order = { name: string; parts: string[]; baseReward: number };

const ORDERS: Order[] = [
  { name: '통학용 어반 로드', parts: ['프레임 Lv.2', '휠셋 Lv.1', '구동계 Lv.1'], baseReward: 1000 },
  { name: '트레일 MTB', parts: ['프레임 Lv.2', '휠셋 Lv.2', '구동계 Lv.1', '핸들바 Lv.1'], baseReward: 1400 },
  { name: '주말 그래블', parts: ['프레임 Lv.3', '휠셋 Lv.2', '구동계 Lv.2', '핸들바 Lv.1'], baseReward: 1900 },
];

function startOrderCycle(root: HTMLElement) {
  let completed = 0;
  let coins = 0;

  root.innerHTML = `<div class="core-loop-lab">
    <header class="core-loop-head"><div><span>ISSUE #144 · PROTOTYPE A</span><strong>3종 학습 주문 → 변형 반복 주문</strong></div><div class="core-loop-wallet">COIN <b data-coins>0</b></div></header>
    <section class="order-cycle-layout">
      <div class="current-order"></div>
      <aside class="order-queue"><span>NEXT ORDER</span><div data-queue></div></aside>
    </section>
    <section class="cycle-progress"><div><span>완료 주문</span><strong data-completed>0건</strong></div><div><span>현재 회차</span><strong data-cycle>학습 1회차</strong></div><div><span>반복 목표</span><strong data-goal>3종 완주</strong></div></section>
    <button class="core-primary" data-complete>현재 주문 완료 시뮬레이션</button>
    <p class="core-message" aria-live="polite">첫 주문은 부품 3종으로 규칙을 익힙니다.</p>
  </div>`;

  const render = () => {
    const orderIndex = completed % ORDERS.length;
    const cycle = Math.floor(completed / ORDERS.length);
    const order = ORDERS[orderIndex];
    const levelBonus = cycle;
    root.querySelector<HTMLElement>('.current-order')!.innerHTML = `<span>CURRENT ORDER · ${orderIndex + 1}/3</span><h2>${order.name}</h2><p>${order.parts.map((part) => levelBonus ? part.replace(/Lv\.(\d+)/, (_, value) => `Lv.${Number(value) + levelBonus}`) : part).join(' · ')}</p><div><b>예상 급여 ${(order.baseReward + cycle * 300).toLocaleString()}</b><em>${cycle ? `반복 ${cycle + 1}회차 변형` : '초기 학습 주문'}</em></div>`;
    root.querySelector<HTMLElement>('[data-queue]')!.innerHTML = [1, 2].map((offset) => {
      const next = ORDERS[(orderIndex + offset) % ORDERS.length];
      return `<div><b>${next.name}</b><small>${next.parts.length}개 부품 · ${(next.baseReward + Math.floor((completed + offset) / 3) * 300).toLocaleString()} 코인</small></div>`;
    }).join('');
    root.querySelector<HTMLElement>('[data-coins]')!.textContent = coins.toLocaleString();
    root.querySelector<HTMLElement>('[data-completed]')!.textContent = `${completed}건`;
    root.querySelector<HTMLElement>('[data-cycle]')!.textContent = cycle ? `반복 ${cycle + 1}회차` : '학습 1회차';
    root.querySelector<HTMLElement>('[data-goal]')!.textContent = completed < 3 ? `${3 - completed}건 남음` : '다음 변형 주문';
  };

  root.querySelector<HTMLButtonElement>('[data-complete]')!.onclick = () => {
    const order = ORDERS[completed % ORDERS.length];
    const cycle = Math.floor(completed / ORDERS.length);
    coins += order.baseReward + cycle * 300;
    completed += 1;
    root.querySelector<HTMLElement>('.core-message')!.textContent = completed === 3
      ? '초기 3종을 완주했습니다. 요구 레벨과 보상이 오른 반복 주문이 시작됩니다.'
      : `${order.name} 납품 완료 · 다음 주문 목표를 확인하세요.`;
    render();
  };
  render();
}

function startFreeCleanup(root: HTMLElement) {
  let phase: 'blocked' | 'space' | 'pair' | 'merged' = 'blocked';
  let actions = 0;
  let recoveryUsed = 0;

  root.innerHTML = `<div class="core-loop-lab">
    <header class="core-loop-head"><div><span>ISSUE #145 · PROTOTYPE A</span><strong>막힘 감지 → 1회 무료 정리 → 유효 머지 복귀</strong></div><div class="blocked-badge" data-state>BOARD BLOCKED</div></header>
    <section class="recovery-layout"><div class="recovery-board" aria-label="6 곱하기 7 막힘 보드"></div><aside class="recovery-panel">
      <div><span>자동 진단</span><strong data-diagnosis>빈 칸 0 · 유효 머지 0</strong><p>현재 주문에 필요하지 않은 낮은 레벨 부품을 한 개 정리할 수 있습니다.</p></div>
      <div class="recovery-metrics"><span>행동 <b data-actions>0</b></span><span>무료 정리 <b data-used>0/1</b></span></div>
      <button class="core-primary" data-recover>불필요 부품 1개 무료 정리</button>
      <button data-supply disabled>주문 프레임 Lv.1 받기</button>
      <button data-merge disabled>프레임 Lv.1 두 개 머지</button>
    </aside></section>
    <p class="core-message" aria-live="polite">진행 불가능 상태를 감지했습니다. 무료 정리로 플레이를 계속할 수 있습니다.</p>
  </div>`;

  const render = () => {
    const board = root.querySelector<HTMLElement>('.recovery-board')!;
    board.innerHTML = Array.from({ length: 42 }, (_, index) => {
      if (phase !== 'blocked' && index === 41) return phase === 'space' ? '<div class="recovery-cell empty">EMPTY</div>' : '<div class="recovery-cell target">F1</div>';
      if (phase === 'merged' && index === 0) return '<div class="recovery-cell merged">F2</div>';
      if (phase === 'merged' && index === 41) return '<div class="recovery-cell empty">EMPTY</div>';
      return `<div class="recovery-cell">${index === 0 ? 'F1' : `P${String(index + 1).padStart(2, '0')}`}</div>`;
    }).join('');
    const state = phase === 'blocked' ? ['BOARD BLOCKED', '빈 칸 0 · 유효 머지 0'] : phase === 'space' ? ['SPACE READY', '빈 칸 1 · 보급 가능'] : phase === 'pair' ? ['MERGE READY', '빈 칸 0 · 유효 머지 1'] : ['PLAY RESUMED', '빈 칸 1 · 프레임 Lv.2 완성'];
    root.querySelector<HTMLElement>('[data-state]')!.textContent = state[0];
    root.querySelector<HTMLElement>('[data-diagnosis]')!.textContent = state[1];
    root.querySelector<HTMLElement>('[data-actions]')!.textContent = String(actions);
    root.querySelector<HTMLElement>('[data-used]')!.textContent = `${recoveryUsed}/1`;
    root.querySelector<HTMLButtonElement>('[data-recover]')!.disabled = phase !== 'blocked';
    root.querySelector<HTMLButtonElement>('[data-supply]')!.disabled = phase !== 'space';
    root.querySelector<HTMLButtonElement>('[data-merge]')!.disabled = phase !== 'pair';
  };
  root.querySelector<HTMLButtonElement>('[data-recover]')!.onclick = () => { phase = 'space'; actions += 1; recoveryUsed = 1; root.querySelector<HTMLElement>('.core-message')!.textContent = '낮은 레벨의 불필요 부품을 정리해 빈 칸 1개를 확보했습니다.'; render(); };
  root.querySelector<HTMLButtonElement>('[data-supply]')!.onclick = () => { phase = 'pair'; actions += 1; root.querySelector<HTMLElement>('.core-message')!.textContent = '현재 주문에 필요한 프레임 Lv.1이 도착했습니다. 유효 머지가 생겼습니다.'; render(); };
  root.querySelector<HTMLButtonElement>('[data-merge]')!.onclick = () => { phase = 'merged'; actions += 1; root.querySelector<HTMLElement>('.core-message')!.textContent = '프레임 Lv.2 완성 · 막힘에서 정상 플레이 상태로 복귀했습니다.'; render(); };
  render();
}

export function startCoreLoopPrototype(parent: string, mode: CoreLoopPrototypeMode) {
  const root = document.getElementById(parent);
  if (!root) throw new Error(`Missing #${parent}`);
  mode === 'order-cycle' ? startOrderCycle(root) : startFreeCleanup(root);
  return { destroy: () => { root.innerHTML = ''; } };
}
