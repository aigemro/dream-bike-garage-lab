import Phaser from 'phaser';

export type RewardPrototypeMode = 'fixed' | 'performance' | 'soft-timer';

const C = {
  bg: 0x07111f, panel: 0x0b1828, panelActive: 0x102b3c, line: 0x294158,
  text: '#eaf2f8', muted: '#8196aa', accent: '#55d6be', gold: '#ffdf6b', blue: '#8ea6ff',
};
const BASE_REWARD = 500;
const START_COINS = 1000;
const UPGRADE_COST = 1000;
const TIMER_SECONDS = 15;

type Upgrade = { id: string; name: string; description: string; level: number };

class RewardScene extends Phaser.Scene {
  private mode: RewardPrototypeMode;
  private coins = START_COINS;
  private orders = 0;
  private totalEarned = 0;
  private lastReward: string[] = [];
  private selectedQuality = 1;
  private orderStartedAt = 0;
  private timerText?: Phaser.GameObjects.Text;
  private upgrades: Upgrade[] = [
    { id: 'supply', name: '수급 속도', description: '부품 준비 시간 단축', level: 0 },
    { id: 'board', name: '작업 공간', description: '보드 슬롯 확장', level: 0 },
    { id: 'collection', name: '수집 보너스', description: '완성차 보상 증가', level: 0 },
  ];

  constructor(mode: RewardPrototypeMode) {
    super('reward');
    this.mode = mode;
  }

  create() {
    this.orderStartedAt = this.time.now;
    this.render();
  }

  update() {
    if (this.mode === 'soft-timer' && this.timerText?.active) {
      this.timerText.setText(`권장 시간  ${this.remainingSeconds().toFixed(1)}초`);
    }
  }

  private remainingSeconds() {
    return Math.max(0, TIMER_SECONDS - (this.time.now - this.orderStartedAt) / 1000);
  }

  private text(x: number, y: number, value: string, size = 16, color = C.text, bold = false) {
    return this.add.text(x, y, value, {
      fontFamily: 'Arial, sans-serif', fontSize: `${size}px`, color,
      fontStyle: bold ? 'bold' : 'normal', lineSpacing: 7,
    });
  }

  private panel(x: number, y: number, width: number, height: number, active = false) {
    return this.add.rectangle(x, y, width, height, active ? C.panelActive : C.panel)
      .setStrokeStyle(active ? 2 : 1, active ? 0x55d6be : C.line);
  }

  private button(x: number, y: number, width: number, label: string, onClick: () => void, enabled = true) {
    const background = this.add.rectangle(x, y, width, 44, enabled ? 0x15314a : 0x111d2b)
      .setStrokeStyle(1, enabled ? 0x55d6be : 0x30475c);
    const caption = this.text(x, y, label, 14, enabled ? C.accent : '#60778c', true).setOrigin(.5);
    if (enabled) [background, caption].forEach((item) => item.setInteractive({ useHandCursor: true }).on('pointerdown', onClick));
  }

  private modeInfo() {
    if (this.mode === 'fixed') return ['REWARD A · FIXED SALARY', '고정 급여·직선 성장'];
    if (this.mode === 'performance') return ['REWARD B · PERFORMANCE', '성과 보너스·성장 선택'];
    return ['REWARD C · SOFT TIMER', '빠른 납품 vs 고품질 납품'];
  }

  private deliver() {
    let reward = BASE_REWARD;
    const details = [`기본 급여 +${BASE_REWARD}`];
    if (this.mode === 'performance') {
      const bonus = this.selectedQuality * 150;
      reward += bonus;
      details.push(`성과 보너스 +${bonus}`);
    }
    if (this.mode === 'soft-timer') {
      const timeBonus = this.remainingSeconds() > 0 ? 300 : 0;
      const qualityBonus = (this.selectedQuality - 1) * 300;
      reward += timeBonus + qualityBonus;
      if (timeBonus) details.push(`시간 보너스 +${timeBonus}`);
      if (qualityBonus) details.push(`품질 보너스 +${qualityBonus}`);
      if (!timeBonus && !qualityBonus) details.push('보너스 없음 · 실패 없음');
    }
    this.coins += reward;
    this.totalEarned += reward;
    this.orders += 1;
    this.lastReward = [...details, `총 급여 +${reward}`];
    this.selectedQuality = 1;
    this.orderStartedAt = this.time.now;
    this.render();
  }

  private upgrade(upgrade: Upgrade) {
    if (this.coins < UPGRADE_COST || upgrade.level >= 3) return;
    this.coins -= UPGRADE_COST;
    upgrade.level += 1;
    this.render();
  }

  private render() {
    this.children.removeAll();
    this.add.rectangle(480, 310, 960, 620, C.bg);
    const [eyebrow, title] = this.modeInfo();
    this.text(36, 24, eyebrow, 12, C.accent, true);
    this.text(36, 46, title, 25, C.text, true);
    this.text(730, 25, '보유 급여', 12, C.muted);
    this.text(730, 47, `${this.coins.toLocaleString()} 코인`, 22, C.gold, true);
    this.text(36, 80, `완료 주문 ${this.orders}건  ·  누적 급여 ${this.totalEarned.toLocaleString()}`, 12, C.muted);
    this.add.line(480, 108, 36, 0, 924, 0, C.line);

    this.renderOrder();
    this.renderGrowth();
  }

