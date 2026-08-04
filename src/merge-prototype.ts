import Phaser from 'phaser';

export type MergePrototypeMode = 'free' | 'order' | 'guided';

type PartType = 'frame' | 'wheel' | 'drivetrain' | 'handlebar';
type Cell = { type?: PartType; level: number; item?: Phaser.GameObjects.Container };
type Goal = { type: PartType; level: number; delivered: boolean };

const PARTS: Array<{ type: PartType; name: string; short: string; color: number }> = [
  { type: 'frame', name: '프레임', short: 'F', color: 0x55d6be },
  { type: 'wheel', name: '휠셋', short: 'W', color: 0xffb35c },
  { type: 'drivetrain', name: '구동계', short: 'D', color: 0xff7185 },
  { type: 'handlebar', name: '핸들바', short: 'H', color: 0x8c7bff },
];

const ORDERS: Goal[][] = [
  [
    { type: 'frame', level: 2, delivered: false },
    { type: 'wheel', level: 2, delivered: false },
    { type: 'drivetrain', level: 1, delivered: false },
    { type: 'handlebar', level: 1, delivered: false },
  ],
  [
    { type: 'frame', level: 3, delivered: false },
    { type: 'wheel', level: 2, delivered: false },
    { type: 'drivetrain', level: 2, delivered: false },
    { type: 'handlebar', level: 1, delivered: false },
  ],
  [
    { type: 'frame', level: 2, delivered: false },
    { type: 'wheel', level: 3, delivered: false },
    { type: 'drivetrain', level: 2, delivered: false },
    { type: 'handlebar', level: 2, delivered: false },
  ],
];

class MergePrototypeScene extends Phaser.Scene {
  constructor(private readonly mode: MergePrototypeMode) { super(`merge-${mode}`); }

  private cells: Cell[] = [];
  private zones: Phaser.GameObjects.Rectangle[] = [];
  private selected = -1;
  private selectedGenerator: PartType = 'frame';
  private orderIndex = 0;
  private goals: Goal[] = [];
  private actions = 0;
  private merges = 0;
  private mistakes = 0;
  private startedAt = 0;
  private info!: Phaser.GameObjects.Text;
  private metrics!: Phaser.GameObjects.Text;
  private orderText!: Phaser.GameObjects.Text;
  private guideText!: Phaser.GameObjects.Text;

  create() {
    this.cameras.main.setBackgroundColor('#0b1727');
    this.startedAt = this.time.now;
    this.goals = ORDERS[this.orderIndex].map((goal) => ({ ...goal }));
    this.drawHeader();
    this.drawGenerators();
    this.drawBoard();
    this.refreshUi('부품 종류를 고르고 빈 칸을 눌러 생성하세요.');
  }

  update() { this.refreshMetrics(); }

  private drawHeader() {
    const names = { free: 'A · 자유 보드', order: 'B · 주문 중심', guided: 'C · 자유 + 가이드' };
    this.add.text(28, 22, names[this.mode], { fontFamily: 'Arial', fontSize: '20px', color: '#55d6be', fontStyle: 'bold' });
    this.info = this.add.text(28, 52, '', { fontFamily: 'Arial', fontSize: '13px', color: '#bfd0dc', wordWrap: { width: 584 } });
    this.metrics = this.add.text(612, 24, '', { fontFamily: 'Arial', fontSize: '12px', color: '#758da1' }).setOrigin(1, 0);

    if (this.mode !== 'free') {
      this.add.rectangle(320, 108, 584, 54, 0x10243a).setStrokeStyle(1, 0x294b64);
      this.orderText = this.add.text(42, 91, '', { fontFamily: 'Arial', fontSize: '13px', color: '#dce9f2', wordWrap: { width: 550 } });
    }
    if (this.mode === 'guided') {
      this.guideText = this.add.text(28, 142, '', { fontFamily: 'Arial', fontSize: '12px', color: '#ffd37a', backgroundColor: '#2a2418', padding: { x: 9, y: 6 } });
    }
  }

  private drawGenerators() {
    const y = this.mode === 'free' ? 112 : this.mode === 'guided' ? 190 : 164;
    PARTS.forEach((part, index) => {
      const x = 92 + index * 152;
      const button = this.add.rectangle(x, y, 132, 46, 0x13263b).setStrokeStyle(2, part.color).setInteractive({ useHandCursor: true });
      this.add.text(x, y, `${part.short}  ${part.name}`, { fontFamily: 'Arial', fontSize: '13px', color: '#e8f1f7', fontStyle: 'bold' }).setOrigin(0.5);
      button.on('pointerdown', () => { this.selectedGenerator = part.type; this.refreshGenerators(); this.refreshUi(`${part.name} 생성기를 선택했습니다.`); });
      button.setData('part', part.type);
    });
    this.refreshGenerators();
  }

  private refreshGenerators() {
    this.children.list.filter((object): object is Phaser.GameObjects.Rectangle => object instanceof Phaser.GameObjects.Rectangle && Boolean(object.getData('part')))
      .forEach((button) => button.setFillStyle(button.getData('part') === this.selectedGenerator ? 0x21445a : 0x13263b));
  }

