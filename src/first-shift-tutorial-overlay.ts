// 첫 영업 튜토리얼 안내 레이어 (#265 · Phaser)
// 강조 영역만 남기고 주변을 어둡게 덮는 스포트라이트 + 말풍선 + 가리킴 화살표입니다.
// 어두운 영역은 입력을 막고, B안의 '행동' 단계에서는 강조 영역 안의 칸·버튼만 실제로 누를 수 있습니다.
import Phaser from 'phaser';
import { cellSpan, type TutorialStep, type TutorialTarget } from './first-shift-tutorial';
import { AMBER, BOARD_LEFT, BOARD_TOP, BORDER, BOX, CELL, CREAM, CREAM_TEXT, GOLD, GREEN, INK, MUTED, ROW2_Y, textStyle } from './merge-play-screen';
import { COLS, ROWS } from './merge-placement-state';

type Rect = { x: number; y: number; w: number; h: number };

export function targetRect(target: TutorialTarget): Rect {
  if (target.kind === 'order') return { x: 8, y: 66, w: 374, h: 144 };
  if (target.kind === 'box') return { x: BOX.x - BOX.w / 2 - 4, y: BOX.y - BOX.h / 2 - 4, w: BOX.w + 8, h: BOX.h + 8 };
  if (target.kind === 'shelf-info') return { x: 14, y: ROW2_Y - 28, w: 362, h: 56 };
  if (target.kind === 'board') return { x: BOARD_LEFT - 8, y: BOARD_TOP - 8, w: COLS * CELL + 16, h: ROWS * CELL + 16 };
  const span = cellSpan(target.cells);
  return { x: BOARD_LEFT + span.col * CELL - 3, y: BOARD_TOP + span.row * CELL - 3, w: span.cols * CELL + 6, h: span.rows * CELL + 6 };
}

export type OverlayOptions = {
  index: number;
  total: number;
  // 참이면 강조 영역 안도 누를 수 없습니다(읽기만 하는 단계)
  readOnly: boolean;
  onNext(): void;
  onSkip(): void;
};

export class TutorialOverlay {
  private layer?: Phaser.GameObjects.Container;

  constructor(private readonly scene: Phaser.Scene, private readonly reduced: boolean) {}

  hide() {
    if (!this.layer) return;
    this.layer.each((child: Phaser.GameObjects.GameObject) => { this.scene.tweens.killTweensOf(child); });
    this.layer.destroy(true);
    this.layer = undefined;
  }

  show(step: TutorialStep, options: OverlayOptions) {
    this.hide();
    const hole = targetRect(step.target);
    const dim = 0x1d1016, alpha = 0.6;
    const blocker = (x: number, y: number, w: number, h: number, a = alpha) => this.scene.add.rectangle(x + w / 2, y + h / 2, Math.max(1, w), Math.max(1, h), dim, a).setInteractive();
    const items: Phaser.GameObjects.GameObject[] = [
      blocker(0, 0, 390, hole.y),
      blocker(0, hole.y + hole.h, 390, 810 - hole.y - hole.h),
      blocker(0, hole.y, hole.x, hole.h),
      blocker(hole.x + hole.w, hole.y, 390 - hole.x - hole.w, hole.h),
    ];
    if (options.readOnly) items.push(blocker(hole.x, hole.y, hole.w, hole.h, 0.001));
    const frame = this.scene.add.rectangle(hole.x + hole.w / 2, hole.y + hole.h / 2, hole.w + 4, hole.h + 4).setStrokeStyle(4, AMBER);
    items.push(frame);

    // 행동 단계에서는 누를 곳을 화살표로 짚어 줍니다.
    if (!options.readOnly) {
      const point = step.target.kind === 'cells'
        ? { x: BOARD_LEFT + (step.target.cells[0] % COLS) * CELL + CELL / 2, y: hole.y - 6 }
        : { x: hole.x + hole.w / 2, y: hole.y - 6 };
      const arrow = this.scene.add.triangle(point.x, point.y - 10, 0, 0, 22, 0, 11, 16, AMBER).setStrokeStyle(2, BORDER);
      items.push(arrow);
      if (!this.reduced) this.scene.tweens.add({ targets: arrow, y: point.y - 2, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // 말풍선: 강조 영역과 겹치지 않는 쪽(위 또는 아래)에 둡니다.
    const below = hole.y + hole.h / 2 < 330;
    const bubbleY = below ? Math.min(700, hole.y + hole.h + 92) : Math.max(110, hole.y - 92);
    const bubble = this.scene.add.rectangle(195, bubbleY, 356, 136, CREAM).setStrokeStyle(4, BORDER);
    const title = this.scene.add.text(28, bubbleY - 56, step.title, textStyle(13, '#a14a38'));
    const counter = this.scene.add.text(362, bubbleY - 56, `${options.index + 1}/${options.total}`, textStyle(10, MUTED)).setOrigin(1, 0);
    const text = this.scene.add.text(28, bubbleY - 32, step.text, { ...textStyle(12, INK, false), lineSpacing: 4 });
    items.push(bubble, title, counter, text);
    if (step.advance.on === 'next') {
      const last = options.index === options.total - 1;
      const next = this.scene.add.rectangle(306, bubbleY + 42, 104, 30, GREEN).setStrokeStyle(3, BORDER).setInteractive({ useHandCursor: true }).on('pointerdown', options.onNext);
      items.push(next, this.scene.add.text(306, bubbleY + 42, last ? '시작하기 ▶' : '다음 →', textStyle(11, CREAM_TEXT)).setOrigin(0.5));
    } else {
      items.push(this.scene.add.text(28, bubbleY + 36, '▲ 강조된 곳을 직접 눌러 보세요', textStyle(10, '#3f7851')));
    }
    // 행동 단계에는 다음 버튼이 없으므로 건너뛰기를 오른쪽에 둡니다.
    const skipX = step.advance.on === 'next' ? 84 : 306;
    const skip = this.scene.add.rectangle(skipX, bubbleY + 42, 92, 26, GOLD).setStrokeStyle(2, BORDER).setInteractive({ useHandCursor: true }).on('pointerdown', options.onSkip);
    items.push(skip, this.scene.add.text(skipX, bubbleY + 42, '건너뛰기 ✕', textStyle(10, INK)).setOrigin(0.5));

    this.layer = this.scene.add.container(0, 0, items).setDepth(55);
    if (!this.reduced) this.scene.tweens.add({ targets: frame, alpha: { from: 1, to: 0.45 }, duration: 520, yoyo: true, repeat: -1 });
  }
}
