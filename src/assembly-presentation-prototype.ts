import Phaser from 'phaser';

export type AssemblyPresentationMode = 'auto-sequence' | 'confirm-sequence';

type PartId = 'frame' | 'wheelset' | 'drivetrain' | 'handlebar';
type Part = { id: PartId; name: string; target: string; color: number };

const PARTS: Part[] = [
  { id: 'frame', name: '프레임', target: '카본 Lv.3', color: 0x55d6be },
  { id: 'wheelset', name: '휠셋', target: '에어로 Lv.3', color: 0x6ea8ff },
  { id: 'drivetrain', name: '구동계', target: '레이스 Lv.2', color: 0xf4c95d },
  { id: 'handlebar', name: '핸들바', target: '드롭 Lv.2', color: 0xd596ff },
];

const C = {
  bg: 0x07111f,
  panel: 0x0c1c2d,
  active: 0x102b3d,
  line: 0x294158,
  text: '#eaf2f8',
  muted: '#7890a5',
  accent: '#55d6be',
  gold: '#f4c95d',
};

class AssemblyPresentationScene extends Phaser.Scene {
  private mode: AssemblyPresentationMode;
  private prepared = new Set<PartId>();
  private installed = new Set<PartId>();
  private installing?: PartId;
  private message = '';
  private completed = false;

  constructor(mode: AssemblyPresentationMode) {
    super('assembly-presentation');
    this.mode = mode;
  }

  create() {
    this.resetState();
  }

  private text(x: number, y: number, value: string, size = 16, color = C.text, bold = false) {
    return this.add.text(x, y, value, {
      fontFamily: 'Arial, sans-serif',
      fontSize: `${size}px`,
      color,
      fontStyle: bold ? 'bold' : 'normal',
      lineSpacing: 5,
    });
  }

  private panel(x: number, y: number, width: number, height: number, active = false) {
    return this.add.rectangle(x, y, width, height, active ? C.active : C.panel)
      .setStrokeStyle(active ? 2 : 1, active ? 0x55d6be : C.line);
  }

  private button(x: number, y: number, width: number, label: string, onClick: () => void, enabled = true) {
    const background = this.add.rectangle(x, y, width, 38, enabled ? 0x15314a : 0x101b29)
      .setStrokeStyle(1, enabled ? 0x55d6be : 0x30475c);
    const caption = this.text(x, y, label, 12, enabled ? C.accent : '#60778c', true).setOrigin(.5);
    if (enabled) {
      [background, caption].forEach((item) => item.setInteractive({ useHandCursor: true }).on('pointerdown', onClick));
    }
  }

  private resetState() {
    this.prepared.clear();
    this.installed.clear();
    this.installing = undefined;
    this.completed = false;
    this.message = this.mode === 'auto-sequence'
      ? '부품을 완성하면 해당 부위가 자동으로 장착됩니다.'
      : '부품을 준비한 뒤 장착 진행을 눌러 과정을 확인합니다.';
    this.render();
  }

  private prepare(part: Part) {
    if (this.prepared.has(part.id) || this.completed || this.installing) return;
    this.prepared.add(part.id);
    if (this.mode === 'auto-sequence') {
      this.startInstall(part);
      return;
    }
    this.message = `${part.name} 준비 완료 · 장착 대기열 ${this.prepared.size - this.installed.size}개`;
    this.render();
  }

  private installNext() {
    if (this.installing || this.completed) return;
    const next = PARTS.find((part) => this.prepared.has(part.id) && !this.installed.has(part.id));
    if (next) this.startInstall(next);
  }

