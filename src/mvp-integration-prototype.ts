export type MvpIntegrationMode = 'selected-flow';

type PartId = 'frame' | 'wheelset' | 'drivetrain' | 'handlebar';
type BoardItem =
  | { kind: 'parcel'; part: PartId }
  | { kind: 'part'; part: PartId; level: number };
type Order = { name: string; reward: number; targets: Partial<Record<PartId, number>> };
type SavedState = {
  board: Array<BoardItem | null>;
  orderIndex: number;
  completed: number;
  coins: number;
  bikeStage: number;
  installed: PartId[];
};

const STORAGE_KEY = 'dbg-lab-mvp-integration-v1';
const PARTS: Array<{ id: PartId; name: string; short: string }> = [
  { id: 'frame', name: '프레임', short: 'F' },
  { id: 'wheelset', name: '휠셋', short: 'W' },
  { id: 'drivetrain', name: '구동계', short: 'D' },
  { id: 'handlebar', name: '핸들바', short: 'H' },
];
const ORDERS: Order[] = [
  { name: '통학용 어반 로드', reward: 1000, targets: { frame: 2, wheelset: 1, drivetrain: 1 } },
  { name: '트레일 MTB', reward: 1400, targets: { frame: 2, wheelset: 2, drivetrain: 1, handlebar: 1 } },
  { name: '주말 그래블', reward: 1900, targets: { frame: 3, wheelset: 2, drivetrain: 2, handlebar: 1 } },
];

function emptyState(): SavedState {
  return {
    board: Array.from({ length: 30 }, () => null),
    orderIndex: 0,
    completed: 0,
    coins: 0,
    bikeStage: 0,
    installed: [],
  };
}

function loadState(): SavedState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as SavedState;
    if (!Array.isArray(parsed.board) || parsed.board.length !== 30) return emptyState();
    return parsed;
  } catch {
    return emptyState();
  }
}

function partInfo(id: PartId) {
  return PARTS.find((part) => part.id === id)!;
}

