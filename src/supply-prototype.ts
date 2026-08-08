import Phaser from 'phaser';

export type SupplyPrototypeMode = 'instant' | 'parcel' | 'generator';

// 세 방안 공통 조건: 5×4 보드, Lv.1 부품 공급, 2-to-1 머지, 목표 Lv.3 부품 2개
const COLS = 5;
const ROWS = 4;
const CELL = 96;
const GAP = 8;
const BOARD_X = 64;
const BOARD_Y = 128;
const GOAL_LEVEL = 3;
const GOAL_COUNT = 2;
const PARCEL_DELIVERY_MS = 1500;
const GENERATOR_MAX_CHARGE = 5;
const GENERATOR_COOLDOWN_MS = 5000;

const C = {
  bg: 0x07111f, panel: 0x0b1828, line: 0x294158, cell: 0x0e2136, cellFull: 0x13293f,
  text: '#eaf2f8', muted: '#8196aa', accent: '#55d6be', gold: '#ffdf6b',
};
const LEVEL_COLORS = [0x55d6be, 0x8ea6ff, 0xffdf6b];

const MODE_INFO: Record<SupplyPrototypeMode, { title: string; hint: string }> = {
  instant: { title: 'A안 · 즉시 생성 버튼형', hint: '생성 버튼을 누르면 부품이 바로 보드에 추가됩니다.' },
  parcel: { title: 'B안 · 택배 상자 개봉형', hint: '주문한 부품이 택배로 도착하며, 상자를 탭해 개봉합니다.' },
  generator: { title: 'C안 · 쿨다운·충전식 생성기형', hint: '충전량만큼 부품을 뽑고, 소진되면 쿨다운 후 재충전됩니다.' },
};

class SupplyScene extends Phaser.Scene {
  private mode: SupplyPrototypeMode;
  private board: Array<number | null> = Array.from({ length: COLS * ROWS }, () => null);
  private selected: number | null = null;
  private supplies = 0;
  private mergeCount = 0;
  private startedAt = 0;
  private finalSeconds: number | null = null;
  private toastText = '';
  private toastUntil = 0;
  // B안 상태: 배송 중이면 도착 예정 시각, 도착하면 개봉 대기
  private parcelArriveAt: number | null = null;
  private parcelArrived = false;
  // C안 상태: 충전량과 재충전 완료 예정 시각
  private generatorCharge = GENERATOR_MAX_CHARGE;
  private generatorReadyAt: number | null = null;
  private liveTexts: Phaser.GameObjects.Text[] = [];

  constructor(mode: SupplyPrototypeMode) {
    super('supply');
    this.mode = mode;
  }

  create() {
    this.startedAt = this.time.now;
    this.render();
  }

  update() {
    const now = this.time.now;
    if (this.parcelArriveAt !== null && now >= this.parcelArriveAt) {
      this.parcelArriveAt = null;
      this.parcelArrived = true;
      this.render();
    }
    if (this.generatorReadyAt !== null && now >= this.generatorReadyAt) {
      this.generatorReadyAt = null;
      this.generatorCharge = GENERATOR_MAX_CHARGE;
      this.render();
    }
    if (this.toastUntil && now >= this.toastUntil) {
      this.toastUntil = 0;
      this.toastText = '';
      this.render();
    }
    this.liveTexts.forEach((entry) => entry.active && entry.setText(this.liveLabel(entry.name)));
  }

  private liveLabel(name: string) {
    const now = this.time.now;
    if (name === 'elapsed') return `경과 ${(this.finalSeconds ?? (now - this.startedAt) / 1000).toFixed(1)}초`;
    if (name === 'parcel-countdown' && this.parcelArriveAt !== null) return `배송 중… ${Math.max(0, (this.parcelArriveAt - now) / 1000).toFixed(1)}초`;
    if (name === 'generator-countdown' && this.generatorReadyAt !== null) return `재충전 중… ${Math.max(0, (this.generatorReadyAt - now) / 1000).toFixed(1)}초`;
    return '';
  }

  private goalProgress() {
    return this.board.filter((level) => level !== null && level >= GOAL_LEVEL).length;
  }

  private toast(message: string) {
    this.toastText = message;
    this.toastUntil = this.time.now + 1600;
    this.render();
  }

