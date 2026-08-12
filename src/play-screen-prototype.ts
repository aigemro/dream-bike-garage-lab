import Phaser from 'phaser';

export type PlayScreenPrototypeMode = 'top-order' | 'bike-first' | 'step-flow';

type PartId = 'frame' | 'wheelset' | 'drivetrain' | 'handlebar';
type Part = { id: PartId; name: string; short: string; target: number; color: number };

const PARTS: Part[] = [
  { id: 'frame', name: '프레임', short: 'F', target: 3, color: 0x55d6be },
  { id: 'wheelset', name: '휠셋', short: 'W', target: 2, color: 0x6ea8ff },
  { id: 'drivetrain', name: '구동계', short: 'D', target: 2, color: 0xf4c95d },
  { id: 'handlebar', name: '핸들바', short: 'H', target: 1, color: 0xd596ff },
];

const C = { bg: 0x07111f, panel: 0x0c1c2d, active: 0x102b3d, line: 0x294158, text: '#eaf2f8', muted: '#7890a5', accent: '#55d6be', gold: '#f4c95d' };

class PlayScreenScene extends Phaser.Scene {
  private mode: PlayScreenPrototypeMode;
  private levels: Record<PartId, number[]> = { frame: [], wheelset: [], drivetrain: [], handlebar: [] };
  private assembled = new Set<PartId>();
  private orderIndex = 0;
  private coins = 0;
  private message = '부품을 주문해 같은 종류·레벨 2개를 자동 머지하세요.';
  private step = 0;

  constructor(mode: PlayScreenPrototypeMode) {
    super('play-screen');
    this.mode = mode;
  }

  create() { this.render(); }

