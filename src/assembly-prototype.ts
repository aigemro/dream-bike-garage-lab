import Phaser from 'phaser';

export type AssemblyPrototypeMode = 'auto' | 'slots';

type PartId = 'frame' | 'wheelset' | 'drivetrain' | 'handlebar';
type Part = { id: PartId; name: string; target: string; color: number };

const PARTS: Part[] = [
  { id: 'frame', name: '프레임', target: '카본 Lv.3', color: 0x55d6be },
  { id: 'wheelset', name: '휠셋', target: '에어로 Lv.3', color: 0x6ea8ff },
  { id: 'drivetrain', name: '구동계', target: '레이스 Lv.2', color: 0xf4c95d },
  { id: 'handlebar', name: '핸들바', target: '드롭 Lv.2', color: 0xd596ff },
];

const C = { bg: 0x07111f, panel: 0x0c1c2d, panelActive: 0x102b3d, line: 0x294158, text: '#eaf2f8', muted: '#7890a5', accent: '#55d6be', gold: '#f4c95d' };

class AssemblyScene extends Phaser.Scene {
  private mode: AssemblyPrototypeMode;
  private prepared = new Set<PartId>();
  private installed = new Set<PartId>();
  private completed = false;
  private orderCount = 0;
  private message = '';

  constructor(mode: AssemblyPrototypeMode) {
    super('assembly');
    this.mode = mode;
  }

  create() {
    this.message = this.mode === 'auto'
      ? '각 부품의 준비 버튼을 눌러 주문 조건을 충족하세요.'
      : '부품을 먼저 준비한 뒤 자전거의 같은 이름 슬롯을 눌러 장착하세요.';
    this.render();
  }