  private drawBoard() {
    const top = this.mode === 'free' ? 164 : this.mode === 'guided' ? 246 : 218;
    const cellSize = 64;
    const gap = 6;
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 6; column += 1) {
        const index = row * 6 + column;
        const x = 145 + column * (cellSize + gap);
        const y = top + row * (cellSize + gap);
        const zone = this.add.rectangle(x, y, cellSize, cellSize, 0x13263b).setStrokeStyle(2, 0x28455f).setInteractive({ useHandCursor: true });
        this.add.text(x, y, '+', { fontFamily: 'Arial', fontSize: '20px', color: '#36546d' }).setOrigin(0.5);
        this.cells.push({ level: 0 });
        this.zones.push(zone);
        zone.on('pointerdown', () => this.handleCell(index, x, y));
      }
    }
  }

  private handleCell(index: number, x: number, y: number) {
    const cell = this.cells[index];
    this.actions += 1;
    if (!cell.item) {
      cell.type = this.mode === 'order' ? this.recommendedPart() : this.selectedGenerator;
      cell.level = 1;
      cell.item = this.makeItem(x, y, cell.type, cell.level);
      this.refreshUi(`${this.partName(cell.type)} Lv.1을 생성했습니다.`);
      return;
    }
    if (this.selected < 0) {
      this.selected = index;
      cell.item.setScale(1.12);
      this.refreshUi(`${this.partName(cell.type!)} Lv.${cell.level} 선택 · 합칠 부품 또는 빈 칸을 누르세요.`);
      return;
    }

    const previousIndex = this.selected;
    const previous = this.cells[previousIndex];
    previous.item?.setScale(1);
    this.selected = -1;
    if (previousIndex === index) { this.refreshUi('선택을 취소했습니다.'); return; }

    if (previous.type === cell.type && previous.level === cell.level && cell.level < 4) {
      previous.item?.destroy();
      previous.item = undefined;
      previous.type = undefined;
      previous.level = 0;
      cell.level += 1;
      cell.item?.destroy();
      cell.item = this.makeItem(x, y, cell.type!, cell.level);
      this.merges += 1;
      this.refreshUi(`${this.partName(cell.type!)} Lv.${cell.level} 머지 성공!`);
      return;
    }

    if (!cell.item) return;
    this.mistakes += 1;
    this.refreshUi('같은 종류·같은 레벨끼리만 머지할 수 있습니다.');
  }

  private makeItem(x: number, y: number, type: PartType, level: number) {
    const part = PARTS.find((item) => item.type === type)!;
    const container = this.add.container(x, y, [
      this.add.circle(0, 0, 24, part.color),
      this.add.text(0, -3, part.short, { fontFamily: 'Arial', fontSize: '18px', color: '#07111f', fontStyle: 'bold' }).setOrigin(0.5),
      this.add.text(0, 17, `L${level}`, { fontFamily: 'Arial', fontSize: '10px', color: '#07111f', fontStyle: 'bold' }).setOrigin(0.5),
    ]);
    container.setDepth(2);
    return container;
  }

  private refreshUi(message: string) {
    this.info.setText(message);
    if (this.mode !== 'free') this.checkDelivery();
    this.refreshOrder();
    this.refreshGuide();
    this.refreshMetrics();
  }

  private checkDelivery() {
    this.goals.forEach((goal) => {
      if (goal.delivered) return;
      const match = this.cells.find((cell) => cell.type === goal.type && cell.level >= goal.level);
      if (!match) return;
      goal.delivered = true;
      match.item?.destroy();
      match.item = undefined;
      match.type = undefined;
      match.level = 0;
    });
    if (this.goals.every((goal) => goal.delivered)) {
      this.info.setText(`주문 ${this.orderIndex + 1} 완료 · 급여를 획득했습니다! 다음 주문을 시작합니다.`);
      this.orderIndex = (this.orderIndex + 1) % ORDERS.length;
      this.goals = ORDERS[this.orderIndex].map((goal) => ({ ...goal }));
    }
  }

  private refreshOrder() {
    if (!this.orderText) return;
    const progress = this.goals.map((goal) => `${goal.delivered ? '✓' : '○'} ${this.partName(goal.type)} L${goal.level}`).join('   ');
    this.orderText.setText(`주문 ${this.orderIndex + 1}/3   ${progress}`);
  }

  private refreshGuide() {
    if (!this.guideText) return;
    const next = this.goals.find((goal) => !goal.delivered);
    if (!next) return;
    const count = this.cells.filter((cell) => cell.type === next.type && cell.level === 1).length;
    this.guideText.setText(`추천: ${this.partName(next.type)} L${next.level} 제작 · 보드의 L1 ${count}개 · 자유 제작 가능`);
    this.zones.forEach((zone, index) => {
      const cell = this.cells[index];
      const highlight = cell.type === next.type || (!cell.item && this.selectedGenerator === next.type);
      zone.setStrokeStyle(highlight ? 3 : 2, highlight ? 0xffd37a : 0x28455f);
    });
  }

  private refreshMetrics() {
    if (!this.metrics) return;
    const seconds = Math.floor((this.time.now - this.startedAt) / 1000);
    const empty = this.cells.filter((cell) => !cell.item).length;
    this.metrics.setText(`${seconds}s · 행동 ${this.actions} · 머지 ${this.merges} · 오입력 ${this.mistakes} · 빈칸 ${empty}`);
  }

  private recommendedPart() { return this.goals.find((goal) => !goal.delivered)?.type ?? this.selectedGenerator; }
  private partName(type: PartType) { return PARTS.find((part) => part.type === type)!.name; }
}

export function startMergePrototype(parent: string, mode: MergePrototypeMode) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 640,
    height: 720,
    backgroundColor: '#0b1727',
    scene: new MergePrototypeScene(mode),
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 2 },
  });
}
