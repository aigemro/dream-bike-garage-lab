export type StoragePrototypeMode = 'local' | 'indexed-db';

type Part = { id: string; type: 'frame' | 'wheel' | 'gear'; level: number };
type GameSaveData = { schemaVersion: number; revision: number; savedAt: string; coins: number; order: number; parts: Part[] };
type SaveRepository = { save(slot: string, data: GameSaveData): Promise<void>; load(slot: string): Promise<GameSaveData | null>; remove(slot: string): Promise<void> };

const LOCAL_KEY = 'dream-bike-garage:lab:save';
const DB_NAME = 'dream-bike-garage-lab';
const STORE_NAME = 'game-saves';
const initialState = (): GameSaveData => ({ schemaVersion: 1, revision: 0, savedAt: '', coins: 1200, order: 1, parts: [
  { id: crypto.randomUUID(), type: 'frame', level: 1 }, { id: crypto.randomUUID(), type: 'wheel', level: 1 },
] });

function isGameSaveData(value: unknown): value is GameSaveData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<GameSaveData>;
  return data.schemaVersion === 1
    && Number.isInteger(data.revision) && (data.revision ?? -1) >= 0
    && typeof data.savedAt === 'string'
    && Number.isFinite(data.coins) && (data.coins ?? -1) >= 0
    && Number.isInteger(data.order) && (data.order ?? 0) >= 1
    && Array.isArray(data.parts)
    && data.parts.length <= 12
    && data.parts.every((part) => part
      && typeof part.id === 'string'
      && ['frame', 'wheel', 'gear'].includes(part.type)
      && Number.isInteger(part.level)
      && part.level >= 1);
}

function assertGameSaveData(value: unknown): GameSaveData {
  if (!isGameSaveData(value)) throw new Error('지원하지 않거나 손상된 저장 데이터입니다.');
  return structuredClone(value);
}

class LocalStorageRepository implements SaveRepository {
  async save(_slot: string, data: GameSaveData) { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); }
  async load(_slot: string) { const value = localStorage.getItem(LOCAL_KEY); return value ? assertGameSaveData(JSON.parse(value)) : null; }
  async remove(_slot: string) { localStorage.removeItem(LOCAL_KEY); }
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

class IndexedDbRepository implements SaveRepository {
  private async request<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
    const database = await openDatabase();
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => database.close();
    });
  }
  async save(slot: string, data: GameSaveData) { await this.request('readwrite', (store) => store.put(data, slot)); }
  async load(slot: string) {
    const value = await this.request('readonly', (store) => store.get(slot));
    return value === undefined ? null : assertGameSaveData(value);
  }
  async remove(slot: string) { await this.request('readwrite', (store) => store.delete(slot)); }
}

const partNames = { frame: '프레임', wheel: '휠', gear: '구동계' };

export function startStoragePrototype(rootId: string, mode: StoragePrototypeMode) {
  const root = document.getElementById(rootId);
  if (!root) throw new Error(`Storage prototype root not found: ${rootId}`);
  const repository: SaveRepository = mode === 'local' ? new LocalStorageRepository() : new IndexedDbRepository();
  let state = initialState();
  let slot = mode === 'local' ? 'default' : 'slot-1';
  let status = '저장 데이터를 확인하고 있습니다.';
  let busy = true;

  const loadState = async (automatic = false) => {
    busy = true;
    render();
    try {
      const loaded = await repository.load(slot);
      if (loaded) {
        state = loaded;
        status = `${automatic ? '자동으로 ' : ''}revision ${loaded.revision}을 복원했습니다.`;
      } else {
        state = initialState();
        status = automatic ? '저장 데이터가 없어 새 진행 상태로 시작합니다.' : '선택한 위치에 저장 데이터가 없습니다.';
      }
    } catch (error) {
      state = initialState();
      status = `불러오기 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
    } finally {
      busy = false;
      render();
    }
  };

  const render = () => {
    root.innerHTML = `<div class="storage-lab">
      <section class="storage-summary"><div><span>저장 방식</span><strong>${mode === 'local' ? 'localStorage · 단일 슬롯' : 'IndexedDB · 다중 슬롯'}</strong></div><div><span>스키마 / 리비전</span><strong>v${state.schemaVersion} / r${state.revision}</strong></div><div><span>마지막 저장</span><strong>${state.savedAt ? new Date(state.savedAt).toLocaleTimeString('ko-KR') : '없음'}</strong></div></section>
      ${mode === 'indexed-db' ? `<label class="slot-picker">저장 슬롯<select id="storage-slot"><option value="slot-1">슬롯 1</option><option value="slot-2">슬롯 2</option><option value="slot-3">슬롯 3</option></select></label>` : ''}
      <section class="save-state-card"><div class="save-metric"><span>보유 코인</span><strong>${state.coins.toLocaleString()}</strong></div><div class="save-metric"><span>진행 주문</span><strong>#${state.order}</strong></div><div class="save-metric"><span>보드 부품</span><strong>${state.parts.length} / 12</strong></div><div class="parts-preview">${state.parts.map((part) => `<span>${partNames[part.type]} Lv.${part.level}</span>`).join('') || '<em>보드가 비어 있습니다.</em>'}</div></section>
      <section class="storage-actions"><div><span>상태 변경</span><button data-action="coin" ${busy ? 'disabled' : ''}>+100 코인</button><button data-action="part" ${busy ? 'disabled' : ''}>부품 추가</button><button data-action="order" ${busy ? 'disabled' : ''}>주문 완료</button></div><div><span>저장 검증</span><button class="accent" data-action="save" ${busy ? 'disabled' : ''}>현재 상태 저장</button><button data-action="load" ${busy ? 'disabled' : ''}>저장 상태 불러오기</button><button data-action="remove" ${busy ? 'disabled' : ''}>저장 삭제</button></div></section>
      <p class="storage-status" role="status" aria-live="polite">${status}</p><p class="storage-guide">저장하면 다음 진입 시 자동으로 복원됩니다. 상태를 변경한 뒤 수동 저장·불러오기 또는 새로고침으로 같은 값이 유지되는지 확인하세요.</p>
    </div>`;
    const picker = root.querySelector<HTMLSelectElement>('#storage-slot');
    if (picker) {
      picker.value = slot;
      picker.disabled = busy;
      picker.addEventListener('change', () => {
        slot = picker.value;
        void loadState(true);
      });
    }
    root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => button.addEventListener('click', async () => {
      const action = button.dataset.action;
      try {
        if (action === 'coin') state.coins += 100;
        if (action === 'part' && state.parts.length < 12) { const types: Part['type'][] = ['frame', 'wheel', 'gear']; state.parts.push({ id: crypto.randomUUID(), type: types[state.parts.length % types.length], level: 1 }); }
        if (action === 'order') { state.order += 1; state.coins += 500; state.parts = []; }
        if (action === 'save') { state = { ...state, revision: state.revision + 1, savedAt: new Date().toISOString() }; await repository.save(slot, state); status = `${mode === 'local' ? '단일 저장소' : slot}에 revision ${state.revision}을 저장했습니다.`; }
        if (action === 'load') { await loadState(); return; }
        if (action === 'remove') { await repository.remove(slot); state = initialState(); status = '선택한 저장 데이터를 삭제하고 새 진행 상태로 초기화했습니다.'; }
      } catch (error) { status = `저장 처리 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`; }
      render();
    }));
  };
  render();
  void loadState(true);
}
