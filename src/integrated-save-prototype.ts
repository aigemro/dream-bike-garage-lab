// 통합 상태 자동 저장·복구 프로토타입 (C안)
// #3 저장 방식 비교의 저장 계약(schemaVersion·revision·savedAt·검증)을 채택하고,
// #5 앱 라이프사이클(백그라운드 전환·페이지 이탈) 자동 저장을 MVP 통합 상태에 결합합니다.
// 대상 상태는 MVP_READINESS_PLAN의 로컬 저장 범위: 보드, 현재 주문, 코인, 성장, 튜토리얼.

type PartType = 'frame' | 'wheel' | 'drivetrain' | 'handlebar';
type BoardPart = { id: string; type: PartType; level: number };
type OrderGoal = { type: PartType; level: number; delivered: boolean };
type SaveReason = 'manual' | 'visibility' | 'pagehide' | 'restore-check';

type UnifiedSaveData = {
  schemaVersion: 1;
  revision: number;
  savedAt: string;
  saveReason: SaveReason;
  coins: number;
  growthStage: number;
  tutorialDone: boolean;
  orderNumber: number;
  goals: OrderGoal[];
  parts: BoardPart[];
};

const SAVE_KEY = 'dream-bike-garage:lab:integrated-save';
const MAX_PARTS = 12;
const GROWTH_MAX_STAGE = 3;
const GROWTH_COST = 1500;
const ORDER_REWARD = 800;
const PART_TYPES: PartType[] = ['frame', 'wheel', 'drivetrain', 'handlebar'];
const PART_NAMES: Record<PartType, string> = { frame: '프레임', wheel: '휠셋', drivetrain: '구동계', handlebar: '핸들바' };

const initialGoals = (orderNumber: number): OrderGoal[] => [
  { type: 'frame', level: Math.min(2 + Math.floor((orderNumber - 1) / 3), 4), delivered: false },
  { type: 'wheel', level: 2, delivered: false },
  { type: 'drivetrain', level: 1, delivered: false },
  { type: 'handlebar', level: 1, delivered: false },
];

const initialState = (): UnifiedSaveData => ({
  schemaVersion: 1,
  revision: 0,
  savedAt: '',
  saveReason: 'manual',
  coins: 500,
  growthStage: 1,
  tutorialDone: false,
  orderNumber: 1,
  goals: initialGoals(1),
  parts: [
    { id: crypto.randomUUID(), type: 'frame', level: 1 },
    { id: crypto.randomUUID(), type: 'frame', level: 1 },
    { id: crypto.randomUUID(), type: 'wheel', level: 1 },
  ],
});

function isUnifiedSaveData(value: unknown): value is UnifiedSaveData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UnifiedSaveData>;
  return data.schemaVersion === 1
    && Number.isInteger(data.revision) && (data.revision ?? -1) >= 0
    && typeof data.savedAt === 'string'
    && typeof data.saveReason === 'string'
    && Number.isFinite(data.coins) && (data.coins ?? -1) >= 0
    && Number.isInteger(data.growthStage) && (data.growthStage ?? 0) >= 1 && (data.growthStage ?? 99) <= GROWTH_MAX_STAGE
    && typeof data.tutorialDone === 'boolean'
    && Number.isInteger(data.orderNumber) && (data.orderNumber ?? 0) >= 1
    && Array.isArray(data.goals)
    && data.goals.every((goal) => goal && PART_TYPES.includes(goal.type) && Number.isInteger(goal.level) && goal.level >= 1 && typeof goal.delivered === 'boolean')
    && Array.isArray(data.parts) && data.parts.length <= MAX_PARTS
    && data.parts.every((part) => part && typeof part.id === 'string' && PART_TYPES.includes(part.type) && Number.isInteger(part.level) && part.level >= 1);
}

