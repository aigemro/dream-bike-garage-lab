// 머지 코어 D v3: 일반 프로젝트 게임 화면(게임 화면 디자인 B안 · 390×810) 디자인 정렬
// 화면 구성과 연출은 E안과 같은 merge-play-screen을 쓰고, 규칙은 merge-intake-state
// (가운데→바깥 입고·자유 이동·거리 무관 2개 겹치기·직접 장착)를 사용합니다.
import Phaser from 'phaser';
import { ReleaseAudio, type ReleaseSfxEvent } from './release-audio';
import {
  CAP, KINDS, SIZE, fresh, restore, recover, nextSlot, supply, supplyBlock, canMerge, mergeTargets, drop, canInstall, install, returnPart,
  type State, type ProgressEvent, type DropResult, type Part,
} from './merge-intake-state';
import { NONE, resolveTap, resolveDrop, resolveInstall, type InputOutcome } from './merge-intake-input';
import {
  ALERT, MUTED, CREAM, BROWN, RED, GREEN, AMBER, PART_COLORS, SMALL_LEFT, SMALL_RIGHT,
  cellCenter, cellAt, inOrderCard, recoveryLabel, drawBackdrop, drawHeader, makePiece, OrderCard, drawBoard, createNextMarker,
  InfoLine, drawShelf, smallButton, BoxButton, infoPanel, EnergyPanel, Motion, launchMergeDemo,
  type DemoHooks, type MergeDemoHandle, type Tone,
} from './merge-play-screen';

/** 기존 D안 저장 키를 유지해 v1·v2 진행을 v3로 이전합니다. */
export const KEY = 'dbg-lab-merge-intake-v1';
const RETURN_ARM_MS = 2500;
const ORDER_NOTE = '부품을 골라 직접 장착';
type Drag = { from: number; x: number; y: number; dragging: boolean; hover: number; overCard: boolean; ghost?: Phaser.GameObjects.Container };

class MergeIntakeScene extends Phaser.Scene {
  private s!: State;
  private selected = NONE;
  private accelerated = false;
  private accelTicks = 0;
  private alive = false;
  private generation = 0;
  private queue: Promise<void> = Promise.resolve();
  private view = { order: 0, installed: [false, false, false, false], coins: 0 };
  private pieces = new Map<number, Phaser.GameObjects.Container>();
  private hidden = new Set<number>(); // 입고·이동 연출이 끝날 때까지 숨겨 두는 칸
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
  private installButton!: Phaser.GameObjects.Rectangle;
  private installLabel!: Phaser.GameObjects.Text;
  private returnButton!: Phaser.GameObjects.Rectangle;
  private returnLabel!: Phaser.GameObjects.Text;
  private energy!: EnergyPanel;
  private benchTitle!: Phaser.GameObjects.Text;
  private benchSub!: Phaser.GameObjects.Text;

  constructor(private readonly hooks: DemoHooks) { super('merge-intake-d-v3'); }

