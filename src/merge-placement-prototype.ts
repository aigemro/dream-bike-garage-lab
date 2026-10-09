// 머지 코어 E v3: 일반 프로젝트 게임 화면(게임 화면 디자인 B안 · 390×810) 디자인 정렬
// 화면 구성과 연출은 D안과 같은 merge-play-screen을 쓰고, 규칙은 merge-placement-state
// (가운데→바깥 예정 입고·이동 금지·인접 2개 합성·연쇄 보너스)를 사용합니다.
import Phaser from 'phaser';
import { ReleaseAudio, type ReleaseSfxEvent } from './release-audio';
import {
  CAP, KINDS, ORDER_LEVELS, COMBO_FREE_BOX, COMBO_GUARANTEE,
  fresh, restore, recover, nextSlot, supply, supplyBlock, drop, undo, returnPart, canMerge, mergeTargets,
  type State, type ProgressEvent,
} from './merge-placement-state';
import { NONE, resolveTap, resolveDrop, type InputOutcome } from './merge-placement-input';
import {
  applyRescue, isStuck, localDate, parseRescueRecord, recommendMerge, rescueRemaining, shouldShowHint, useRescue, RESCUE_PER_DAY,
  type RescueRecord,
} from './merge-assist';
import {
  CREAM_TEXT, SUCCESS, ALERT, MUTED, INK, CREAM, BROWN, BORDER, RED, GREEN, AMBER, PART_COLORS, ROW2_Y, SMALL_LEFT, SMALL_RIGHT,
  cellCenter, cellAt, drawBackdrop, drawHeader, makePiece, OrderCard, drawBoard, createNextMarker, InfoLine, drawShelf,
  smallButton, BoxButton, infoPanel, EnergyPanel, Motion, launchMergeDemo, recoveryLabel, createMergeGame, DayHeader,
  type DemoHooks, type MergeDemoHandle, type Tone, type DaySummary,
} from './merge-play-screen';

/** 기존 E안 저장 키를 유지해 v1·v2 진행을 v3로 이전합니다. */
export const KEY = 'dbg-lab-merge-placement-e-v1';
const RETURN_ARM_MS = 2500;
type Drag = { from: number; x: number; y: number; dragging: boolean; hover: number; ghost?: Phaser.GameObjects.Container };

/**
 * Day 세션 연결 계약 (DAY_SESSION_MAIN_APPLICATION.md 4.2).
 * E안은 납품을 행동 시점에 동기적으로 확정하므로 '연출 중' 알림 없이 납품 1건마다 onOrderDelivered를 한 번 호출합니다.
 */
export type PlacementDayLink = {
  load(): string | null;
  save(raw: string): boolean;
  /** 저장된 작업대가 없을 때 이어서 시작할 주문 순번 */
  initialOrder: number;
  getDay(): DaySummary;
  /** 참이면 상자 열기·합성·반품·되돌리기를 받지 않습니다 (Day 마감·일시정지). */
  isInputLocked(): boolean;
  onOrderDelivered(result: { orderIndex: number; reward: number }): void;
  onSfx(event: ReleaseSfxEvent): void;
};
/**
 * 막힘 완화 보조(#264). hint: B안 합성 추천, rescue: C안 막힘 구제(하루 1회 정리).
 * 정리 횟수는 작업대 저장과 따로 `${KEY}-rescue`에 기기 날짜 기준으로 저장합니다.
 */
export type PlacementAssist = 'hint' | 'rescue';
type SceneHooks = DemoHooks & { day?: PlacementDayLink; assist?: PlacementAssist; rescueKey?: string };