  private startInstall(part: Part) {
    this.installing = part.id;
    this.message = `${part.name} 장착 중 · 작업대로 이동합니다.`;
    this.render();

    const source = { x: 372, y: 246 + PARTS.findIndex((item) => item.id === part.id) * 68 };
    const targets: Record<PartId, { x: number; y: number }> = {
      frame: { x: 704, y: 340 },
      wheelset: { x: 710, y: 390 },
      drivetrain: { x: 705, y: 390 },
      handlebar: { x: 803, y: 292 },
    };
    const marker = this.add.circle(source.x, source.y, 13, part.color).setDepth(20);
    this.tweens.add({
      targets: marker,
      x: targets[part.id].x,
      y: targets[part.id].y,
      scale: { from: .8, to: 1.45 },
      alpha: { from: 1, to: .35 },
      duration: 480,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        marker.destroy();
        this.installed.add(part.id);
        this.installing = undefined;
        this.completed = this.installed.size === PARTS.length;
        this.message = this.completed
          ? '자전거 완성 · 모든 부품이 장착되어 납품할 수 있습니다!'
          : `${part.name} 장착 완료 · ${this.installed.size}/4`;
        this.render();
      },
    });
  }

  private render() {
    this.children.removeAll();
    this.add.rectangle(480, 310, 960, 620, C.bg);
    const auto = this.mode === 'auto-sequence';
    this.text(34, 22, 'GAME CORE · INSTALLATION PRESENTATION', 11, C.accent, true);
    this.text(34, 45, auto ? 'A안 · 부품별 순차 자동 장착' : 'B안 · 확인 후 순차 장착', 25, C.text, true);
    this.text(34, 80, auto
      ? '부품 완성의 흐름을 끊지 않고 장착 위치와 완성 과정을 보여줍니다.'
      : '준비와 장착 사이에 확인을 두어 조립 순간을 사용자가 통제합니다.', 12, C.muted);
    this.add.line(480, 108, 34, 0, 926, 0, C.line);

    this.renderParts();
    this.renderBike();

    this.panel(480, 584, 892, 48, true);
    this.text(52, 574, this.message, 13, this.completed ? C.gold : C.text, true);
    if (this.completed) this.button(820, 584, 160, '다시 비교하기', () => this.resetState());
  }

  private renderParts() {
    this.panel(244, 334, 420, 420);
    this.text(54, 138, 'ORDER PARTS', 11, C.accent, true);
    this.text(54, 163, '에어로 로드바이크', 22, C.text, true);
    this.text(54, 194, '같은 부품 4종 · 장착 타이밍만 비교', 11, C.muted);

    PARTS.forEach((part, index) => {
      const y = 246 + index * 68;
      const ready = this.prepared.has(part.id);
      const installed = this.installed.has(part.id);
      this.panel(244, y, 374, 56, ready);
      this.add.circle(76, y, 9, installed ? part.color : 0x24394d).setStrokeStyle(1, part.color);
      this.text(96, y - 17, part.name, 14, ready ? C.text : C.muted, true);
      this.text(96, y + 5, installed ? '장착 완료' : ready ? '장착 대기' : part.target, 11, installed ? C.accent : C.muted);
      this.button(357, y, 112, installed ? '장착됨' : ready ? '준비됨' : '부품 완성', () => this.prepare(part), !ready && !this.installing);
    });

    if (this.mode === 'confirm-sequence' && !this.completed) {
      const waiting = PARTS.some((part) => this.prepared.has(part.id) && !this.installed.has(part.id));
      this.button(244, 514, 374, this.installing ? '장착 진행 중' : '다음 부품 장착', () => this.installNext(), waiting && !this.installing);
    }
  }

  private renderBike() {
    this.panel(712, 334, 420, 420, this.completed);
    this.text(522, 138, 'ASSEMBLY WORKBENCH', 11, C.accent, true);
    this.text(522, 163, this.completed ? '납품 준비 완료' : `조립 진행 ${this.installed.size}/4`, 22, C.text, true);
    this.text(522, 194, '회색 실루엣이 부품별 색상으로 채워집니다.', 11, C.muted);

    const g = this.add.graphics();
    const alpha = (id: PartId) => this.installed.has(id) ? 1 : .16;
    const rearX = 602;
    const frontX = 812;
    const axleY = 382;
    const radius = 50;
    const crankX = 704;
    const crankY = 390;
    const seatX = 674;
    const seatY = 282;
    const headTopX = 764;
    const headTopY = 290;
    const headBottomX = 778;
    const headBottomY = 322;

    [rearX, frontX].forEach((x) => {
      g.lineStyle(4, 0x6ea8ff, alpha('wheelset')).strokeCircle(x, axleY, radius);
      g.lineStyle(2, 0xb9d3ff, alpha('wheelset') * .9).strokeCircle(x, axleY, radius - 6);
      g.fillStyle(0x6ea8ff, alpha('wheelset')).fillCircle(x, axleY, 5);
    });

    g.lineStyle(8, 0x55d6be, alpha('frame'))
      .lineBetween(rearX, axleY, seatX, seatY)
      .lineBetween(seatX, seatY, crankX, crankY)
      .lineBetween(crankX, crankY, rearX, axleY)
      .lineBetween(seatX, seatY, headTopX, headTopY)
      .lineBetween(headTopX, headTopY, headBottomX, headBottomY)
      .lineBetween(headBottomX, headBottomY, crankX, crankY);
    g.lineStyle(6, 0x82ead8, alpha('frame')).lineBetween(headBottomX, headBottomY, frontX, axleY);

    g.lineStyle(4, 0xf4c95d, alpha('drivetrain')).strokeCircle(crankX, crankY, 17);
    g.lineStyle(2, 0xffe6a4, alpha('drivetrain'))
      .lineBetween(crankX, crankY - 17, rearX, axleY - 8)
      .lineBetween(crankX, crankY + 17, rearX, axleY + 8);

    g.lineStyle(5, 0xd596ff, alpha('handlebar')).lineBetween(headTopX, headTopY, 793, 286);
    g.lineStyle(6, 0xe4b8ff, alpha('handlebar'));
    g.beginPath();
    g.moveTo(788, 283);
    g.lineTo(817, 283);
    g.lineTo(824, 296);
    g.lineTo(820, 310);
    g.lineTo(811, 313);
    g.strokePath();

    PARTS.forEach((part, index) => {
      const x = 550 + index * 82;
      const active = this.installed.has(part.id);
      this.add.circle(x, 492, 13, active ? part.color : 0x1b2c3c).setStrokeStyle(2, part.color, active ? 1 : .35);
      this.text(x, 516, String(index + 1), 11, active ? C.text : C.muted, true).setOrigin(.5);
      if (index < PARTS.length - 1) this.add.line(0, 0, x + 16, 492, x + 66, 492, active ? part.color : C.line).setOrigin(0);
    });
  }
}

export function startAssemblyPresentationPrototype(parent: string, mode: AssemblyPresentationMode) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 620,
    backgroundColor: '#07111f',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: new AssemblyPresentationScene(mode),
    render: { antialias: true },
  });
}
