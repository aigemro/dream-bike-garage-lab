import Phaser from 'phaser';

export type CollectionPrototypeMode = 'catalog' | 'garage' | 'dream-bike';

type Bike = {
  id: string;
  name: string;
  category: '로드' | 'MTB' | '그래블' | '미니벨로';
  grade: '입문' | '중급' | '고급' | '드림';
  color: number;
  owned: boolean;
  duplicates: number;
  level: number;
};

const SAMPLE_BIKES: Bike[] = [
  { id: 'urban-road', name: '어반 로드', category: '로드', grade: '입문', color: 0x55d6be, owned: true, duplicates: 1, level: 1 },
  { id: 'trail-mtb', name: '트레일 MTB', category: 'MTB', grade: '중급', color: 0xffb454, owned: true, duplicates: 2, level: 2 },
  { id: 'gravel-explorer', name: '그래블 익스플로러', category: '그래블', grade: '중급', color: 0x8ea6ff, owned: true, duplicates: 0, level: 1 },
  { id: 'city-mini', name: '시티 미니벨로', category: '미니벨로', grade: '입문', color: 0xf08ac0, owned: false, duplicates: 0, level: 1 },
  { id: 'aero-pro', name: '에어로 프로', category: '로드', grade: '고급', color: 0xe5e7eb, owned: false, duplicates: 0, level: 1 },
  { id: 'dream-machine', name: '드림 머신', category: '로드', grade: '드림', color: 0xffdf6b, owned: false, duplicates: 0, level: 1 },
];

const C = {
  bg: 0x07111f, panel: 0x0b1828, line: 0x294158, text: '#eaf2f8',
  muted: '#8196aa', accent: '#55d6be', gold: '#ffdf6b', danger: '#ff7b7b',
};

class CollectionScene extends Phaser.Scene {
  private mode: CollectionPrototypeMode;
  private bikes = SAMPLE_BIKES.map((bike) => ({ ...bike }));
  private coins = 3000;
  private selected = 'urban-road';
  private garageSlots: Array<string | null> = ['urban-road', 'trail-mtb', null];
  private dreamStats = { 성능: 1, 스타일: 1, 희귀도: 1 };

  constructor(mode: CollectionPrototypeMode) {
    super('collection');
    this.mode = mode;
  }

  create() {
    this.render();
  }

  private render() {
    this.children.removeAll();
    this.add.rectangle(480, 310, 960, 620, C.bg);
    this.header();
    if (this.mode === 'catalog') this.catalog();
    if (this.mode === 'garage') this.garage();
    if (this.mode === 'dream-bike') this.dreamBike();
  }

  private text(x: number, y: number, value: string, size = 18, color = C.text, weight = '400') {
    return this.add.text(x, y, value, {
      fontFamily: 'Arial, sans-serif', fontSize: `${size}px`, color,
      fontStyle: weight === '700' ? 'bold' : 'normal', lineSpacing: 6,
    });
  }

  private header() {
    const titles = {
      catalog: ['COLLECTION A · 도감형', '빈칸을 채워 전체 수집 목표를 확인'],
      garage: ['COLLECTION B · GARAGE', '보유 자전거를 전시하고 대표 자전거를 성장'],
      'dream-bike': ['COLLECTION C · DREAM BIKE', '한 대에 집중해 나만의 드림 바이크 완성'],
    };
    const [eyebrow, title] = titles[this.mode];
    this.text(36, 24, eyebrow, 12, C.accent, '700');
    this.text(36, 44, title, 25, C.text, '700');
    this.text(795, 28, '보유 코인', 12, C.muted);
    this.text(795, 48, this.coins.toLocaleString(), 22, C.gold, '700');
    this.add.line(480, 88, 36, 0, 924, 0, C.line);
  }

  private panel(x: number, y: number, w: number, h: number, color = C.panel) {
    return this.add.rectangle(x, y, w, h, color).setStrokeStyle(1, C.line);
  }

  private button(x: number, y: number, w: number, label: string, onClick: () => void, active = true) {
    const bg = this.add.rectangle(x, y, w, 38, active ? 0x15314a : 0x111d2b)
      .setStrokeStyle(1, active ? 0x55d6be : 0x30475c);
    const labelText = this.text(x, y, label, 13, active ? C.accent : '#60778c', '700').setOrigin(.5);
    if (active) {
      [bg, labelText].forEach((item) => item.setInteractive({ useHandCursor: true }).on('pointerdown', onClick));
    }
    return bg;
  }