  private renderOrder() {
    this.panel(282, 350, 492, 450);
    this.text(58, 142, 'CUSTOMER ORDER', 12, C.accent, true);
    this.text(58, 169, '에어로 로드 조립 주문', 22, C.text, true);
    this.text(58, 204, '프레임 · 휠셋 · 구동계 · 핸들바', 13, C.muted);

    if (this.mode !== 'fixed') {
      this.text(58, 236, this.mode === 'performance' ? '납품 성과 선택' : '품질 단계 선택', 13, C.muted, true);
      [1, 2, 3].forEach((quality, index) => {
        const x = 116 + index * 128;
        const active = this.selectedQuality === quality;
        const box = this.add.rectangle(x, 286, 112, 62, active ? C.panelActive : 0x0e2136)
          .setStrokeStyle(active ? 2 : 1, active ? 0x55d6be : C.line)
          .setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.selectedQuality = quality; this.render(); });
        this.text(x, 273, `품질 Lv.${quality}`, 13, active ? C.accent : C.text, true).setOrigin(.5);
        this.text(x, 296, quality === 1 ? '기본' : quality === 2 ? '우수' : '최상', 11, C.muted).setOrigin(.5);
        void box;
      });
    } else {
      this.text(58, 255, '주문 난이도와 관계없이 동일한 급여를 지급합니다.', 14, C.muted);
      this.panel(282, 302, 420, 70, true);
      this.text(82, 278, '예정 급여', 12, C.muted);
      this.text(82, 303, `+${BASE_REWARD} 코인`, 23, C.gold, true);
    }

    if (this.mode === 'soft-timer') {
      this.timerText = this.text(58, 331, `권장 시간  ${this.remainingSeconds().toFixed(1)}초`, 18, C.gold, true);
      this.text(58, 360, '시간 내 납품 +300  ·  품질 Lv.2/3 +300/+600', 12, C.muted);
      this.text(58, 382, '시간을 넘겨도 실패하지 않고 기본 급여를 받습니다.', 12, C.accent);
    } else if (this.mode === 'performance') {
      this.text(58, 337, `예상 보상  기본 ${BASE_REWARD} + 성과 ${this.selectedQuality * 150}`, 15, C.gold, true);
      this.text(58, 365, '높은 품질을 선택할수록 보너스가 증가합니다.', 12, C.muted);
    }

    this.button(282, 446, 420, '주문 납품하기', () => this.deliver());
    if (this.lastReward.length) {
      this.panel(282, 532, 420, 94, true);
      this.text(82, 496, 'LAST REWARD', 11, C.accent, true);
      this.text(82, 518, this.lastReward.join('  ·  '), 12, C.text, true).setWordWrapWidth(390);
    }
  }

  private renderGrowth() {
    this.panel(730, 330, 356, 410);
    this.text(574, 142, this.mode === 'fixed' ? '직선 성장 경로' : '성장 경로 선택', 17, C.text, true);
    this.text(574, 171, this.mode === 'fixed' ? '정해진 순서대로 해금합니다.' : '원하는 항목에 급여를 투자합니다.', 12, C.muted);

    this.upgrades.forEach((upgrade, index) => {
      const lockedByOrder = this.mode === 'fixed' && index > 0 && this.upgrades[index - 1].level < 1;
      const y = 245 + index * 104;
      this.panel(730, y, 312, 84, !lockedByOrder && upgrade.level > 0);
      this.text(590, y - 27, `${index + 1}. ${upgrade.name}`, 15, lockedByOrder ? C.muted : C.text, true);
      this.text(590, y - 3, upgrade.description, 11, C.muted);
      this.text(590, y + 21, `Lv.${upgrade.level} / 3`, 12, upgrade.level ? C.accent : C.muted, true);
      const enabled = !lockedByOrder && this.coins >= UPGRADE_COST && upgrade.level < 3;
      this.button(826, y + 15, 92, upgrade.level >= 3 ? 'MAX' : `${UPGRADE_COST}`, () => this.upgrade(upgrade), enabled);
    });

    const progress = this.upgrades.reduce((sum, item) => sum + item.level, 0);
    this.text(574, 520, `전체 성장 ${progress} / 9`, 13, C.text, true);
    this.add.rectangle(574, 552, 312, 10, 0x14273a).setOrigin(0, .5);
    this.add.rectangle(574, 552, 312 * progress / 9, 10, 0x55d6be).setOrigin(0, .5);
    this.text(574, 570, `다음 강화까지 ${Math.max(0, UPGRADE_COST - this.coins).toLocaleString()} 코인`, 11, C.muted);
  }
}

export function startRewardPrototype(parent: string, mode: RewardPrototypeMode) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 620,
    backgroundColor: '#07111f',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: new RewardScene(mode),
    render: { antialias: true },
  });
}