  private spawnPart(): boolean {
    const empty = this.board.map((level, index) => (level === null ? index : -1)).filter((index) => index >= 0);
    if (!empty.length) {
      this.toast('보드가 가득 찼습니다. 머지로 공간을 만드세요.');
      return false;
    }
    this.board[empty[Math.floor(Math.random() * empty.length)]] = 1;
    this.supplies += 1;
    this.render();
    return true;
  }

  private onCellTap(index: number) {
    if (this.finalSeconds !== null) return;
    const level = this.board[index];
    if (this.selected === null) {
      if (level !== null) { this.selected = index; this.render(); }
      return;
    }
    if (this.selected === index) { this.selected = null; this.render(); return; }
    const selectedLevel = this.board[this.selected]!;
    if (level === null) {
      this.board[index] = selectedLevel;
      this.board[this.selected] = null;
      this.selected = null;
      this.render();
      return;
    }
    if (level === selectedLevel && level < GOAL_LEVEL) {
      this.board[index] = level + 1;
      this.board[this.selected] = null;
      this.selected = null;
      this.mergeCount += 1;
      if (this.goalProgress() >= GOAL_COUNT && this.finalSeconds === null) {
        this.finalSeconds = (this.time.now - this.startedAt) / 1000;
      }
      this.render();
      return;
    }
    this.selected = index;
    this.render();
  }

  private onSupplyAction() {
    if (this.finalSeconds !== null) return;
    if (this.mode === 'instant') {
      this.spawnPart();
      return;
    }
    if (this.mode === 'parcel') {
      if (this.parcelArrived) {
        if (this.spawnPart()) this.parcelArrived = false;
        return;
      }
      if (this.parcelArriveAt !== null) { this.toast('이미 배송 중입니다.'); return; }
      this.parcelArriveAt = this.time.now + PARCEL_DELIVERY_MS;
      this.render();
      return;
    }
    if (this.generatorCharge <= 0) { this.toast('생성기가 재충전 중입니다.'); return; }
    if (this.spawnPart()) {
      this.generatorCharge -= 1;
      if (this.generatorCharge === 0) this.generatorReadyAt = this.time.now + GENERATOR_COOLDOWN_MS;
      this.render();
    }
  }

  private text(x: number, y: number, value: string, size = 16, color = C.text, bold = false) {
    return this.add.text(x, y, value, {
      fontFamily: 'Arial, sans-serif', fontSize: `${size}px`, color,
      fontStyle: bold ? 'bold' : 'normal', lineSpacing: 6,
    });
  }

  private render() {
    this.children.removeAll();
    this.liveTexts = [];
    this.add.rectangle(480, 310, 960, 620, C.bg);

    const info = MODE_INFO[this.mode];
    this.text(64, 28, info.title, 22, C.text, true);
    this.text(64, 62, info.hint, 14, C.muted);
    const elapsed = this.text(792, 32, this.liveLabel('elapsed'), 18, C.gold, true).setName('elapsed');
    this.liveTexts.push(elapsed);

    // 보드
    this.board.forEach((level, index) => {
      const x = BOARD_X + (index % COLS) * (CELL + GAP) + CELL / 2;
      const y = BOARD_Y + Math.floor(index / COLS) * (CELL + GAP) + CELL / 2;
      const cell = this.add.rectangle(x, y, CELL, CELL, level === null ? C.cell : C.cellFull)
        .setStrokeStyle(2, this.selected === index ? 0x55d6be : C.line)
        .setInteractive({ useHandCursor: true });
      cell.on('pointerdown', () => this.onCellTap(index));
      if (level !== null) {
        this.add.circle(x, y - 8, 26, LEVEL_COLORS[level - 1]).setStrokeStyle(2, 0x07111f);
        this.text(x, y + 24, `Lv.${level}`, 13, level >= GOAL_LEVEL ? C.gold : C.text, true).setOrigin(0.5, 0.5);
      }
    });

    this.renderSidePanel();
    this.renderSupplyZone();

    if (this.toastText) this.text(480, 96, this.toastText, 14, C.gold, true).setOrigin(0.5, 0.5);
    if (this.finalSeconds !== null) {
      this.add.rectangle(480, 310, 620, 150, C.panel).setStrokeStyle(2, 0x55d6be);
      this.text(480, 280, '목표 달성!', 26, C.accent, true).setOrigin(0.5, 0.5);
      this.text(480, 322, `${this.finalSeconds.toFixed(1)}초 · 공급 ${this.supplies}회 · 머지 ${this.mergeCount}회`, 18, C.text, true).setOrigin(0.5, 0.5);
      this.text(480, 352, '같은 지표로 A/B/C 템포를 비교해 주세요.', 13, C.muted).setOrigin(0.5, 0.5);
    }
  }