  create() {
    this.alive = true;
    this.motion = new Motion(this, window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true);
    this.audio.setEnabled(false, true); // 랩 체험은 효과음만 사용합니다.
    this.s = restore(this.hooks.load(), Date.now());
    this.syncView();
    drawBackdrop(this);
    this.metrics = drawHeader(this);
    this.order = new OrderCard(this, (kind) => this.apply(resolveInstall(this.s, this.selected, kind)));
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
      ? '사장님: 입고 부품을 정리해 고객 자전거를 조립해 주세요. 같은 부품을 차례로 누르면 합쳐져요.'
      : '저장할 수 없어 이 화면에서만 진행돼요. 같은 부품을 차례로 누르면 합쳐져요.');
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
    this.info.set('D안 첫 주문을 시작합니다. 같은 부품을 겹쳐 합성하고 직접 장착하세요.');
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
    // 게임 화면 B안의 '택배 선반' 자리와 크기에 D안의 입고 상자·장착·반납을 둡니다.
    drawShelf(this, '입고 상자 · INTAKE BOX', '자유 이동 · 거리 무관 2개 겹치기');
    this.box = new BoxButton(this, '입고 상자 열기', () => this.onSupply());
    [this.installButton, this.installLabel] = smallButton(this, SMALL_LEFT, '↑\n장착', () => this.apply(resolveInstall(this.s, this.selected)));
    [this.returnButton, this.returnLabel] = smallButton(this, SMALL_RIGHT, '↗\n반납', () => this.onReturn());
    this.energy = new EnergyPanel(this);
    ({ title: this.benchTitle, sub: this.benchSub } = infoPanel(this, 286));
  }

  // ── 표시 ──
  private renderAll() { this.renderBoard(); this.renderOrder(); this.renderHeader(); this.renderShelf(); }

  private renderBoard() {
    this.pieces.forEach(piece => piece.destroy(true));
    this.pieces.clear();
    this.s.board.forEach((part, index) => {
      if (!part) return;
      const piece = makePiece(this, part, cellCenter(index));
      if (this.hidden.has(index)) piece.setAlpha(0);
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
    this.renderOrder();
    if (!active) return;
    const center = cellCenter(this.selected);
    this.highlight.lineStyle(3, CREAM, 1).strokeRect(center.x - 26, center.y - 26, 52, 52);
    for (const target of mergeTargets(this.s, this.selected)) {
      const at = cellCenter(target);
      this.highlight.fillStyle(GREEN, 0.2).fillRect(at.x - 22, at.y - 22, 44, 44);
      this.highlight.lineStyle(4, GREEN, 1).strokeRect(at.x - 24, at.y - 24, 48, 48);
    }
  }

  // 선택(또는 끌고 있는) 부품을 장착할 수 있으면 해당 칩을 초록으로, 끌어 놓을 수 없으면 빨강으로 표시합니다.
  private renderOrder(dragFrom = NONE) {
    const from = dragFrom !== NONE ? dragFrom : this.selected;
    const part = from === NONE ? null : this.s.board[from];
    const current = this.view.order === this.s.order;
    const highlight = part && current && (dragFrom !== NONE || canInstall(this.s, from)) ? { kind: part.kind, ok: canInstall(this.s, from) } : undefined;
    this.order.render(this.view.order, this.view.installed, ORDER_NOTE, highlight);
  }
  private renderHeader() { this.metrics.setText(`급여 ${this.view.coins.toLocaleString()} C · 머지 ${this.s.merges}`); }

  private renderShelf() {
    const block = supplyBlock(this.s);
    this.box.render({
      blocked: Boolean(block),
      status: block === 'full'
        ? '작업대가 가득 찼어요 · 합성·반납으로 자리 확보'
        : block === 'energy'
          ? `체력 회복 중 · 다음 +1 ${recoveryLabel(this.s.anchor)}`
          : '가운데 점선 칸부터 자동 배치',
      statusColor: block ? ALERT : MUTED,
      cost: '⚡ −1',
      costColor: ALERT,
    });
    const canPut = this.selected !== NONE && canInstall(this.s, this.selected);
    this.installButton.setFillStyle(canPut ? GREEN : BROWN).setAlpha(canPut ? 1 : 0.45);
    this.installLabel.setAlpha(canPut ? 1 : 0.6);
    const canReturn = this.selected !== NONE && !!this.s.board[this.selected];
    const armed = canReturn && this.time.now < this.returnArmedUntil;
    this.returnButton.setFillStyle(armed ? RED : BROWN).setAlpha(canReturn ? 1 : 0.45);
    this.returnLabel.setText(armed ? '한 번 더\n눌러 반납' : '↗\n반납').setAlpha(canReturn ? 1 : 0.6);
    this.energy.render(this.s.energy, this.s.anchor, this.accelerated);
    this.benchTitle.setText(`작업대 빈칸 ${this.s.board.filter(part => !part).length}/${SIZE}`);
    this.benchSub.setText(`합성 ${this.s.merges} · 반납 ${this.s.returned}`);
  }

  // ── 입력: 탭 선택 → 대상 탭 (게임 화면 B안과 동일), 드래그 놓기·주문 카드로 끌어 장착 ──
  private onDown(index: number, pointer: Phaser.Input.Pointer) {
    if (this.drag) return;
    this.drag = { from: index, x: pointer.x, y: pointer.y, dragging: false, hover: NONE, overCard: false };
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
    const overCard = inOrderCard(pointer.x, pointer.y);
    if (overCard !== drag.overCard) { drag.overCard = overCard; this.renderOrder(overCard ? drag.from : NONE); }
    const over = overCard ? NONE : cellAt(pointer.x, pointer.y);
    if (over === drag.hover) return;
    drag.hover = over;
    this.dropHint.clear();
    if (over === NONE || over === drag.from) return;
    const at = cellCenter(over);
    // 합성(초록) · 빈칸 이동(크림) · 자리 교환(노랑)
    const color = canMerge(this.s, drag.from, over) ? GREEN : this.s.board[over] ? AMBER : CREAM;
    this.dropHint.lineStyle(4, color, 1).strokeRect(at.x - 24, at.y - 24, 48, 48);
  }

  private onUp(pointer: Phaser.Input.Pointer) {
    const drag = this.drag;
    if (!drag) return;
    this.clearDrag(drag);
    if (!drag.dragging) { this.apply(resolveTap(this.s, this.selected, drag.from)); return; }
    this.apply(inOrderCard(pointer.x, pointer.y)
      ? resolveInstall(this.s, drag.from)
      : resolveDrop(this.s, drag.from, cellAt(pointer.x, pointer.y)));
  }

  private cancelDrag() { if (this.drag) this.clearDrag(this.drag); }
  private clearDrag(drag: Drag) {
    this.drag = undefined;
    this.dropHint.clear();
    drag.ghost?.destroy(true);
    this.pieces.get(drag.from)?.setAlpha(this.hidden.has(drag.from) ? 0 : 1);
    if (drag.overCard) this.renderOrder();
  }

  private apply(outcome: InputOutcome) {
    this.returnArmedUntil = 0;
    if (outcome.install !== undefined) { this.performInstall(outcome.install); return; }
    if (outcome.drop) { this.performDrop(outcome.drop.from, outcome.drop.to); return; }
    this.selected = outcome.selected;
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
        ? '작업대에 빈칸이 없어요. 합성하거나 부품을 반납해 자리를 만드세요.'
        : '알바 체력이 부족해요. 회복을 기다려 주세요.', 'error');
      this.renderShelf();
      return;
    }
    const result = supply(this.s, Date.now(), Math.random);
    if (!result) return;
    const placed = result.events[0];
    if (placed.type !== 'placed') return;
    this.hidden.add(placed.index);
    this.commit(`${KINDS[placed.part.kind]} Lv.${placed.part.level} 입고! 같은 부품을 골라 겹쳐 보세요.`);
    this.playEvents(result.events);
  }

  private performDrop(from: number, to: number) {
    const moving = this.s.board[from], other = this.s.board[to];
    const result: DropResult = drop(this.s, from, to);
    if (result === 'none' || !moving) return;
    this.selected = to;
    if (result === 'moved') this.hidden.add(to);
    if (result === 'swapped') { this.hidden.add(to); this.hidden.add(from); }
    this.commit(result === 'merged'
      ? `${KINDS[moving.kind]} Lv.${moving.level + 1} 합성!${canInstall(this.s, to) ? ' 이제 장착할 수 있어요.' : ''}`
      : result === 'swapped' ? '두 부품의 자리를 바꿨어요.' : '빈칸으로 옮겼어요.');
    this.playDrop(result, from, to, moving, other);
  }

  private performInstall(index: number) {
    const result = install(this.s, index);
    if (!result) return;
    this.selected = NONE;
    const installed = result.events[0], delivered = result.events.find(event => event.type === 'delivered');
    this.commit(delivered?.type === 'delivered'
      ? `${delivered.name} 납품 완료! 급여 +${delivered.reward.toLocaleString()} C`
      : installed.type === 'installed' ? `${KINDS[installed.kind]} 장착 완료 · 남은 부품을 준비하세요.` : '');
    this.playEvents(result.events);
  }

  private onReturn() {
    this.cancelDrag();
    const part = this.selected === NONE ? null : this.s.board[this.selected];
    if (!part) {
      this.say('반납할 부품을 먼저 눌러 선택하세요.', 'error');
      return;
    }
    if (this.time.now >= this.returnArmedUntil) {
      this.returnArmedUntil = this.time.now + RETURN_ARM_MS;
      this.say('한 번 더 누르면 선택한 부품을 반납해요. 부품은 사라지고 체력은 돌아오지 않아요.');
      this.renderShelf();
      this.time.delayedCall(RETURN_ARM_MS + 50, () => { if (this.alive) this.renderShelf(); });
      return;
    }
    returnPart(this.s, this.selected);
    this.selected = NONE;
    this.commit(`${KINDS[part.kind]} Lv.${part.level} 반납 완료 · 빈칸을 확보했어요.`);
    this.sfx('tap');
  }

  private commit(message: string) {
    this.returnArmedUntil = 0;
    this.persist();
    this.renderBoard();
    this.renderHeader();
    this.renderShelf();
    this.info.set(message);
    this.changed();
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
    this.hooks.onChange?.(`공급 ${this.s.supplied} · 합성 ${this.s.merges} · 반납 ${this.s.returned} · 납품 ${this.s.order}`);
  }
  private sfx(event: ReleaseSfxEvent) { this.audio.play(event); }
  private reveal(index: number) { if (this.hidden.delete(index)) this.pieces.get(index)?.setAlpha(1); }

  // ── 연출: 상태는 즉시 반영하고, 주문 카드·급여 표시는 순서대로 따라갑니다 ──
  private enqueue(step: () => Promise<void>) {
    const generation = this.generation;
    this.queue = this.queue.then(() => (this.alive && generation === this.generation ? step() : undefined));
  }
  private resetQueue() {
    this.generation++;
    this.queue = Promise.resolve();
    this.hidden.clear();
    this.motion.clear();
  }

  private playDrop(result: DropResult, from: number, to: number, moving: Part, other: Part | null) {
    this.hooks.onMotion?.({ type: result, from, to });
    this.enqueue(async () => {
      if (result === 'merged') {
        this.sfx('merge');
        await this.motion.slide(moving, cellCenter(from), cellCenter(to), true);
        const piece = this.s.board[to] ? this.pieces.get(to) : undefined;
        await this.motion.pop(piece, { kind: moving.kind, level: moving.level + 1 }, cellCenter(to), piece && this.selected === to ? 1.06 : 1);
        return;
      }
      this.sfx('tap');
      await Promise.all([
        this.motion.slide(moving, cellCenter(from), cellCenter(to)),
        result === 'swapped' && other ? this.motion.slide(other, cellCenter(to), cellCenter(from)) : Promise.resolve(),
      ]);
      this.reveal(to);
      this.reveal(from);
    });
  }

  private playEvents(events: ProgressEvent[]) {
    this.enqueue(async () => {
      for (const event of events) {
        this.hooks.onMotion?.(event);
        if (event.type === 'placed') {
          this.sfx('parcel');
          await this.motion.arrive(event.part, cellCenter(event.index));
          this.reveal(event.index);
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
    });
  }
}

/**
 * D v3 체험 화면을 시작합니다. toolsId가 있으면 그 요소에 랩 테스트 도구(체력 충전·가속·초기화)를 그립니다.
 */
export function startMergeIntake(parent: string, toolsId?: string): MergeDemoHandle {
  return launchMergeDemo({
    parent, toolsId, key: KEY, resetLabel: 'D안', saveLabel: 'D안 자동 저장 · 기존 v1·v2 진행 이전 지원',
    createScene: (hooks) => new MergeIntakeScene(hooks),
  });
}
