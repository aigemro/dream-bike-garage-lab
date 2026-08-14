export type BoardSizeMode = 'board-size';

type Condition = 'compact' | 'wide' | 'unlock';
type Part = { id: number; type: '프레임' | '휠' | '핸들' | '구동계'; level: number; cell: number };

const COLORS: Record<Part['type'], string> = {
  프레임: '#55d6be', 휠: '#ffcb6b', 핸들: '#82aaff', 구동계: '#c792ea',
};
const SEED: Omit<Part, 'id'>[] = [
  { type: '프레임', level: 1, cell: 0 }, { type: '프레임', level: 1, cell: 1 },
  { type: '휠', level: 1, cell: 7 }, { type: '휠', level: 1, cell: 8 },
  { type: '핸들', level: 1, cell: 14 }, { type: '핸들', level: 1, cell: 15 },
  { type: '구동계', level: 1, cell: 21 }, { type: '구동계', level: 1, cell: 22 },
];

export function startBoardSizePrototype(parent: string, _mode: BoardSizeMode) {
  const root = document.getElementById(parent);
  if (!root) throw new Error(`Missing #${parent}`);
  const container = root;
  let condition: Condition = 'compact';
  let selected: number | null = null;
  let actions = 0;
  let merges = 0;
  let unlocked = 42;
  let parts: Part[] = [];

  root.innerHTML = `<div class="board-size-lab">
    <header class="board-size-toolbar">
      <div><span>ISSUE #74 · CONTROLLED COMPARISON</span><strong>보드 조건만 바꿔 같은 주문을 비교하세요</strong></div>
      <div class="condition-tabs" role="tablist" aria-label="보드 조건">
        <button data-condition="compact">① 6×7 고정</button><button data-condition="wide">② 7×9 고정</button><button data-condition="unlock">③ 7×9 잠금형</button>
      </div>
    </header>
    <section class="board-size-layout">
      <div class="board-stage"><div class="board-caption"></div><div class="size-board"></div></div>
      <aside class="board-size-panel">
        <div class="order-card"><span>동일 주문</span><strong>로드바이크 시제품</strong><p>프레임 · 휠 · 핸들 · 구동계 Lv.2</p></div>
        <div class="metric-grid"><div><span>사용 가능</span><strong data-metric="cells">42 / 42</strong></div><div><span>행동</span><strong data-metric="actions">0</strong></div><div><span>머지</span><strong data-metric="merges">0 / 4</strong></div></div>
        <div class="unlock-progress"><span>잠금 해제 성장</span><div><i></i></div><small>잠금형은 머지 1회마다 바깥 칸 5개를 해제합니다.</small></div>
        <div class="observation"><span>관찰 포인트</span><ul><li>초반 압박감과 빈 공간 인지</li><li>다음 머지 위치 판단 난이도</li><li>잠금 해제 순간의 성장감</li></ul></div>
        <p class="board-message" aria-live="polite"></p>
      </aside>
    </section>
  </div>`;

  const board = root.querySelector<HTMLElement>('.size-board')!;
  const message = root.querySelector<HTMLElement>('.board-message')!;
  const activeCells = () => condition === 'compact' ? 42 : condition === 'wide' ? 63 : unlocked;
  const dimensions = () => condition === 'compact' ? { columns: 6, rows: 7 } : { columns: 7, rows: 9 };

  function reset(text = '같은 초기 부품 8개로 시작합니다. 같은 종류·레벨을 차례로 눌러 머지하세요.') {
    selected = null; actions = 0; merges = 0; unlocked = 42;
    parts = SEED.map((part, id) => ({ ...part, id, cell: condition === 'compact' ? part.cell - Math.floor(part.cell / 7) : part.cell }));
    message.textContent = text;
    render();
  }

  function handlePart(id: number) {
    actions += 1;
    const target = parts.find((part) => part.id === id)!;
    if (selected === null) { selected = id; message.textContent = `${target.type} Lv.${target.level} 선택 · 같은 부품을 누르세요.`; render(); return; }
    const source = parts.find((part) => part.id === selected);
    if (source && source.id !== target.id && source.type === target.type && source.level === target.level) {
      target.level += 1; parts = parts.filter((part) => part.id !== source.id); merges += 1; selected = null;
      if (condition === 'unlock') unlocked = Math.min(63, 42 + merges * 5);
      message.textContent = `${target.type} Lv.${target.level} 완성${condition === 'unlock' ? ` · 사용 가능 칸 ${unlocked}개` : ''}`;
    } else { selected = id; message.textContent = '종류와 레벨이 같아야 머지됩니다. 선택을 변경했습니다.'; }
    render();
  }

  function render() {
    const { columns, rows } = dimensions();
    const available = activeCells();
    board.style.setProperty('--board-columns', String(columns));
    board.innerHTML = Array.from({ length: columns * rows }, (_, cell) => {
      const locked = cell >= available;
      const part = parts.find((item) => item.cell === cell);
      return `<button class="board-cell${locked ? ' locked' : ''}${part && part.id === selected ? ' selected' : ''}" ${locked || !part ? 'disabled' : ''} data-part="${part?.id ?? ''}" aria-label="${locked ? '잠금 칸' : part ? `${part.type} 레벨 ${part.level}` : '빈 칸'}">${locked ? '<b>🔒</b>' : part ? `<i style="--part:${COLORS[part.type]}">${part.type.slice(0, 1)}</i><small>Lv.${part.level}</small>` : ''}</button>`;
    }).join('');
    container.querySelectorAll<HTMLButtonElement>('[data-part]:not([disabled])').forEach((button) => button.onclick = () => handlePart(Number(button.dataset.part)));
    container.querySelectorAll<HTMLButtonElement>('[data-condition]').forEach((button) => button.classList.toggle('active', button.dataset.condition === condition));
    container.querySelector<HTMLElement>('.board-caption')!.textContent = condition === 'compact' ? '6열 × 7행 · 42칸' : condition === 'wide' ? '7열 × 9행 · 63칸' : `7열 × 9행 · ${63 - unlocked}칸 잠금`;
    container.querySelector<HTMLElement>('[data-metric="cells"]')!.textContent = `${available} / ${columns * rows}`;
    container.querySelector<HTMLElement>('[data-metric="actions"]')!.textContent = String(actions);
    container.querySelector<HTMLElement>('[data-metric="merges"]')!.textContent = `${merges} / 4`;
    container.querySelector<HTMLElement>('.unlock-progress i')!.style.width = `${condition === 'unlock' ? ((unlocked - 42) / 21) * 100 : 0}%`;
  }

  root.querySelectorAll<HTMLButtonElement>('[data-condition]').forEach((button) => button.onclick = () => {
    condition = button.dataset.condition as Condition;
    reset(`${button.textContent} 조건으로 전환했습니다. 주문과 초기 부품은 동일합니다.`);
  });
  reset();
  return { destroy: () => { root.innerHTML = ''; } };
}
