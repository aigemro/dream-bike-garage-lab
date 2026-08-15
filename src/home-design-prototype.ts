import Phaser from 'phaser';
import { DuskWorkshopGarageScene } from './home-design-dusk-workshop';
import { RetroPixelGarageScene } from './home-design-retro-pixel';
import { ModernCasualGarageScene } from './home-design-modern-casual';

export type HomeDesignPrototypeMode =
  | 'warm-pixel-garage'
  | 'dusk-workshop-garage'
  | 'retro-pixel-garage'
  | 'modern-casual-garage';

const P = {
  ink: 0x3b2531, cream: 0xfff1c6, paper: 0xf6d995, wood: 0x8e5136,
  darkWood: 0x573044, floor: 0xb66f45, green: 0x5e9a67, leaf: 0x86ba6f,
  sky: 0x86c9c8, blue: 0x4e8092, gold: 0xf4b84a, red: 0xc95746, tire: 0x302936,
};

class WarmPixelGarageScene extends Phaser.Scene {
  private playing = false;
  private toast = '오늘의 주문을 확인하고 작업을 시작해 보세요.';

  constructor() { super('home-design-warm-pixel-garage'); }
  create() { this.render(); }

  private label(x: number, y: number, value: string, size = 12, color = '#3b2531', bold = false) {
    return this.add.text(x, y, value, {
      fontFamily: '"Arial Rounded MT Bold", "Noto Sans KR", sans-serif', fontSize: `${size}px`,
      color, fontStyle: bold ? 'bold' : 'normal', stroke: bold ? '#fff1c6' : undefined, strokeThickness: bold ? 1 : 0,
    });
  }

  private pixelRect(x: number, y: number, w: number, h: number, fill: number, stroke = P.ink, depth = 0) {
    return this.add.rectangle(x, y, w, h, fill).setStrokeStyle(3, stroke).setDepth(depth);
  }

  private button(x: number, y: number, w: number, h: number, text: string, action: () => void, primary = false) {
    const shadow = this.add.rectangle(x + 3, y + 4, w, h, P.darkWood).setDepth(20);
    const box = this.add.rectangle(x, y, w, h, primary ? P.gold : P.paper)
      .setStrokeStyle(3, P.ink).setDepth(21).setInteractive({ useHandCursor: true }).on('pointerdown', action);
    const caption = this.label(x, y, text, primary ? 16 : 10, '#3b2531', true).setOrigin(.5).setAlign('center').setDepth(22)
      .setInteractive({ useHandCursor: true }).on('pointerdown', action);
    void shadow;
    return box;
  }

  private render() {
    this.children.removeAll();
    this.add.rectangle(195, 405, 390, 810, P.cream);
    this.playing ? this.renderPlayPreview() : this.renderGarageHome();
  }

  private renderGarageHome() {
    this.renderWorkshop();
    this.renderTopBar();

    this.pixelRect(195, 125, 238, 60, P.paper, P.ink, 10);
    this.label(88, 101, 'TODAY\'S ORDER', 9, '#6e473b', true).setDepth(11);
    this.label(88, 119, '통학용 어반 바이크', 14, '#3b2531', true).setDepth(11);
    this.label(88, 140, '진행 2 / 4  ·  보상 1,000', 10, '#8e5136', true).setDepth(11);
    this.drawTinyBike(282, 127, .34, P.red, 12);

    this.button(38, 205, 54, 48, 'EVENT\n3', () => this.notify('이벤트 준비 중'));
    this.button(38, 263, 54, 48, 'RANK\n#18', () => this.notify('랭킹 준비 중'));
    this.button(352, 205, 54, 48, 'TOUR\nD2', () => this.notify('투어 준비 중'));
    this.button(352, 263, 54, 48, '조립\n2/4', () => this.notify('조립 현황'));
    this.button(352, 321, 54, 48, 'STATUS\nLv.12', () => this.notify('견습 정비사 Lv.12'));

    this.pixelRect(195, 387, 254, 430, 0xf2c77e, P.ink, 7).setAlpha(.88);
    this.label(82, 183, 'MY LITTLE GARAGE', 10, '#6e473b', true).setDepth(13);
    this.label(82, 202, '나의 드림 로드바이크', 17, '#3b2531', true).setDepth(13);
    this.label(82, 226, '햇살 아래 한 단계씩 완성 중', 10, '#7b5140').setDepth(13);
    this.add.ellipse(195, 419, 218, 30, 0x6e473b, .28).setDepth(12);
    this.drawBike(195, 338, 1, 13);

    this.pixelRect(195, 478, 222, 72, 0xffe6a8, P.wood, 13);
    this.label(98, 454, 'COLLECTION', 8, '#7b5140', true).setDepth(14);
    this.label(98, 471, '8 / 24', 17, '#3b2531', true).setDepth(14);
    this.label(192, 454, 'NEXT GOAL', 8, '#7b5140', true).setDepth(14);
    this.label(192, 471, 'TRAIL MTB', 12, '#3b2531', true).setDepth(14);
    this.label(192, 490, '주문 2건 남음', 9, '#a14a38', true).setDepth(14);

    this.add.rectangle(195, 526, 212, 10, P.darkWood).setDepth(13);
    this.add.rectangle(125, 526, 72, 10, P.green).setDepth(14);
    this.label(195, 544, 'Garage 성장 33%', 9, '#5d3b34', true).setOrigin(.5).setDepth(14);

    this.pixelRect(195, 592, 310, 50, 0xfff1c6, P.wood, 14);
    this.label(195, 592, this.toast, 10, '#5d3b34', true).setOrigin(.5).setDepth(15);

    this.pixelRect(195, 744, 366, 82, P.wood, P.ink, 18);
    this.button(67, 741, 80, 48, '프로필\nLv.12', () => this.notify('견습 정비사 프로필'));
    this.button(195, 738, 150, 58, '▶  PLAY', () => { this.playing = true; this.render(); }, true);
    this.button(323, 741, 80, 48, '자전거\n8/24', () => this.notify('자전거 도감'));
    this.label(195, 793, 'DREAM BIKE GARAGE · WARM PIXEL HOME', 8, '#fff1c6', true).setOrigin(.5).setDepth(22);
  }

