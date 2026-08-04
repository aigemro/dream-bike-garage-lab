import Phaser from 'phaser';

export type MergePrototypeMode = 'free' | 'order' | 'guided';

type PartType = 'frame' | 'wheel' | 'drivetrain' | 'handlebar';
type Point = { x: number; y: number };
type Piece = {
  id: number;
  type: PartType;
  level: number;
  row: number;
  column: number;
  rotation: number;
  item: Phaser.GameObjects.Container;
};
type Goal = { type: PartType; level: number; delivered: boolean };

const PARTS: Array<{ type: PartType; name: string; short: string; color: number; shape: Point[] }> = [
  { type: 'frame', name: '프레임', short: 'F', color: 0x55d6be, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] },
  { type: 'wheel', name: '휠셋', short: 'W', color: 0xffb35c, shape: [{ x: 0, y: 0 }, { x: 0, y: 1 }] },
  { type: 'drivetrain', name: '구동계', short: 'D', color: 0xff7185, shape: [{ x: 0, y: 0 }] },
  { type: 'handlebar', name: '핸들바', short: 'H', color: 0x8c7bff, shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
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

  private rows = 7;
  private columns = 6;
  private pieces: Piece[] = [];
  private zones: Phaser.GameObjects.Rectangle[] = [];
  private boardObjects: Phaser.GameObjects.GameObject[] = [];
  private controls: Phaser.GameObjects.GameObject[] = [];
  private selectedPiece?: Piece;
  private selectedGenerator: PartType = 'frame';
  private activeSizeField: 'columns' | 'rows' | undefined;
  private nextId = 1;
  private orderIndex = 0;
  private boardLeft = 0;
  private boardTop = 0;
  private cellSize = 0;
  private gap = 4;
  private goals: Goal[] = [];
  private actions = 0;
  private merges = 0;
  private mistakes = 0;
  private startedAt = 0;
  private info!: Phaser.GameObjects.Text;
  private metrics!: Phaser.GameObjects.Text;
  private orderText?: Phaser.GameObjects.Text;
  private orderBike?: Phaser.GameObjects.Graphics;
  private goalSlots = new Map<PartType, { label: Phaser.GameObjects.Text; panel: Phaser.GameObjects.Rectangle }>();

  create() {
    this.cameras.main.setBackgroundColor('#0b1727');
    this.startedAt = this.time.now;
    this.goals = ORDERS[0].map((goal) => ({ ...goal }));
    this.drawHeader();
    this.drawSizeControls();
    this.rebuildBoard('열·행 값을 직접 입력해 보드 크기를 바꿀 수 있습니다.');
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.handleSizeInput(event));
  }

  update() { this.refreshMetrics(); }

  private drawHeader() {
    const names = { free: 'A · 자유 보드 · 2차 구현', order: 'B · 주문 중심 · 2차 구현', guided: 'C · 자유 + 가이드' };
    this.add.text(24, 18, names[this.mode], { fontFamily: 'Arial', fontSize: '19px', color: '#55d6be', fontStyle: 'bold' });
    this.info = this.add.text(24, 47, '', { fontFamily: 'Arial', fontSize: '12px', color: '#bfd0dc', wordWrap: { width: 592 } });
    this.metrics = this.add.text(616, 20, '', { fontFamily: 'Arial', fontSize: '11px', color: '#758da1' }).setOrigin(1, 0);
    if (this.mode === 'order') this.drawVisualOrder();
    else if (this.mode !== 'free') this.orderText = this.add.text(24, 67, '', { fontFamily: 'Arial', fontSize: '10px', color: '#ffd37a', wordWrap: { width: 592 } });
  }

  private drawVisualOrder() {
    this.add.rectangle(320, 190, 584, 140, 0x10243a).setStrokeStyle(1, 0x294b64);
    this.orderText = this.add.text(42, 130, '', { fontFamily: 'Arial', fontSize: '12px', color: '#91a9bc' });
    this.orderBike = this.add.graphics();

    PARTS.forEach((part, index) => {
      const x = 91 + index * 152;
      const panel = this.add.rectangle(x, 230, 138, 42, 0x0b1929).setStrokeStyle(1, part.color, 0.65);
      const label = this.add.text(x, 230, '', { fontFamily: 'Arial', fontSize: '11px', color: '#dce9f2', align: 'center' }).setOrigin(0.5);
      this.goalSlots.set(part.type, { label, panel });
    });
    this.drawOrderBike();
  }

  private drawSizeControls() {
    this.add.text(24, 82, '보드 크기', { fontFamily: 'Arial', fontSize: '12px', color: '#8fa8ba' });
    this.makeSizeField(102, 94, '열', 'columns');
    this.makeSizeField(205, 94, '행', 'rows');
    const apply = this.add.rectangle(300, 94, 76, 32, 0x21445a).setStrokeStyle(1, 0x55d6be).setInteractive({ useHandCursor: true });
    this.add.text(300, 94, '적용', { fontFamily: 'Arial', fontSize: '12px', color: '#e8f1f7', fontStyle: 'bold' }).setOrigin(0.5);
    apply.on('pointerdown', () => this.rebuildBoard('보드 크기를 변경했습니다. 배치된 부품은 초기화됩니다.'));
    this.add.text(350, 86, '4~10 입력 · 부품 선택 후 빈 칸 배치\n부품 선택 → 회전 또는 빈 칸 이동', { fontFamily: 'Arial', fontSize: '10px', color: '#71899c', lineSpacing: 3 });
  }

  private makeSizeField(x: number, y: number, label: string, field: 'columns' | 'rows') {
    const box = this.add.rectangle(x, y, 78, 32, 0x101f31).setStrokeStyle(1, 0x395a72).setInteractive({ useHandCursor: true });
    this.add.text(x - 30, y, label, { fontFamily: 'Arial', fontSize: '11px', color: '#7990a2' }).setOrigin(0, 0.5);
    const text = this.add.text(x + 15, y, String(field === 'columns' ? this.columns : this.rows), { fontFamily: 'Arial', fontSize: '14px', color: '#eaf2f8', fontStyle: 'bold' }).setOrigin(0.5);
    text.setData('sizeField', field);
    box.on('pointerdown', () => { this.activeSizeField = field; this.refreshSizeFields(); });
  }

  private refreshSizeFields() {
    this.children.list.filter((object): object is Phaser.GameObjects.Text => object instanceof Phaser.GameObjects.Text && Boolean(object.getData('sizeField')))
      .forEach((text) => {
        const field = text.getData('sizeField') as 'columns' | 'rows';
        text.setText(`${field === 'columns' ? this.columns : this.rows}${this.activeSizeField === field ? '|' : ''}`);
        text.setColor(this.activeSizeField === field ? '#55d6be' : '#eaf2f8');
      });
  }

  private handleSizeInput(event: KeyboardEvent) {
    if (!this.activeSizeField) return;
    const current = String(this.activeSizeField === 'columns' ? this.columns : this.rows);
    let next = current;
    if (/^[0-9]$/.test(event.key)) next = current === '10' || current.length >= 2 ? event.key : `${current}${event.key}`;
    else if (event.key === 'Backspace') next = current.slice(0, -1) || '0';
    else if (event.key === 'Enter') { this.activeSizeField = undefined; this.rebuildBoard('보드 크기를 변경했습니다. 배치된 부품은 초기화됩니다.'); return; }
    else return;
    const value = Number(next);
    if (this.activeSizeField === 'columns') this.columns = Math.min(10, value);
    else this.rows = Math.min(10, value);
    this.refreshSizeFields();
  }

  private rebuildBoard(message: string) {
    this.columns = Phaser.Math.Clamp(this.columns || 4, 4, 10);
    this.rows = Phaser.Math.Clamp(this.rows || 4, 4, 10);
    this.activeSizeField = undefined;
    this.selectedPiece = undefined;
    this.pieces.forEach((piece) => piece.item.destroy());
    this.pieces = [];
    this.boardObjects.forEach((object) => object.destroy());
    this.controls.forEach((object) => object.destroy());
    this.boardObjects = [];
    this.controls = [];
    this.zones = [];
    this.cellSize = Math.floor(Math.min(440 / this.columns, 390 / this.rows));
    this.gap = Math.max(2, Math.min(5, Math.floor(this.cellSize * 0.08)));
    const width = this.columns * this.cellSize;
    this.boardLeft = (640 - width) / 2;
    this.boardTop = this.mode === 'order' ? 276 : 128;
    this.drawBoard();
    this.drawPartControls();
    this.refreshSizeFields();
    this.refreshUi(message);
  }

  private drawBoard() {
    for (let row = 0; row < this.rows; row += 1) {
      for (let column = 0; column < this.columns; column += 1) {
        const { x, y } = this.cellCenter(row, column);
        const zone = this.add.rectangle(x, y, this.cellSize - this.gap, this.cellSize - this.gap, 0x13263b)
          .setStrokeStyle(1, 0x28455f).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => this.handleCell(row, column));
        this.zones.push(zone);
        this.boardObjects.push(zone);
      }
    }
  }

  private drawPartControls() {
    const boardBottom = this.boardTop + this.rows * this.cellSize;
    const controlsTop = Math.min(this.mode === 'order' ? 790 : 642, boardBottom + 10);
    const label = this.add.text(24, controlsTop, '추가할 부품', { fontFamily: 'Arial', fontSize: '11px', color: '#8fa8ba' });
    this.controls.push(label);
    PARTS.forEach((part, index) => {
      const x = 91 + index * 137;
      const y = controlsTop + 28;
      const button = this.add.rectangle(x, y, 124, 40, 0x13263b).setStrokeStyle(2, part.color).setInteractive({ useHandCursor: true });
      button.setData('part', part.type);
      button.on('pointerdown', () => { this.selectedGenerator = part.type; this.selectedPiece = undefined; this.refreshControls(); this.refreshUi(`${part.name}을 선택했습니다. 빈 공간을 눌러 배치하세요.`); });
      const text = this.add.text(x, y, `${part.short}  ${part.name} · ${part.shape.length}칸`, { fontFamily: 'Arial', fontSize: '11px', color: '#e8f1f7', fontStyle: 'bold' }).setOrigin(0.5);
      this.controls.push(button, text);
    });
    const rotateY = controlsTop + 58;
    const rotate = this.add.rectangle(253, rotateY, 270, 30, 0x101f31).setStrokeStyle(1, 0x557086).setInteractive({ useHandCursor: true });
    const rotateText = this.add.text(253, rotateY, '선택한 부품 90° 회전', { fontFamily: 'Arial', fontSize: '11px', color: '#d5e2eb' }).setOrigin(0.5);
    const remove = this.add.rectangle(453, rotateY, 116, 30, 0x251c29).setStrokeStyle(1, 0x8b5365).setInteractive({ useHandCursor: true });
    const removeText = this.add.text(453, rotateY, '선택 제거', { fontFamily: 'Arial', fontSize: '11px', color: '#e3bec9' }).setOrigin(0.5);
    rotate.on('pointerdown', () => this.rotateSelected());
    remove.on('pointerdown', () => this.removeSelected());
    this.controls.push(rotate, rotateText, remove, removeText);
    this.refreshControls();
  }

  private handleCell(row: number, column: number) {
    this.actions += 1;
    const clicked = this.pieceAt(row, column);
    if (clicked) {
      if (!this.selectedPiece) {
        this.selectedPiece = clicked;
        this.refreshControls();
        this.refreshUi(`${this.partName(clicked.type)} Lv.${clicked.level} 선택 · 빈 칸으로 이동하거나 같은 부품에 머지하세요.`);
        return;
      }
      if (clicked.id === this.selectedPiece.id) { this.selectedPiece = undefined; this.refreshControls(); this.refreshUi('선택을 취소했습니다.'); return; }
      if (clicked.type === this.selectedPiece.type && clicked.level === this.selectedPiece.level && clicked.level < 4) {
        this.mergePieces(this.selectedPiece, clicked);
        return;
      }
      this.mistakes += 1;
      this.refreshUi('같은 종류·같은 레벨끼리만 머지할 수 있습니다.');
      return;
    }

    if (this.selectedPiece) {
      if (this.canPlace(this.selectedPiece.type, row, column, this.selectedPiece.rotation, this.selectedPiece.id)) {
        this.selectedPiece.row = row;
        this.selectedPiece.column = column;
        this.positionPiece(this.selectedPiece);
        this.refreshUi(`${this.partName(this.selectedPiece.type)}을 이동했습니다.`);
        this.selectedPiece = undefined;
        this.refreshControls();
      } else { this.mistakes += 1; this.refreshUi('부품 모양이 보드 밖으로 나가거나 다른 부품과 겹칩니다.'); }
      return;
    }

    const type = this.mode === 'order' ? this.recommendedPart() : this.selectedGenerator;
    if (!this.canPlace(type, row, column, 0)) { this.mistakes += 1; this.refreshUi('선택한 부품 모양이 들어갈 빈 공간이 부족합니다. 회전하거나 다른 위치를 선택하세요.'); return; }
    const piece = this.makePiece(type, row, column, 0, 1);
    this.pieces.push(piece);
    this.refreshUi(`${this.partName(type)} Lv.1을 ${this.shape(type, 0).length}칸 크기로 배치했습니다.`);
  }

  private makePiece(type: PartType, row: number, column: number, rotation: number, level: number) {
    const part = PARTS.find((item) => item.type === type)!;
    const cells = this.shape(type, rotation);
    const blocks = cells.map((point) => this.add.rectangle(point.x * this.cellSize, point.y * this.cellSize, this.cellSize - this.gap * 2, this.cellSize - this.gap * 2, part.color).setStrokeStyle(2, 0x07111f));
    const centerX = (Math.max(...cells.map((point) => point.x)) * this.cellSize) / 2;
    const centerY = (Math.max(...cells.map((point) => point.y)) * this.cellSize) / 2;
    const tag = this.add.text(centerX, centerY, `${part.short}\nL${level}`, { align: 'center', fontFamily: 'Arial', fontSize: `${Math.max(10, Math.min(16, this.cellSize * 0.28))}px`, color: '#07111f', fontStyle: 'bold' }).setOrigin(0.5);
    const item = this.add.container(0, 0, [...blocks, tag]).setDepth(2);
    const piece: Piece = { id: this.nextId++, type, level, row, column, rotation, item };
    this.positionPiece(piece);
    return piece;
  }

  private positionPiece(piece: Piece) {
    const origin = this.cellCenter(piece.row, piece.column);
    piece.item.setPosition(origin.x, origin.y);
  }

  private rotateSelected() {
    if (!this.selectedPiece) { this.refreshUi('먼저 보드의 부품을 선택하세요.'); return; }
    const next = (this.selectedPiece.rotation + 1) % 4;
    if (!this.canPlace(this.selectedPiece.type, this.selectedPiece.row, this.selectedPiece.column, next, this.selectedPiece.id)) {
      this.mistakes += 1;
      this.refreshUi('현재 위치에서는 회전할 공간이 부족합니다. 먼저 넓은 곳으로 이동하세요.');
      return;
    }
    const old = this.selectedPiece;
    old.item.destroy();
    const replacement = this.makePiece(old.type, old.row, old.column, next, old.level);
    replacement.id = old.id;
    this.pieces[this.pieces.findIndex((piece) => piece.id === old.id)] = replacement;
    this.selectedPiece = replacement;
    this.refreshControls();
    this.refreshUi(`${this.partName(replacement.type)}을 90° 회전했습니다.`);
  }

  private removeSelected() {
    if (!this.selectedPiece) { this.refreshUi('먼저 제거할 부품을 선택하세요.'); return; }
    this.selectedPiece.item.destroy();
    this.pieces = this.pieces.filter((piece) => piece.id !== this.selectedPiece!.id);
    this.selectedPiece = undefined;
    this.refreshControls();
    this.refreshUi('선택한 부품을 보드에서 제거했습니다.');
  }

  private mergePieces(source: Piece, target: Piece) {
    source.item.destroy();
    target.item.destroy();
    this.pieces = this.pieces.filter((piece) => piece.id !== source.id && piece.id !== target.id);
    const merged = this.makePiece(target.type, target.row, target.column, target.rotation, target.level + 1);
    this.pieces.push(merged);
    this.selectedPiece = undefined;
    this.merges += 1;
    this.refreshControls();
    this.refreshUi(`${this.partName(target.type)} Lv.${merged.level} 머지 성공!`);
  }

  private shape(type: PartType, rotation: number) {
    let points = PARTS.find((part) => part.type === type)!.shape.map((point) => ({ ...point }));
    for (let turn = 0; turn < rotation; turn += 1) points = points.map((point) => ({ x: -point.y, y: point.x }));
    const minX = Math.min(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    return points.map((point) => ({ x: point.x - minX, y: point.y - minY }));
  }

  private occupied(piece: Piece) { return this.shape(piece.type, piece.rotation).map((point) => ({ row: piece.row + point.y, column: piece.column + point.x })); }

  private canPlace(type: PartType, row: number, column: number, rotation: number, ignoredId?: number) {
    const occupied = this.pieces.filter((piece) => piece.id !== ignoredId).flatMap((piece) => this.occupied(piece));
    return this.shape(type, rotation).every((point) => {
      const targetRow = row + point.y;
      const targetColumn = column + point.x;
      return targetRow >= 0 && targetRow < this.rows && targetColumn >= 0 && targetColumn < this.columns
        && !occupied.some((cell) => cell.row === targetRow && cell.column === targetColumn);
    });
  }

  private pieceAt(row: number, column: number) {
    return this.pieces.find((piece) => this.occupied(piece).some((cell) => cell.row === row && cell.column === column));
  }

  private cellCenter(row: number, column: number) { return { x: this.boardLeft + column * this.cellSize + this.cellSize / 2, y: this.boardTop + row * this.cellSize + this.cellSize / 2 }; }

  private refreshControls() {
    this.controls.filter((object): object is Phaser.GameObjects.Rectangle => object instanceof Phaser.GameObjects.Rectangle && Boolean(object.getData('part')))
      .forEach((button) => button.setFillStyle(button.getData('part') === this.selectedGenerator && !this.selectedPiece ? 0x21445a : 0x13263b));
    this.pieces.forEach((piece) => piece.item.setScale(piece.id === this.selectedPiece?.id ? 1.06 : 1));
  }

  private refreshUi(message: string) {
    this.info.setText(message);
    if (this.mode !== 'free') this.checkDelivery();
    this.refreshOrder();
    this.refreshMetrics();
  }

  private checkDelivery() {
    this.goals.forEach((goal) => {
      if (goal.delivered) return;
      const match = this.pieces.find((piece) => piece.type === goal.type && piece.level >= goal.level);
      if (!match) return;
      goal.delivered = true;
      match.item.destroy();
      this.pieces = this.pieces.filter((piece) => piece.id !== match.id);
    });
    if (this.goals.every((goal) => goal.delivered)) {
      this.info.setText(`주문 ${this.orderIndex + 1} 완료 · 급여를 획득했습니다! 다음 주문을 시작합니다.`);
      this.orderIndex = (this.orderIndex + 1) % ORDERS.length;
      this.goals = ORDERS[this.orderIndex].map((goal) => ({ ...goal }));
    }
  }

  private refreshOrder() {
    if (!this.orderText) return;
    if (this.mode === 'order') {
      const completed = this.goals.filter((goal) => goal.delivered).length;
      this.orderText.setText(`CUSTOMER ORDER ${this.orderIndex + 1}/3  ·  어반 로드 자전거  ·  준비 ${completed}/4`);
      this.goals.forEach((goal) => {
        const slot = this.goalSlots.get(goal.type);
        if (!slot) return;
        const part = PARTS.find((item) => item.type === goal.type)!;
        slot.panel.setFillStyle(goal.delivered ? part.color : 0x0b1929, goal.delivered ? 0.28 : 1);
        slot.panel.setStrokeStyle(goal.delivered ? 2 : 1, part.color, goal.delivered ? 1 : 0.65);
        slot.label.setText(`${goal.delivered ? '✓ 완료' : part.name}\nLv.${goal.level}`).setColor(goal.delivered ? '#ffffff' : '#dce9f2');
      });
      return;
    }
    this.orderText.setText(`주문 ${this.orderIndex + 1}/3   ${this.goals.map((goal) => `${goal.delivered ? '✓' : '○'} ${this.partName(goal.type)} L${goal.level}`).join('   ')}`);
  }

  private drawOrderBike() {
    if (!this.orderBike) return;
    const g = this.orderBike.clear();
    g.lineStyle(5, 0xffb35c, 1).strokeCircle(260, 178, 28).strokeCircle(382, 178, 28);
    g.lineStyle(6, 0x55d6be, 1).strokeTriangle(274, 176, 327, 138, 352, 176).lineBetween(274, 176, 352, 176).lineBetween(327, 138, 382, 178);
    g.lineStyle(5, 0xff7185, 1).strokeCircle(327, 172, 10).lineBetween(327, 172, 352, 176);
    g.lineStyle(5, 0x8c7bff, 1).lineBetween(365, 134, 382, 178).lineBetween(358, 134, 377, 134);
    g.fillStyle(0x55d6be).fillRect(312, 128, 29, 6);
  }

  private refreshMetrics() {
    if (!this.metrics) return;
    const seconds = Math.floor((this.time.now - this.startedAt) / 1000);
    const occupied = this.pieces.reduce((sum, piece) => sum + this.shape(piece.type, piece.rotation).length, 0);
    this.metrics.setText(`${seconds}s · 행동 ${this.actions} · 머지 ${this.merges} · 오입력 ${this.mistakes} · 빈칸 ${this.rows * this.columns - occupied}`);
  }

  private recommendedPart() { return this.goals.find((goal) => !goal.delivered)?.type ?? this.selectedGenerator; }
  private partName(type: PartType) { return PARTS.find((part) => part.type === type)!.name; }
}

export function startMergePrototype(parent: string, mode: MergePrototypeMode) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 640,
    height: mode === 'order' ? 880 : 720,
    backgroundColor: '#0b1727',
    scene: new MergePrototypeScene(mode),
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 2 },
  });
}