export function startMvpIntegrationPrototype(parent: string, _mode: MvpIntegrationMode) {
  const root = document.getElementById(parent);
  if (!root) throw new Error(`Missing #${parent}`);

  let state = loadState();
  let selected: number | null = null;
  let message = '현재 주문에 필요한 부품 카테고리를 선택해 택배를 주문하세요.';

  root.innerHTML = `<div class="mvp-integration-lab">
    <header class="integration-head">
      <div><span>ISSUE #114 · RELEASE INTEGRATION</span><strong>택배 → C안 머지 → 자동 장착 → 납품</strong></div>
      <div class="integration-wallet">COIN <b data-coins>0</b></div>
    </header>
    <section class="integration-layout">
      <aside class="integration-order">
        <span>CURRENT ORDER</span>
        <h2 data-order-name></h2>
        <div data-targets></div>
        <div class="integration-bike"><span>고객 자전거</span><strong data-assembly>조립 0/0</strong><div data-bike-parts></div></div>
        <button class="core-primary" data-deliver disabled>납품하고 급여 받기</button>
      </aside>
      <main class="integration-play">
        <div class="integration-supply"><div><span>부품 택배 주문</span><small>카테고리 선택형 · 대기시간 없음</small></div><div data-supply-buttons></div></div>
        <div class="integration-board" data-board aria-label="6 곱하기 5 머지 보드"></div>
      </main>
      <aside class="integration-progress">
        <span>RUN STATUS</span>
        <div><small>완료 주문</small><b data-completed>0건</b></div>
        <div><small>드림 바이크</small><b data-growth>Stage 0/3</b></div>
        <div><small>저장 상태</small><b>자동 저장</b></div>
        <button data-reset>통합 상태 초기화</button>
      </aside>
    </section>
    <p class="core-message" data-message aria-live="polite"></p>
  </div>`;

  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const currentOrder = () => ORDERS[state.orderIndex % ORDERS.length];
  const requiredParts = () => Object.keys(currentOrder().targets) as PartId[];

  const addParcel = (part: PartId) => {
    const empty = state.board.findIndex((item) => item === null);
    if (empty < 0) {
      message = '보드가 가득 찼습니다. 같은 부품을 머지해 공간을 확보하세요.';
      render();
      return;
    }
    state.board[empty] = { kind: 'parcel', part };
    selected = null;
    message = `${partInfo(part).name} 택배가 도착했습니다. 상자를 눌러 개봉하세요.`;
    save();
    render();
  };

  const openParcel = (index: number, item: Extract<BoardItem, { kind: 'parcel' }>) => {
    state.board[index] = { kind: 'part', part: item.part, level: 1 };
    message = `${partInfo(item.part).name} Lv.1 획득 · 같은 종류와 레벨 두 개를 선택하면 머지됩니다.`;
    save();
    checkAssembly(index);
  };

  const checkAssembly = (index: number) => {
    const item = state.board[index];
    if (!item || item.kind !== 'part') {
      render();
      return;
    }
    const target = currentOrder().targets[item.part];
    if (target && item.level >= target && !state.installed.includes(item.part)) {
      state.installed.push(item.part);
      state.board[index] = null;
      selected = null;
      message = `${partInfo(item.part).name} Lv.${item.level} 목표 달성 · 고객 자전거에 자동 장착했습니다.`;
      save();
    }
    render();
  };

  const selectPart = (index: number, item: Extract<BoardItem, { kind: 'part' }>) => {
    if (selected === null) {
      selected = index;
      message = `${partInfo(item.part).name} Lv.${item.level} 선택 · 같은 부품을 선택하세요.`;
      render();
      return;
    }
    if (selected === index) {
      selected = null;
      message = '선택을 취소했습니다.';
      render();
      return;
    }
    const first = state.board[selected];
    if (first?.kind === 'part' && first.part === item.part && first.level === item.level) {
      const mergedLevel = item.level + 1;
      state.board[selected] = null;
      state.board[index] = { kind: 'part', part: item.part, level: mergedLevel };
      selected = null;
      message = `${partInfo(item.part).name} Lv.${mergedLevel} 완성`;
      save();
      checkAssembly(index);
      return;
    }
    selected = index;
    message = '종류와 레벨이 달라 머지할 수 없습니다. 새 기준 부품을 선택했습니다.';
    render();
  };

  const deliver = () => {
    const order = currentOrder();
    if (!requiredParts().every((part) => state.installed.includes(part))) return;
    state.coins += order.reward;
    state.completed += 1;
    state.bikeStage = Math.min(3, state.bikeStage + 1);
    state.orderIndex = (state.orderIndex + 1) % ORDERS.length;
    state.installed = [];
    selected = null;
    message = `${order.name} 납품 완료 · ${order.reward.toLocaleString()}코인 획득 · 다음 주문이 시작됐습니다.`;
    save();
    render();
  };

  const render = () => {
    const order = currentOrder();
    const targets = requiredParts();
    root.querySelector<HTMLElement>('[data-order-name]')!.textContent = order.name;
    root.querySelector<HTMLElement>('[data-targets]')!.innerHTML = targets.map((part) => {
      const installed = state.installed.includes(part);
      return `<div class="integration-target ${installed ? 'done' : ''}"><b>${partInfo(part).name}</b><span>${installed ? '장착 완료' : `Lv.${order.targets[part]}`}</span></div>`;
    }).join('');
    root.querySelector<HTMLElement>('[data-assembly]')!.textContent = `조립 ${state.installed.length}/${targets.length}`;
    root.querySelector<HTMLElement>('[data-bike-parts]')!.innerHTML = targets.map((part) => `<i class="${state.installed.includes(part) ? 'installed' : ''}">${partInfo(part).short}</i>`).join('');
    root.querySelector<HTMLButtonElement>('[data-deliver]')!.disabled = !targets.every((part) => state.installed.includes(part));
    root.querySelector<HTMLElement>('[data-coins]')!.textContent = state.coins.toLocaleString();
    root.querySelector<HTMLElement>('[data-completed]')!.textContent = `${state.completed}건`;
    root.querySelector<HTMLElement>('[data-growth]')!.textContent = `Stage ${state.bikeStage}/3`;
    root.querySelector<HTMLElement>('[data-message]')!.textContent = message;
    root.querySelector<HTMLElement>('[data-supply-buttons]')!.innerHTML = targets
      .filter((part) => !state.installed.includes(part))
      .map((part) => `<button data-supply="${part}">${partInfo(part).name} 택배</button>`).join('');
    root.querySelector<HTMLElement>('[data-board]')!.innerHTML = state.board.map((item, index) => {
      if (!item) return `<button class="integration-cell empty" data-cell="${index}" disabled></button>`;
      if (item.kind === 'parcel') return `<button class="integration-cell parcel" data-cell="${index}"><b>BOX</b><small>${partInfo(item.part).name}</small></button>`;
      return `<button class="integration-cell part ${selected === index ? 'selected' : ''}" data-cell="${index}"><b>${partInfo(item.part).short}${item.level}</b><small>${partInfo(item.part).name}</small></button>`;
    }).join('');

    root.querySelectorAll<HTMLButtonElement>('[data-supply]').forEach((button) => {
      button.onclick = () => addParcel(button.dataset.supply as PartId);
    });
    root.querySelectorAll<HTMLButtonElement>('[data-cell]').forEach((button) => {
      const index = Number(button.dataset.cell);
      const item = state.board[index];
      button.onclick = () => item?.kind === 'parcel' ? openParcel(index, item) : item?.kind === 'part' ? selectPart(index, item) : undefined;
    });
  };

  root.querySelector<HTMLButtonElement>('[data-deliver]')!.onclick = deliver;
  root.querySelector<HTMLButtonElement>('[data-reset]')!.onclick = () => {
    localStorage.removeItem(STORAGE_KEY);
    state = emptyState();
    selected = null;
    message = '통합 상태를 초기화했습니다. 첫 주문부터 다시 시작합니다.';
    render();
  };
  render();

  return { destroy: () => { root.innerHTML = ''; } };
}
