import Phaser from 'phaser';

export type HomePlayPrototypeMode = 'play-focus' | 'order-focus' | 'hub-focus' | 'garage-lobby' | 'garage-agreement';

const C = {
  bg: 0x07111f, panel: 0x0d1d2f, panel2: 0x11263b, line: 0x294158,
  text: '#edf5fb', muted: '#7f96aa', accent: '#55d6be', gold: '#f4c95d', blue: '#6ea8ff', purple: '#d596ff',
};

class HomePlayScene extends Phaser.Scene {
  private mode: HomePlayPrototypeMode;
  private selectedCell = -1;
  private message = '머지할 부품을 선택하세요.';
  private garagePlaying = false;
  private board = [1, 1, 2, 0, 3, 0, 2, 0, 1, 0, 0, 3, 0, 2, 0, 1, 0, 0, 2, 0];

  constructor(mode: HomePlayPrototypeMode) {
    super(`home-play-${mode}`);
    this.mode = mode;
  }

  create() { this.render(); }

  private text(x: number, y: number, value: string, size = 14, color = C.text, bold = false) {
    return this.add.text(x, y, value, { fontFamily: 'Arial, sans-serif', fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' });
  }

  private panel(x: number, y: number, width: number, height: number, active = false) {
    return this.add.rectangle(x, y, width, height, active ? C.panel2 : C.panel).setStrokeStyle(active ? 2 : 1, active ? 0x55d6be : C.line);
  }

  private button(x: number, y: number, width: number, height: number, label: string, onClick: () => void, active = false) {
    const box = this.add.rectangle(x, y, width, height, active ? 0x153d4a : C.panel2)
      .setStrokeStyle(active ? 2 : 1, active ? 0x55d6be : C.line)
      .setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    const caption = this.text(x, y, label, 11, active ? C.accent : C.text, true)
      .setAlign('center').setLineSpacing(2).setOrigin(.5);
    caption.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    return box;
  }

  private notify(label: string) { this.message = `${label} 화면으로 이동하는 진입 버튼입니다.`; this.render(); }

  private render() {
    this.children.removeAll();
    this.add.rectangle(195, 405, 390, 810, C.bg);
    this.renderResourceBar();
    if (this.mode === 'garage-lobby' || this.mode === 'garage-agreement') {
      this.garagePlaying
        ? this.renderGaragePlay()
        : this.mode === 'garage-agreement' ? this.renderGarageAgreement() : this.renderGarageLobby();
      return;
    }
    if (this.mode === 'play-focus') this.renderPlayFocus();
    if (this.mode === 'order-focus') this.renderOrderFocus();
    if (this.mode === 'hub-focus') this.renderHubFocus();
    this.renderBottomNavigation();
  }

  private renderResourceBar() {
    this.panel(195, 38, 366, 54, true);
    this.text(28, 20, '⚡ STAMINA', 10, C.muted, true);
    this.text(28, 37, '72 / 100', 15, C.accent, true);
    this.add.rectangle(115, 43, 78, 6, 0x1a3447).setOrigin(0, .5);
    this.add.rectangle(115, 43, 56, 6, 0x55d6be).setOrigin(0, .5);
    this.text(273, 20, 'COIN', 10, C.muted, true);
    this.text(273, 37, '2,480', 15, C.gold, true);
  }

  private renderPlayFocus() {
    this.text(18, 76, 'A · PLAY FOCUS', 10, C.accent, true);
    this.renderOrderSlots(18, 96, 354, 70);
    this.button(47, 192, 58, 46, '이벤트', () => this.notify('이벤트'));
    this.button(47, 244, 58, 46, '랭킹', () => this.notify('리더 순위'));
    this.button(343, 192, 58, 46, 'TOUR', () => this.notify('Tour'));
    this.renderBoard(80, 186, 232, 356, 4, 5);
    this.renderAssemblyMini(319, 251, 53, 258);
    this.renderMessage(18, 557, 354);
  }

  private renderOrderFocus() {
    this.text(18, 76, 'B · ORDER & BIKE FOCUS', 10, C.accent, true);
    this.renderHeroOrder(18, 94, 354, 164);
    this.button(51, 284, 66, 42, '이벤트', () => this.notify('이벤트'));
    this.button(123, 284, 66, 42, '랭킹', () => this.notify('리더 순위'));
    this.button(195, 284, 66, 42, 'TOUR', () => this.notify('Tour'));
    this.renderBoard(35, 314, 320, 268, 5, 4);
    this.renderMessage(18, 596, 354);
  }

  private renderHubFocus() {
    this.text(18, 76, 'C · HOME HUB FOCUS', 10, C.accent, true);
    this.renderHubButtons();
    this.renderCompactOrder(18, 166, 354, 94);
    this.renderBoard(57, 280, 276, 292, 5, 4);
    this.renderMessage(18, 586, 354);
  }


  private renderGarageAgreement() {
    this.text(18, 76, 'E · AGREED GARAGE HOME', 10, C.accent, true);

    this.panel(195, 119, 238, 62, true);
    this.text(88, 100, 'CURRENT ORDERS', 8, C.muted, true);
    ['ROAD', 'MTB', '+2'].forEach((label, index) => {
      this.button(118 + index * 77, 128, 66, 30, label, () => this.notify(index === 0 ? '현재 주문' : '대기 주문'), index === 0);
    });

    this.button(37, 205, 54, 48, 'EVENT\n3', () => this.notify('이벤트'));
    this.button(37, 263, 54, 48, 'RANK\n#18', () => this.notify('리더 순위'));
    this.button(353, 205, 54, 48, 'TOUR\nD2', () => this.notify('Tour'));
    this.button(353, 263, 54, 48, '조립\n2/4', () => this.notify('조립·성장'));
    this.button(353, 321, 54, 48, 'STATUS\nLv.12', () => this.notify('Status'));

    this.panel(195, 385, 254, 446, true);
    this.text(82, 176, 'MY GARAGE', 9, C.accent, true);
    this.text(82, 197, '오늘의 대표 자전거', 18, C.text, true);
    this.text(82, 222, 'AERO ROAD · RARE', 9, C.gold, true);

    this.add.rectangle(195, 354, 226, 212, 0x0a1726).setStrokeStyle(1, 0x294158);
    this.add.ellipse(195, 425, 204, 28, 0x173047, .85);
    this.drawBike(195, 340, .88);
    this.text(195, 454, '대표 자전거를 눌러 Garage 상세 보기', 9, C.muted).setOrigin(.5);

    this.text(82, 489, 'COLLECTION', 8, C.muted, true);
    this.text(82, 509, '8 / 24', 18, C.text, true);
    this.text(186, 489, 'NEXT GOAL', 8, C.muted, true);
    this.text(186, 509, 'MTB TRAIL', 13, C.text, true);
    this.text(186, 530, '주문 2건 남음', 9, C.gold, true);
    this.add.rectangle(82, 552, 226, 7, 0x1b3447).setOrigin(0, .5);
    this.add.rectangle(82, 552, 75, 7, 0x55d6be).setOrigin(0, .5);
    this.text(82, 570, '도감 33% · 다음 자전거까지 2 ORDERS', 9, C.muted);

    this.panel(195, 744, 366, 76, true);
    this.button(67, 741, 82, 50, '알바생\nPROFILE', () => this.notify('직급·프로필'));
    this.button(195, 741, 152, 56, '▶  PLAY', () => {
      this.garagePlaying = true;
      this.message = '현재 주문의 머지 플레이 화면으로 이동했습니다.';
      this.render();
    }, true);
    this.button(323, 741, 82, 50, '수집\n8/24', () => this.notify('자전거 수집'));
    this.text(195, 795, 'GARAGE HOME · MEETING AGREEMENT', 8, C.muted, true).setOrigin(.5);
  }

  private renderGarageLobby() {
    this.text(18, 76, 'D · GARAGE LOBBY', 10, C.accent, true);
    this.button(55, 112, 74, 44, 'EVENT\n3', () => this.notify('이벤트'));
    this.button(139, 112, 74, 44, 'TOUR\nDAY 2', () => this.notify('Tour'));
    this.button(223, 112, 74, 44, 'RANK\n#18', () => this.notify('리더 순위'));
    this.button(324, 112, 86, 44, 'SHOP', () => this.notify('상점'));

    this.panel(195, 320, 354, 350, true);
    this.text(34, 160, 'MY GARAGE', 10, C.accent, true);
    this.text(34, 183, '나의 드림 바이크', 21, C.text, true);
    this.text(34, 213, 'AERO ROAD · RARE', 10, C.gold, true);
    this.add.rectangle(195, 330, 322, 204, 0x0a1726).setStrokeStyle(1, 0x294158);
    this.add.ellipse(195, 410, 260, 32, 0x173047, .8);
    this.drawBike(195, 315, 1.05);
    this.text(195, 460, '대표 자전거를 눌러 전시 자전거 변경', 10, C.muted).setOrigin(.5);

    this.panel(100, 557, 164, 92);
    this.text(34, 526, 'BIKE COLLECTION', 9, C.muted, true);
    this.text(34, 548, '8 / 24', 20, C.text, true);
    this.add.rectangle(34, 582, 132, 7, 0x1b3447).setOrigin(0, .5);
    this.add.rectangle(34, 582, 44, 7, 0x55d6be).setOrigin(0, .5);

    this.panel(290, 557, 164, 92);
    this.text(224, 526, 'NEXT UNLOCK', 9, C.muted, true);
    this.text(224, 548, 'MTB TRAIL', 14, C.text, true);
    this.text(224, 572, '주문 2건 남음', 10, C.gold, true);

    this.panel(195, 744, 366, 76, true);
    this.button(67, 741, 82, 50, 'GARAGE', () => this.notify('Garage'), true);
    this.button(195, 741, 152, 56, '▶  PLAY', () => { this.garagePlaying = true; this.message = '머지 플레이 화면으로 이동했습니다.'; this.render(); }, true);
    this.button(323, 741, 82, 50, '수집\n8/24', () => this.notify('자전거 수집'));
    this.text(195, 795, 'GARAGE LOBBY · COLLECTION HUB', 8, C.muted, true).setOrigin(.5);
  }

  private renderGaragePlay() {
    this.text(18, 76, this.mode === 'garage-agreement' ? 'E · MERGE PLAY' : 'D · MERGE PLAY', 10, C.accent, true);
    this.button(54, 112, 72, 42, '← HOME', () => { this.garagePlaying = false; this.message = 'Garage 로비로 돌아왔습니다.'; this.render(); });
    this.panel(230, 112, 266, 42, true);
    this.text(112, 100, 'ORDER #01 · 에어로 로드', 11, C.text, true);
    this.text(112, 118, '조립 진행 2 / 4', 10, C.gold, true);
    this.renderBoard(35, 150, 320, 438, 5, 4);
    this.renderMessage(18, 602, 354);
    this.panel(195, 710, 354, 92, true);
    this.text(34, 682, 'PLAY MODE', 9, C.accent, true);
    this.text(34, 704, '같은 레벨 부품을 차례로 눌러 머지', 11, C.text, true);
    this.button(300, 710, 112, 48, '부품 생성', () => this.addGaragePart());
    this.text(195, 782, 'PLAY 종료 후 HOME으로 Garage에 복귀', 8, C.muted, true).setOrigin(.5);
  }

  private addGaragePart() {
    const empty = this.board.findIndex((level) => level === 0);
    this.message = empty < 0 ? '보드가 가득 찼습니다.' : 'Lv.1 부품을 보드에 추가했습니다.';
    if (empty >= 0) this.board[empty] = 1;
    this.render();
  }

  private renderOrderSlots(x: number, y: number, width: number, height: number) {
    this.panel(x + width / 2, y + height / 2, width, height);
    this.text(x + 12, y + 9, 'CURRENT ORDERS', 9, C.muted, true);
    ['ROAD', 'MTB', '+'].forEach((label, index) => {
      const active = index === 0;
      this.button(x + 72 + index * 88, y + 43, 78, 36, label, () => this.notify(active ? '현재 주문' : '대기 주문'), active);
    });
  }

  private renderHeroOrder(x: number, y: number, width: number, height: number) {
    this.panel(x + width / 2, y + height / 2, width, height, true);
    this.text(x + 14, y + 12, 'CURRENT ORDER #01', 9, C.accent, true);
    this.text(x + 14, y + 32, '에어로 로드바이크', 18, C.text, true);
    this.drawBike(x + 224, y + 82, .65);
    this.text(x + 14, y + 64, '조립 진행', 10, C.muted);
    this.text(x + 14, y + 82, '2 / 4 PARTS', 13, C.gold, true);
    this.add.rectangle(x + 14, y + 108, 148, 8, 0x1b3447).setOrigin(0, .5);
    this.add.rectangle(x + 14, y + 108, 74, 8, 0x55d6be).setOrigin(0, .5);
    this.text(x + 14, y + 127, '프레임 ✓  휠셋 ✓  구동계 ·  핸들바 ·', 9, C.muted);
  }

  private renderCompactOrder(x: number, y: number, width: number, height: number) {
    this.panel(x + width / 2, y + height / 2, width, height, true);
    this.text(x + 12, y + 11, 'ORDER #01', 9, C.accent, true);
    this.text(x + 12, y + 31, '에어로 로드 · 조립 2/4', 15, C.text, true);
    this.add.rectangle(x + 12, y + 63, 205, 8, 0x1b3447).setOrigin(0, .5);
    this.add.rectangle(x + 12, y + 63, 103, 8, 0x55d6be).setOrigin(0, .5);
    this.drawBike(x + 285, y + 52, .36);
  }

  private renderHubButtons() {
    const items = [['EVENT', '3'], ['TOUR', 'DAY 2'], ['RANK', '#18']];
    items.forEach(([label, value], index) => {
      const x = 72 + index * 123;
      this.panel(x, 122, 112, 64, index === 0);
      this.text(x, 107, label, 9, index === 0 ? C.accent : C.muted, true).setOrigin(.5);
      const valueText = this.text(x, 130, value, 14, index === 0 ? C.gold : C.text, true).setOrigin(.5);
      [valueText].forEach((item) => item.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.notify(label)));
    });
  }

  private renderBoard(x: number, y: number, width: number, height: number, columns: number, rows: number) {
    this.panel(x + width / 2, y + height / 2, width, height);
    this.text(x + 12, y + 12, 'MERGE WORKBENCH', 9, C.accent, true);
    const gap = 5;
    const cell = Math.min((width - 24 - gap * (columns - 1)) / columns, (height - 58 - gap * (rows - 1)) / rows);
    const boardWidth = cell * columns + gap * (columns - 1);
    const startX = x + (width - boardWidth) / 2 + cell / 2;
    const startY = y + 42 + cell / 2;
    for (let index = 0; index < columns * rows; index += 1) {
      const cx = startX + (index % columns) * (cell + gap);
      const cy = startY + Math.floor(index / columns) * (cell + gap);
      const level = this.board[index] ?? 0;
      const active = this.selectedCell === index;
      const cellBox = this.add.rectangle(cx, cy, cell, cell, level ? 0x173047 : 0x101f30)
        .setStrokeStyle(active ? 2 : 1, active ? 0xf4c95d : 0x294158)
        .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.selectCell(index));
      if (level) {
        this.add.circle(cx, cy - 5, Math.max(5, cell * .13), [0, 0x55d6be, 0x6ea8ff, 0xd596ff][level]);
        this.text(cx, cy + cell * .23, `Lv.${level}`, Math.max(8, cell * .17), C.text, true).setOrigin(.5);
      }
      void cellBox;
    }
  }

