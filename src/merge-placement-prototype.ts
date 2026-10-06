// 머지 코어 E v3: 일반 프로젝트 게임 화면(게임 화면 디자인 B안 · 390×810) 디자인 정렬
// 화면 구성과 시각 언어(작업대 헤더 → 주문 카드·픽셀 자전거 → 나무 6×7 보드 → 하단 선반)는
// game-screen-mobile.ts의 배치 수치·팔레트·부품 표현을 그대로 따르고,
// 규칙은 merge-placement-state(예정 칸 자동 입고·이동 금지·인접 2개 합성·연쇄 보너스)를 사용합니다.
import Phaser from 'phaser';
import { drawPixelBike, drawPixelPartIcon, makeWarmColorway, bikePartAnchorOffset, WARM_PART_COLORS } from './bike-pixel-sprite';
import { ReleaseAudio, type ReleaseSfxEvent } from './release-audio';
import {
  CAP, COLS, ROWS, SIZE, KINDS, PART_TYPES, RECOVERY, COMBO_FREE_BOX, COMBO_GUARANTEE,
  fresh, restore, recover, requirements, orderMeta, nextSlot, supply, supplyBlock, drop, undo, returnPart,
  canMerge, mergeTargets, type State, type Part, type ProgressEvent,
} from './merge-placement-state';
import { NONE, resolveTap, resolveDrop, type InputOutcome } from './merge-placement-input';
import './merge-placement.css';

/** 기존 E안 저장 키를 유지해 v1·v2 진행을 v3로 이전합니다. */
export const KEY = 'dbg-lab-merge-placement-e-v1';

// ── 게임 화면 B안과 같은 팔레트·글꼴 ──
const FONT = '"Arial Rounded MT Bold", "Noto Sans KR", sans-serif';
const INK = '#3b2531', MUTED = '#7b5140', CREAM_TEXT = '#fff1c6', SUCCESS = '#3f7851', PENDING = '#a16028', ALERT = '#a14a38', ERROR_TEXT = '#ffd7c9';
const CREAM = 0xfff1c6, GOLD = 0xf6d995, BORDER = 0x3b2531, BROWN = 0x8e5136, DARK_WOOD = 0x573044;
const CELL_FILL = 0xffe6a8, CELL_LINE = 0x9c5b3c, ARRIVED = 0xf4c86a, DONE_CHIP = 0xdff0d0, DISABLED = 0xe8d3a6;
const GREEN = 0x5e9a67, RED = 0xc95746, AMBER = 0xf4b84a;
const PART_COLORS = PART_TYPES.map(type => WARM_PART_COLORS[type]); // 부품 아이콘과 같은 대표색 단일 출처

// ── 게임 화면 B안과 같은 배치 수치 (보드 셀 52 = floor(min(368/6, 364/7))) ──
const CELL = 52, GAP = 4, BOARD_LEFT = 39, BOARD_TOP = 234;
const BIKE_X = 292, BIKE_Y = 132, BIKE_CELL = 2;
const SHELF_TOP = 668, ROW1_Y = 708, ROW2_Y = 762;
const BOX = { x: 136, y: ROW1_Y, w: 240, h: 48 };
const UNDO_BUTTON = { x: 290, y: ROW1_Y, w: 56, h: 48 }, RETURN_BUTTON = { x: 350, y: ROW1_Y, w: 56, h: 48 };
const BOX_ICON = { x: BOX.x - BOX.w / 2 + 26, y: ROW1_Y };
const RETURN_ARM_MS = 2500;

