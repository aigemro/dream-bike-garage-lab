// 머지 코어 D·E 공통 화면 구성 (Phaser)
// 일반 프로젝트 게임 화면 디자인 B안(game-screen-mobile.ts · 390×810)의 배치 수치·팔레트·부품 표현과
// 장착·납품 연출을 두 방안이 같은 모습으로 쓰도록 모았습니다. 규칙과 입력 판정은 각 방안의 모듈이 맡습니다.
import Phaser from 'phaser';
import { drawPixelBike, drawPixelPartIcon, makeWarmColorway, bikePartAnchorOffset, WARM_PART_COLORS } from './bike-pixel-sprite';
import { CAP, COLS, ROWS, SIZE, PART_TYPES, RECOVERY, orderMeta, requirements, type Part } from './merge-core-shared';
import './merge-play-screen.css';

// ── 게임 화면 B안과 같은 팔레트·글꼴 ──
export const FONT = '"Arial Rounded MT Bold", "Noto Sans KR", sans-serif';
export const INK = '#3b2531', MUTED = '#7b5140', CREAM_TEXT = '#fff1c6', SUCCESS = '#3f7851', PENDING = '#a16028', ALERT = '#a14a38', ERROR_TEXT = '#ffd7c9';
export const CREAM = 0xfff1c6, GOLD = 0xf6d995, BORDER = 0x3b2531, BROWN = 0x8e5136, DARK_WOOD = 0x573044;
export const CELL_FILL = 0xffe6a8, CELL_LINE = 0x9c5b3c, ARRIVED = 0xf4c86a, DONE_CHIP = 0xdff0d0, DISABLED = 0xe8d3a6;
export const GREEN = 0x5e9a67, RED = 0xc95746, AMBER = 0xf4b84a;
export const PART_COLORS = PART_TYPES.map(type => WARM_PART_COLORS[type]); // 부품 아이콘과 같은 대표색 단일 출처