  private text(x: number, y: number, value: string, size = 16, color = C.text, bold = false) {
    return this.add.text(x, y, value, { fontFamily: 'Arial, sans-serif', fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal', lineSpacing: 6 });
  }

  private panel(x: number, y: number, width: number, height: number, active = false) {
    return this.add.rectangle(x, y, width, height, active ? C.panelActive : C.panel).setStrokeStyle(active ? 2 : 1, active ? 0x55d6be : C.line);
  }

  private button(x: number, y: number, width: number, label: string, onClick: () => void, enabled = true) {
    const fill = enabled ? 0x15314a : 0x101b29;
    const border = enabled ? 0x55d6be : 0x30475c;
    const background = this.add.rectangle(x, y, width, 38, fill).setStrokeStyle(1, border);
    const caption = this.text(x, y, label, 12, enabled ? C.accent : '#60778c', true).setOrigin(.5);
    if (enabled) [background, caption].forEach((item) => item.setInteractive({ useHandCursor: true }).on('pointerdown', onClick));
  }

  private prepare(part: Part) {
    if (this.prepared.has(part.id) || this.completed) return;
    this.prepared.add(part.id);
    this.message = `${part.name} 준비 완료 · ${this.prepared.size}/4`;
    if (this.mode === 'auto' && this.prepared.size === PARTS.length) {
      this.installed = new Set(PARTS.map((item) => item.id));
      this.complete('모든 조건 충족 · 자전거를 자동으로 조립했습니다!');
      return;
    }
    this.render();
  }

  private install(part: Part) {
    if (this.mode !== 'slots' || !this.prepared.has(part.id) || this.installed.has(part.id) || this.completed) return;
    this.installed.add(part.id);
    this.message = `${part.name} 장착 완료 · ${this.installed.size}/4`;
    if (this.installed.size === PARTS.length) {
      this.complete('모든 슬롯 장착 완료 · 직접 조립한 자전거가 완성됐습니다!');
      return;
    }
    this.render();
  }

  private complete(message: string) {
    this.completed = true;
    this.orderCount += 1;
    this.message = message;
    this.render();
  }

  private nextOrder() {
    this.prepared.clear();
    this.installed.clear();
    this.completed = false;
    this.message = this.mode === 'auto' ? '새 주문이 도착했습니다. 부품 조건을 충족하세요.' : '새 주문이 도착했습니다. 준비 후 슬롯에 직접 장착하세요.';
    this.render();
  }

  private render() {
    this.children.removeAll();
    this.add.rectangle(480, 310, 960, 620, C.bg);
    const modeTitle = this.mode === 'auto' ? 'A안 · 조건 충족 자동 조립' : 'B안 · 조립 슬롯 직접 배치';
    this.text(34, 22, 'ORDER & ASSEMBLY · LIVE EXPERIMENT', 11, C.accent, true);
    this.text(34, 45, modeTitle, 25, C.text, true);
    this.text(720, 28, `완료 주문 ${this.orderCount}건`, 13, C.gold, true);
    this.text(34, 80, this.mode === 'auto' ? '부품 완성과 동시에 조립되는 캐주얼 템포를 확인합니다.' : '준비한 부품을 직접 장착할 때 조립감과 추가 피로를 확인합니다.', 12, C.muted);
    this.add.line(480, 108, 34, 0, 926, 0, C.line);

    this.renderOrder();
    this.renderBike();

    this.panel(480, 574, 892, 54, true);
    this.text(52, 563, this.message, 13, this.completed ? C.gold : C.text, true);
    if (this.completed) this.button(820, 574, 160, '다음 주문 받기', () => this.nextOrder());
  }

  private renderOrder() {
    this.panel(244, 334, 420, 420);
    this.text(54, 138, 'CUSTOMER ORDER #01', 11, C.accent, true);
    this.text(54, 163, '에어로 로드바이크', 22, C.text, true);
    this.text(54, 194, '동일한 주문 데이터로 두 조립 방식을 비교합니다.', 11, C.muted);

    PARTS.forEach((part, index) => {
      const y = 246 + index * 68;
      const ready = this.prepared.has(part.id);
      this.panel(244, y, 374, 56, ready);
      this.add.circle(76, y, 9, ready ? part.color : 0x24394d).setStrokeStyle(1, part.color);
      this.text(96, y - 17, part.name, 14, ready ? C.text : C.muted, true);
      this.text(96, y + 5, part.target, 11, C.muted);
      this.button(357, y, 112, ready ? '준비 완료' : '부품 준비', () => this.prepare(part), !ready && !this.completed);
    });
  }

  private renderBike() {
    this.panel(712, 334, 420, 420, this.completed);
    this.text(522, 138, this.mode === 'auto' ? 'AUTO ASSEMBLY' : 'ASSEMBLY WORKBENCH', 11, C.accent, true);
    this.text(522, 163, this.completed ? '자전거 완성' : this.mode === 'auto' ? `조립 조건 ${this.prepared.size}/4` : `장착 슬롯 ${this.installed.size}/4`, 22, C.text, true);
    this.text(522, 194, this.mode === 'auto' ? '4개 조건이 충족되면 즉시 완성됩니다.' : '준비된 슬롯을 눌러 하나씩 장착합니다.', 11, C.muted);

    const g = this.add.graphics();
    const partAlpha = (part: PartId) => this.installed.has(part) ? 1 : .2;
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

    // 로드 휠: 타이어·림·스포크·허브를 분리해 실루엣만으로도 휠셋을 알아볼 수 있게 한다.
    [rearX, frontX].forEach((x) => {
      const wheelAlpha = partAlpha('wheelset');
      g.lineStyle(4, 0x6ea8ff, wheelAlpha).strokeCircle(x, axleY, radius);
      g.lineStyle(2, 0xb9d3ff, wheelAlpha * .9).strokeCircle(x, axleY, radius - 6);
      g.lineStyle(1, 0x8ab8ff, wheelAlpha * .72);
      for (let angle = 0; angle < 360; angle += 30) {
        const rad = Phaser.Math.DegToRad(angle);
        g.lineBetween(x, axleY, x + Math.cos(rad) * (radius - 8), axleY + Math.sin(rad) * (radius - 8));
      }
      g.fillStyle(0x6ea8ff, wheelAlpha).fillCircle(x, axleY, 5);
    });

    // 프레임: 로드바이크의 다이아몬드 프레임과 포크, 시트포스트·안장을 실제 연결 구조로 그린다.
    const frameAlpha = partAlpha('frame');
    g.lineStyle(8, 0x55d6be, frameAlpha)
      .lineBetween(rearX, axleY, seatX, seatY)
      .lineBetween(seatX, seatY, crankX, crankY)
      .lineBetween(crankX, crankY, rearX, axleY)
      .lineBetween(seatX, seatY, headTopX, headTopY)
      .lineBetween(headTopX, headTopY, headBottomX, headBottomY)
      .lineBetween(headBottomX, headBottomY, crankX, crankY);
    g.lineStyle(6, 0x82ead8, frameAlpha).lineBetween(headBottomX, headBottomY, frontX, axleY);
    g.lineStyle(5, 0x82ead8, frameAlpha).lineBetween(seatX, seatY, seatX - 5, seatY - 25);
    g.lineStyle(7, 0xa4f4e6, frameAlpha).lineBetween(seatX - 28, seatY - 30, seatX + 14, seatY - 30);

    // 구동계: 체인링·크랭크·페달·체인을 표시한다.
    const driveAlpha = partAlpha('drivetrain');
    g.lineStyle(4, 0xf4c95d, driveAlpha).strokeCircle(crankX, crankY, 17);
    g.lineStyle(2, 0xffe6a4, driveAlpha)
      .strokeCircle(crankX, crankY, 9)
      .lineBetween(crankX, crankY - 17, rearX, axleY - 8)
      .lineBetween(crankX, crankY + 17, rearX, axleY + 8);
    g.lineStyle(4, 0xf4c95d, driveAlpha).lineBetween(crankX - 20, crankY - 13, crankX + 20, crankY + 13);
    g.lineStyle(5, 0xffe6a4, driveAlpha)
      .lineBetween(crankX + 16, crankY + 13, crankX + 31, crankY + 13)
      .lineBetween(crankX - 31, crankY - 13, crankX - 16, crankY - 13);

    // 로드 콕핏: 스템에서 이어지는 드롭바를 별도 색으로 강조한다.
    const barAlpha = partAlpha('handlebar');
    g.lineStyle(5, 0xd596ff, barAlpha).lineBetween(headTopX, headTopY, 793, 286);
    g.lineStyle(6, 0xe4b8ff, barAlpha);
    g.beginPath();
    g.moveTo(788, 283); g.lineTo(817, 283); g.lineTo(824, 296); g.lineTo(820, 310); g.lineTo(811, 313);
    g.strokePath();

    if (this.mode === 'slots' && !this.completed) {
      PARTS.forEach((part, index) => {
        const x = 572 + (index % 2) * 182;
        const y = 466 + Math.floor(index / 2) * 46;
        const ready = this.prepared.has(part.id);
        const installed = this.installed.has(part.id);
        this.button(x, y, 164, installed ? `${part.name} 장착됨` : ready ? `${part.name} 장착` : `${part.name} 미준비`, () => this.install(part), ready && !installed);
      });
    } else {
      const progress = this.prepared.size / PARTS.length;
      this.add.rectangle(538, 502, 348, 10, 0x14273a).setOrigin(0, .5);
      this.add.rectangle(538, 502, 348 * progress, 10, 0x55d6be).setOrigin(0, .5);
      this.text(538, 520, this.completed ? '조립 완료 · 납품 준비 완료' : `부품 조건 ${this.prepared.size} / 4`, 12, this.completed ? C.gold : C.muted, true);
    }
  }
}

export function startAssemblyPrototype(parent: string, mode: AssemblyPrototypeMode) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 620,
    backgroundColor: '#07111f',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: new AssemblyScene(mode),
    render: { antialias: true },
  });
}