  private renderSidePanel() {
    const x = 620;
    this.add.rectangle(770, 300, 280, 340, C.panel).setStrokeStyle(1, C.line);
    this.text(x + 24, 152, '목표', 13, C.muted, true);
    this.text(x + 24, 174, `Lv.${GOAL_LEVEL} 부품 ${GOAL_COUNT}개 제작`, 18, C.gold, true);
    this.text(x + 24, 206, `진행 ${this.goalProgress()} / ${GOAL_COUNT}`, 15, C.text);
    this.text(x + 24, 252, '템포 지표', 13, C.muted, true);
    this.text(x + 24, 274, `공급 행동 ${this.supplies}회`, 15, C.text);
    this.text(x + 24, 298, `머지 ${this.mergeCount}회`, 15, C.text);
    this.text(x + 24, 344, '조작', 13, C.muted, true);
    this.text(x + 24, 366, '부품 탭 → 같은 레벨 탭: 머지\n부품 탭 → 빈 칸 탭: 이동', 13, C.muted);
  }

  private renderSupplyZone() {
    const y = 566;
    this.add.rectangle(300, y, 472, 76, C.panel).setStrokeStyle(1, C.line);
    let label = '부품 생성';
    let sub = '탭하면 Lv.1 부품이 즉시 추가됩니다';
    let enabled = true;
    if (this.mode === 'parcel') {
      if (this.parcelArriveAt !== null) { label = '배송 중…'; sub = ''; enabled = false; }
      else if (this.parcelArrived) { label = '📦 상자 개봉'; sub = '도착한 상자를 개봉해 부품을 받으세요'; }
      else { label = '부품 주문'; sub = `주문하면 ${(PARCEL_DELIVERY_MS / 1000).toFixed(1)}초 뒤 택배가 도착합니다`; }
    }
    if (this.mode === 'generator') {
      if (this.generatorCharge <= 0) { label = '재충전 중…'; sub = ''; enabled = false; }
      else { label = '생성기 가동'; sub = '충전량을 소모해 부품을 뽑습니다'; }
      for (let i = 0; i < GENERATOR_MAX_CHARGE; i += 1) {
        this.add.rectangle(388 + i * 26, y + 24, 18, 8, i < this.generatorCharge ? 0x55d6be : 0x1c3a52);
      }
    }
    const button = this.add.rectangle(300, y - 6, 200, 44, enabled ? 0x123049 : 0x0c1c2d)
      .setStrokeStyle(2, enabled ? 0x55d6be : C.line);
    if (enabled) {
      button.setInteractive({ useHandCursor: true });
      button.on('pointerdown', () => this.onSupplyAction());
    }
    this.text(300, y - 6, label, 16, enabled ? C.text : C.muted, true).setOrigin(0.5, 0.5);
    if (sub) this.text(300, y + 26, sub, 12, C.muted).setOrigin(0.5, 0.5);
    if (this.mode === 'parcel' && this.parcelArriveAt !== null) {
      const countdown = this.text(300, y + 26, this.liveLabel('parcel-countdown'), 13, C.gold, true).setOrigin(0.5, 0.5).setName('parcel-countdown');
      this.liveTexts.push(countdown);
    }
    if (this.mode === 'generator' && this.generatorReadyAt !== null) {
      const countdown = this.text(300, y + 26, this.liveLabel('generator-countdown'), 13, C.gold, true).setOrigin(0.5, 0.5).setName('generator-countdown');
      this.liveTexts.push(countdown);
    }
  }
}

export function startSupplyPrototype(parent: string, mode: SupplyPrototypeMode) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 620,
    backgroundColor: '#07111f',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: new SupplyScene(mode),
    render: { antialias: true },
  });
}