  private selectCell(index: number) {
    const level = this.board[index];
    if (!level) { this.selectedCell = -1; this.message = '빈 칸입니다. 부품이 있는 칸을 선택하세요.'; this.render(); return; }
    if (this.selectedCell < 0) { this.selectedCell = index; this.message = `Lv.${level} 부품 선택 · 같은 레벨을 누르면 머지됩니다.`; this.render(); return; }
    if (this.selectedCell !== index && this.board[this.selectedCell] === level) {
      this.board[this.selectedCell] = 0; this.board[index] = Math.min(3, level + 1); this.selectedCell = -1;
      this.message = `머지 성공 · Lv.${Math.min(3, level + 1)} 부품이 만들어졌습니다.`; this.render(); return;
    }
    this.selectedCell = index; this.message = `Lv.${level} 부품을 새로 선택했습니다.`; this.render();
  }

  private renderAssemblyMini(x: number, y: number, width: number, height: number) {
    this.panel(x + width / 2, y + height / 2, width, height);
    this.text(x + width / 2, y + 14, '조립', 9, C.muted, true).setOrigin(.5);
    [C.accent, C.blue, C.gold, C.purple].forEach((color, index) => this.add.circle(x + width / 2, y + 48 + index * 43, 8, Number.parseInt(color.slice(1), 16), index < 2 ? 1 : .2));
    this.text(x + width / 2, y + height - 20, '2/4', 10, C.gold, true).setOrigin(.5);
  }