  private renderWorkshop() {
    this.add.rectangle(195, 274, 390, 548, 0xd79a63);
    this.add.rectangle(195, 632, 390, 168, P.floor);
    for (let y = 574; y < 710; y += 34) this.add.line(0, 0, 0, y, 390, y, P.darkWood, .35).setOrigin(0);
    for (let x = 16; x < 390; x += 58) this.add.line(0, 0, x, 574, x - 14, 710, P.darkWood, .22).setOrigin(0);

    this.pixelRect(195, 260, 214, 210, 0x6a3e36, P.darkWood, 1);
    this.pixelRect(195, 254, 184, 172, P.sky, P.cream, 2);
    this.add.rectangle(195, 300, 180, 78, 0x8fc975).setDepth(3);
    this.add.triangle(150, 292, 95, 335, 150, 266, 205, 335, 0x5e9a67).setDepth(3);
    this.add.triangle(246, 293, 198, 335, 248, 258, 300, 335, 0x4f8060).setDepth(3);
    this.add.rectangle(195, 254, 8, 172, P.cream).setDepth(4);
    this.add.rectangle(195, 254, 184, 8, P.cream).setDepth(4);

    this.pixelRect(54, 386, 74, 250, P.darkWood, P.ink, 4);
    this.label(54, 282, 'TOOLS', 9, '#fff1c6', true).setOrigin(.5).setDepth(5);
    [P.red, P.gold, P.green, P.blue].forEach((c, i) => {
      this.add.rectangle(38 + (i % 2) * 31, 322 + Math.floor(i / 2) * 62, 14, 42, c).setStrokeStyle(2, P.ink).setDepth(5);
      this.add.circle(38 + (i % 2) * 31, 352 + Math.floor(i / 2) * 62, 8, c).setStrokeStyle(2, P.ink).setDepth(5);
    });

    this.pixelRect(337, 450, 78, 120, 0x6d8b62, P.ink, 4);
    this.label(337, 411, 'ORDERS', 9, '#fff1c6', true).setOrigin(.5).setDepth(5);
    [0, 1, 2].forEach((i) => this.add.rectangle(337, 440 + i * 31, 54, 21, 0xffe8ad).setStrokeStyle(2, P.wood).setDepth(5));

    this.add.rectangle(27, 555, 26, 64, P.wood).setStrokeStyle(3, P.ink).setDepth(5);
    this.add.circle(27, 518, 28, P.leaf).setStrokeStyle(3, P.ink).setDepth(5);
    this.add.circle(45, 529, 22, P.green).setStrokeStyle(3, P.ink).setDepth(5);
  }

  private renderTopBar() {
    this.pixelRect(195, 39, 366, 54, P.paper, P.ink, 15);
    this.label(28, 20, 'ENERGY', 8, '#795044', true).setDepth(16);
    this.label(28, 37, '72 / 100', 14, '#3f7851', true).setDepth(16);
    this.add.rectangle(112, 43, 72, 8, P.darkWood).setDepth(16).setOrigin(0, .5);
    this.add.rectangle(112, 43, 52, 8, P.green).setDepth(17).setOrigin(0, .5);
    this.label(274, 20, 'COIN', 8, '#795044', true).setDepth(16);
    this.label(274, 37, '2,480', 14, '#a16028', true).setDepth(16);
  }

