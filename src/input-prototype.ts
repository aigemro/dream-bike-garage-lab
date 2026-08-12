import Phaser from 'phaser';

export type InputPrototypeMode = 'tap' | 'drag' | 'hybrid';

type Part = { kind: 'frame' | 'wheel' | 'gear'; level: number };
type PointerState = { source: number; startX: number; startY: number; dragging: boolean };

const COLS = 6;
const ROWS = 5;
const CELL = 82;
const BOARD_X = 70;
const BOARD_Y = 130;
const DRAG_THRESHOLD = 12;
const COLORS = {
  bg: 0x07111f, panel: 0x0b1828, line: 0x294158, active: 0x55d6be,
  valid: 0x173d45, invalid: 0x482537, text: '#eaf2f8', muted: '#8196aa', accent: '#55d6be',
};

const INITIAL: Array<Part | undefined> = [
  { kind: 'frame', level: 1 }, { kind: 'wheel', level: 1 }, undefined, { kind: 'gear', level: 1 }, undefined, undefined,
  undefined, { kind: 'frame', level: 1 }, undefined, { kind: 'wheel', level: 1 }, undefined, undefined,
  { kind: 'gear', level: 1 }, undefined, undefined, undefined, { kind: 'frame', level: 2 }, undefined,
  undefined, undefined, { kind: 'wheel', level: 2 }, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, undefined,
];

class InputScene extends Phaser.Scene {
  private mode: InputPrototypeMode;
  private board = INITIAL.map((part) => part ? { ...part } : undefined);
  private selected?: number;
  private pointerState?: PointerState;
  private ghost?: Phaser.GameObjects.Container;
  private successes = 0;
  private mistakes = 0;
  private lastAction = '같은 초기 배치에서 조작을 시작해 보세요.';

  constructor(mode: InputPrototypeMode) {
    super('input-prototype');
    this.mode = mode;
  }

