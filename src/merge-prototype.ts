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
  private generatorRotation = 0;
  private generatorPlacementActive = false;
  private placementGhost?: Phaser.GameObjects.Container;
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
  private orderParts = new Map<PartType, number[]>();
  private orderPartDisplays = new Map<PartType, Phaser.GameObjects.Container>();

  create() {
    this.cameras.main.setBackgroundColor('#0b1727');
    this.startedAt = this.time.now;
    this.goals = ORDERS[0].map((goal) => ({ ...goal }));
    this.drawHeader();
    if (this.mode === 'order') {
      this.drawCustomOrder();
      this.drawOrderPartControls();
      this.refreshUi('오른쪽 부품을 클릭해 커스텀 주문을 완성하세요. 같은 레벨 부품 2개는 자동으로 머지됩니다.');
      return;
    }
    this.drawSizeControls();
    this.rebuildBoard('열·행의 − / + 버튼을 누르면 보드 크기가 바로 변경됩니다.');
  }

  update() { this.refreshMetrics(); }

  private drawHeader() {
    const names = { free: 'A · 자유 보드 · 2차 구현', order: 'B · 주문 중심 · 2차 구현', guided: 'C · 자유 + 가이드' };
    this.add.text(24, 18, names[this.mode], { fontFamily: 'Arial', fontSize: '19px', color: '#55d6be', fontStyle: 'bold' });
    this.info = this.add.text(24, 47, '', { fontFamily: 'Arial', fontSize: '12px', color: '#bfd0dc', wordWrap: { width: 1040 } });
    this.metrics = this.add.text(1096, 20, '', { fontFamily: 'Arial', fontSize: '11px', color: '#758da1' }).setOrigin(1, 0);
    if (this.mode !== 'free' && this.mode !== 'order') this.orderText = this.add.text(794, 508, '', { fontFamily: 'Arial', fontSize: '11px', color: '#ffd37a', wordWrap: { width: 292 } }).setDepth(2);
  }

  private drawCustomOrder() {
    this.add.rectangle(382, 394, 704, 556, 0x0e1d2e).setStrokeStyle(1, 0x29465e);
    this.add.text(54, 136, 'CUSTOM ORDER WORKBENCH', { fontFamily: 'Arial', fontSize: '11px', color: '#55d6be', fontStyle: 'bold' });
    this.orderText = this.add.text(54, 158, '', { fontFamily: 'Arial', fontSize: '16px', color: '#dce9f2', fontStyle: 'bold' });
    this.add.text(54, 188, '완성된 부품은 주문 카드에 장착되어 표시됩니다.', { fontFamily: 'Arial', fontSize: '11px', color: '#71899c' });
    this.orderBike = this.add.graphics().setDepth(2);

    PARTS.forEach((part, index) => {
      const x = 218 + (index % 2) * 332;
      const y = 476 + Math.floor(index / 2) * 118;
      const panel = this.add.rectangle(x, y, 294, 94, 0x0b1929).setStrokeStyle(1, part.color, 0.65).setDepth(2);
      const label = this.add.text(x - 126, y - 34, '', { fontFamily: 'Arial', fontSize: '11px', color: '#dce9f2' }).setDepth(3);
      this.goalSlots.set(part.type, { label, panel });
      const display = this.add.container(x - 118, y + 12).setDepth(3);
      this.orderPartDisplays.set(part.type, display);
      this.orderParts.set(part.type, []);
    });
    this.drawOrderBike();
  }

  private drawOrderPartControls() {
    const panelLeft = 770;
    const panelWidth = 340;
    this.add.rectangle(940, 404, panelWidth, 520, 0x0e1d2e).setStrokeStyle(1, 0x29465e);
    this.add.text(794, 174, '추가할 부품', { fontFamily: 'Arial', fontSize: '12px', color: '#8fa8ba' });
    PARTS.forEach((part, index) => {
      const x = 865 + (index % 2) * 150;
      const y = 226 + Math.floor(index / 2) * 72;
      const button = this.add.rectangle(x, y, 134, 58, 0x13263b).setStrokeStyle(2, part.color).setInteractive({ useHandCursor: true });
      button.on('pointerdown', () => this.addPartToOrder(part.type));
      this.add.text(x, y, `${part.name}\nLv.1 추가`, { align: 'center', fontFamily: 'Arial', fontSize: '12px', color: '#e8f1f7', fontStyle: 'bold', lineSpacing: 4 }).setOrigin(0.5);
    });
    this.add.text(794, 354, '클릭할 때마다 Lv.1 부품이 주문에 추가됩니다.\n같은 레벨 2개는 즉시 상위 레벨로 합쳐집니다.', {
      fontFamily: 'Arial', fontSize: '11px', color: '#71899c', lineSpacing: 7, wordWrap: { width: 292 },
    });
    this.add.rectangle(940, 526, 292, 178, 0x0b1929).setStrokeStyle(1, 0x29465e);
    this.add.text(814, 455, 'B안 검증 포인트', { fontFamily: 'Arial', fontSize: '12px', color: '#55d6be', fontStyle: 'bold' });
    this.add.text(814, 482, '• 보드 없이 주문 자체가 플레이 공간이 되는가\n• 추가·머지 결과를 즉시 이해할 수 있는가\n• 완성 부품과 미완성 부품이 구분되는가', {
      fontFamily: 'Arial', fontSize: '11px', color: '#91a9bc', lineSpacing: 9,
    });
  }

  private addPartToOrder(type: PartType) {
    this.actions += 1;
    const levels = [...(this.orderParts.get(type) ?? []), 1];
    let merged = true;
    while (merged) {
      merged = false;
      for (let level = 1; level < 4; level += 1) {
        const matches = levels.filter((value) => value === level);
        if (matches.length < 2) continue;
        levels.splice(levels.indexOf(level), 1);
        levels.splice(levels.indexOf(level), 1);
        levels.push(level + 1);
        this.merges += 1;
        merged = true;
        break;
      }
    }
    levels.sort((a, b) => b - a);
    this.orderParts.set(type, levels);
    const goal = this.goals.find((item) => item.type === type);
    if (goal && levels.some((level) => level >= goal.level)) goal.delivered = true;
    this.refreshUi(`${this.partName(type)} 추가 · 현재 ${levels.map((level) => `Lv.${level}`).join(' + ')}`);
  }

  private drawSizeControls() {
    this.add.text(24, 88, '보드 크기', { fontFamily: 'Arial', fontSize: '12px', color: '#8fa8ba' }).setOrigin(0, 0.5);
    this.makeSizeStepper(154, 94, '열', 'columns');
    this.makeSizeStepper(304, 94, '행', 'rows');
    this.add.text(394, 78, '4~10칸 · 누르면 즉시 변경\n부품 선택 → 같은 부품을 다시 눌러 회전\n빈 칸 이동 · 같은 종류와 레벨끼리 머지', {
      fontFamily: 'Arial', fontSize: '10px', color: '#71899c', lineSpacing: 3, wordWrap: { width: 360 },
    });
  }

  private makeSizeStepper(x: number, y: number, label: string, field: 'columns' | 'rows') {
    this.add.text(x - 68, y, label, { fontFamily: 'Arial', fontSize: '11px', color: '#7990a2' }).setOrigin(0.5);
    const minus = this.add.rectangle(x - 34, y, 30, 32, 0x101f31).setStrokeStyle(1, 0x395a72).setInteractive({ useHandCursor: true });
    const valueBox = this.add.rectangle(x, y, 38, 32, 0x101f31).setStrokeStyle(1, 0x395a72);
    const plus = this.add.rectangle(x + 38, y, 30, 32, 0x101f31).setStrokeStyle(1, 0x395a72).setInteractive({ useHandCursor: true });
    this.add.text(x - 34, y, '−', { fontFamily: 'Arial', fontSize: '18px', color: '#dce8f0' }).setOrigin(0.5);
    this.add.text(x + 38, y, '+', { fontFamily: 'Arial', fontSize: '18px', color: '#dce8f0' }).setOrigin(0.5);
    const text = this.add.text(x, y, String(field === 'columns' ? this.columns : this.rows), { fontFamily: 'Arial', fontSize: '14px', color: '#55d6be', fontStyle: 'bold' }).setOrigin(0.5);
    text.setData('sizeField', field);
    minus.on('pointerdown', () => this.changeBoardSize(field, -1));
    plus.on('pointerdown', () => this.changeBoardSize(field, 1));
    void valueBox;
  }

  private refreshSizeFields() {
    this.children.list.filter((object): object is Phaser.GameObjects.Text => object instanceof Phaser.GameObjects.Text && Boolean(object.getData('sizeField')))
      .forEach((text) => {
        const field = text.getData('sizeField') as 'columns' | 'rows';
        text.setText(String(field === 'columns' ? this.columns : this.rows));
      });
  }

  private changeBoardSize(field: 'columns' | 'rows', amount: number) {
    const current = field === 'columns' ? this.columns : this.rows;
    const next = Phaser.Math.Clamp(current + amount, 4, 10);
    if (next === current) {
      this.refreshUi(`보드 ${field === 'columns' ? '열' : '행'}은 4~10 사이에서 변경할 수 있습니다.`);
      return;
    }
    if (field === 'columns') this.columns = next;
    else this.rows = next;
    this.rebuildBoard(`보드를 ${this.columns}열 × ${this.rows}행으로 변경했습니다. 배치된 부품은 초기화됩니다.`);
  }

  private rebuildBoard(message: string) {
    this.columns = Phaser.Math.Clamp(this.columns || 4, 4, 10);
    this.rows = Phaser.Math.Clamp(this.rows || 4, 4, 10);
    this.selectedPiece = undefined;
    this.clearPlacementGhost();
    this.pieces.forEach((piece) => piece.item.destroy());
    this.pieces = [];
    this.boardObjects.forEach((object) => object.destroy());
    this.controls.forEach((object) => this.destroySceneObject(object));
    this.boardObjects = [];
    this.controls = [];
    this.zones = [];
    this.cellSize = Math.floor(Math.min(680 / this.columns, 520 / this.rows, 76));
    this.gap = Math.max(2, Math.min(5, Math.floor(this.cellSize * 0.08)));
    const width = this.columns * this.cellSize;
    this.boardLeft = 32 + (704 - width) / 2;
    this.boardTop = 142 + (536 - this.rows * this.cellSize) / 2;
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
        zone.on('pointerover', () => this.showPlacementGhost(row, column));
        zone.on('pointerout', () => this.clearPlacementGhost());
        zone.on('pointerdown', () => this.handleCell(row, column));
        this.zones.push(zone);
        this.boardObjects.push(zone);
      }
    }
  }

  private drawPartControls() {
    this.drawDesktopPartControls();
  }

  private drawDesktopPartControls() {
    const panelLeft = 770;
    const panelWidth = 340;
    const panelPadding = 24;
    const columnGap = 16;
    const buttonWidth = (panelWidth - panelPadding * 2 - columnGap) / 2;
    const controlsLeft = panelLeft + panelPadding;
    const controlsTop = 174;
    const panel = this.add.rectangle(panelLeft + panelWidth / 2, 404, panelWidth, 520, 0x0e1d2e).setStrokeStyle(1, 0x29465e).setDepth(0);
    const label = this.add.text(controlsLeft, controlsTop, '추가할 부품', { fontFamily: 'Arial', fontSize: '12px', color: '#8fa8ba' });
    this.controls.push(panel, label);

    PARTS.forEach((part, index) => {
      const x = controlsLeft + buttonWidth / 2 + (index % 2) * (buttonWidth + columnGap);
      const y = controlsTop + 52 + Math.floor(index / 2) * 72;
      const button = this.add.rectangle(x, y, buttonWidth, 58, 0x13263b).setStrokeStyle(2, part.color).setInteractive({ useHandCursor: true });
      button.setData('part', part.type);
      button.on('pointerdown', () => this.selectGenerator(part.type));
      const text = this.add.text(x, y, `${part.name}\n${part.short} · ${part.shape.length}칸`, { align: 'center', fontFamily: 'Arial', fontSize: '12px', color: '#e8f1f7', fontStyle: 'bold', lineSpacing: 4 }).setOrigin(0.5);
      this.controls.push(button, text);
    });

    const modeGuide = this.mode === 'order'
      ? '주문에서 다음으로 필요한 부품이 자동 선택됩니다.\n배치된 부품은 선택·이동·회전·머지할 수 있습니다.'
      : this.mode === 'guided'
        ? '원하는 부품을 선택하고 같은 버튼을 다시 눌러 회전합니다.\n아래 주문 가이드로 필요한 목표를 확인합니다.'
        : '부품 버튼을 다시 누르면 90° 회전합니다.\n보드 위에서 배치 모양을 미리 확인하고,\n같은 부품 위에 놓으면 바로 머지됩니다.\n배치된 부품은 선택 후 이동·회전할 수 있습니다.';
    const guide = this.add.text(controlsLeft, controlsTop + 210, modeGuide, { fontFamily: 'Arial', fontSize: '11px', color: '#71899c', lineSpacing: 6, wordWrap: { width: panelWidth - panelPadding * 2 } });
    this.controls.push(guide);

    const previewTop = controlsTop + 340;
    const previewLabel = this.add.text(controlsLeft, previewTop, '선택 부품 미리보기', { fontFamily: 'Arial', fontSize: '12px', color: '#8fa8ba', fontStyle: 'bold' });
    const previewPanel = this.add.rectangle(panelLeft + panelWidth / 2, previewTop + 76, panelWidth - panelPadding * 2, 118, 0x0b1929).setStrokeStyle(1, 0x29465e);
    this.controls.push(previewLabel, previewPanel);

    PARTS.forEach((part) => {
      const previewCell = 25;
      [0, 1, 2, 3].forEach((rotation) => {
        const previewShape = this.shape(part.type, rotation);
        const maxX = Math.max(...previewShape.map((point) => point.x));
        const maxY = Math.max(...previewShape.map((point) => point.y));
        const shapeWidth = (maxX + 1) * previewCell;
        const shapeHeight = (maxY + 1) * previewCell;
        const preview = this.add.container(
          panelLeft + panelWidth / 2,
          previewTop + 66,
        ).setData('previewPart', part.type).setData('previewRotation', rotation);
        const blocks = previewShape.map((point) => this.add.rectangle(
          point.x * previewCell - shapeWidth / 2 + previewCell / 2,
          point.y * previewCell - shapeHeight / 2 + previewCell / 2,
          previewCell - 3,
          previewCell - 3,
          part.color,
        ).setStrokeStyle(1, 0x07111f));
        const caption = this.add.text(0, 42, `${part.name} · ${part.shape.length}칸 · ${rotation * 90}°`, {
          fontFamily: 'Arial', fontSize: '10px', color: '#bfd0dc', align: 'center',
        }).setOrigin(0.5);
        preview.add([...blocks, caption]);
        this.controls.push(preview);
      });
    });
    this.refreshControls();
  }

  private handleCell(row: number, column: number) {
    this.actions += 1;
    this.clearPlacementGhost();
    const clicked = this.pieceAt(row, column);
    if (clicked && this.generatorPlacementActive && !this.selectedPiece && clicked.type === this.selectedGenerator && clicked.level === 1) {
      this.mergeGeneratedPiece(clicked);
      return;
    }
    if (clicked) {
      if (!this.selectedPiece) {
        this.selectedPiece = clicked;
        this.generatorPlacementActive = false;
        this.refreshControls();
        this.refreshUi(`${this.partName(clicked.type)} Lv.${clicked.level} 선택 · 빈 칸으로 이동하거나 같은 부품에 머지하세요.`);
        return;
      }
      if (clicked.id === this.selectedPiece.id) { this.rotateSelected(); return; }
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

    if (this.mode === 'free' && !this.generatorPlacementActive) {
      this.refreshUi('먼저 오른쪽에서 추가할 부품을 선택하세요.');
      return;
    }
    const type = this.mode === 'order' ? this.recommendedPart() : this.selectedGenerator;
    const placementRotation = this.mode === 'free' ? this.generatorRotation : (this.findPlacementRotation(type, row, column) ?? 0);
    if (!this.canPlace(type, row, column, placementRotation)) {
      this.mistakes += 1;
      this.refreshUi('미리보기 방향으로 배치할 공간이 부족합니다. 부품 버튼을 다시 눌러 회전하거나 다른 위치를 선택하세요.');
      return;
    }
    const piece = this.makePiece(type, row, column, placementRotation, 1);
    this.pieces.push(piece);
    this.generatorPlacementActive = false;
    const rotationMessage = placementRotation === 0 ? '' : ` · ${placementRotation * 90}° 회전`;
    this.refreshUi(`${this.partName(type)} Lv.1을 ${this.shape(type, placementRotation).length}칸 크기로 배치했습니다${rotationMessage}.`);
  }

  private selectGenerator(type: PartType) {
    const repeated = this.selectedGenerator === type && !this.selectedPiece;
    this.selectedGenerator = type;
    this.selectedPiece = undefined;
    this.generatorPlacementActive = true;
    this.generatorRotation = repeated ? (this.generatorRotation + 1) % 4 : 0;
    this.clearPlacementGhost();
    this.refreshControls();
    const part = PARTS.find((item) => item.type === type)!;
    this.refreshUi(`${part.name} ${this.generatorRotation * 90}° 선택 · 보드 위에서 배치 모양을 확인하세요. 같은 부품 위에 놓으면 바로 머지됩니다.`);
  }

  private showPlacementGhost(row: number, column: number) {
    this.clearPlacementGhost();
    if (this.selectedPiece || !this.generatorPlacementActive) return;
    const clicked = this.pieceAt(row, column);
    const mergeTarget = clicked?.type === this.selectedGenerator && clicked.level === 1 ? clicked : undefined;
    const rotation = mergeTarget?.rotation ?? this.generatorRotation;
    const anchorRow = mergeTarget?.row ?? row;
    const anchorColumn = mergeTarget?.column ?? column;
    const canMerge = Boolean(mergeTarget);
    const valid = canMerge || (!clicked && this.canPlace(this.selectedGenerator, anchorRow, anchorColumn, rotation));
    const part = PARTS.find((item) => item.type === this.selectedGenerator)!;
    const color = valid ? part.color : 0xff5d73;
    const blocks = this.shape(this.selectedGenerator, rotation).map((point) => this.add.rectangle(
      point.x * this.cellSize,
      point.y * this.cellSize,
      this.cellSize - this.gap * 2,
      this.cellSize - this.gap * 2,
      color,
      canMerge ? 0.48 : 0.3,
    ).setStrokeStyle(2, valid ? 0xffffff : 0xffa0ad, 0.85));
    const origin = this.cellCenter(anchorRow, anchorColumn);
    this.placementGhost = this.add.container(origin.x, origin.y, blocks).setDepth(4);
  }

  private clearPlacementGhost() {
    this.placementGhost?.destroy(true);
    this.placementGhost = undefined;
  }

  private mergeGeneratedPiece(target: Piece) {
    target.item.destroy(true);
    this.pieces = this.pieces.filter((piece) => piece.id !== target.id);
    const merged = this.makePiece(target.type, target.row, target.column, target.rotation, 2);
    this.pieces.push(merged);
    this.generatorPlacementActive = false;
    this.merges += 1;
    this.refreshControls();
    this.refreshUi(`${this.partName(target.type)} Lv.1을 같은 위치에 놓아 Lv.2로 머지했습니다.`);
  }

  private makePiece(type: PartType, row: number, column: number, rotation: number, level: number) {
    const part = PARTS.find((item) => item.type === type)!;
    const cells = this.shape(type, rotation);
    const blocks = cells.map((point) => this.add.rectangle(point.x * this.cellSize, point.y * this.cellSize, this.cellSize - this.gap * 2, this.cellSize - this.gap * 2, part.color).setStrokeStyle(2, 0x07111f));
    const center = cells.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
    center.x /= cells.length;
    center.y /= cells.length;
    const badgeCell = cells.reduce((closest, point) => {
      const distance = (point.x - center.x) ** 2 + (point.y - center.y) ** 2;
      const closestDistance = (closest.x - center.x) ** 2 + (closest.y - center.y) ** 2;
      return distance < closestDistance ? point : closest;
    });
    const badgeX = badgeCell.x * this.cellSize;
    const badgeY = badgeCell.y * this.cellSize;
    const badgeWidth = Math.max(24, Math.min(52, this.cellSize - this.gap * 4));
    const badgeHeight = Math.max(18, Math.min(28, this.cellSize - this.gap * 4, this.cellSize * 0.48));
    const badge = this.add.rectangle(badgeX, badgeY, badgeWidth, badgeHeight, 0x07111f, 0.9).setStrokeStyle(1, 0xffffff, 0.7);
    const tag = this.add.text(badgeX, badgeY, `Lv.${level}`, { align: 'center', fontFamily: 'Arial', fontSize: `${Math.max(10, Math.min(15, badgeHeight * 0.58))}px`, color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    const item = this.add.container(0, 0, [...blocks, badge, tag]).setDepth(2);
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
    old.item.destroy(true);
    const replacement = this.makePiece(old.type, old.row, old.column, next, old.level);
    replacement.id = old.id;
    this.pieces[this.pieces.findIndex((piece) => piece.id === old.id)] = replacement;
    this.selectedPiece = replacement;
    this.refreshControls();
    this.refreshUi(`${this.partName(replacement.type)}을 90° 회전했습니다.`);
  }

  private mergePieces(source: Piece, target: Piece) {
    source.item.destroy(true);
    target.item.destroy(true);
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

  private findPlacementRotation(type: PartType, row: number, column: number) {
    return [0, 1, 2, 3].find((rotation) => this.canPlace(type, row, column, rotation));
  }

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
      .forEach((button) => button.setFillStyle(button.getData('part') === this.selectedGenerator && !this.selectedPiece && this.generatorPlacementActive ? 0x21445a : 0x13263b));
    this.controls.filter((object): object is Phaser.GameObjects.Container => object instanceof Phaser.GameObjects.Container && Boolean(object.getData('previewPart')))
      .forEach((preview) => preview.setVisible(preview.getData('previewPart') === this.selectedGenerator && preview.getData('previewRotation') === this.generatorRotation));
    this.pieces.forEach((piece) => piece.item.setScale(piece.id === this.selectedPiece?.id ? 1.06 : 1));
  }

  private refreshUi(message: string) {
    this.info.setText(message);
    if (this.mode === 'guided') this.checkDelivery();
    this.refreshOrder();
    this.refreshMetrics();
  }

  private checkDelivery() {
    this.goals.forEach((goal) => {
      if (goal.delivered) return;
      const match = this.pieces.find((piece) => piece.type === goal.type && piece.level >= goal.level);
      if (!match) return;
      goal.delivered = true;
      match.item.destroy(true);
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
      this.orderText.setText(`CUSTOMER ORDER ${this.orderIndex + 1}/3  ·  어반 로드 자전거  ·  완성 ${completed}/4`);
      this.goals.forEach((goal) => {
        const slot = this.goalSlots.get(goal.type);
        if (!slot) return;
        const part = PARTS.find((item) => item.type === goal.type)!;
        slot.panel.setFillStyle(goal.delivered ? part.color : 0x0b1929, goal.delivered ? 0.28 : 1);
        slot.panel.setStrokeStyle(goal.delivered ? 2 : 1, part.color, goal.delivered ? 1 : 0.65);
        const levels = this.orderParts.get(goal.type) ?? [];
        slot.label.setText(`${goal.delivered ? '✓ 완성' : part.name}  ·  목표 Lv.${goal.level}`).setColor(goal.delivered ? '#ffffff' : '#dce9f2');
        const display = this.orderPartDisplays.get(goal.type);
        if (display) {
          display.removeAll(true);
          if (levels.length === 0) {
            display.add(this.add.text(0, 0, '부품을 추가해 주세요', { fontFamily: 'Arial', fontSize: '11px', color: '#536b80' }));
          } else {
            levels.slice(0, 5).forEach((level, index) => {
              const complete = level >= goal.level;
              const chip = this.add.rectangle(index * 52 + 20, 12, 44, 28, part.color, complete ? 0.9 : 0.28).setStrokeStyle(1, part.color);
              const text = this.add.text(index * 52 + 20, 12, `Lv.${level}`, { fontFamily: 'Arial', fontSize: '10px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
              display.add([chip, text]);
            });
          }
        }
      });
      if (completed === this.goals.length) this.info.setText('커스텀 주문의 모든 부품이 완성되었습니다. 완성 상태와 부품 구성을 확인하세요.');
      return;
    }
    this.orderText.setText(`주문 ${this.orderIndex + 1}/3   ${this.goals.map((goal) => `${goal.delivered ? '✓' : '○'} ${this.partName(goal.type)} L${goal.level}`).join('   ')}`);
  }

  private drawOrderBike() {
    if (!this.orderBike) return;
    const g = this.orderBike.clear();
    g.lineStyle(5, 0xffb35c, 1).strokeCircle(226, 322, 43).strokeCircle(538, 322, 43);
    g.lineStyle(7, 0x55d6be, 1).strokeTriangle(248, 316, 376, 234, 462, 316).lineBetween(248, 316, 462, 316).lineBetween(376, 234, 538, 322);
    g.lineStyle(5, 0xff7185, 1).strokeCircle(376, 308, 15).lineBetween(376, 308, 462, 316);
    g.lineStyle(5, 0x8c7bff, 1).lineBetween(492, 226, 538, 322).lineBetween(474, 226, 520, 226);
    g.fillStyle(0x55d6be).fillRect(344, 214, 68, 7);
  }

  private destroySceneObject(object: Phaser.GameObjects.GameObject) {
    if (object instanceof Phaser.GameObjects.Container) object.destroy(true);
    else object.destroy();
  }

  private refreshMetrics() {
    if (!this.metrics) return;
    const seconds = Math.floor((this.time.now - this.startedAt) / 1000);
    if (this.mode === 'order') {
      this.metrics.setText(`${seconds}s · 클릭 ${this.actions} · 자동 머지 ${this.merges} · 완성 ${this.goals.filter((goal) => goal.delivered).length}/4`);
      return;
    }
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
    width: 1120,
    height: 720,
    backgroundColor: '#0b1727',
    scene: new MergePrototypeScene(mode),
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 2 },
  });
}