class MergePlacementScene extends Phaser.Scene {
  private s!: State;
  private selected = NONE;
  // 막힘 완화 보조 상태
  private hintGfx!: Phaser.GameObjects.Graphics;
  private hintShown = false;
  private lastInputAt = 0;
  private rescueRecord: RescueRecord | null = null;
  private accelerated = false;
  private accelTicks = 0;
  private alive = false;
  private generation = 0;
  private queue: Promise<void> = Promise.resolve();
  private view = { order: 0, installed: [false, false, false, false], coins: 0 };
  private pieces = new Map<number, Phaser.GameObjects.Container>();
  private arriving = new Set<number>();
  private drag?: Drag;
  private returnArmedUntil = 0;
  private readonly audio = new ReleaseAudio();
  private motion!: Motion;
  private metrics?: Phaser.GameObjects.Text;
  private dayHeader?: DayHeader;
  private order!: OrderCard;
  private nextMarker!: Phaser.GameObjects.Container;
  private highlight!: Phaser.GameObjects.Graphics;
  private dropHint!: Phaser.GameObjects.Graphics;
  private info!: InfoLine;
  private box!: BoxButton;
  private undoButton!: Phaser.GameObjects.Rectangle;
  private undoLabel!: Phaser.GameObjects.Text;
  private returnButton!: Phaser.GameObjects.Rectangle;
  private returnLabel!: Phaser.GameObjects.Text;
  private energy!: EnergyPanel;
  private comboText!: Phaser.GameObjects.Text;
  private comboDots: Phaser.GameObjects.Rectangle[] = [];
  private tokenText!: Phaser.GameObjects.Text;

  constructor(private readonly hooks: SceneHooks) { super('merge-placement-e-v3'); }