  create() {
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.onPointerMove(pointer));
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.onPointerUp(pointer));
    this.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => this.cancelPointer(pointer));
    this.render();
  }

  private label() {
    if (this.mode === 'tap') return ['INPUT A · TAP', '탭 선택 · 탭 이동', '부품을 탭한 뒤 목적지 칸을 탭하세요.'];
    if (this.mode === 'drag') return ['INPUT B · DRAG', '직접 드래그 앤 드롭', '부품을 누른 채 목적지 칸으로 끌어 놓으세요.'];
    return ['INPUT C · HYBRID', '탭 · 드래그 하이브리드', `짧은 탭은 선택, ${DRAG_THRESHOLD}px 이상 이동은 드래그로 처리합니다.`];
  }

  private text(x: number, y: number, value: string, size = 16, color = COLORS.text, bold = false) {
    return this.add.text(x, y, value, { fontFamily: 'Arial, sans-serif', fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' });
  }

  private render() {
    this.children.removeAll();
    this.ghost = undefined;
    this.add.rectangle(480, 310, 960, 620, COLORS.bg);
    const [eyebrow, title, guide] = this.label();
    this.text(36, 24, eyebrow, 12, COLORS.accent, true);
    this.text(36, 48, title, 25, COLORS.text, true);
    this.text(36, 82, guide, 13, COLORS.muted);
    this.renderBoard();
    this.renderMetrics();
  }

  private renderBoard() {
    this.add.rectangle(BOARD_X + COLS * CELL / 2, BOARD_Y + ROWS * CELL / 2, COLS * CELL + 18, ROWS * CELL + 18, COLORS.panel)
      .setStrokeStyle(1, COLORS.line);
    this.board.forEach((part, index) => {
      const { x, y } = this.cellCenter(index);
      const selected = this.selected === index;
      const targetState = this.selected !== undefined && this.selected !== index ? this.targetState(this.selected, index) : 'none';
      const fill = selected ? 0x17384a : targetState === 'valid' ? COLORS.valid : targetState === 'invalid' ? 0x101b29 : 0x0e2136;
      const stroke = selected ? COLORS.active : targetState === 'valid' ? COLORS.active : COLORS.line;
      const cell = this.add.rectangle(x, y, CELL - 8, CELL - 8, fill).setStrokeStyle(selected || targetState === 'valid' ? 2 : 1, stroke);
      cell.setInteractive({ useHandCursor: Boolean(part) || this.selected !== undefined })
        .on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onCellDown(index, pointer));
      if (part) this.drawPart(x, y, part, 1);
    });
  }

  private renderMetrics() {
    const x = 620;
    this.add.rectangle(778, 335, 316, 430, COLORS.panel).setStrokeStyle(1, COLORS.line);
    this.text(x, 136, 'COMPARISON LOG', 12, COLORS.accent, true);
    this.text(x, 167, '동일한 평가 조건', 19, COLORS.text, true);
    this.text(x, 204, '이동 · 동일 종류/레벨 머지\n잘못된 입력 · 보드 밖 취소', 13, COLORS.muted).setLineSpacing(8);
    this.metric(x, 286, '성공 입력', `${this.successes}회`, COLORS.accent);
    this.metric(x, 354, '실수 / 취소', `${this.mistakes}회`, '#ff8fa3');
    this.text(x, 421, '최근 피드백', 12, COLORS.muted, true);
    this.text(x, 447, this.lastAction, 14, COLORS.text, true).setWordWrapWidth(276).setLineSpacing(6);
    this.text(x, 535, '목표: 같은 부품을 합쳐 Lv.2 만들기', 12, '#ffdf6b');
  }

  private metric(x: number, y: number, label: string, value: string, color: string) {
    this.add.rectangle(x + 138, y, 276, 54, 0x102235).setStrokeStyle(1, COLORS.line);
    this.text(x + 16, y - 9, label, 12, COLORS.muted).setOrigin(0, .5);
    this.text(x + 258, y - 9, value, 18, color, true).setOrigin(1, .5);
  }

  private onCellDown(index: number, pointer: Phaser.Input.Pointer) {
    if (this.mode === 'tap') return this.handleTap(index);
    if (!this.board[index]) {
      if (this.mode === 'hybrid' && this.selected !== undefined) this.handleTap(index);
      return;
    }
    this.pointerState = { source: index, startX: pointer.x, startY: pointer.y, dragging: false };
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    const state = this.pointerState;
    if (!state || !pointer.isDown) return;
    const distance = Phaser.Math.Distance.Between(state.startX, state.startY, pointer.x, pointer.y);
    if (!state.dragging && distance >= DRAG_THRESHOLD) {
      state.dragging = true;
      this.selected = state.source;
      this.render();
    }
    if (!state.dragging) return;
    this.ghost?.destroy();
    const part = this.board[state.source];
    if (part) this.ghost = this.drawPart(pointer.x, pointer.y - 18, part, .62);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer) {
    const state = this.pointerState;
    if (!state) return;
    this.pointerState = undefined;
    this.ghost?.destroy();
    this.ghost = undefined;
    if (state.dragging) {
      const target = this.indexAt(pointer.x, pointer.y);
      if (target === undefined) return this.reject('보드 밖 드롭 · 원위치 복구');
      this.execute(state.source, target, '드래그');
      return;
    }
    if (this.mode === 'hybrid') this.handleTap(state.source);
    else this.reject('드래그 임계값에 도달하지 않았습니다.');
  }

  private cancelPointer(_pointer: Phaser.Input.Pointer) {
    if (!this.pointerState) return;
    this.pointerState = undefined;
    this.reject('포인터 이탈 · 원위치 복구');
  }

  private handleTap(index: number) {
    if (this.selected === undefined) {
      if (!this.board[index]) return this.reject('빈 칸입니다. 부품을 먼저 선택하세요.');
      this.selected = index;
      this.lastAction = '부품 선택 · 목적지를 탭하세요.';
      return this.render();
    }
    if (this.selected === index) {
      this.selected = undefined;
      this.lastAction = '선택을 취소했습니다.';
      return this.render();
    }
    this.execute(this.selected, index, '탭');
  }

  private execute(source: number, target: number, input: string) {
    const sourcePart = this.board[source];
    if (!sourcePart || source === target) return this.reject('같은 칸에는 놓을 수 없습니다.');
    const targetPart = this.board[target];
    if (!targetPart) {
      this.board[target] = sourcePart;
      this.board[source] = undefined;
      this.successes += 1;
      this.selected = undefined;
      this.lastAction = `${input} 이동 성공`;
      return this.render();
    }
    if (targetPart.kind === sourcePart.kind && targetPart.level === sourcePart.level) {
      this.board[target] = { ...targetPart, level: targetPart.level + 1 };
      this.board[source] = undefined;
      this.successes += 1;
      this.selected = undefined;
      this.lastAction = `${input} 머지 성공 · Lv.${targetPart.level + 1}`;
      return this.render();
    }
    this.reject('종류와 레벨이 같아야 머지할 수 있습니다.');
  }

  private reject(message: string) {
    this.mistakes += 1;
    this.selected = undefined;
    this.lastAction = message;
    this.render();
  }

  private targetState(source: number, target: number) {
    const a = this.board[source];
    const b = this.board[target];
    return !b || (a && a.kind === b.kind && a.level === b.level) ? 'valid' : 'invalid';
  }

  private cellCenter(index: number) {
    return { x: BOARD_X + (index % COLS) * CELL + CELL / 2, y: BOARD_Y + Math.floor(index / COLS) * CELL + CELL / 2 };
  }

  private indexAt(x: number, y: number) {
    const col = Math.floor((x - BOARD_X) / CELL);
    const row = Math.floor((y - BOARD_Y) / CELL);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return undefined;
    return row * COLS + col;
  }

  private drawPart(x: number, y: number, part: Part, alpha: number) {
    const container = this.add.container(x, y).setAlpha(alpha);
    const color = part.kind === 'frame' ? 0xff7f66 : part.kind === 'wheel' ? 0x8ea6ff : 0xffdf6b;
    const shape = this.add.circle(0, -4, 24, color).setStrokeStyle(2, 0xffffff, .45);
    const icon = this.text(0, -6, part.kind === 'frame' ? '△' : part.kind === 'wheel' ? '◉' : '✦', 25, '#07111f', true).setOrigin(.5);
    const level = this.text(0, 24, `Lv.${part.level}`, 11, COLORS.text, true).setOrigin(.5);
    container.add([shape, icon, level]);
    return container;
  }
}

export function startInputPrototype(parent: string, mode: InputPrototypeMode) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#07111f',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 960, height: 620 },
    scene: new InputScene(mode),
    input: { activePointers: 2 },
  });
}