  private drawBike(x: number, y: number, scale: number, color: number, level = 1, locked = false) {
    const g = this.add.graphics().setAlpha(locked ? .22 : 1);
    const line = locked ? 0x607080 : color;
    g.lineStyle(5 * scale, line, 1);
    g.strokeCircle(x - 48 * scale, y + 24 * scale, 30 * scale);
    g.strokeCircle(x + 48 * scale, y + 24 * scale, 30 * scale);
    g.lineBetween(x - 48 * scale, y + 24 * scale, x - 10 * scale, y - 15 * scale);
    g.lineBetween(x - 10 * scale, y - 15 * scale, x + 15 * scale, y + 24 * scale);
    g.lineBetween(x + 15 * scale, y + 24 * scale, x - 48 * scale, y + 24 * scale);
    g.lineBetween(x - 10 * scale, y - 15 * scale, x + 35 * scale, y - 15 * scale);
    g.lineBetween(x + 35 * scale, y - 15 * scale, x + 48 * scale, y + 24 * scale);
    g.lineBetween(x - 20 * scale, y - 22 * scale, x + 2 * scale, y - 22 * scale);
    g.lineBetween(x + 29 * scale, y - 24 * scale, x + 46 * scale, y - 31 * scale);
    if (level >= 2) {
      g.fillStyle(color, .2);
      g.fillTriangle(x - 45 * scale, y + 20 * scale, x - 8 * scale, y - 12 * scale, x + 12 * scale, y + 20 * scale);
    }
    if (level >= 3) {
      g.lineStyle(3 * scale, 0xffdf6b, 1);
      g.strokeCircle(x, y + 5 * scale, 62 * scale);
    }
    return g;
  }

  private catalog() {
    const owned = this.bikes.filter((bike) => bike.owned).length;
    this.text(36, 108, `전체 진행률  ${owned} / ${this.bikes.length}`, 16, C.text, '700');
    this.add.rectangle(367, 118, 430, 10, 0x14273a).setOrigin(0, .5);
    this.add.rectangle(367, 118, 430 * owned / this.bikes.length, 10, 0x55d6be).setOrigin(0, .5);

    this.bikes.forEach((bike, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = 176 + col * 304;
      const y = 246 + row * 198;
      const selected = this.selected === bike.id;
      const card = this.add.rectangle(x, y, 282, 184, selected ? 0x102b3c : C.panel)
        .setStrokeStyle(selected ? 2 : 1, selected ? bike.color : C.line)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => { this.selected = bike.id; this.render(); });
      this.text(x - 126, y - 78, `${bike.category} · ${bike.grade}`, 11, bike.owned ? C.accent : C.muted, '700');
      this.drawBike(x, y - 16, .65, bike.color, bike.level, !bike.owned);
      this.text(x - 126, y + 48, bike.owned ? bike.name : '??? 미획득', 16, bike.owned ? C.text : C.muted, '700');
      this.text(x - 126, y + 70, bike.owned ? `Lv.${bike.level} · 중복 ${bike.duplicates}` : '주문 납품 보상으로 발견', 11, C.muted);
    });

