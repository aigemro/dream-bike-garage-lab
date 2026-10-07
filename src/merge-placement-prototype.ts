// 머지 코어 E v3: 일반 프로젝트 게임 화면(게임 화면 디자인 B안 · 390×810) 디자인 정렬
// 화면 구성과 연출은 D안과 같은 merge-play-screen을 쓰고, 규칙은 merge-placement-state
// (가운데→바깥 예정 입고·이동 금지·인접 2개 합성·연쇄 보너스)를 사용합니다.
import Phaser from 'phaser';
import { ReleaseAudio, type ReleaseSfxEvent } from './release-audio';
import {
  CAP, KINDS, COMBO_FREE_BOX, COMBO_GUARANTEE,
  fresh, restore, recover, nextSlot, supply, supplyBlock, drop, undo, returnPart, canMerge, mergeTargets,
  type State, type ProgressEvent,
} from './merge-placement-state';
import { NONE, resolveTap, resolveDrop, type InputOutcome } from './merge-placement-input';
import {
  CREAM_TEXT, SUCCESS, ALERT, MUTED, INK, CREAM, BROWN, BORDER, RED, GREEN, AMBER, PART_COLORS, ROW2_Y, SMALL_LEFT, SMALL_RIGHT,
  cellCenter, cellAt, drawBackdrop, drawHeader, makePiece, OrderCard, drawBoard, createNextMarker, InfoLine, drawShelf,
  smallButton, BoxButton, infoPanel, EnergyPanel, Motion, launchMergeDemo, recoveryLabel,
  type DemoHooks, type MergeDemoHandle, type Tone,
} from './merge-play-screen';

/** 기존 E안 저장 키를 유지해 v1·v2 진행을 v3로 이전합니다. */
export const KEY = 'dbg-lab-merge-placement-e-v1';
const RETURN_ARM_MS = 2500;
type Drag = { from: number; x: number; y: number; dragging: boolean; hover: number; ghost?: Phaser.GameObjects.Container };

class MergePlacementScene extends Phaser.Scene {
  private s!: State;
  private selected = NONE;
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
  private metrics!: Phaser.GameObjects.Text;
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

  constructor(private readonly hooks: DemoHooks) { super('merge-placement-e-v3'); }

  create() {
    this.alive = true;
    this.motion = new Motion(this, window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true);
    this.audio.setEnabled(false, true); // 랩 체험은 효과음만 사용합니다.
    this.s = restore(this.hooks.load(), Date.now());
    this.syncView();
    drawBackdrop(this);
    this.metrics = drawHeader(this);
    this.order = new OrderCard(this);
    drawBoard(this, (index, pointer) => this.onDown(index, pointer));
    this.nextMarker = createNextMarker(this, this.motion.reduced);
    this.highlight = this.add.graphics().setDepth(5);
    this.dropHint = this.add.graphics().setDepth(6);
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
    this.info.set(saved
      ? '점선 칸이 다음 입고 자리예요. 상하좌우로 맞닿은 같은 부품을 눌러 합성하세요.'
      : '저장할 수 없어 이 화면에서만 진행돼요. 점선 칸이 다음 입고 자리예요.');
    this.changed();
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
  private renderAll() { this.renderBoard(); this.renderOrder(); this.renderHeader(); this.renderShelf(); }

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
  private renderHeader() { this.metrics.setText(`급여 ${this.view.coins.toLocaleString()} C · 머지 ${this.s.merges}`); }

  private renderShelf() {
    const block = supplyBlock(this.s);
    const free = this.s.freeBoxes > 0, sure = this.s.guarantees > 0;
    this.box.render({
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
    if (this.drag) return;
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
    this.selected = NONE;
    this.returnArmedUntil = 0;
    this.say('선택을 취소했어요.');
    this.renderHighlights();
    this.renderShelf();
  }

  // ── 행동 ──
  private onSupply() {
    this.cancelDrag();
    recover(this.s, Date.now());
    const block = supplyBlock(this.s);
    if (block) {
      this.say(block === 'full'
        ? '작업대에 빈칸이 없어요. 합성하거나 부품을 반품해 자리를 만드세요.'
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

  private onUndo() {
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
    this.persist();
    this.arriving = new Set(events.flatMap(event => (event.type === 'placed' && this.s.board[event.index] ? [event.index] : [])));
    this.renderBoard();
    this.renderHeader();
    this.renderShelf();
    this.info.set(this.describe(events));
    this.enqueue(events);
    this.changed();
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
  private sfx(event: ReleaseSfxEvent) { this.audio.play(event); }

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
export function startMergePlacement(parent: string, toolsId?: string): MergeDemoHandle {
  return launchMergeDemo({
    parent, toolsId, key: KEY, resetLabel: 'E안', saveLabel: 'E안 자동 저장 · 기존 v1·v2 진행 이전 지원',
    createScene: (hooks) => new MergePlacementScene(hooks),
  });
}