export function startIntegratedSavePrototype(rootId: string) {
  const root = document.getElementById(rootId);
  if (!root) throw new Error(`Integrated save prototype root not found: ${rootId}`);

  let state = initialState();
  let status = '저장 데이터를 확인하고 있습니다.';
  const events: string[] = [];

  const now = () => new Date().toLocaleTimeString('ko-KR', { hour12: false });
  const logEvent = (message: string) => { events.unshift(`${now()} · ${message}`); if (events.length > 6) events.pop(); };

  const persist = (reason: SaveReason) => {
    state = { ...state, revision: state.revision + 1, savedAt: new Date().toISOString(), saveReason: reason };
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return state.revision;
  };

  const restore = () => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      state = initialState();
      status = '저장 데이터가 없어 첫 실행 상태로 시작합니다.';
      logEvent('첫 실행 · 새 진행 상태 생성');
      return;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isUnifiedSaveData(parsed)) throw new Error('지원하지 않거나 손상된 저장 데이터입니다.');
      state = parsed;
      const reasonNames: Record<SaveReason, string> = { manual: '수동 저장', visibility: '백그라운드 전환 자동 저장', pagehide: '페이지 이탈 자동 저장', 'restore-check': '복구 점검 저장' };
      status = `revision ${state.revision} 복원 완료 · 마지막 저장: ${reasonNames[state.saveReason]}`;
      logEvent(`복원 · r${state.revision} (${reasonNames[state.saveReason]})`);
    } catch (error) {
      // 손상 데이터는 진행에 덮어쓰지 않고 새 상태로 시작하되, 다음 저장 전까지 원본을 유지합니다.
      state = initialState();
      status = `복원 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'} · 새 진행 상태로 시작합니다.`;
      logEvent('복원 실패 · 손상 데이터 감지');
    }
  };

  // #5 라이프사이클: 탭 백그라운드 전환·페이지 이탈 시 자동 저장
  const onVisibilityChange = () => {
    if (!root.isConnected) { detach(); return; }
    if (document.visibilityState === 'hidden') {
      const revision = persist('visibility');
      logEvent(`자동 저장 · r${revision} (백그라운드 전환)`);
      render();
    } else {
      logEvent('복귀 · 탭 활성화');
      render();
    }
  };
  const onPageHide = () => {
    if (!root.isConnected) { detach(); return; }
    persist('pagehide');
  };
  const detach = () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onPageHide);
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);

  const mergeablePair = () => {
    for (const part of state.parts) {
      const pair = state.parts.find((other) => other !== part && other.type === part.type && other.level === part.level);
      if (pair) return [part, pair] as const;
    }
    return null;
  };

  const installablePart = () => state.parts.find((part) => state.goals.some((goal) => !goal.delivered && goal.type === part.type && goal.level === part.level));

  const render = () => {
    const deliveredCount = state.goals.filter((goal) => goal.delivered).length;
    const pair = mergeablePair();
    const installable = installablePart();
    const orderComplete = deliveredCount === state.goals.length;
    root.innerHTML = `<div class="storage-lab integrated-save-lab">
      <section class="storage-summary"><div><span>저장 계약</span><strong>통합 상태 v${state.schemaVersion} · localStorage</strong></div><div><span>리비전 / 저장 사유</span><strong>r${state.revision} · ${{ manual: '수동', visibility: '백그라운드', pagehide: '페이지 이탈', 'restore-check': '복구 점검' }[state.saveReason]}</strong></div><div><span>마지막 저장</span><strong>${state.savedAt ? new Date(state.savedAt).toLocaleTimeString('ko-KR', { hour12: false }) : '없음'}</strong></div></section>
      <section class="save-state-card"><div class="save-metric"><span>코인</span><strong>${state.coins.toLocaleString()}</strong></div><div class="save-metric"><span>드림 바이크 성장</span><strong>${state.growthStage} / ${GROWTH_MAX_STAGE}단계</strong></div><div class="save-metric"><span>주문 #${state.orderNumber} 장착</span><strong>${deliveredCount} / ${state.goals.length}</strong></div>
        <div class="parts-preview">${state.goals.map((goal) => `<span class="${goal.delivered ? 'goal-done' : ''}">${goal.delivered ? '✓ ' : ''}${PART_NAMES[goal.type]} Lv.${goal.level}</span>`).join('')}</div>
        <div class="parts-preview">${state.parts.map((part) => `<span>${PART_NAMES[part.type]} Lv.${part.level}</span>`).join('') || '<em>보드가 비어 있습니다.</em>'}<em style="margin-left:auto">보드 ${state.parts.length}/${MAX_PARTS} · 튜토리얼 ${state.tutorialDone ? '완료' : '진행 전'}</em></div></section>
      <section class="storage-actions"><div><span>통합 상태 변경</span>
        <button data-action="supply" ${state.parts.length >= MAX_PARTS ? 'disabled' : ''}>택배 개봉 · 부품 추가</button>
        <button data-action="merge" ${pair ? '' : 'disabled'}>2-to-1 머지</button>
        <button data-action="install" ${installable ? '' : 'disabled'}>부품 장착</button>
        <button data-action="complete" ${orderComplete ? '' : 'disabled'}>주문 납품 · +${ORDER_REWARD}</button>
        <button data-action="grow" ${state.coins >= GROWTH_COST && state.growthStage < GROWTH_MAX_STAGE ? '' : 'disabled'}>성장 · −${GROWTH_COST.toLocaleString()}</button>
        <button data-action="tutorial" ${state.tutorialDone ? 'disabled' : ''}>튜토리얼 완료</button></div>
      <div><span>저장 검증</span>
        <button class="accent" data-action="save">수동 저장</button>
        <button data-action="reload">복원 다시 실행</button>
        <button data-action="remove">저장 삭제</button></div></section>
      <p class="storage-status" role="status" aria-live="polite">${status}</p>
      <section class="save-event-log"><span>라이프사이클 이벤트</span>${events.map((event) => `<p>${event}</p>`).join('') || '<p>아직 기록이 없습니다.</p>'}</section>
      <p class="storage-guide">상태를 변경한 뒤 새로고침하면 마지막 저장 시점(자동 저장 포함)으로 복원됩니다. 다른 탭으로 전환하거나 창을 최소화하면 백그라운드 자동 저장이, 페이지를 떠나면 이탈 자동 저장이 실행됩니다.</p>
    </div>`;

    root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (action === 'supply' && state.parts.length < MAX_PARTS) {
        const missing = state.goals.find((goal) => !goal.delivered);
        const type = missing ? missing.type : PART_TYPES[state.parts.length % PART_TYPES.length];
        state.parts.push({ id: crypto.randomUUID(), type, level: 1 });
        status = `${PART_NAMES[type]} Lv.1 부품이 보드에 도착했습니다.`;
      }
      if (action === 'merge') {
        const found = mergeablePair();
        if (found) {
          const [keep, remove] = found;
          state.parts = state.parts.filter((part) => part !== remove);
          keep.level += 1;
          status = `${PART_NAMES[keep.type]} Lv.${keep.level} 머지 완성.`;
        }
      }
      if (action === 'install') {
        const part = installablePart();
        if (part) {
          const goal = state.goals.find((item) => !item.delivered && item.type === part.type && item.level === part.level)!;
          goal.delivered = true;
          state.parts = state.parts.filter((item) => item !== part);
          status = `${PART_NAMES[goal.type]} Lv.${goal.level} 장착 완료.`;
        }
      }
      if (action === 'complete' && state.goals.every((goal) => goal.delivered)) {
        state.coins += ORDER_REWARD;
        state.orderNumber += 1;
        state.goals = initialGoals(state.orderNumber);
        status = `주문 납품 완료 · +${ORDER_REWARD} 코인 · 주문 #${state.orderNumber} 시작.`;
      }
      if (action === 'grow' && state.coins >= GROWTH_COST && state.growthStage < GROWTH_MAX_STAGE) {
        state.coins -= GROWTH_COST;
        state.growthStage += 1;
        status = `드림 바이크가 ${state.growthStage}단계로 성장했습니다.`;
      }
      if (action === 'tutorial') { state.tutorialDone = true; status = '튜토리얼 완료 상태를 기록했습니다.'; }
      if (action === 'save') { const revision = persist('manual'); status = `revision ${revision}을 수동 저장했습니다.`; logEvent(`수동 저장 · r${revision}`); }
      if (action === 'reload') { restore(); }
      if (action === 'remove') { localStorage.removeItem(SAVE_KEY); state = initialState(); status = '저장 데이터를 삭제하고 첫 실행 상태로 초기화했습니다.'; logEvent('저장 삭제 · 첫 실행 상태'); }
      render();
    }));
  };

  restore();
  render();
}