    const target = this.bikes.find((bike) => bike.id === this.selected)!;
    this.panel(480, 578, 888, 54);
    this.text(56, 564, target.owned ? `${target.name} 상세 확인 · 획득 완료` : `${target.name} 발견 시뮬레이션 · 1,000코인`, 14, C.text, '700');
    if (!target.owned) this.button(815, 578, 170, '신규 획득 연출', () => {
      if (this.coins < 1000) return;
      target.owned = true; this.coins -= 1000; this.render();
    });
  }

  private garage() {
    this.text(36, 105, '전시 슬롯', 16, C.text, '700');
    this.text(36, 129, '아래 보유 자전거를 선택한 뒤 빈 전시대에 배치하세요.', 12, C.muted);
    this.garageSlots.forEach((bikeId, index) => {
      const x = 186 + index * 294;
      this.panel(x, 260, 266, 210, bikeId ? 0x102535 : 0x091523);
      this.text(x - 116, 170, `DISPLAY 0${index + 1}`, 11, C.muted, '700');
      if (bikeId) {
        const bike = this.bikes.find((item) => item.id === bikeId)!;
        this.drawBike(x, 242, .78, bike.color, bike.level);
        this.text(x, 310, bike.name, 15, C.text, '700').setOrigin(.5);
        this.text(x, 335, `Lv.${bike.level} · ${bike.grade}`, 11, C.muted).setOrigin(.5);
      } else {
        this.text(x, 250, '+', 40, C.muted).setOrigin(.5);
        this.text(x, 290, '빈 전시대', 13, C.muted).setOrigin(.5);
      }
      this.add.rectangle(x, 260, 266, 210, 0xffffff, 0.001).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        const bike = this.bikes.find((item) => item.id === this.selected);
        if (bike?.owned) { this.garageSlots[index] = bike.id; this.render(); }
      });
    });

    this.text(36, 385, '보유 자전거', 15, C.text, '700');
    this.bikes.filter((bike) => bike.owned).forEach((bike, index) => {
      const x = 155 + index * 245;
      const active = this.selected === bike.id;
      this.add.rectangle(x, 465, 220, 104, active ? 0x15314a : C.panel)
        .setStrokeStyle(active ? 2 : 1, active ? bike.color : C.line)
        .setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.selected = bike.id; this.render(); });
      this.drawBike(x - 55, 455, .34, bike.color, bike.level);
      this.text(x - 5, 433, bike.name, 13, C.text, '700');
      this.text(x - 5, 458, `중복 ${bike.duplicates} · Lv.${bike.level}`, 11, C.muted);
      this.text(x - 5, 480, active ? '선택됨' : '선택', 11, active ? C.accent : C.muted, '700');
    });
    const selected = this.bikes.find((bike) => bike.id === this.selected)!;
    const cost = 500 * selected.level;
    this.panel(480, 565, 888, 64);
    this.text(56, 548, `대표 후보 · ${selected.name}`, 14, C.text, '700');
    this.text(56, 570, '중복 획득 또는 급여를 사용해 전시 자전거를 성장시킵니다.', 11, C.muted);
    this.button(792, 565, 210, `성장 Lv.${selected.level + 1} · ${cost}코인`, () => {
      if (this.coins >= cost) { this.coins -= cost; selected.level += 1; this.render(); }
    }, this.coins >= cost);
  }

  private dreamBike() {
    const dream = this.bikes.find((bike) => bike.id === this.selected) ?? this.bikes[0];
    const total = Object.values(this.dreamStats).reduce((sum, value) => sum + value, 0);
    const stage = total >= 10 ? 3 : total >= 7 ? 2 : 1;
    this.panel(302, 340, 532, 466, 0x0b1c2d);
    this.text(62, 125, 'MY DREAM BIKE', 12, C.accent, '700');
    this.text(62, 150, dream.name, 27, C.text, '700');
    this.text(62, 188, stage === 3 ? '드림 등급' : stage === 2 ? '고급 등급' : '중급 등급', 13, stage === 3 ? C.gold : C.muted, '700');
    this.drawBike(302, 335, 1.7, dream.color, stage);
    this.text(62, 508, `전체 성장 ${Math.round((total - 3) / 9 * 100)}%`, 12, C.muted);
    this.add.rectangle(62, 542, 440, 10, 0x14273a).setOrigin(0, .5);
    this.add.rectangle(62, 542, 440 * Math.min(1, (total - 3) / 9), 10, dream.color).setOrigin(0, .5);

    this.panel(740, 340, 356, 466);
    this.text(586, 125, '성장 파츠', 16, C.text, '700');
    this.text(586, 153, '주문 급여를 투자해 외형과 등급 변화를 확인합니다.', 11, C.muted);
    (Object.keys(this.dreamStats) as Array<keyof typeof this.dreamStats>).forEach((key, index) => {
      const level = this.dreamStats[key];
      const y = 225 + index * 112;
      this.text(586, y - 25, key, 15, C.text, '700');
      this.text(840, y - 25, `Lv.${level} / 4`, 12, level === 4 ? C.gold : C.muted, '700');
      for (let dot = 0; dot < 4; dot++) this.add.circle(604 + dot * 42, y + 12, 8, dot < level ? dream.color : 0x203248);
      const cost = 350 * level;
      this.button(820, y + 18, 150, level < 4 ? `강화 · ${cost}` : 'MAX', () => {
        if (level < 4 && this.coins >= cost) { this.coins -= cost; this.dreamStats[key] += 1; this.render(); }
      }, level < 4 && this.coins >= cost);
    });
    this.text(586, 545, stage === 3 ? '드림 바이크 완성!' : '다음 등급까지 성장 파츠를 강화하세요.', 12, stage === 3 ? C.gold : C.accent, '700');
  }
}

export function startCollectionPrototype(parent: string, mode: CollectionPrototypeMode) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 620,
    backgroundColor: '#07111f',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: new CollectionScene(mode),
    render: { antialias: true },
  });
}