// ── 게임 화면 B안과 같은 배치 수치 (보드 셀 52 = floor(min(368/6, 364/7))) ──
export const CELL = 52, GAP = 4, BOARD_LEFT = 39, BOARD_TOP = 234;
export const BIKE_X = 292, BIKE_Y = 132, BIKE_CELL = 2;
export const SHELF_TOP = 668, ROW1_Y = 708, ROW2_Y = 762;
export const BOX = { x: 136, y: ROW1_Y, w: 240, h: 48 };
export const BOX_ICON = { x: BOX.x - BOX.w / 2 + 26, y: ROW1_Y };
export const SMALL_LEFT = { x: 290, y: ROW1_Y, w: 56, h: 48 }, SMALL_RIGHT = { x: 350, y: ROW1_Y, w: 56, h: 48 };
const ORDER_CARD = { left: 8, top: 68, right: 382, bottom: 208 };

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Tone = 'info' | 'error';
export const textStyle = (size: number, color: string, bold = true): Phaser.Types.GameObjects.Text.TextStyle =>
  ({ fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' });

export function cellCenter(index: number): Point {
  const row = Math.floor(index / COLS), column = index % COLS;
  return { x: BOARD_LEFT + column * CELL + CELL / 2, y: BOARD_TOP + row * CELL + CELL / 2 };
}
/** 화면 좌표의 보드 칸. 보드 밖이면 -1 */
export function cellAt(x: number, y: number) {
  const column = Math.floor((x - BOARD_LEFT) / CELL), row = Math.floor((y - BOARD_TOP) / CELL);
  return column >= 0 && column < COLS && row >= 0 && row < ROWS ? row * COLS + column : -1;
}
export function inOrderCard(x: number, y: number) {
  return x >= ORDER_CARD.left && x <= ORDER_CARD.right && y >= ORDER_CARD.top && y <= ORDER_CARD.bottom;
}
export function recoveryLabel(anchor: number) {
  const remaining = Math.max(0, Math.ceil((RECOVERY - (Date.now() - anchor)) / 1000));
  return `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
}

/** 택배 상자 픽셀 아이콘 (부품 아이콘과 같은 잉크 외곽선 톤) */
export function drawBoxIcon(scene: Phaser.Scene, x: number, y: number, cell: number) {
  const g = scene.add.graphics();
  const px = (cx: number, cy: number, w: number, h: number, color: number) => g.fillStyle(color, 1).fillRect(x + cx * cell, y + cy * cell, w * cell, h * cell);
  px(-7, -5, 14, 11, BORDER); // 외곽선
  px(-6, -4, 12, 9, 0xd39a5c); // 상자 몸통
  px(-6, -4, 12, 3, 0xb7783f); // 윗면 덮개
  px(-1, -4, 2, 9, GOLD); // 테이프
  px(-5, 2, 3, 1, CREAM); // 송장 라벨
  return g;
}

/** 홈 A안과 같은 목재 공방 배경: 벽·바닥·판자 라인 */
export function drawBackdrop(scene: Phaser.Scene) {
  scene.cameras.main.setBackgroundColor('#c78452');
  scene.add.rectangle(195, 300, 390, 600, 0xc78452).setDepth(0);
  scene.add.rectangle(195, 705, 390, 210, 0xa9683f).setDepth(0);
  for (let y = 626; y < 810; y += 26) scene.add.rectangle(195, y, 390, 2, 0x8a5231, 0.5).setDepth(0);
  for (let x = 24; x < 390; x += 52) scene.add.rectangle(x, 300, 2, 600, 0xb37246, 0.35).setDepth(0);
}

/** 작업대 헤더 (WORK 태그 + 공방 이름). 오른쪽 지표 텍스트를 돌려줍니다. */
export function drawHeader(scene: Phaser.Scene) {
  scene.add.rectangle(195, 30, 390, 60, CREAM).setStrokeStyle(4, BORDER).setDepth(8);
  scene.add.rectangle(56, 30, 76, 24, RED).setStrokeStyle(2, BORDER).setDepth(9);
  scene.add.text(56, 30, 'WORK', textStyle(11, CREAM_TEXT)).setOrigin(0.5).setDepth(10);
  scene.add.text(104, 22, '두리 자전거 공방 · 작업대', textStyle(13, INK)).setDepth(10);
  return scene.add.text(382, 39, '', textStyle(10, MUTED, false)).setOrigin(1, 0.5).setDepth(10);
}

/** 게임 화면 B안의 부품 블록: 대표색 블록 + 픽셀 아이콘 + Lv 배지 */
export function makePiece(scene: Phaser.Scene, part: Part, at: Point) {
  const block = scene.add.rectangle(0, 0, CELL - GAP * 2, CELL - GAP * 2, PART_COLORS[part.kind]).setStrokeStyle(3, BORDER);
  const icon = drawPixelPartIcon(scene, 0, -8, 2, PART_TYPES[part.kind], { level: part.level });
  const badge = scene.add.rectangle(0, 14, 32, 18, CREAM, 0.94).setStrokeStyle(2, BORDER, 0.8);
  const tag = scene.add.text(0, 14, `Lv.${part.level}`, textStyle(10, INK)).setOrigin(0.5);
  return scene.add.container(at.x, at.y, [block, icon, badge, tag]).setDepth(2);
}

/** NEW ORDER 주문 카드: 주문명·진행·보상, 부품 칩 4개, 장착 상태가 반영된 픽셀 자전거 */
export class OrderCard {
  private readonly title: Phaser.GameObjects.Text;
  private readonly progress: Phaser.GameObjects.Text;
  private readonly reward: Phaser.GameObjects.Text;
  private readonly chips: Array<{ panel: Phaser.GameObjects.Rectangle; status: Phaser.GameObjects.Text }> = [];
  private bike?: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene, onChipTap?: (kind: number) => void) {
    scene.add.rectangle(195, 138, 374, 140, CREAM).setStrokeStyle(4, BROWN).setDepth(2);
    scene.add.rectangle(64, 78, 88, 22, RED).setStrokeStyle(2, BORDER).setDepth(3);
    scene.add.text(64, 78, 'NEW ORDER', textStyle(9, CREAM_TEXT)).setOrigin(0.5).setDepth(4);
    this.title = scene.add.text(20, 94, '', textStyle(15, INK)).setDepth(4);
    this.progress = scene.add.text(20, 117, '', textStyle(10, MUTED)).setDepth(4);
    this.reward = scene.add.text(BIKE_X, 186, '', textStyle(10, PENDING)).setOrigin(0.5).setDepth(4);
    PART_TYPES.forEach((type, kind) => {
      const { x, y } = this.chipCenter(kind);
      const panel = scene.add.rectangle(x, y, 42, 40, GOLD).setStrokeStyle(2, PART_COLORS[kind]).setDepth(3);
      if (onChipTap) panel.setInteractive({ useHandCursor: true }).on('pointerdown', () => onChipTap(kind));
      // 칩 위쪽은 부품 픽셀 아이콘, 아래쪽은 요구 레벨 또는 장착 완료 표시
      drawPixelPartIcon(scene, x, y - 9, 1.5, type, { depth: 4 });
      const status = scene.add.text(x, y + 11, '', textStyle(9, MUTED)).setOrigin(0.5).setDepth(4);
      this.chips.push({ panel, status });
    });
  }

  chipCenter(kind: number): Point { return { x: 42 + kind * 46, y: 168 }; }

  /** 부품이 날아가 장착될 자전거 부위의 좌표 */
  bikeAnchor(order: number, kind: number): Point {
    const { dx, dy } = bikePartAnchorOffset(orderMeta(order).bikeCategory, PART_TYPES[kind], BIKE_CELL);
    return { x: BIKE_X + dx, y: BIKE_Y + dy };
  }

  /** highlight: 장착할 수 있는 칩(초록) 또는 맞지 않는 칩(빨강)을 강조합니다. */
  render(order: number, installed: readonly boolean[], note: string, highlight?: { kind: number; ok: boolean }) {
    const meta = orderMeta(order), req = requirements({ order });
    this.title.setText(meta.name);
    this.progress.setText(`장착 ${installed.filter(Boolean).length}/4 · ${note}`);
    this.reward.setText(`납품 보상 ${meta.reward.toLocaleString()} C`);
    this.chips.forEach((chip, kind) => {
      const done = installed[kind], marked = highlight?.kind === kind;
      chip.status.setText(done ? '✓' : marked && highlight.ok ? '장착!' : `Lv.${req[kind]}`).setColor(done || (marked && highlight.ok) ? SUCCESS : MUTED);
      chip.panel.setFillStyle(done ? DONE_CHIP : marked && highlight.ok ? 0xeaf6dd : GOLD);
      if (marked) chip.panel.setStrokeStyle(4, highlight.ok ? GREEN : RED, 1);
      else chip.panel.setStrokeStyle(done ? 2 : 3, PART_COLORS[kind], done ? 0.5 : 1);
    });
    const alpha = (kind: number) => (installed[kind] ? 1 : 0.5);
    this.bike?.destroy();
    this.bike = drawPixelBike(this.scene, BIKE_X, BIKE_Y, BIKE_CELL, {
      category: meta.bikeCategory,
      colorway: makeWarmColorway(RED),
      depth: 4,
      partAlpha: { frame: alpha(0), wheel: alpha(1), drivetrain: alpha(2), handlebar: alpha(3) },
    });
  }
}

/** 나무 테두리 6×7 보드와 입력용 칸 */
export function drawBoard(scene: Phaser.Scene, onDown: (index: number, pointer: Phaser.Input.Pointer) => void) {
  const width = COLS * CELL, height = ROWS * CELL;
  scene.add.rectangle(BOARD_LEFT + width / 2, BOARD_TOP + height / 2, width + 16, height + 16, BROWN).setStrokeStyle(5, BORDER).setDepth(0);
  for (let index = 0; index < SIZE; index++) {
    const { x, y } = cellCenter(index);
    scene.add.rectangle(x, y, CELL - GAP, CELL - GAP, CELL_FILL).setStrokeStyle(2, CELL_LINE).setDepth(1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (pointer: Phaser.Input.Pointer) => onDown(index, pointer));
  }
}

/** 다음 입고 칸 표시: 점선 테두리 + 상자 아이콘 */
export function createNextMarker(scene: Phaser.Scene, reduced: boolean) {
  const dashes = scene.add.graphics();
  dashes.fillStyle(BROWN, 1);
  for (let t = -20; t < 20; t += 8) dashes.fillRect(t, -21, 5, 3).fillRect(t, 18, 5, 3).fillRect(-21, t, 3, 5).fillRect(18, t, 3, 5);
  const label = scene.add.text(0, 12, '다음 입고', textStyle(8, MUTED)).setOrigin(0.5);
  const marker = scene.add.container(0, 0, [dashes, drawBoxIcon(scene, 0, -6, 1.5), label]).setDepth(3);
  if (!reduced) scene.tweens.add({ targets: marker, alpha: { from: 1, to: 0.45 }, duration: 700, yoyo: true, repeat: -1 });
  return marker;
}

/** 보드 아래 안내 문구와 '× 선택 취소' 버튼 */
export class InfoLine {
  private readonly text: Phaser.GameObjects.Text;
  private readonly cancel: Phaser.GameObjects.Rectangle;
  private readonly cancelLabel: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene, onCancel: () => void) {
    const below = BOARD_TOP + ROWS * CELL;
    this.text = scene.add.text(12, below + 12, '', { ...textStyle(10, CREAM_TEXT, false), wordWrap: { width: 270 }, lineSpacing: 3 }).setDepth(10);
    this.cancel = scene.add.rectangle(334, below + 38, 104, 44, BROWN).setStrokeStyle(2, CREAM).setDepth(10)
      .setInteractive({ useHandCursor: true }).on('pointerdown', onCancel);
    this.cancelLabel = scene.add.text(334, below + 38, '× 선택 취소', textStyle(10, CREAM_TEXT)).setOrigin(0.5).setDepth(11);
  }
  set(message: string, tone: Tone = 'info') { this.text.setText(message).setColor(tone === 'error' ? ERROR_TEXT : CREAM_TEXT); }
  showCancel(visible: boolean) { this.cancel.setVisible(visible); this.cancelLabel.setVisible(visible); }
}

/** 게임 화면 B안의 '택배 선반' 자리·크기의 하단 선반 틀 */
export function drawShelf(scene: Phaser.Scene, title: string, pill: string) {
  scene.add.rectangle(195, SHELF_TOP + 66, 374, 136, CREAM).setStrokeStyle(4, BORDER).setDepth(2);
  scene.add.rectangle(96, SHELF_TOP, 152, 22, BROWN).setDepth(3);
  scene.add.text(28, SHELF_TOP - 7, title, textStyle(10, CREAM_TEXT)).setDepth(4);
  scene.add.rectangle(282, SHELF_TOP, 200, 22, BROWN).setStrokeStyle(2, BORDER).setDepth(3);
  scene.add.text(282, SHELF_TOP, pill, textStyle(9, CREAM_TEXT)).setOrigin(0.5).setDepth(4);
}

/** 선반 1행의 작은 보조 버튼 */
export function smallButton(scene: Phaser.Scene, rect: Rect, label: string, handler: () => void): [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Text] {
  const button = scene.add.rectangle(rect.x, rect.y, rect.w, rect.h, BROWN).setStrokeStyle(2, BORDER).setDepth(3)
    .setInteractive({ useHandCursor: true }).on('pointerdown', handler);
  const text = scene.add.text(rect.x, rect.y, label, { ...textStyle(9, CREAM_TEXT), align: 'center', lineSpacing: 2 }).setOrigin(0.5).setDepth(4);
  return [button, text];
}

/** 선반 1행의 주 버튼(상자 열기) */
export class BoxButton {
  private readonly button: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private readonly cost: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene, label: string, handler: () => void) {
    this.button = scene.add.rectangle(BOX.x, BOX.y, BOX.w, BOX.h, GOLD).setStrokeStyle(3, BROWN).setDepth(3)
      .setInteractive({ useHandCursor: true }).on('pointerdown', handler);
    drawBoxIcon(scene, BOX_ICON.x, BOX_ICON.y, 2).setDepth(4);
    this.title = scene.add.text(BOX.x - BOX.w / 2 + 48, BOX.y - 17, label, textStyle(12, INK)).setDepth(4);
    this.status = scene.add.text(BOX.x - BOX.w / 2 + 48, BOX.y + 2, '', textStyle(9, MUTED, false)).setDepth(4);
    this.cost = scene.add.text(BOX.x + BOX.w / 2 - 8, BOX.y - 17, '', textStyle(9, ALERT)).setOrigin(1, 0).setDepth(4);
  }
  render(view: { blocked: boolean; highlight?: boolean; status: string; statusColor: string; cost: string; costColor: string }) {
    this.button.setFillStyle(view.blocked ? DISABLED : view.highlight ? ARRIVED : GOLD).setStrokeStyle(3, view.blocked ? 0xb08a6a : BROWN);
    this.title.setColor(view.blocked ? MUTED : INK);
    this.status.setText(view.status).setColor(view.statusColor);
    this.cost.setText(view.cost).setColor(view.costColor);
  }
}

/** 선반 2행 정보 칸(172×48) */
export function infoPanel(scene: Phaser.Scene, x: number) {
  scene.add.rectangle(x, ROW2_Y, 172, 48, GOLD).setStrokeStyle(2, BROWN).setDepth(3);
  const left = x - 80;
  return {
    title: scene.add.text(left, ROW2_Y - 18, '', textStyle(11, INK)).setDepth(4),
    sub: scene.add.text(left, ROW2_Y - 1, '', textStyle(9, MUTED, false)).setDepth(4),
  };
}

/** 선반 2행 왼쪽: 알바 체력(상자 비용)과 회복 시간 */
export class EnergyPanel {
  private readonly title: Phaser.GameObjects.Text;
  private readonly sub: Phaser.GameObjects.Text;
  private readonly fill: Phaser.GameObjects.Rectangle;
  constructor(scene: Phaser.Scene) {
    ({ title: this.title, sub: this.sub } = infoPanel(scene, 104));
    scene.add.rectangle(24, ROW2_Y + 16, 160, 5, DARK_WOOD).setOrigin(0, 0.5).setDepth(4);
    this.fill = scene.add.rectangle(24, ROW2_Y + 16, 160, 5, GREEN).setOrigin(0, 0.5).setDepth(5);
  }
  render(energy: number, anchor: number, accelerated: boolean) {
    this.title.setText(`⚡ 알바 체력 ${energy}/${CAP}`);
    this.sub.setText(energy >= CAP ? '가득 참' : accelerated ? '랩 가속 · 10초마다 +1' : `다음 +1 ${recoveryLabel(anchor)}`);
    this.fill.setScale(energy / CAP, 1);
  }
}

/** 입고·합성·이동·장착·납품 연출. 상태는 즉시 반영하고 연출은 순서대로 따라갑니다. */
export class Motion {
  private readonly objects = new Set<Phaser.GameObjects.GameObject>();
  constructor(private readonly scene: Phaser.Scene, readonly reduced: boolean) {}

  track<T extends Phaser.GameObjects.GameObject>(object: T): T { this.objects.add(object); return object; }
  untrack(object: Phaser.GameObjects.GameObject) {
    if (!this.objects.delete(object)) return;
    this.scene.tweens.killTweensOf(object);
    object.destroy();
  }
  clear() {
    this.objects.forEach(object => { this.scene.tweens.killTweensOf(object); object.destroy(); });
    this.objects.clear();
  }
  duration(ms: number) { return this.reduced ? 1 : ms; }
  tween(config: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>(resolve => {
      this.scene.tweens.add({ ...config, duration: this.duration(Number(config.duration ?? 0)), onComplete: () => resolve() });
    });
  }
  wait(ms: number) { return new Promise<void>(resolve => { this.scene.time.delayedCall(ms, () => resolve()); }); }

  /** 상자에서 칸으로 부품이 들어오는 연출 */
  async arrive(part: Part, to: Point) {
    const ghost = this.track(makePiece(this.scene, part, BOX_ICON).setDepth(30).setScale(0.45));
    await this.tween({ targets: ghost, x: to.x, y: to.y, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.untrack(ghost);
  }
  /** 부품이 한 칸에서 다른 칸으로 옮겨지는 연출 (fade: 합성되며 사라짐) */
  async slide(part: Part, from: Point, to: Point, fade = false) {
    const ghost = this.track(makePiece(this.scene, part, from).setDepth(29).setAlpha(0.9));
    await this.tween({ targets: ghost, x: to.x, y: to.y, scale: fade ? 0.7 : 1, alpha: fade ? 0.2 : 0.9, duration: fade ? 160 : 180, ease: fade ? 'Quad.easeIn' : 'Quad.easeOut' });
    this.untrack(ghost);
  }
  /** 합성 결과가 튀어나오는 연출. 보드에 남은 조각이 없으면 임시 조각으로 보여 줍니다. */
  async pop(piece: Phaser.GameObjects.Container | undefined, part: Part, at: Point, finalScale = 1) {
    const burst = this.track(this.scene.add.circle(at.x, at.y, 10, CREAM, 0.85).setDepth(28));
    this.scene.tweens.add({ targets: burst, radius: 30, alpha: 0, duration: this.duration(260), onComplete: () => this.untrack(burst) });
    const target = piece ?? this.track(makePiece(this.scene, part, at).setDepth(29));
    target.setScale(1.28);
    await this.tween({ targets: target, scale: piece ? finalScale : 1, duration: 200, ease: 'Back.easeOut' });
    if (!piece) this.untrack(target);
  }
  /** 게임 화면 B안과 같은 장착 연출: 부품 색 사각형이 자전거 부위로 날아갑니다. */
  async install(from: Point, to: Point, color: number) {
    const marker = this.track(this.scene.add.rectangle(from.x, from.y, 24, 24, color).setStrokeStyle(3, CREAM, 0.9).setDepth(30));
    await this.tween({ targets: marker, x: to.x, y: to.y, scale: { from: 0.9, to: 1.4 }, alpha: { from: 1, to: 0.3 }, duration: 520, ease: 'Cubic.easeInOut' });
    this.untrack(marker);
  }
  /** 납품 도장. 가장 크게 보일 때 onPeak로 다음 주문 표시를 바꿉니다. */
  async delivered(name: string, reward: number, onPeak: () => void) {
    const stamp = this.track(this.scene.add.container(195, 138, [
      this.scene.add.rectangle(0, 0, 232, 66, CREAM).setStrokeStyle(4, RED),
      this.scene.add.rectangle(0, -21, 112, 20, RED).setStrokeStyle(2, BORDER),
      this.scene.add.text(0, -21, '납품 완료', textStyle(11, CREAM_TEXT)).setOrigin(0.5),
      this.scene.add.text(0, 10, `${name} · +${reward.toLocaleString()} C`, textStyle(13, INK)).setOrigin(0.5),
    ]).setDepth(35).setScale(0.6).setAlpha(0));
    await this.tween({ targets: stamp, scale: 1, alpha: 1, duration: 240, ease: 'Back.easeOut' });
    await this.wait(this.reduced ? 300 : 650);
    onPeak();
    await this.tween({ targets: stamp, alpha: 0, y: 120, duration: 220 });
    this.untrack(stamp);
  }
  /** 보드 위쪽 알림 띠 (기다리지 않음) */
  banner(label: string, fill: number, textColor: string) {
    const banner = this.track(this.scene.add.container(195, 252, [
      this.scene.add.rectangle(0, 0, 250, 30, fill).setStrokeStyle(3, BORDER),
      this.scene.add.text(0, 0, label, textStyle(12, textColor)).setOrigin(0.5),
    ]).setDepth(32).setAlpha(0));
    this.scene.tweens.chain({
      targets: banner,
      tweens: [
        { alpha: 1, y: 262, duration: this.duration(180), ease: 'Back.easeOut' },
        { alpha: 1, duration: this.reduced ? 600 : 900 },
        { alpha: 0, y: 252, duration: this.duration(240) },
      ],
      onComplete: () => this.untrack(banner),
    });
  }
  floatText(x: number, y: number, label: string, color: string) {
    const text = this.track(this.scene.add.text(x, y, label, { ...textStyle(12, color), stroke: INK, strokeThickness: 3 }).setOrigin(0.5).setDepth(33));
    this.scene.tweens.add({ targets: text, y: y - 24, alpha: 0, duration: this.reduced ? 500 : 650, onComplete: () => this.untrack(text) });
  }
}

// ── 랩 체험 실행: 저장·랩 도구·화면 이탈 처리 ──
export type DemoHooks = {
  load(): string | null;
  save(raw: string): boolean;
  onChange?(stats: string): void;
  onMotion?(event: unknown): void;
};
export type LabControls = { labCharge(): void; labSetAccelerated(on: boolean): void; labReset(): void; flush(): void };
export type MergeDemoHandle = { destroy(removeCanvas?: boolean): void };

/**
 * 390×810 Phaser 체험 화면을 띄우고, toolsId 요소에 랩 테스트 도구(체력 충전·가속·초기화)를 그립니다.
 * 랩 도구는 게임 화면 디자인과 섞이지 않도록 캔버스 밖 DOM에 접어 둡니다.
 */
export function launchMergeDemo(options: {
  parent: string;
  toolsId?: string;
  key: string;
  resetLabel: string;
  saveLabel: string;
  createScene(hooks: DemoHooks): Phaser.Scene & LabControls;
}): MergeDemoHandle {
  const root = document.getElementById(options.parent);
  const tools = options.toolsId ? document.getElementById(options.toolsId) : null;
  let storageOK = true;
  const scene = options.createScene({
    load: () => { try { return localStorage.getItem(options.key); } catch { storageOK = false; return null; } },
    save: (raw) => { try { localStorage.setItem(options.key, raw); storageOK = true; } catch { storageOK = false; } return storageOK; },
    onChange: (stats) => {
      const statsLine = tools?.querySelector('[data-stats]'), saveLine = tools?.querySelector('[data-save]');
      if (statsLine) statsLine.textContent = stats;
      if (saveLine) saveLine.textContent = storageOK ? options.saveLabel : '저장 불가: 이 화면에서만 진행됩니다.';
    },
    onMotion: (event) => root?.dispatchEvent(new CustomEvent('dbg:merge-motion', { detail: event, bubbles: true })),
  });
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: options.parent,
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
    if (button.dataset.action === 'reset' && window.confirm(`${options.resetLabel}의 진행을 초기화할까요?`)) scene.labReset();
  };
  if (tools) {
    // 게임 캔버스 높이를 줄이지 않도록 기본은 한 줄로 접어 둡니다.
    tools.innerHTML = `<details class="merge-lab-tools"><summary><span>LAB 도구</span><small data-stats></small></summary>
      <div><button type="button" data-action="charge">체력 충전</button>
      <button type="button" data-action="speed">10초 회복 OFF</button>
      <button type="button" data-action="reset">${options.resetLabel} 초기화</button></div>
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