type Point = { x: number; y: number };
type Hooks = {
  load(): string | null;
  save(raw: string): boolean;
  onChange?(s: State): void;
  onMotion?(event: ProgressEvent): void;
};
type Drag = { from: number; x: number; y: number; dragging: boolean; hover: number; ghost?: Phaser.GameObjects.Container };
const textStyle = (size: number, color: string, bold = true): Phaser.Types.GameObjects.Text.TextStyle =>
  ({ fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' });

// 택배 상자 픽셀 아이콘 (부품 아이콘과 같은 잉크 외곽선 톤)
function drawBoxIcon(scene: Phaser.Scene, x: number, y: number, cell: number) {
  const g = scene.add.graphics();
  const px = (cx: number, cy: number, w: number, h: number, color: number) => g.fillStyle(color, 1).fillRect(x + cx * cell, y + cy * cell, w * cell, h * cell);
  px(-7, -5, 14, 11, BORDER); // 외곽선
  px(-6, -4, 12, 9, 0xd39a5c); // 상자 몸통
  px(-6, -4, 12, 3, 0xb7783f); // 윗면 덮개
  px(-1, -4, 2, 9, GOLD); // 테이프
  px(-5, 2, 3, 1, 0xfff1c6); // 송장 라벨
  return g;
}

class MergePlacementScene extends Phaser.Scene {
  s!: State;
  private selected = NONE;
  private accelerated = false;
  private accelTicks = 0;
  private reduced = false;
  private alive = false;
  private generation = 0;
  private queue: Promise<void> = Promise.resolve();
  private view = { order: 0, installed: [false, false, false, false], coins: 0 };
  private pieces = new Map<number, Phaser.GameObjects.Container>();
  private arriving = new Set<number>();
  private transients = new Set<Phaser.GameObjects.GameObject>();
  private drag?: Drag;
  private returnArmedUntil = 0;
  private readonly audio = new ReleaseAudio();
  private metrics!: Phaser.GameObjects.Text;
  private orderTitle!: Phaser.GameObjects.Text;
  private orderProgress!: Phaser.GameObjects.Text;
  private orderReward!: Phaser.GameObjects.Text;
  private chips: Array<{ panel: Phaser.GameObjects.Rectangle; status: Phaser.GameObjects.Text }> = [];
  private bike?: Phaser.GameObjects.Graphics;
  private nextMarker!: Phaser.GameObjects.Container;
  private highlight!: Phaser.GameObjects.Graphics;
  private dropHint!: Phaser.GameObjects.Graphics;
  private info!: Phaser.GameObjects.Text;
  private cancelButton!: Phaser.GameObjects.Rectangle;
  private cancelLabel!: Phaser.GameObjects.Text;
  private boxButton!: Phaser.GameObjects.Rectangle;
  private boxTitle!: Phaser.GameObjects.Text;
  private boxStatus!: Phaser.GameObjects.Text;
  private boxCost!: Phaser.GameObjects.Text;
  private undoButton!: Phaser.GameObjects.Rectangle;
  private undoLabel!: Phaser.GameObjects.Text;
  private returnButton!: Phaser.GameObjects.Rectangle;
  private returnLabel!: Phaser.GameObjects.Text;
  private energyText!: Phaser.GameObjects.Text;
  private energySub!: Phaser.GameObjects.Text;
  private energyFill!: Phaser.GameObjects.Rectangle;
  private comboText!: Phaser.GameObjects.Text;
  private comboDots: Phaser.GameObjects.Rectangle[] = [];
  private tokenText!: Phaser.GameObjects.Text;

  constructor(private readonly hooks: Hooks) { super('merge-placement-e-v3'); }

  create() {
    this.alive = true;
    this.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    this.audio.setEnabled(false, true); // 랩 체험은 효과음만 사용합니다.
    this.s = restore(this.hooks.load(), Date.now());
    this.syncView();
    this.cameras.main.setBackgroundColor('#c78452');
    this.drawBackdrop();
    this.drawHeader();
    this.drawOrderCard();
    this.drawBoard();
    this.drawShelf();
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('gameout', this.cancelDrag, this);
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tick() });
    this.events.once('shutdown', () => this.shutdown());
    this.events.once('destroy', () => this.shutdown());
    const saved = this.persist();
    this.renderAll();
    this.setInfo(saved
      ? '점선 칸이 다음 입고 자리예요. 상하좌우로 맞닿은 같은 부품을 눌러 합성하세요.'
      : '저장할 수 없어 이 화면에서만 진행돼요. 점선 칸이 다음 입고 자리예요.');
    this.hooks.onChange?.(this.s);
  }

  // ── 랩 도구 · 생명주기 ──
  labCharge() {
    if (!this.alive) return;
    this.s.energy = CAP; this.s.anchor = Date.now();
    this.persist(); this.renderShelf(); this.setInfo('테스트용 체력을 충전했어요.');
    this.hooks.onChange?.(this.s);
  }
  labSetAccelerated(on: boolean) {
    this.accelerated = on; this.accelTicks = 0;
    if (this.alive) this.renderShelf();
  }
  labReset() {
    if (!this.alive) return;
    this.resetQueue();
    this.s = fresh(Date.now());
    this.selected = NONE; this.syncView(); this.persist(); this.renderAll();
    this.setInfo('E안 첫 주문을 시작합니다. 점선 칸이 다음 입고 자리예요.');
    this.hooks.onChange?.(this.s);
  }
  flush() {
    if (!this.alive) return;
    this.cancelDrag();
    recover(this.s, Date.now());
    this.persist();
  }
  private shutdown() {
    if (!this.alive) return;
    this.alive = false;
    this.audio.destroy();
    this.transients.clear();
  }

  // ── 정적 화면 (게임 화면 B안과 같은 구성) ──
  private drawBackdrop() {
    this.add.rectangle(195, 300, 390, 600, 0xc78452).setDepth(0);
    this.add.rectangle(195, 705, 390, 210, 0xa9683f).setDepth(0);
    for (let y = 626; y < 810; y += 26) this.add.rectangle(195, y, 390, 2, 0x8a5231, 0.5).setDepth(0);
    for (let x = 24; x < 390; x += 52) this.add.rectangle(x, 300, 2, 600, 0xb37246, 0.35).setDepth(0);
  }

  private drawHeader() {
    this.add.rectangle(195, 30, 390, 60, CREAM).setStrokeStyle(4, BORDER).setDepth(8);
    this.add.rectangle(56, 30, 76, 24, RED).setStrokeStyle(2, BORDER).setDepth(9);
    this.add.text(56, 30, 'WORK', textStyle(11, CREAM_TEXT)).setOrigin(0.5).setDepth(10);
    this.add.text(104, 22, '두리 자전거 공방 · 작업대', textStyle(13, INK)).setDepth(10);
    this.metrics = this.add.text(382, 39, '', textStyle(10, MUTED, false)).setOrigin(1, 0.5).setDepth(10);
  }

  private drawOrderCard() {
    this.add.rectangle(195, 138, 374, 140, CREAM).setStrokeStyle(4, BROWN).setDepth(2);
    this.add.rectangle(64, 78, 88, 22, RED).setStrokeStyle(2, BORDER).setDepth(3);
    this.add.text(64, 78, 'NEW ORDER', textStyle(9, CREAM_TEXT)).setOrigin(0.5).setDepth(4);
    this.orderTitle = this.add.text(20, 94, '', textStyle(15, INK)).setDepth(4);
    this.orderProgress = this.add.text(20, 117, '', textStyle(10, MUTED)).setDepth(4);
    this.orderReward = this.add.text(BIKE_X, 186, '', textStyle(10, PENDING)).setOrigin(0.5).setDepth(4);
    PART_TYPES.forEach((type, kind) => {
      const x = 42 + kind * 46, y = 168;
      const panel = this.add.rectangle(x, y, 42, 40, GOLD).setStrokeStyle(2, PART_COLORS[kind]).setDepth(3);
      // 칩 위쪽은 부품 픽셀 아이콘, 아래쪽은 요구 레벨 또는 장착 완료 표시
      drawPixelPartIcon(this, x, y - 9, 1.5, type, { depth: 4 });
      const status = this.add.text(x, y + 11, '', textStyle(9, MUTED)).setOrigin(0.5).setDepth(4);
      this.chips.push({ panel, status });
    });
  }

  private drawBoard() {
    const width = COLS * CELL, height = ROWS * CELL;
    this.add.rectangle(BOARD_LEFT + width / 2, BOARD_TOP + height / 2, width + 16, height + 16, BROWN).setStrokeStyle(5, BORDER).setDepth(0);
    for (let index = 0; index < SIZE; index++) {
      const { x, y } = this.cellCenter(index);
      this.add.rectangle(x, y, CELL - GAP, CELL - GAP, CELL_FILL).setStrokeStyle(2, CELL_LINE).setDepth(1)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onDown(index, pointer));
    }
    // 다음 입고 칸: 점선 테두리 + 상자 아이콘 (상자를 열면 이 칸에 부품이 들어옵니다)
    const dashes = this.add.graphics();
    dashes.fillStyle(BROWN, 1);
    for (let t = -20; t < 20; t += 8) {
      dashes.fillRect(t, -21, 5, 3).fillRect(t, 18, 5, 3).fillRect(-21, t, 3, 5).fillRect(18, t, 3, 5);
    }
    const label = this.add.text(0, 12, '다음 입고', textStyle(8, MUTED)).setOrigin(0.5);
    this.nextMarker = this.add.container(0, 0, [dashes, drawBoxIcon(this, 0, -6, 1.5), label]).setDepth(3);
    if (!this.reduced) this.tweens.add({ targets: this.nextMarker, alpha: { from: 1, to: 0.45 }, duration: 700, yoyo: true, repeat: -1 });
    this.highlight = this.add.graphics().setDepth(5);
    this.dropHint = this.add.graphics().setDepth(6);
    this.info = this.add.text(12, BOARD_TOP + height + 12, '', { ...textStyle(10, CREAM_TEXT, false), wordWrap: { width: 270 }, lineSpacing: 3 }).setDepth(10);
    const cancelY = BOARD_TOP + height + 38;
    this.cancelButton = this.add.rectangle(334, cancelY, 104, 44, BROWN).setStrokeStyle(2, CREAM).setDepth(10)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.deselect());
    this.cancelLabel = this.add.text(334, cancelY, '× 선택 취소', textStyle(10, CREAM_TEXT)).setOrigin(0.5).setDepth(11);
  }

  private drawShelf() {
    // 게임 화면 B안의 '택배 선반' 자리와 크기를 그대로 쓰고, 4종 택배 대신 E안의 부품 상자 하나를 둡니다.
    this.add.rectangle(195, SHELF_TOP + 66, 374, 136, CREAM).setStrokeStyle(4, BORDER).setDepth(2);
    this.add.rectangle(96, SHELF_TOP, 152, 22, BROWN).setDepth(3);
    this.add.text(28, SHELF_TOP - 7, '부품 상자 · PARTS BOX', textStyle(10, CREAM_TEXT)).setDepth(4);
    this.add.rectangle(282, SHELF_TOP, 200, 22, BROWN).setStrokeStyle(2, BORDER).setDepth(3);
    this.add.text(282, SHELF_TOP, `${COMBO_FREE_BOX}연쇄 무료 상자 · ${COMBO_GUARANTEE}연쇄 필수 부품`, textStyle(9, CREAM_TEXT)).setOrigin(0.5).setDepth(4);

    this.boxButton = this.add.rectangle(BOX.x, BOX.y, BOX.w, BOX.h, GOLD).setStrokeStyle(3, BROWN).setDepth(3)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.onSupply());
    drawBoxIcon(this, BOX_ICON.x, BOX_ICON.y, 2).setDepth(4);
    this.boxTitle = this.add.text(BOX.x - BOX.w / 2 + 48, BOX.y - 17, '부품 상자 열기', textStyle(12, INK)).setDepth(4);
    this.boxStatus = this.add.text(BOX.x - BOX.w / 2 + 48, BOX.y + 2, '', textStyle(9, MUTED, false)).setDepth(4);
    this.boxCost = this.add.text(BOX.x + BOX.w / 2 - 8, BOX.y - 17, '', textStyle(9, ALERT)).setOrigin(1, 0).setDepth(4);
    [this.undoButton, this.undoLabel] = this.smallButton(UNDO_BUTTON, '↶\n되돌리기', () => this.onUndo());
    [this.returnButton, this.returnLabel] = this.smallButton(RETURN_BUTTON, '↗\n반품', () => this.onReturn());

    // 2행: 알바 체력(상자 비용)과 연쇄 합성 진행
    this.add.rectangle(104, ROW2_Y, 172, 48, GOLD).setStrokeStyle(2, BROWN).setDepth(3);
    this.energyText = this.add.text(24, ROW2_Y - 18, '', textStyle(11, INK)).setDepth(4);
    this.energySub = this.add.text(24, ROW2_Y - 1, '', textStyle(9, MUTED, false)).setDepth(4);
    this.add.rectangle(24, ROW2_Y + 16, 160, 5, DARK_WOOD).setOrigin(0, 0.5).setDepth(4);
    this.energyFill = this.add.rectangle(24, ROW2_Y + 16, 160, 5, GREEN).setOrigin(0, 0.5).setDepth(5);
    this.add.rectangle(286, ROW2_Y, 172, 48, GOLD).setStrokeStyle(2, BROWN).setDepth(3);
    this.comboText = this.add.text(206, ROW2_Y - 18, '', textStyle(11, INK)).setDepth(4);
    for (let i = 0; i < COMBO_GUARANTEE; i++) {
      const milestone = i === COMBO_FREE_BOX - 1 || i === COMBO_GUARANTEE - 1;
      this.comboDots.push(this.add.rectangle(306 + i * 14, ROW2_Y - 11, milestone ? 11 : 9, milestone ? 11 : 9, CREAM).setStrokeStyle(2, BORDER).setDepth(4));
    }
    this.tokenText = this.add.text(206, ROW2_Y + 3, '', textStyle(9, MUTED)).setDepth(4);
  }

  private smallButton(rect: { x: number; y: number; w: number; h: number }, label: string, handler: () => void): [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Text] {
    const button = this.add.rectangle(rect.x, rect.y, rect.w, rect.h, BROWN).setStrokeStyle(2, BORDER).setDepth(3)
      .setInteractive({ useHandCursor: true }).on('pointerdown', handler);
    const text = this.add.text(rect.x, rect.y, label, { ...textStyle(9, CREAM_TEXT), align: 'center', lineSpacing: 2 }).setOrigin(0.5).setDepth(4);
    return [button, text];
  }

  // ── 동적 표시 ──
  private renderAll() { this.renderBoard(); this.renderOrder(); this.renderHeader(); this.renderShelf(); }

  private makePiece(part: Part, at: Point) {
    // 게임 화면 B안의 부품 블록과 같은 표현: 대표색 블록 + 픽셀 아이콘 + Lv 배지
    const block = this.add.rectangle(0, 0, CELL - GAP * 2, CELL - GAP * 2, PART_COLORS[part.kind]).setStrokeStyle(3, BORDER);
    const icon = drawPixelPartIcon(this, 0, -8, 2, PART_TYPES[part.kind], { level: part.level });
    const badge = this.add.rectangle(0, 14, 32, 18, CREAM, 0.94).setStrokeStyle(2, BORDER, 0.8);
    const tag = this.add.text(0, 14, `Lv.${part.level}`, textStyle(10, INK)).setOrigin(0.5);
    return this.add.container(at.x, at.y, [block, icon, badge, tag]).setDepth(2);
  }

  private renderBoard() {
    this.pieces.forEach(piece => piece.destroy(true));
    this.pieces.clear();
    this.s.board.forEach((part, index) => {
      if (!part) return;
      const piece = this.makePiece(part, this.cellCenter(index));
      if (this.arriving.has(index)) piece.setAlpha(0);
      this.pieces.set(index, piece);
    });
    const slot = nextSlot(this.s);
    this.nextMarker.setVisible(slot >= 0);
    if (slot >= 0) this.nextMarker.setPosition(this.cellCenter(slot).x, this.cellCenter(slot).y);
    this.renderHighlights();
  }

  private renderHighlights() {
    this.highlight.clear();
    const active = this.selected !== NONE && !!this.s.board[this.selected];
    this.pieces.forEach((piece, index) => piece.setScale(active && index === this.selected ? 1.06 : 1));
    this.cancelButton.setVisible(active);
    this.cancelLabel.setVisible(active);
    if (!active) return;
    const center = this.cellCenter(this.selected);
    this.highlight.lineStyle(3, CREAM, 1).strokeRect(center.x - 26, center.y - 26, 52, 52);
    for (const target of mergeTargets(this.s, this.selected)) {
      const at = this.cellCenter(target);
      this.highlight.fillStyle(GREEN, 0.2).fillRect(at.x - 22, at.y - 22, 44, 44);
      this.highlight.lineStyle(4, GREEN, 1).strokeRect(at.x - 24, at.y - 24, 48, 48);
    }
  }

  private renderOrder() {
    const meta = orderMeta(this.view.order), req = requirements({ order: this.view.order });
    const installed = this.view.installed.filter(Boolean).length;
    this.orderTitle.setText(meta.name);
    this.orderProgress.setText(`장착 ${installed}/4 · 완성 즉시 자동 장착`);
    this.orderReward.setText(`납품 보상 ${meta.reward.toLocaleString()} C`);
    this.chips.forEach((chip, kind) => {
      const done = this.view.installed[kind];
      chip.status.setText(done ? '✓' : `Lv.${req[kind]}`).setColor(done ? SUCCESS : MUTED);
      chip.panel.setFillStyle(done ? DONE_CHIP : GOLD);
      chip.panel.setStrokeStyle(done ? 2 : 3, PART_COLORS[kind], done ? 0.5 : 1);
    });
    const alpha = (kind: number) => (this.view.installed[kind] ? 1 : 0.5);
    this.bike?.destroy();
    this.bike = drawPixelBike(this, BIKE_X, BIKE_Y, BIKE_CELL, {
      category: meta.bikeCategory,
      colorway: makeWarmColorway(RED),
      depth: 4,
      partAlpha: { frame: alpha(0), wheel: alpha(1), drivetrain: alpha(2), handlebar: alpha(3) },
    });
  }

  private renderHeader() {
    this.metrics.setText(`급여 ${this.view.coins.toLocaleString()} C · 머지 ${this.s.merges}`);
  }

  private renderShelf() {
    const block = supplyBlock(this.s);
    const free = this.s.freeBoxes > 0, sure = this.s.guarantees > 0;
    this.boxButton.setFillStyle(block ? DISABLED : free ? ARRIVED : GOLD).setStrokeStyle(3, block ? 0xb08a6a : BROWN);
    this.boxTitle.setColor(block ? MUTED : INK);
    this.boxStatus.setText(block === 'full'
      ? '작업대가 가득 찼어요 · 반품으로 자리 확보'
      : block === 'energy'
        ? `체력 회복 중 · 다음 +1 ${this.recoveryLabel()}`
        : `${free ? '무료 상자 · 체력 소모 없음' : '점선 칸에 자동 배치'}${sure ? ' · 필수 부품 확정' : ''}`)
      .setColor(block ? ALERT : free || sure ? SUCCESS : MUTED);
    this.boxCost.setText(free ? `무료 ×${this.s.freeBoxes}` : '⚡ −1').setColor(free ? SUCCESS : ALERT);
    const canUndo = Boolean(this.s.undo);
    this.undoButton.setAlpha(canUndo ? 1 : 0.45);
    this.undoLabel.setAlpha(canUndo ? 1 : 0.6);
    const canReturn = this.selected !== NONE && !!this.s.board[this.selected];
    const armed = canReturn && this.time.now < this.returnArmedUntil;
    this.returnButton.setFillStyle(armed ? RED : BROWN).setAlpha(canReturn ? 1 : 0.45);
    this.returnLabel.setText(armed ? '한 번 더\n눌러 반품' : '↗\n반품').setAlpha(canReturn ? 1 : 0.6);
    this.energyText.setText(`⚡ 알바 체력 ${this.s.energy}/${CAP}`);
    this.energySub.setText(this.s.energy >= CAP ? '가득 참' : this.accelerated ? '랩 가속 · 10초마다 +1' : `다음 +1 ${this.recoveryLabel()}`);
    this.energyFill.setScale(this.s.energy / CAP, 1);
    this.comboText.setText(`연쇄 합성 ${this.s.combo}`);
    this.comboDots.forEach((dot, i) => dot.setFillStyle(i < this.s.combo ? (i < COMBO_FREE_BOX ? GREEN : AMBER) : CREAM));
    this.tokenText.setText(`무료 상자 ${this.s.freeBoxes} · 확정 ${this.s.guarantees}`);
  }

  private recoveryLabel() {
    const remaining = Math.max(0, Math.ceil((RECOVERY - (Date.now() - this.s.anchor)) / 1000));
    return `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  }

  private setInfo(message: string, tone: 'info' | 'error' = 'info') {
    this.info.setText(message).setColor(tone === 'error' ? ERROR_TEXT : CREAM_TEXT);
  }

  // ── 입력: 탭 선택 → 대상 탭 (게임 화면 B안과 동일), 드래그 놓기도 같은 규칙 ──
  private onDown(index: number, pointer: Phaser.Input.Pointer) {
    if (this.drag) return;
    this.drag = { from: index, x: pointer.x, y: pointer.y, dragging: false, hover: NONE };
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    const drag = this.drag;
    if (!drag || !pointer.isDown || !this.s.board[drag.from]) return;
    if (!drag.dragging) {
      if (Phaser.Math.Distance.Between(drag.x, drag.y, pointer.x, pointer.y) < 8) return;
      drag.dragging = true;
      drag.ghost = this.makePiece(this.s.board[drag.from]!, { x: pointer.x, y: pointer.y }).setDepth(40).setScale(1.1).setAlpha(0.92);
      this.pieces.get(drag.from)?.setAlpha(0.35);
    }
    drag.ghost?.setPosition(pointer.x, pointer.y - 10);
    const over = this.cellAt(pointer.x, pointer.y);
    if (over === drag.hover) return;
    drag.hover = over;
    this.dropHint.clear();
    if (over === NONE || over === drag.from) return;
    const at = this.cellCenter(over);
    this.dropHint.lineStyle(4, canMerge(this.s, drag.from, over) ? GREEN : RED, 1).strokeRect(at.x - 24, at.y - 24, 48, 48);
  }

  private onUp(pointer: Phaser.Input.Pointer) {
    const drag = this.drag;
    if (!drag) return;
    this.clearDrag(drag);
    this.apply(drag.dragging
      ? resolveDrop(this.s, drag.from, this.cellAt(pointer.x, pointer.y))
      : resolveTap(this.s, this.selected, drag.from));
  }

  private cancelDrag() { if (this.drag) this.clearDrag(this.drag); }
  private clearDrag(drag: Drag) {
    this.drag = undefined;
    this.dropHint.clear();
    drag.ghost?.destroy(true);
    this.pieces.get(drag.from)?.setAlpha(this.arriving.has(drag.from) ? 0 : 1);
  }

  private apply(outcome: InputOutcome) {
    if (outcome.merge) { this.performMerge(outcome.merge.from, outcome.merge.to); return; }
    this.selected = outcome.selected;
    this.returnArmedUntil = 0;
    this.setInfo(outcome.message, outcome.tone);
    this.sfx(outcome.tone === 'error' ? 'error' : 'tap');
    this.renderHighlights();
    this.renderShelf();
  }

  private deselect() {
    this.selected = NONE;
    this.returnArmedUntil = 0;
    this.setInfo('선택을 취소했어요.');
    this.sfx('tap');
    this.renderHighlights();
    this.renderShelf();
  }

  // ── 행동 ──
  private onSupply() {
    this.cancelDrag();
    recover(this.s, Date.now());
    const block = supplyBlock(this.s);
    if (block) {
      this.setInfo(block === 'full'
        ? '작업대에 빈칸이 없어요. 합성하거나 부품을 반품해 자리를 만드세요.'
        : '알바 체력이 부족해요. 회복을 기다리거나 연쇄 합성으로 무료 상자를 모아 보세요.', 'error');
      this.sfx('error');
      this.renderShelf();
      return;
    }
    const result = supply(this.s, Date.now(), Math.random);
    if (!result) return;
    if (this.selected !== NONE && !this.s.board[this.selected]) this.selected = NONE;
    this.commit(result.events);
  }

  private performMerge(from: number, to: number) {
    const result = drop(this.s, from, to);
    if (!result) return;
    this.selected = NONE;
    this.commit(result.events);
  }

  private onUndo() {
    this.cancelDrag();
    if (!undo(this.s)) {
      this.setInfo('되돌릴 행동이 없어요. 새 상자를 열면 되돌리기 기록이 지워져요.', 'error');
      this.sfx('error');
      return;
    }
    this.resetQueue();
    this.selected = NONE; this.returnArmedUntil = 0;
    this.syncView(); this.persist(); this.renderAll();
    this.setInfo('직전 행동을 되돌렸어요. 자동 장착·납품·연쇄 보너스도 함께 되돌아가요.');
    this.sfx('tap');
    this.hooks.onChange?.(this.s);
  }

  private onReturn() {
    this.cancelDrag();
    const part = this.selected === NONE ? null : this.s.board[this.selected];
    if (!part) {
      this.setInfo('반품할 부품을 먼저 눌러 선택하세요.', 'error');
      this.sfx('error');
      return;
    }
    if (this.time.now >= this.returnArmedUntil) {
      this.returnArmedUntil = this.time.now + RETURN_ARM_MS;
      this.setInfo('한 번 더 누르면 선택한 부품을 반품해요. 체력은 돌아오지 않아요.');
      this.sfx('tap');
      this.renderShelf();
      this.time.delayedCall(RETURN_ARM_MS + 50, () => { if (this.alive) this.renderShelf(); });
      return;
    }
    returnPart(this.s, this.selected);
    this.selected = NONE; this.returnArmedUntil = 0;
    this.persist(); this.renderBoard(); this.renderShelf();
    this.setInfo(`${KINDS[part.kind]} Lv.${part.level} 반품 완료 · ↶ 되돌리기로 복구할 수 있어요.`);
    this.sfx('tap');
    this.hooks.onChange?.(this.s);
  }

  private commit(events: ProgressEvent[]) {
    this.returnArmedUntil = 0;
    this.persist();
    this.arriving = new Set(events.flatMap(event => (event.type === 'placed' && this.s.board[event.index] ? [event.index] : [])));
    this.renderBoard();
    this.renderHeader();
    this.renderShelf();
    this.setInfo(this.describe(events));
    this.enqueue(events);
    this.hooks.onChange?.(this.s);
  }

  private describe(events: ProgressEvent[]) {
    const delivered = events.filter(event => event.type === 'delivered');
    if (delivered.length > 0) {
      const total = delivered.reduce((sum, event) => sum + event.reward, 0);
      return `${delivered.map(event => event.name).join(' · ')} 납품 완료! 급여 +${total.toLocaleString()} C`;
    }
    const bonus = events.find(event => event.type === 'bonus');
    if (bonus) return bonus.bonus === 'free-box'
      ? `${COMBO_FREE_BOX}연쇄! 다음 상자는 체력 없이 열려요.`
      : `${COMBO_GUARANTEE}연쇄! 다음 상자에서 필요한 부품이 확정으로 나와요.`;
    const installed = events.filter(event => event.type === 'installed');
    if (installed.length > 0) return `${installed.map(event => KINDS[event.kind]).join('·')} 완성 · 자전거에 바로 장착했어요.`;
    const merged = events.find(event => event.type === 'merged');
    if (merged) return merged.combo >= 2
      ? `${KINDS[merged.part.kind]} Lv.${merged.part.level} 합성 · ${merged.combo}연쇄 중! 상자를 열면 연쇄가 끊겨요.`
      : `${KINDS[merged.part.kind]} Lv.${merged.part.level} 합성 완료.`;
    const placed = events.find(event => event.type === 'placed');
    if (placed) return `${placed.free ? '무료 상자 · ' : ''}${placed.guaranteed ? '확정 상자 · ' : ''}${KINDS[placed.part.kind]} Lv.${placed.part.level} 입고 · 점선이 다음 자리예요.`;
    return '';
  }

  private tick() {
    if (!this.alive) return;
    const before = this.s.energy;
    recover(this.s, Date.now());
    if (this.accelerated && ++this.accelTicks % 10 === 0 && this.s.energy < CAP) { this.s.energy++; this.s.anchor = Date.now(); }
    if (before !== this.s.energy) { this.persist(); this.hooks.onChange?.(this.s); }
    this.renderShelf();
  }

  private persist() { return this.hooks.save(JSON.stringify(this.s)); }
  private syncView() { this.view = { order: this.s.order, installed: [...this.s.installed], coins: this.s.coins }; }

  // ── 연출: 상태는 즉시 반영하고, 주문 카드·급여 표시는 이벤트 순서대로 따라갑니다 ──
  private enqueue(events: ProgressEvent[]) {
    const generation = this.generation;
    this.queue = this.queue.then(() => this.play(events, generation));
  }

  private resetQueue() {
    this.generation++;
    this.queue = Promise.resolve();
    this.arriving.clear();
    this.transients.forEach(object => { this.tweens.killTweensOf(object); object.destroy(); });
    this.transients.clear();
  }

  private async play(events: ProgressEvent[], generation: number) {
    for (const event of events) {
      if (!this.alive || generation !== this.generation) return;
      this.hooks.onMotion?.(event);
      if (event.type === 'placed') await this.animatePlaced(event);
      else if (event.type === 'merged') await this.animateMerged(event);
      else if (event.type === 'bonus') this.showBanner(event.bonus);
      else if (event.type === 'installed') await this.animateInstalled(event);
      else await this.animateDelivered(event);
    }
  }

  private async animatePlaced(event: Extract<ProgressEvent, { type: 'placed' }>) {
    this.sfx('parcel');
    const target = this.cellCenter(event.index);
    const ghost = this.track(this.makePiece(event.part, BOX_ICON).setDepth(30).setScale(0.45));
    await this.tweenAsync({ targets: ghost, x: target.x, y: target.y, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.untrack(ghost);
    if (this.arriving.delete(event.index)) this.pieces.get(event.index)?.setAlpha(1);
  }

  private async animateMerged(event: Extract<ProgressEvent, { type: 'merged' }>) {
    this.sfx('merge');
    const from = this.cellCenter(event.from), to = this.cellCenter(event.to);
    const trail = this.track(this.makePiece({ kind: event.part.kind, level: event.part.level - 1 }, from).setDepth(29).setAlpha(0.85));
    await this.tweenAsync({ targets: trail, x: to.x, y: to.y, scale: 0.7, alpha: 0.2, duration: 160, ease: 'Quad.easeIn' });
    this.untrack(trail);
    const burst = this.track(this.add.circle(to.x, to.y, 10, CREAM, 0.85).setDepth(28));
    this.tweens.add({ targets: burst, radius: 30, alpha: 0, duration: this.duration(260), onComplete: () => this.untrack(burst) });
    const stays = this.s.board[event.to]?.kind === event.part.kind && this.s.board[event.to]?.level === event.part.level;
    const pop = stays ? this.pieces.get(event.to) : undefined;
    const target = pop ?? this.track(this.makePiece(event.part, to).setDepth(29));
    target.setScale(1.28);
    await this.tweenAsync({ targets: target, scale: pop && this.selected === event.to ? 1.06 : 1, duration: 200, ease: 'Back.easeOut' });
    if (!pop) this.untrack(target);
    if (event.combo >= 2) this.floatText(to.x, to.y - 30, `${event.combo}연쇄!`, event.combo >= COMBO_FREE_BOX ? '#dff0d0' : CREAM_TEXT);
  }

  private async animateInstalled(event: Extract<ProgressEvent, { type: 'installed' }>) {
    const from = this.cellCenter(event.from);
    const { dx, dy } = bikePartAnchorOffset(orderMeta(event.order).bikeCategory, PART_TYPES[event.kind], BIKE_CELL);
    const marker = this.track(this.add.rectangle(from.x, from.y, 24, 24, PART_COLORS[event.kind]).setStrokeStyle(3, CREAM, 0.9).setDepth(30));
    await this.tweenAsync({ targets: marker, x: BIKE_X + dx, y: BIKE_Y + dy, scale: { from: 0.9, to: 1.4 }, alpha: { from: 1, to: 0.3 }, duration: 520, ease: 'Cubic.easeInOut' });
    this.untrack(marker);
    this.sfx('install');
    if (this.view.order === event.order) {
      this.view.installed[event.kind] = true;
      this.renderOrder();
    }
  }

  private async animateDelivered(event: Extract<ProgressEvent, { type: 'delivered' }>) {
    this.sfx('complete');
    const stamp = this.track(this.add.container(195, 138, [
      this.add.rectangle(0, 0, 232, 66, CREAM).setStrokeStyle(4, RED),
      this.add.rectangle(0, -21, 112, 20, RED).setStrokeStyle(2, BORDER),
      this.add.text(0, -21, '납품 완료', textStyle(11, CREAM_TEXT)).setOrigin(0.5),
      this.add.text(0, 10, `${event.name} · +${event.reward.toLocaleString()} C`, textStyle(13, INK)).setOrigin(0.5),
    ]).setDepth(35).setScale(0.6).setAlpha(0));
    await this.tweenAsync({ targets: stamp, scale: 1, alpha: 1, duration: 240, ease: 'Back.easeOut' });
    await this.wait(this.reduced ? 300 : 650);
    this.view = { order: event.order, installed: [false, false, false, false], coins: this.view.coins + event.reward };
    this.renderOrder();
    this.renderHeader();
    this.sfx('reward');
    await this.tweenAsync({ targets: stamp, alpha: 0, y: 120, duration: 220 });
    this.untrack(stamp);
  }

  private showBanner(bonus: 'free-box' | 'guarantee') {
    this.sfx('reward');
    const color = bonus === 'free-box' ? GREEN : AMBER;
    const label = bonus === 'free-box' ? `${COMBO_FREE_BOX}연쇄! 다음 상자 무료` : `${COMBO_GUARANTEE}연쇄! 다음 상자 필수 부품 확정`;
    const banner = this.track(this.add.container(195, 252, [
      this.add.rectangle(0, 0, 250, 30, color).setStrokeStyle(3, BORDER),
      this.add.text(0, 0, label, textStyle(12, bonus === 'free-box' ? CREAM_TEXT : INK)).setOrigin(0.5),
    ]).setDepth(32).setAlpha(0));
    this.tweens.chain({
      targets: banner,
      tweens: [
        { alpha: 1, y: 262, duration: this.duration(180), ease: 'Back.easeOut' },
        { alpha: 1, duration: this.reduced ? 600 : 900 },
        { alpha: 0, y: 252, duration: this.duration(240) },
      ],
      onComplete: () => this.untrack(banner),
    });
  }

  private floatText(x: number, y: number, label: string, color: string) {
    const text = this.track(this.add.text(x, y, label, { ...textStyle(12, color), stroke: INK, strokeThickness: 3 }).setOrigin(0.5).setDepth(33));
    this.tweens.add({ targets: text, y: y - 24, alpha: 0, duration: this.reduced ? 500 : 650, onComplete: () => this.untrack(text) });
  }

  private track<T extends Phaser.GameObjects.GameObject>(object: T): T { this.transients.add(object); return object; }
  private untrack(object: Phaser.GameObjects.GameObject) {
    if (!this.transients.delete(object)) return;
    this.tweens.killTweensOf(object);
    object.destroy();
  }
  private duration(ms: number) { return this.reduced ? 1 : ms; }
  private tweenAsync(config: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>(resolve => {
      this.tweens.add({ ...config, duration: this.duration(Number(config.duration ?? 0)), onComplete: () => resolve() });
    });
  }
  private wait(ms: number) { return new Promise<void>(resolve => { this.time.delayedCall(ms, () => resolve()); }); }
  private sfx(event: ReleaseSfxEvent) { this.audio.play(event); }

  private cellCenter(index: number): Point {
    const row = Math.floor(index / COLS), column = index % COLS;
    return { x: BOARD_LEFT + column * CELL + CELL / 2, y: BOARD_TOP + row * CELL + CELL / 2 };
  }
  private cellAt(x: number, y: number) {
    const column = Math.floor((x - BOARD_LEFT) / CELL), row = Math.floor((y - BOARD_TOP) / CELL);
    return column >= 0 && column < COLS && row >= 0 && row < ROWS ? row * COLS + column : NONE;
  }
}

export type MergePlacementHandle = { destroy(removeCanvas?: boolean): void };

/**
 * E v3 체험 화면을 시작합니다. toolsId가 있으면 그 요소에 랩 테스트 도구(체력 충전·가속·초기화)를 그립니다.
 * 랩 도구는 게임 화면 디자인과 섞이지 않도록 캔버스 밖 DOM에 둡니다.
 */
export function startMergePlacement(parent: string, toolsId?: string): MergePlacementHandle {
  const root = document.getElementById(parent);
  const tools = toolsId ? document.getElementById(toolsId) : null;
  let storageOK = true;
  const renderTools = (s: State) => {
    if (!tools) return;
    const stats = tools.querySelector('[data-stats]');
    const save = tools.querySelector('[data-save]');
    if (stats) stats.textContent = `공급 ${s.supplied} · 합성 ${s.merges} · 반품 ${s.returned} · 납품 ${s.order} · 무료 상자 사용 ${s.freeUsed}`;
    if (save) save.textContent = storageOK ? 'E안 자동 저장 · 기존 v1·v2 진행 이전 지원' : '저장 불가: 이 화면에서만 진행됩니다.';
  };
  const scene = new MergePlacementScene({
    load: () => { try { return localStorage.getItem(KEY); } catch { storageOK = false; return null; } },
    save: (raw) => { try { localStorage.setItem(KEY, raw); storageOK = true; } catch { storageOK = false; } return storageOK; },
    onChange: renderTools,
    onMotion: (event) => root?.dispatchEvent(new CustomEvent('dbg:merge-motion', { detail: event, bubbles: true })),
  });
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 390,
    height: 810,
    backgroundColor: '#c78452',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene,
  });

  let accelerated = false;
  const click = (event: Event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
    if (!button) return;
    if (button.dataset.action === 'charge') scene.labCharge();
    if (button.dataset.action === 'speed') {
      accelerated = !accelerated;
      scene.labSetAccelerated(accelerated);
      button.textContent = `10초 회복 ${accelerated ? 'ON' : 'OFF'}`;
    }
    if (button.dataset.action === 'reset' && window.confirm('E안의 진행을 초기화할까요?')) scene.labReset();
  };
  if (tools) {
    // 게임 캔버스 높이를 줄이지 않도록 기본은 한 줄로 접어 둡니다.
    tools.innerHTML = `<details class="placement-tools"><summary><span>LAB 도구</span><small data-stats></small></summary>
      <div><button type="button" data-action="charge">체력 충전</button>
      <button type="button" data-action="speed">10초 회복 OFF</button>
      <button type="button" data-action="reset">E안 초기화</button></div>
      <small data-save></small></details>`;
    tools.addEventListener('click', click);
  }
  const hide = () => scene.flush();
  const visibility = () => { if (document.hidden) hide(); };
  window.addEventListener('pagehide', hide);
  document.addEventListener('visibilitychange', visibility);
  return {
    destroy(removeCanvas = true) {
      window.removeEventListener('pagehide', hide);
      document.removeEventListener('visibilitychange', visibility);
      scene.flush();
      if (tools) { tools.removeEventListener('click', click); tools.innerHTML = ''; }
      game.destroy(removeCanvas);
    },
  };
}