  create() {
    this.alive = true;
    this.motion = new Motion(this, window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true);
    this.audio.setEnabled(false, true); // 랩 체험은 효과음만 사용합니다.
    const raw = this.hooks.load();
    this.s = raw === null && this.hooks.day ? fresh(Date.now(), this.hooks.day.initialOrder) : restore(raw, Date.now());
    this.syncView();
    drawBackdrop(this);
    if (this.hooks.day) {
      this.dayHeader = new DayHeader(this);
      this.dayHeader.render(this.hooks.day.getDay());
    } else {
      this.metrics = drawHeader(this);
    }
    this.order = new OrderCard(this);
    drawBoard(this, (index, pointer) => this.onDown(index, pointer));
    this.nextMarker = createNextMarker(this, this.motion.reduced);
    this.highlight = this.add.graphics().setDepth(5);
    this.dropHint = this.add.graphics().setDepth(6);
    this.hintGfx = this.add.graphics().setDepth(7);
    this.lastInputAt = this.time.now;
    this.rescueRecord = this.loadRescue();
    this.info = new InfoLine(this, () => this.deselect());
    this.drawShelf();
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('gameout', this.cancelDrag, this);
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tick() });
    this.events.once('shutdown', () => this.shutdown());
    this.events.once('destroy', () => this.shutdown());
    const saved = this.persist();
    this.renderAll();
    this.info.set(!saved
      ? '저장할 수 없어 이 화면에서만 진행돼요. 점선 칸이 다음 입고 자리예요.'
      : this.hooks.day
        ? '영업 시작! 점선 칸이 다음 입고 자리예요. 맞닿은 같은 부품을 눌러 합성하세요.'
        : '점선 칸이 다음 입고 자리예요. 상하좌우로 맞닿은 같은 부품을 눌러 합성하세요.');
    this.showStuckNotice();
    this.changed();
  }

  update() {
    if (this.alive && this.hooks.day) this.dayHeader?.render(this.hooks.day.getDay());
  }

  // Day 마감·일시정지 중에는 새 입력을 받지 않습니다.
  private inputLocked() {
    if (!this.hooks.day?.isInputLocked()) return false;
    this.cancelDrag();
    this.say('영업 시간이 끝났어요. 오늘 정산을 준비하고 있어요.', 'error');
    return true;
  }

  // ── 랩 도구 · 생명주기 ──
  labCharge() {
    if (!this.alive) return;
    this.s.energy = CAP; this.s.anchor = Date.now();
    this.persist(); this.renderShelf(); this.info.set('테스트용 체력을 충전했어요.');
    this.changed();
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
    this.rescueRecord = null;
    this.saveRescue();
    this.info.set('E안 첫 주문을 시작합니다. 점선 칸이 다음 입고 자리예요.');
    this.changed();
  }
  flush() {
    if (!this.alive) return;
    this.cancelDrag();
    recover(this.s, Date.now());
    this.persist();
  }
  private shutdown() {
    if (!this.alive) return;
    recover(this.s, Date.now());
    this.persist();
    this.alive = false;
    this.audio.destroy();
    this.motion.clear();
  }

  private drawShelf() {
    // 게임 화면 B안의 '택배 선반' 자리와 크기에 E안의 부품 상자 하나를 둡니다.
    drawShelf(this, '부품 상자 · PARTS BOX', `${COMBO_FREE_BOX}연쇄 무료 상자 · ${COMBO_GUARANTEE}연쇄 필수 부품`);
    this.box = new BoxButton(this, '부품 상자 열기', () => this.onSupply());
    [this.undoButton, this.undoLabel] = smallButton(this, SMALL_LEFT, '↶\n되돌리기', () => this.onUndo());
    [this.returnButton, this.returnLabel] = smallButton(this, SMALL_RIGHT, '↗\n반품', () => this.onReturn());
    this.energy = new EnergyPanel(this);
    const combo = infoPanel(this, 286);
    this.comboText = combo.title;
    this.tokenText = combo.sub.setColor(MUTED).setFontStyle('bold');
    for (let i = 0; i < COMBO_GUARANTEE; i++) {
      const milestone = i === COMBO_FREE_BOX - 1 || i === COMBO_GUARANTEE - 1;
      this.comboDots.push(this.add.rectangle(306 + i * 14, ROW2_Y - 11, milestone ? 11 : 9, milestone ? 11 : 9, CREAM).setStrokeStyle(2, BORDER).setDepth(4));
    }
  }

  // ── 표시 ──
  private renderAll() { this.clearHint(); this.renderBoard(); this.renderOrder(); this.renderHeader(); this.renderShelf(); }

  private renderBoard() {
    this.pieces.forEach(piece => piece.destroy(true));
    this.pieces.clear();
    this.s.board.forEach((part, index) => {
      if (!part) return;
      const piece = makePiece(this, part, cellCenter(index));
      if (this.arriving.has(index)) piece.setAlpha(0);
      this.pieces.set(index, piece);
    });
    const slot = nextSlot(this.s);
    this.nextMarker.setVisible(slot >= 0);
    if (slot >= 0) this.nextMarker.setPosition(cellCenter(slot).x, cellCenter(slot).y);
    this.renderHighlights();
  }

  private renderHighlights() {
    this.highlight.clear();
    const active = this.selected !== NONE && !!this.s.board[this.selected];
    this.pieces.forEach((piece, index) => piece.setScale(active && index === this.selected ? 1.06 : 1));
    this.info.showCancel(active);
    if (!active) return;
    const center = cellCenter(this.selected);
    this.highlight.lineStyle(3, CREAM, 1).strokeRect(center.x - 26, center.y - 26, 52, 52);
    for (const target of mergeTargets(this.s, this.selected)) {
      const at = cellCenter(target);
      this.highlight.fillStyle(GREEN, 0.2).fillRect(at.x - 22, at.y - 22, 44, 44);
      this.highlight.lineStyle(4, GREEN, 1).strokeRect(at.x - 24, at.y - 24, 48, 48);
    }
  }

  private renderOrder() { this.order.render(this.view.order, this.view.installed, '완성 즉시 자동 장착'); }
  private renderHeader() { this.metrics?.setText(`급여 ${this.view.coins.toLocaleString()} C · 머지 ${this.s.merges}`); }

  private renderShelf() {
    const block = supplyBlock(this.s);
    const free = this.s.freeBoxes > 0, sure = this.s.guarantees > 0;
    if (this.rescueMode() && isStuck(this.s)) {
      // C안: 막힘이면 상자 버튼이 '무료 정리' 버튼이 됩니다.
      const remaining = rescueRemaining(this.rescueRecord, localDate());
      this.box.render({
        blocked: remaining === 0,
        highlight: remaining > 0,
        status: remaining > 0 ? '막힘! 눌러서 무료 정리 · 부품 2개 회수' : '오늘 정리를 썼어요 · 반품으로 자리 확보',
        statusColor: remaining > 0 ? SUCCESS : ALERT,
        cost: `정리 ${remaining}/${RESCUE_PER_DAY}`,
        costColor: remaining > 0 ? SUCCESS : ALERT,
      });
    } else this.box.render({
      blocked: Boolean(block),
      highlight: free,
      status: block === 'full'
        ? '작업대가 가득 찼어요 · 반품으로 자리 확보'
        : block === 'energy'
          ? `체력 회복 중 · 다음 +1 ${recoveryLabel(this.s.anchor)}`
          : `${free ? '무료 상자 · 체력 소모 없음' : '점선 칸에 자동 배치'}${sure ? ' · 필수 부품 확정' : ''}`,
      statusColor: block ? ALERT : free || sure ? SUCCESS : MUTED,
      cost: free ? `무료 ×${this.s.freeBoxes}` : '⚡ −1',
      costColor: free ? SUCCESS : ALERT,
    });
    const canUndo = Boolean(this.s.undo);
    this.undoButton.setAlpha(canUndo ? 1 : 0.45);
    this.undoLabel.setAlpha(canUndo ? 1 : 0.6);
    const canReturn = this.selected !== NONE && !!this.s.board[this.selected];
    const armed = canReturn && this.time.now < this.returnArmedUntil;
    this.returnButton.setFillStyle(armed ? RED : BROWN).setAlpha(canReturn ? 1 : 0.45);
    this.returnLabel.setText(armed ? '한 번 더\n눌러 반품' : '↗\n반품').setAlpha(canReturn ? 1 : 0.6);
    this.energy.render(this.s.energy, this.s.anchor, this.accelerated);
    this.comboText.setText(`연쇄 합성 ${this.s.combo}`);
    this.comboDots.forEach((dot, i) => dot.setFillStyle(i < this.s.combo ? (i < COMBO_FREE_BOX ? GREEN : AMBER) : CREAM));
    this.tokenText.setText(`무료 상자 ${this.s.freeBoxes} · 확정 ${this.s.guarantees}`);
  }

  // ── 입력: 탭 선택 → 대상 탭 (게임 화면 B안과 동일), 드래그 놓기도 같은 규칙 ──
  private onDown(index: number, pointer: Phaser.Input.Pointer) {
    this.markInput();
    if (this.drag || this.inputLocked()) return;
    this.drag = { from: index, x: pointer.x, y: pointer.y, dragging: false, hover: NONE };
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    const drag = this.drag;
    if (!drag || !pointer.isDown || !this.s.board[drag.from]) return;
    if (!drag.dragging) {
      if (Phaser.Math.Distance.Between(drag.x, drag.y, pointer.x, pointer.y) < 8) return;
      drag.dragging = true;
      drag.ghost = makePiece(this, this.s.board[drag.from]!, { x: pointer.x, y: pointer.y }).setDepth(40).setScale(1.1).setAlpha(0.92);
      this.pieces.get(drag.from)?.setAlpha(0.35);
    }
    drag.ghost?.setPosition(pointer.x, pointer.y - 10);
    const over = cellAt(pointer.x, pointer.y);
    if (over === drag.hover) return;
    drag.hover = over;
    this.dropHint.clear();
    if (over === NONE || over === drag.from) return;
    const at = cellCenter(over);
    this.dropHint.lineStyle(4, canMerge(this.s, drag.from, over) ? GREEN : RED, 1).strokeRect(at.x - 24, at.y - 24, 48, 48);
  }

  private onUp(pointer: Phaser.Input.Pointer) {
    const drag = this.drag;
    if (!drag) return;
    this.clearDrag(drag);
    this.apply(drag.dragging
      ? resolveDrop(this.s, drag.from, cellAt(pointer.x, pointer.y))
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
    this.say(outcome.message, outcome.tone);
    this.renderHighlights();
    this.renderShelf();
  }

  private deselect() {
    this.markInput();
    this.selected = NONE;
    this.returnArmedUntil = 0;
    this.say('선택을 취소했어요.');
    this.renderHighlights();
    this.renderShelf();
  }

  // ── 행동 ──
  private onSupply() {
    this.markInput();
    if (this.inputLocked()) return;
    this.cancelDrag();
    recover(this.s, Date.now());
    if (this.rescueMode() && isStuck(this.s)) { this.onRescue(); return; }
    const block = supplyBlock(this.s);
    if (block) {
      this.say(block === 'full'
        ? (this.hooks.assist === 'hint' && !isStuck(this.s)
          ? '작업대에 빈칸이 없어요. 반짝이는 추천 쌍부터 합성해 보세요.'
          : '작업대에 빈칸이 없어요. 합성하거나 부품을 반품해 자리를 만드세요.')
        : '알바 체력이 부족해요. 회복을 기다리거나 연쇄 합성으로 무료 상자를 모아 보세요.', 'error');
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

  // C안: 막힘일 때 하루 1회 무료 정리
  private onRescue() {
    const today = localDate();
    if (rescueRemaining(this.rescueRecord, today) <= 0) {
      this.say('오늘 정리는 이미 썼어요. 부품을 눌러 고른 뒤 반품으로 자리를 만드세요.', 'error');
      this.renderShelf();
      return;
    }
    const result = applyRescue(this.s);
    if (!result) return;
    this.rescueRecord = useRescue(this.rescueRecord, today);
    this.saveRescue();
    this.resetQueue();
    this.selected = NONE; this.returnArmedUntil = 0;
    this.persist(); this.renderAll();
    result.removed.forEach(({ index }) => this.motion.floatText(cellCenter(index).x, cellCenter(index).y - 10, '회수', CREAM_TEXT));
    this.sfx('reward');
    this.info.set(`정리 완료 · ${result.removed.map(({ part }) => `${KINDS[part.kind]} Lv.${part.level}`).join(', ')} 회수. 다음 상자는 무료이고 필요한 부품이 나와요.`);
    this.changed();
  }

  private onUndo() {
    this.markInput();
    if (this.inputLocked()) return;
    this.cancelDrag();
    if (!undo(this.s)) {
      this.say('되돌릴 행동이 없어요. 새 상자를 열면 되돌리기 기록이 지워져요.', 'error');
      return;
    }
    this.resetQueue();
    this.selected = NONE; this.returnArmedUntil = 0;
    this.syncView(); this.persist(); this.renderAll();
    this.say('직전 행동을 되돌렸어요. 자동 장착·납품·연쇄 보너스도 함께 되돌아가요.');
    this.changed();
  }

  private onReturn() {
    this.markInput();
    if (this.inputLocked()) return;
    this.cancelDrag();
    const part = this.selected === NONE ? null : this.s.board[this.selected];
    if (!part) {
      this.say('반품할 부품을 먼저 눌러 선택하세요.', 'error');
      return;
    }
    if (this.time.now >= this.returnArmedUntil) {
      this.returnArmedUntil = this.time.now + RETURN_ARM_MS;
      this.say('한 번 더 누르면 선택한 부품을 반품해요. 체력은 돌아오지 않아요.');
      this.renderShelf();
      this.time.delayedCall(RETURN_ARM_MS + 50, () => { if (this.alive) this.renderShelf(); });
      return;
    }
    returnPart(this.s, this.selected);
    this.selected = NONE; this.returnArmedUntil = 0;
    this.persist(); this.renderBoard(); this.renderShelf();
    this.say(`${KINDS[part.kind]} Lv.${part.level} 반품 완료 · ↶ 되돌리기로 복구할 수 있어요.`);
    this.changed();
  }

  private commit(events: ProgressEvent[]) {
    this.returnArmedUntil = 0;
    const delivered = events.filter(event => event.type === 'delivered');
    // Day 세션에서는 급여가 바로 계정에 들어가므로, 납품이 포함된 행동은 되돌리지 않습니다.
    if (this.hooks.day && delivered.length > 0) this.s.undo = null;
    this.persist();
    delivered.forEach(event => this.hooks.day?.onOrderDelivered({ orderIndex: (event.order - 1) % ORDER_LEVELS.length, reward: event.reward }));
    this.arriving = new Set(events.flatMap(event => (event.type === 'placed' && this.s.board[event.index] ? [event.index] : [])));
    this.renderBoard();
    this.renderHeader();
    this.renderShelf();
    this.info.set(this.describe(events));
    this.showStuckNotice();
    this.enqueue(events);
    this.changed();
    this.maybeHint();
  }

  // ── 막힘 완화 보조 (#264) ──
  private rescueMode() { return this.hooks.assist === 'rescue'; }

  // 보조 방안에서 막힘이면 원인과 탈출 방법을 안내합니다.
  private showStuckNotice() {
    if (!this.hooks.assist || !isStuck(this.s)) return;
    this.info.set(this.rescueMode() && rescueRemaining(this.rescueRecord, localDate()) > 0
      ? '작업대가 막혔어요(빈칸·합성 쌍 없음). 상자 버튼을 눌러 무료 정리를 쓰세요.'
      : '작업대가 막혔어요(빈칸·합성 쌍 없음). 필요 없는 부품을 골라 반품하세요.', 'error');
  }

  private markInput() {
    this.lastInputAt = this.time.now;
    this.clearHint();
  }

  // B안: 선택 중이 아니고, 빈칸이 6칸 이하이거나 8초 동안 입력이 없으면 먼저 합칠 쌍 1개를 반짝입니다.
  private maybeHint() {
    if (!this.alive || this.hooks.assist !== 'hint' || this.hintShown || this.drag) return;
    if (!shouldShowHint(this.s, this.time.now - this.lastInputAt, this.selected !== NONE && !!this.s.board[this.selected])) return;
    const pick = recommendMerge(this.s);
    if (!pick) return;
    this.hintShown = true;
    this.hintGfx.clear().setAlpha(1);
    for (const index of [pick.from, pick.to]) {
      const at = cellCenter(index);
      this.hintGfx.lineStyle(4, AMBER, 1).strokeRect(at.x - 25, at.y - 25, 50, 50);
    }
    if (!this.motion.reduced) this.tweens.add({ targets: this.hintGfx, alpha: { from: 1, to: 0.3 }, duration: 520, yoyo: true, repeat: -1 });
    const effect = pick.delivers ? '납품까지 이어져요' : pick.installs > 0 ? '바로 장착돼요' : '다음 합성 자리가 남아요';
    this.info.set(`추천 · 노랗게 반짝이는 ${KINDS[pick.part.kind]} Lv.${pick.part.level} 두 개를 먼저 합치면 ${effect}.`);
  }

  private clearHint() {
    if (!this.hintGfx) return;
    this.tweens.killTweensOf(this.hintGfx);
    this.hintGfx.clear().setAlpha(1);
    this.hintShown = false;
  }

  private loadRescue() {
    if (!this.rescueMode() || !this.hooks.rescueKey) return null;
    try { return parseRescueRecord(localStorage.getItem(this.hooks.rescueKey)); } catch { return null; }
  }

  private saveRescue() {
    if (!this.rescueMode() || !this.hooks.rescueKey) return;
    try {
      if (this.rescueRecord) localStorage.setItem(this.hooks.rescueKey, JSON.stringify(this.rescueRecord));
      else localStorage.removeItem(this.hooks.rescueKey);
    } catch { /* 저장할 수 없으면 이 화면에서만 횟수를 셉니다. */ }
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
    if (before !== this.s.energy) { this.persist(); this.changed(); }
    this.renderShelf();
    this.maybeHint();
  }

  private say(message: string, tone: Tone = 'info') {
    this.info.set(message, tone);
    this.sfx(tone === 'error' ? 'error' : 'tap');
  }
  private persist() { return this.hooks.save(JSON.stringify(this.s)); }
  private syncView() { this.view = { order: this.s.order, installed: [...this.s.installed], coins: this.s.coins }; }
  private changed() {
    this.hooks.onChange?.(`공급 ${this.s.supplied} · 합성 ${this.s.merges} · 반품 ${this.s.returned} · 납품 ${this.s.order} · 무료 상자 사용 ${this.s.freeUsed}`);
  }
  private sfx(event: ReleaseSfxEvent) {
    if (this.hooks.day) this.hooks.day.onSfx(event);
    else this.audio.play(event);
  }

  // ── 연출: 상태는 즉시 반영하고, 주문 카드·급여 표시는 이벤트 순서대로 따라갑니다 ──
  private enqueue(events: ProgressEvent[]) {
    const generation = this.generation;
    this.queue = this.queue.then(() => this.play(events, generation));
  }
  private resetQueue() {
    this.generation++;
    this.queue = Promise.resolve();
    this.arriving.clear();
    this.motion.clear();
  }

  private async play(events: ProgressEvent[], generation: number) {
    for (const event of events) {
      if (!this.alive || generation !== this.generation) return;
      this.hooks.onMotion?.(event);
      if (event.type === 'placed') {
        this.sfx('parcel');
        await this.motion.arrive(event.part, cellCenter(event.index));
        if (this.arriving.delete(event.index)) this.pieces.get(event.index)?.setAlpha(1);
      } else if (event.type === 'merged') {
        this.sfx('merge');
        await this.motion.slide({ kind: event.part.kind, level: event.part.level - 1 }, cellCenter(event.from), cellCenter(event.to), true);
        const stays = this.s.board[event.to]?.kind === event.part.kind && this.s.board[event.to]?.level === event.part.level;
        const piece = stays ? this.pieces.get(event.to) : undefined;
        await this.motion.pop(piece, event.part, cellCenter(event.to), piece && this.selected === event.to ? 1.06 : 1);
        if (event.combo >= 2) this.motion.floatText(cellCenter(event.to).x, cellCenter(event.to).y - 30, `${event.combo}연쇄!`, event.combo >= COMBO_FREE_BOX ? '#dff0d0' : CREAM_TEXT);
      } else if (event.type === 'bonus') {
        this.sfx('reward');
        if (event.bonus === 'free-box') this.motion.banner(`${COMBO_FREE_BOX}연쇄! 다음 상자 무료`, GREEN, CREAM_TEXT);
        else this.motion.banner(`${COMBO_GUARANTEE}연쇄! 다음 상자 필수 부품 확정`, AMBER, INK);
      } else if (event.type === 'installed') {
        await this.motion.install(cellCenter(event.from), this.order.bikeAnchor(event.order, event.kind), PART_COLORS[event.kind]);
        this.sfx('install');
        if (this.view.order === event.order) { this.view.installed[event.kind] = true; this.renderOrder(); }
      } else {
        this.sfx('complete');
        await this.motion.delivered(event.name, event.reward, () => {
          this.view = { order: event.order, installed: [false, false, false, false], coins: this.view.coins + event.reward };
          this.renderOrder();
          this.renderHeader();
          this.sfx('reward');
        });
      }
    }
  }
}

/**
 * E v3 체험 화면을 시작합니다. toolsId가 있으면 그 요소에 랩 테스트 도구(체력 충전·가속·초기화)를 그립니다.
 */
export function startMergePlacement(parent: string, toolsId?: string, assist?: PlacementAssist): MergeDemoHandle {
  // 보조 방안은 기준선(E v3)과 진행이 섞이지 않도록 저장 키를 나눕니다.
  const key = assist ? `${KEY}-${assist}` : KEY;
  const label = assist === 'hint' ? 'E안 합성 추천' : assist === 'rescue' ? 'E안 막힘 구제' : 'E안';
  return launchMergeDemo({
    parent, toolsId, key, resetLabel: label,
    saveLabel: assist ? `${label} 자동 저장 · 기준선 E v3와 별도 진행` : 'E안 자동 저장 · 기존 v1·v2 진행 이전 지원',
    createScene: (hooks) => new MergePlacementScene({ ...hooks, assist, rescueKey: `${key}-rescue` }),
  });
}

/**
 * Day 세션 화면에 E v3 작업대를 띄웁니다. 저장·Day 표시·입력 잠금·납품 통지는 Day 컨트롤러가 맡습니다.
 */
export function startPlacementForDay(parent: string, link: PlacementDayLink): Phaser.Game {
  return createMergeGame(parent, new MergePlacementScene({ load: link.load, save: link.save, day: link }));
}