  private renderPlayPreview() {
    this.add.rectangle(195, 405, 390, 810, 0xd79a63);
    this.renderTopBar();
    this.button(55, 102, 82, 42, '← HOME', () => { this.playing = false; this.toast = 'Garage로 돌아왔습니다. 결과가 이곳에 쌓입니다.'; this.render(); });
    this.pixelRect(234, 102, 272, 48, P.paper, P.ink, 5);
    this.label(112, 87, 'ORDER #01 · 통학용 어반 바이크', 10, '#3b2531', true).setDepth(6);
    this.label(112, 105, '조립 진행 2 / 4 · 보상 1,000', 9, '#8e5136', true).setDepth(6);

    this.pixelRect(195, 380, 340, 492, 0x7f523d, P.ink, 2);
    this.label(42, 154, 'MERGE WORKBENCH', 11, '#fff1c6', true).setDepth(3);
    const parts = [1, 1, 2, 0, 3, 0, 2, 0, 1, 0, 0, 3, 0, 2, 0, 1, 0, 0, 2, 0];
    parts.forEach((level, i) => {
      const x = 64 + (i % 5) * 66; const y = 207 + Math.floor(i / 5) * 83;
      this.add.rectangle(x, y, 56, 68, level ? 0xe8bd76 : 0x684435).setStrokeStyle(3, P.darkWood).setDepth(3);
      if (level) {
        this.add.circle(x, y - 7, 11, [0, P.green, P.blue, P.red][level]).setStrokeStyle(2, P.ink).setDepth(4);
        this.label(x, y + 16, `Lv.${level}`, 9, '#3b2531', true).setOrigin(.5).setDepth(4);
      }
    });
    this.pixelRect(195, 642, 340, 64, P.paper, P.ink, 5);
    this.label(195, 642, 'PLAY 화면은 기능 검증용 축약 미리보기입니다.', 10, '#5d3b34', true).setOrigin(.5).setDepth(6);
    this.button(195, 731, 170, 58, '부품 주문하기', () => { this.toast = '부품이 배송되었습니다.'; }, true);
    this.label(195, 789, '완료 후 HOME으로 돌아가 Garage 성장을 확인', 9, '#5d3b34', true).setOrigin(.5);
  }

  private notify(message: string) { this.toast = message; this.render(); }

  private drawBike(x: number, y: number, scale: number, depth: number) {
    const g = this.add.graphics().setDepth(depth);
    const rearX = x - 72 * scale; const frontX = x + 72 * scale; const wheelY = y + 38 * scale; const r = 35 * scale;
    g.lineStyle(8 * scale, P.tire).strokeCircle(rearX, wheelY, r).strokeCircle(frontX, wheelY, r);
    g.lineStyle(4 * scale, P.cream).strokeCircle(rearX, wheelY, r - 7 * scale).strokeCircle(frontX, wheelY, r - 7 * scale);
    g.lineStyle(8 * scale, P.red)
      .lineBetween(rearX, wheelY, x - 21 * scale, y - 27 * scale).lineBetween(x - 21 * scale, y - 27 * scale, x, wheelY)
      .lineBetween(x, wheelY, rearX, wheelY).lineBetween(x - 21 * scale, y - 27 * scale, x + 41 * scale, y - 20 * scale)
      .lineBetween(x + 41 * scale, y - 20 * scale, x, wheelY).lineBetween(x + 41 * scale, y - 20 * scale, frontX, wheelY);
    g.lineStyle(5 * scale, P.ink).lineBetween(x + 41 * scale, y - 20 * scale, x + 60 * scale, y - 37 * scale);
    this.add.rectangle(x - 27 * scale, y - 35 * scale, 30 * scale, 7 * scale, P.ink).setDepth(depth);
  }

  private drawTinyBike(x: number, y: number, scale: number, color: number, depth: number) {
    const g = this.add.graphics().setDepth(depth);
    const rear = x - 55 * scale; const front = x + 55 * scale; const wy = y + 20 * scale; const r = 22 * scale;
    g.lineStyle(5 * scale, P.tire).strokeCircle(rear, wy, r).strokeCircle(front, wy, r);
    g.lineStyle(6 * scale, color).lineBetween(rear, wy, x - 15 * scale, y - 17 * scale).lineBetween(x - 15 * scale, y - 17 * scale, x, wy).lineBetween(x, wy, rear, wy).lineBetween(x - 15 * scale, y - 17 * scale, x + 32 * scale, y - 12 * scale).lineBetween(x + 32 * scale, y - 12 * scale, front, wy);
  }
}

export function startHomeDesignPrototype(parent: string, mode: HomeDesignPrototypeMode) {
  // 방안별 씬과 기본 배경색·렌더 설정을 분기합니다. (D안만 부드러운 벡터 렌더링)
  const scene =
    mode === 'dusk-workshop-garage' ? new DuskWorkshopGarageScene()
    : mode === 'retro-pixel-garage' ? new RetroPixelGarageScene()
    : mode === 'modern-casual-garage' ? new ModernCasualGarageScene()
    : new WarmPixelGarageScene();
  const backgroundColor =
    mode === 'dusk-workshop-garage' ? '#141a2e'
    : mode === 'retro-pixel-garage' ? '#101026'
    : mode === 'modern-casual-garage' ? '#bfe9f2'
    : '#fff1c6';
  const smooth = mode === 'modern-casual-garage';
  return new Phaser.Game({
    type: Phaser.AUTO, parent, width: 390, height: 810, backgroundColor,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene, render: { antialias: smooth, pixelArt: !smooth, roundPixels: !smooth },
  });
}