  private renderMessage(x: number, y: number, width: number) {
    this.panel(x + width / 2, y + 24, width, 48, true);
    this.text(x + 12, y + 17, this.message, 10, C.text, true).setWordWrapWidth(width - 24);
  }

  private renderBottomNavigation() {
    this.panel(195, 744, 366, 76, true);
    this.button(77, 741, 102, 50, '알바생\n직급', () => this.notify('직급'));
    this.button(195, 741, 120, 50, 'STATUS\nLv.12', () => this.notify('Status'), true);
    this.button(313, 741, 102, 50, '♥\n수집', () => this.notify('수집'));
    this.text(195, 795, 'DREAM BIKE GARAGE · MAIN HOME', 8, C.muted, true).setOrigin(.5);
  }

  private drawBike(x: number, y: number, scale: number) {
    const g = this.add.graphics();
    const rearX = x - 70 * scale; const frontX = x + 70 * scale; const wheelY = y + 28 * scale; const r = 30 * scale;
    g.lineStyle(Math.max(2, 4 * scale), 0x6ea8ff).strokeCircle(rearX, wheelY, r).strokeCircle(frontX, wheelY, r);
    g.lineStyle(Math.max(2, 6 * scale), 0x55d6be)
      .lineBetween(rearX, wheelY, x - 18 * scale, y - 24 * scale)
      .lineBetween(x - 18 * scale, y - 24 * scale, x, wheelY)
      .lineBetween(x, wheelY, rearX, wheelY)
      .lineBetween(x - 18 * scale, y - 24 * scale, x + 40 * scale, y - 18 * scale)
      .lineBetween(x + 40 * scale, y - 18 * scale, x, wheelY)
      .lineBetween(x + 40 * scale, y - 18 * scale, frontX, wheelY);
    g.lineStyle(Math.max(2, 4 * scale), 0xd596ff).lineBetween(x + 40 * scale, y - 18 * scale, x + 57 * scale, y - 30 * scale);
  }
}

export function startHomePlayPrototype(parent: string, mode: HomePlayPrototypeMode) {
  return new Phaser.Game({
    type: Phaser.AUTO, parent, width: 390, height: 810, backgroundColor: '#07111f',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: new HomePlayScene(mode), render: { antialias: true },
  });
}