  private text(x: number, y: number, value: string, size = 14, color = C.text, bold = false) {
    return this.add.text(x, y, value, { fontFamily: 'Arial, sans-serif', fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal', lineSpacing: 4 });
  }

  private panel(x: number, y: number, width: number, height: number, active = false) {
    return this.add.rectangle(x, y, width, height, active ? C.active : C.panel).setStrokeStyle(active ? 2 : 1, active ? 0x55d6be : C.line);
  }

  private button(x: number, y: number, width: number, label: string, action: () => void, enabled = true) {
    const background = this.add.rectangle(x, y, width, 34, enabled ? 0x15314a : 0x101b29).setStrokeStyle(1, enabled ? 0x55d6be : 0x30475c);
    const caption = this.text(x, y, label, 11, enabled ? C.accent : '#60778c', true).setOrigin(.5);
    if (enabled) [background, caption].forEach((item) => item.setInteractive({ useHandCursor: true }).on('pointerdown', action));
  }

  private addPart(part: Part) {
    const levels = this.levels[part.id];
    levels.push(1);
    let level = 1;
    while (level < 4 && levels.filter((value) => value === level).length >= 2) {
      levels.splice(levels.indexOf(level), 1);
      levels.splice(levels.indexOf(level), 1);
      levels.push(level + 1);
      level += 1;
    }
    this.message = `${part.name} 도착 · 동일 레벨은 자동으로 2-to-1 머지됩니다.`;
    if (this.mode === 'step-flow') this.step = 1;
    this.render();
  }

  private bestLevel(part: Part) { return Math.max(0, ...this.levels[part.id]); }
  private ready(part: Part) { return this.bestLevel(part) >= part.target; }
  private allReady() { return PARTS.every((part) => this.ready(part)); }

  private assemble() {
    if (!this.allReady()) return;
    this.assembled = new Set(PARTS.map((part) => part.id));
    this.step = 2;
    this.message = '조립 완료 · 고객에게 납품할 수 있습니다.';
    this.render();
  }

  private deliver() {
    if (this.assembled.size !== PARTS.length) return;
    this.coins += 1500;
    this.orderIndex += 1;
    this.levels = { frame: [], wheelset: [], drivetrain: [], handlebar: [] };
    this.assembled.clear();
    this.step = 0;
    this.message = `${this.orderIndex}번째 주문 납품 완료 · 새 ${this.bikeType()} 주문이 도착했습니다.`;
    this.render();
  }

  private bikeType() { return this.orderIndex % 2 === 0 ? '로드바이크' : 'MTB'; }

  private render() {
    this.children.removeAll();
    this.add.rectangle(480, 310, 960, 620, C.bg);
    this.text(28, 16, 'BASIC PLAY SCREEN · INTEGRATED LOOP', 10, C.accent, true);
    this.text(28, 37, this.mode === 'top-order' ? 'A안 · 주문 상단 통합형' : this.mode === 'bike-first' ? 'B안 · 자전거 우선형' : 'C안 · 단계 전환형', 22, C.text, true);
    this.text(770, 23, `급여 ${this.coins.toLocaleString()} 코인`, 12, C.gold, true);

    if (this.mode === 'top-order') this.renderTopOrder();
    if (this.mode === 'bike-first') this.renderBikeFirst();
    if (this.mode === 'step-flow') this.renderStepFlow();

    this.panel(480, 590, 904, 38, true);
    this.text(42, 580, this.message, 12, this.assembled.size === PARTS.length ? C.gold : C.text, true);
  }

  private renderTopOrder() {
    this.renderOrder(480, 105, 904, 82, true);
    this.renderSupply(244, 346, 430, 374);
    this.renderBike(716, 346, 430, 374);
  }

  private renderBikeFirst() {
    this.renderBike(480, 151, 904, 160, true);
    this.renderOrder(212, 377, 366, 270);
    this.renderSupply(646, 377, 486, 270);
  }

  private renderStepFlow() {
    const labels = ['1 주문 확인', '2 부품 제작', '3 조립·납품'];
    labels.forEach((label, index) => {
      this.button(185 + index * 295, 84, 272, label, () => { this.step = index; this.render(); }, this.step === index || index === 0 || (index === 1 && PARTS.some((part) => this.levels[part.id].length)) || (index === 2 && this.allReady()));
    });
    if (this.step === 0) {
      this.renderOrder(480, 305, 780, 350, true);
      this.button(480, 520, 240, '부품 제작 시작', () => { this.step = 1; this.render(); });
    } else if (this.step === 1) {
      this.renderSupply(480, 330, 780, 420);
      if (this.allReady()) this.button(480, 536, 240, '조립 단계로 이동', () => { this.step = 2; this.render(); });
    } else {
      this.renderBike(480, 330, 780, 420, true);
    }
  }

  private renderOrder(x: number, y: number, width: number, height: number, compact = false) {
    this.panel(x, y, width, height, compact);
    const left = x - width / 2 + 18;
    const top = y - height / 2 + 13;
    this.text(left, top, `ORDER #${String(this.orderIndex + 1).padStart(2, '0')} · ${this.bikeType()}`, 14, C.text, true);
    this.text(left, top + 23, '기본 급여 1,500 · 필요한 부품을 모두 완성하세요.', 10, C.muted);
    if (height < 120) {
      PARTS.forEach((part, index) => this.text(left + 390 + index * 116, top + 9, `${part.name} Lv.${part.target} ${this.ready(part) ? '✓' : ''}`, 10, this.ready(part) ? C.accent : C.muted, true));
    } else {
      PARTS.forEach((part, index) => {
        const rowY = top + 75 + index * 42;
        this.add.circle(left + 8, rowY + 6, 6, this.ready(part) ? part.color : 0x24394d);
        this.text(left + 23, rowY - 4, `${part.name} · 목표 Lv.${part.target}`, 11, this.ready(part) ? C.text : C.muted, true);
        this.text(x + width / 2 - 52, rowY - 4, this.ready(part) ? '완료' : `현재 Lv.${this.bestLevel(part)}`, 10, this.ready(part) ? C.accent : C.muted, true).setOrigin(1, 0);
      });
    }
  }

  private renderSupply(x: number, y: number, width: number, height: number) {
    this.panel(x, y, width, height);
    const left = x - width / 2 + 18;
    const top = y - height / 2 + 14;
    this.text(left, top, 'ONLINE PARTS · MERGE BOARD', 10, C.accent, true);
    this.text(left, top + 22, '부품 주문과 자동 머지', 17, C.text, true);
    const columns = width > 440 ? 4 : 2;
    const cellWidth = (width - 52) / columns;
    PARTS.forEach((part, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const cellX = left + cellWidth / 2 + col * cellWidth;
      const cellY = top + 82 + row * 112;
      this.panel(cellX, cellY, cellWidth - 10, 96, this.ready(part));
      this.add.circle(cellX - cellWidth / 2 + 27, cellY - 20, 9, part.color);
      this.text(cellX - cellWidth / 2 + 45, cellY - 31, part.name, 12, C.text, true);
      const inventory = this.levels[part.id].length ? this.levels[part.id].sort((a, b) => b - a).map((level) => `Lv.${level}`).join(' · ') : '빈 칸';
      this.text(cellX - cellWidth / 2 + 18, cellY - 5, inventory, 10, this.ready(part) ? C.accent : C.muted);
      this.button(cellX, cellY + 26, cellWidth - 28, `${part.short} Lv.1 주문`, () => this.addPart(part));
    });
    if (this.allReady() && this.assembled.size === 0) this.button(x, y + height / 2 - 35, Math.min(240, width - 40), '완성 부품 조립하기', () => this.assemble());
  }

  private renderBike(x: number, y: number, width: number, height: number, wide = false) {
    this.panel(x, y, width, height, this.assembled.size === PARTS.length);
    const left = x - width / 2 + 18;
    const top = y - height / 2 + 14;
    this.text(left, top, `ASSEMBLY · ${this.bikeType().toUpperCase()}`, 10, C.accent, true);
    this.text(left, top + 22, this.assembled.size === PARTS.length ? '주문 자전거 완성' : `조립 진행 ${PARTS.filter((part) => this.ready(part)).length}/4`, 17, C.text, true);
    const scale = wide ? .76 : .7;
    const bikeX = x + (wide ? 100 : 0);
    const bikeY = y + (wide ? 20 : 26);
    const g = this.add.graphics();
    const has = (id: PartId) => this.ready(PARTS.find((part) => part.id === id)!);
    g.lineStyle(6, has('wheelset') ? 0x6ea8ff : 0x385066, has('wheelset') ? 1 : .38);
    g.strokeCircle(bikeX - 118 * scale, bikeY + 45 * scale, 55 * scale); g.strokeCircle(bikeX + 118 * scale, bikeY + 45 * scale, 55 * scale);
    g.lineStyle(8, has('frame') ? 0x55d6be : 0x385066, has('frame') ? 1 : .38);
    g.beginPath(); g.moveTo(bikeX - 118 * scale, bikeY + 45 * scale); g.lineTo(bikeX - 25 * scale, bikeY - 50 * scale); g.lineTo(bikeX + 25 * scale, bikeY + 45 * scale); g.lineTo(bikeX - 118 * scale, bikeY + 45 * scale); g.lineTo(bikeX + 88 * scale, bikeY + 45 * scale); g.lineTo(bikeX - 25 * scale, bikeY - 50 * scale); g.strokePath();
    g.lineStyle(6, has('handlebar') ? 0xd596ff : 0x385066, has('handlebar') ? 1 : .38);
    g.beginPath(); g.moveTo(bikeX + 25 * scale, bikeY + 45 * scale); g.lineTo(bikeX + 78 * scale, bikeY - 64 * scale); g.lineTo(bikeX + 122 * scale, bikeY - 70 * scale); g.strokePath();
    g.lineStyle(5, has('drivetrain') ? 0xf4c95d : 0x385066, has('drivetrain') ? 1 : .38);
    g.strokeCircle(bikeX + 25 * scale, bikeY + 45 * scale, 16 * scale);
    if (this.allReady() && this.assembled.size === 0) this.button(x, y + height / 2 - 42, Math.min(220, width - 36), '자전거 조립', () => this.assemble());
    if (this.assembled.size === PARTS.length) this.button(x, y + height / 2 - 42, Math.min(220, width - 36), '납품하고 다음 주문', () => this.deliver());
  }
}

export function startPlayScreenPrototype(parent: string, mode: PlayScreenPrototypeMode) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 620,
    backgroundColor: '#07111f',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: new PlayScreenScene(mode),
    render: { antialias: true },
  });
}
