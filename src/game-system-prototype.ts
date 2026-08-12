import Phaser from 'phaser';

export type GameSystemPrototypeMode =
  | 'level-linear' | 'level-chapter' | 'level-career'
  | 'career-auto' | 'career-mission' | 'career-collection'
  | 'economy-fixed' | 'economy-performance' | 'economy-choice'
  | 'feedback-casual' | 'feedback-mechanical' | 'feedback-reward';

const COLORS = {
  bg: 0x07111f, panel: 0x0b1828, active: 0x123044, line: 0x294158,
  text: '#eaf2f8', muted: '#8196aa', accent: '#55d6be', gold: '#ffdf6b', blue: '#8ea6ff',
};

const LEVELS = [
  ['부품 생성과 머지', '프레임 Lv.1~2'], ['휠셋 수급', '휠셋'], ['주문 목표 읽기', '주문 진행률'],
  ['조립과 납품', '급여'], ['우선순위 판단', '구동계'], ['전체 루프 완주', '핸들바·경험치'],
  ['상위 부품 제작', 'Lv.3 주문'], ['공간 관리', '막힘 구제'], ['성과 보상', '시간·품질 보너스'],
  ['견습기 마무리', '첫 승진·MTB 예고'],
];
const RANKS = ['견습 알바', '샵 스태프', '정비사', '수석 미케닉', '매니저', '샵 오너'];

type Metric = { orders: number; seconds: number; actions: number; earned: number; spent: number };

class GameSystemScene extends Phaser.Scene {
  private mode: GameSystemPrototypeMode;
  private level = 1;
  private xp = 0;
  private rank = 0;
  private coins = 1000;
  private collection = 0;
  private missionDone = false;
  private metric: Metric = { orders: 0, seconds: 0, actions: 0, earned: 0, spent: 0 };
  private startedAt = 0;

  constructor(mode: GameSystemPrototypeMode) { super('game-system'); this.mode = mode; }
  create() { this.startedAt = this.time.now; this.render(); }

  private text(x: number, y: number, value: string, size = 14, color = COLORS.text, bold = false) {
    return this.add.text(x, y, value, { fontFamily: 'Arial, sans-serif', fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal', lineSpacing: 6 });
  }
  private panel(x: number, y: number, width: number, height: number, active = false) {
    return this.add.rectangle(x, y, width, height, active ? COLORS.active : COLORS.panel).setStrokeStyle(active ? 2 : 1, active ? 0x55d6be : COLORS.line);
  }
  private button(x: number, y: number, width: number, label: string, action: () => void, enabled = true) {
    const box = this.add.rectangle(x, y, width, 42, enabled ? 0x15314a : 0x111d2b).setStrokeStyle(1, enabled ? 0x55d6be : 0x30475c);
    const caption = this.text(x, y, label, 13, enabled ? COLORS.accent : '#60778c', true).setOrigin(.5);
    if (enabled) [box, caption].forEach((item) => item.setInteractive({ useHandCursor: true }).on('pointerdown', action));
  }
  private info() {
    const map: Record<GameSystemPrototypeMode, [string, string, string]> = {
      'level-linear': ['LEVEL A · LINEAR', '플레이어 레벨 선형 해금', '레벨마다 다음 기능을 순서대로 공개합니다.'],
      'level-chapter': ['LEVEL B · CHAPTER', '주문 챕터 중심 해금', '3개의 주문을 한 챕터로 묶어 완주 시 다음 묶음을 엽니다.'],
      'level-career': ['LEVEL C · CAREER', '직급·Garage 결합 해금', '레벨과 직급을 함께 사용해 큰 기능을 구분합니다.'],
      'career-auto': ['CAREER A · AUTO', '레벨 자동 승진', '기준 레벨에 도달하면 별도 조건 없이 승진합니다.'],
      'career-mission': ['CAREER B · MISSION', '레벨 + 승진 과제', '레벨과 지정 주문을 모두 완료해야 승진합니다.'],
      'career-collection': ['CAREER C · COLLECTION', '레벨 + 성과 + 수집', '주문 성과와 자전거 수집까지 승진 조건에 포함합니다.'],
      'economy-fixed': ['ECONOMY A · FIXED', '고정 난이도·보상 곡선', '주문 순서에 따라 요구량과 보상이 예측 가능하게 증가합니다.'],
      'economy-performance': ['ECONOMY B · PERFORMANCE', '성과 기반 보너스 곡선', '행동 효율과 완료 시간에 따라 보너스가 달라집니다.'],
      'economy-choice': ['ECONOMY C · CHOICE', '주문 선택형 경제', '쉬운 주문과 어려운 고보상 주문 중 하나를 선택합니다.'],
      'feedback-casual': ['FEEDBACK A · CASUAL', '짧고 빠른 캐주얼 연출', '짧은 확대와 색상 피드백으로 템포를 유지합니다.'],
      'feedback-mechanical': ['FEEDBACK B · MECHANICAL', '기계적 조립감 강조', '흡착·체결·금속성 피드백을 시각적으로 모사합니다.'],
      'feedback-reward': ['FEEDBACK C · REWARD', '완성·보상 성취감 강조', '큰 공개와 보상 이동으로 중요한 순간을 강조합니다.'],
    };
    return map[this.mode];
  }
  private is(prefix: string) { return this.mode.startsWith(prefix); }

  private completeOrder(hard = false) {
    const elapsed = Math.max(8, Math.round((this.time.now - this.startedAt) / 1000));
    const actions = 8 + this.level * 2 + (hard ? 8 : 0);
    let reward = 400 + this.level * 40 + (hard ? 350 : 0);
    if (this.mode === 'economy-performance') reward += Math.max(0, 300 - elapsed * 8);
    const xpGain = hard ? 160 : 110;
    this.metric = { orders: this.metric.orders + 1, seconds: this.metric.seconds + elapsed, actions: this.metric.actions + actions, earned: this.metric.earned + reward, spent: this.metric.spent };
    this.coins += reward; this.xp += xpGain; this.missionDone = true;
    if (this.metric.orders % 2 === 0) this.collection += 1;
    if (this.xp >= this.level * 150 && this.level < 10) { this.xp -= this.level * 150; this.level += 1; }
    if (this.mode === 'career-auto' && this.level >= (this.rank + 1) * 2) this.rank = Math.min(this.rank + 1, RANKS.length - 1);
    this.startedAt = this.time.now; this.render();
  }
  private promote() {
    const levelOk = this.level >= Math.min(10, (this.rank + 1) * 2);
    const missionOk = this.mode === 'career-auto' || this.missionDone;
    const collectionOk = this.mode !== 'career-collection' || this.collection > this.rank;
    if (levelOk && missionOk && collectionOk) { this.rank = Math.min(this.rank + 1, RANKS.length - 1); this.missionDone = false; this.render(); }
  }

  private render() {
    this.children.removeAll();
    this.add.rectangle(480, 310, 960, 620, COLORS.bg);
    const [eyebrow, title, description] = this.info();
    this.text(34, 22, eyebrow, 11, COLORS.accent, true);
    this.text(34, 43, title, 24, COLORS.text, true);
    this.text(34, 76, description, 13, COLORS.muted);
    this.text(714, 25, `Lv.${this.level}  ·  ${RANKS[this.rank]}`, 14, COLORS.blue, true);
    this.text(714, 52, `${this.coins.toLocaleString()} 코인  ·  자전거 ${this.collection}대`, 13, COLORS.gold, true);
    this.add.line(480, 104, 34, 0, 926, 0, COLORS.line);
    if (this.is('level-')) this.renderLevel();
    if (this.is('career-')) this.renderCareer();
    if (this.is('economy-')) this.renderEconomy();
    if (this.is('feedback-')) this.renderFeedback();
  }

  private renderLevel() {
    this.panel(300, 350, 532, 450);
    this.text(54, 140, 'LV.1~10 CONTENT TABLE', 11, COLORS.accent, true);
    const visible = this.mode === 'level-chapter' ? Math.ceil(this.level / 3) * 3 : this.level + 2;
    LEVELS.forEach(([goal, unlock], index) => {
      const level = index + 1; const y = 178 + index * 34; const current = level === this.level; const locked = level > visible;
      this.add.rectangle(300, y, 490, 29, current ? 0x123044 : index % 2 ? 0x0d1c2d : 0x0a1726).setStrokeStyle(current ? 1 : 0, 0x55d6be);
      this.text(68, y - 8, `Lv.${level}`, 11, current ? COLORS.accent : COLORS.muted, true);
      this.text(124, y - 8, locked ? '잠김' : goal, 11, locked ? '#506579' : COLORS.text);
      this.text(344, y - 8, locked ? '—' : unlock, 11, locked ? '#506579' : COLORS.blue);
    });
    this.panel(738, 350, 326, 450, true);
    this.text(594, 142, 'CURRENT STEP', 11, COLORS.accent, true);
    this.text(594, 174, `Lv.${this.level} · ${LEVELS[this.level - 1][0]}`, 18, COLORS.text, true).setWordWrapWidth(280);
    this.text(594, 216, `해금: ${LEVELS[this.level - 1][1]}`, 13, COLORS.blue);
    if (this.mode === 'level-chapter') this.text(594, 252, `Chapter ${Math.ceil(this.level / 3)} · ${((this.level - 1) % 3) + 1}/3`, 14, COLORS.gold, true);
    if (this.mode === 'level-career') this.text(594, 252, `직급 게이트: ${RANKS[Math.min(5, Math.floor((this.level - 1) / 2))]}`, 13, COLORS.gold, true);
    this.text(594, 294, `경험치 ${this.xp} / ${this.level * 150}`, 12, COLORS.muted);
    this.add.rectangle(594, 322, 280, 10, 0x14273a).setOrigin(0, .5);
    this.add.rectangle(594, 322, 280 * Math.min(1, this.xp / (this.level * 150)), 10, 0x55d6be).setOrigin(0, .5);
    this.button(734, 382, 280, '현재 레벨 주문 완료', () => this.completeOrder());
    this.text(594, 422, '측정', 12, COLORS.accent, true);
    this.text(594, 448, `완료 주문 ${this.metric.orders}건\n누적 행동 ${this.metric.actions}회\n첫 10레벨 진행값 기록`, 13, COLORS.muted);
  }

  private renderCareer() {
    this.panel(314, 350, 560, 450);
    this.text(54, 140, 'CAREER LADDER', 11, COLORS.accent, true);
    RANKS.forEach((rank, index) => {
      const y = 190 + index * 61; const current = index === this.rank; const cleared = index < this.rank;
      this.panel(314, y, 500, 48, current);
      this.text(78, y - 9, cleared ? '✓' : current ? '●' : '○', 15, current ? COLORS.accent : COLORS.muted, true);
      this.text(112, y - 9, rank, 15, current ? COLORS.text : COLORS.muted, true);
      this.text(360, y - 8, index === 0 ? '기본 주문' : ['MTB·주문 선택', '그래블·고급 부품', '특수 주문', '복수 주문', '한정 자전거'][index - 1], 11, current ? COLORS.blue : COLORS.muted);
    });
    this.panel(748, 350, 306, 450, true);
    const needLevel = Math.min(10, (this.rank + 1) * 2);
    this.text(616, 142, 'PROMOTION CHECK', 11, COLORS.accent, true);
    this.text(616, 177, `${RANKS[this.rank]} → ${RANKS[Math.min(this.rank + 1, 5)]}`, 17, COLORS.text, true).setWordWrapWidth(260);
    this.text(616, 229, `${this.level >= needLevel ? '✓' : '○'} Lv.${needLevel} 달성`, 13, this.level >= needLevel ? COLORS.accent : COLORS.muted);
    if (this.mode !== 'career-auto') this.text(616, 261, `${this.missionDone ? '✓' : '○'} 승진 지정 주문`, 13, this.missionDone ? COLORS.accent : COLORS.muted);
    if (this.mode === 'career-collection') this.text(616, 293, `${this.collection > this.rank ? '✓' : '○'} 자전거 ${this.rank + 1}대 수집`, 13, this.collection > this.rank ? COLORS.accent : COLORS.muted);
    this.button(748, 354, 264, '주문 완료 (+XP)', () => this.completeOrder());
    this.button(748, 410, 264, '승진 판정', () => this.promote(), this.rank < RANKS.length - 1);
    this.text(616, 462, `현재 레벨 ${this.level}\n완료 주문 ${this.metric.orders}\n수집 자전거 ${this.collection}`, 13, COLORS.muted);
  }

  private renderEconomy() {
    this.panel(310, 350, 552, 450);
    this.text(54, 140, 'ORDER OPTIONS', 11, COLORS.accent, true);
    const options = this.mode === 'economy-choice' ? [['일반 로드', '8~12행동 · 440코인', false], ['긴급 MTB', '16~20행동 · 790코인', true]] as const : [['현재 주문', this.mode === 'economy-fixed' ? '예측 가능한 고정 보상' : '빠른 완료 시 최대 +300', false]] as const;
    options.forEach(([name, detail, hard], index) => {
      const y = 220 + index * 116; this.panel(310, y, 490, 92, index === 0);
      this.text(82, y - 25, name, 17, COLORS.text, true); this.text(82, y + 2, detail, 12, COLORS.muted);
      this.button(420, y + 17, 180, '이 주문 완료', () => this.completeOrder(hard));
    });
    this.text(66, 454, '난이도 축', 11, COLORS.accent, true);
    this.text(66, 480, `부품 ${Math.min(4, 1 + Math.floor(this.level / 3))}종 · 요구 Lv.${Math.min(3, 1 + Math.floor(this.level / 4))} · 일반 주문 완주 허용`, 12, COLORS.muted);
    this.panel(754, 350, 294, 450, true);
    this.text(626, 140, 'PLAY LOG', 11, COLORS.accent, true);
    const avg = this.metric.orders ? Math.round(this.metric.seconds / this.metric.orders) : 0;
    const perOrder = this.metric.orders ? Math.round(this.metric.earned / this.metric.orders) : 0;
    this.text(626, 178, `완료 주문\n${this.metric.orders}건`, 14, COLORS.text, true);
    this.text(754, 178, `평균 시간\n${avg}초`, 14, COLORS.text, true);
    this.text(626, 240, `누적 행동\n${this.metric.actions}회`, 14, COLORS.text, true);
    this.text(754, 240, `평균 수입\n${perOrder}코인`, 14, COLORS.gold, true);
    this.text(626, 318, `총 획득 ${this.metric.earned.toLocaleString()}\n총 소비 ${this.metric.spent.toLocaleString()}\n순 재화 ${(this.metric.earned - this.metric.spent).toLocaleString()}`, 13, COLORS.muted);
    this.button(754, 424, 244, 'Garage 확장 -1,500', () => { if (this.coins >= 1500) { this.coins -= 1500; this.metric.spent += 1500; this.render(); } }, this.coins >= 1500);
    this.text(626, 470, '주문 시간·행동·수입·소비를\n같은 형식으로 기록합니다.', 12, COLORS.accent);
  }

  private renderFeedback() {
    this.panel(310, 350, 552, 450);
    this.text(54, 140, 'EVENT TEST PAD', 11, COLORS.accent, true);
    const events = ['부품 선택', '머지 성공', '부품 장착', '자전거 완성', '주문 납품', '레벨업·승진'];
    events.forEach((label, index) => {
      const x = 172 + (index % 2) * 274; const y = 205 + Math.floor(index / 2) * 112;
      this.button(x, y, 232, label, () => this.playFeedback(x, y, label));
    });
    this.text(74, 508, '각 이벤트를 반복해서 눌러 인지성·길이·피로도를 비교합니다.', 12, COLORS.muted);
    this.panel(754, 350, 294, 450, true);
    this.text(626, 140, 'STYLE RULE', 11, COLORS.accent, true);
    const rules = this.mode === 'feedback-casual'
      ? ['120~220ms', '짧은 확대·색상', '입력 즉시 복귀', '반복 템포 우선']
      : this.mode === 'feedback-mechanical'
        ? ['240~420ms', '흡착·체결 선', '단계적 장착', '조립감 우선']
        : ['450~800ms', '큰 공개·보상 이동', '중요 이벤트만 사용', '성취감 우선'];
    rules.forEach((rule, index) => { this.panel(754, 190 + index * 65, 244, 47, index === 0); this.text(646, 182 + index * 65, rule, 13, index === 0 ? COLORS.accent : COLORS.text, true); });
    this.text(626, 466, '접근성 준비', 11, COLORS.accent, true);
    this.text(626, 491, '화면 흔들림 OFF\n사운드 OFF\n진동 OFF', 12, COLORS.muted);
  }
  private playFeedback(x: number, y: number, label: string) {
    const color = this.mode === 'feedback-mechanical' ? 0x8ea6ff : this.mode === 'feedback-reward' ? 0xffdf6b : 0x55d6be;
    const duration = this.mode === 'feedback-casual' ? 180 : this.mode === 'feedback-mechanical' ? 360 : 650;
    const ring = this.add.circle(x, y, 20, color, .25).setStrokeStyle(3, color);
    const message = this.text(754, 545, `${label} · ${duration}ms`, 13, Phaser.Display.Color.IntegerToColor(color).rgba, true).setOrigin(.5);
    this.tweens.add({ targets: ring, scale: this.mode === 'feedback-reward' ? 6 : 3.5, alpha: 0, duration, ease: 'Cubic.Out', onComplete: () => ring.destroy() });
    if (this.mode === 'feedback-mechanical') {
      const line = this.add.line(0, 0, x - 55, y, x + 55, y, color).setLineWidth(3);
      this.tweens.add({ targets: line, alpha: 0, duration, onComplete: () => line.destroy() });
    }
    this.time.delayedCall(duration + 250, () => message.destroy());
  }
}

export function startGameSystemPrototype(parent: string, mode: GameSystemPrototypeMode) {
  return new Phaser.Game({ type: Phaser.AUTO, parent, width: 960, height: 620, backgroundColor: '#07111f', scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: new GameSystemScene(mode), render: { antialias: true } });
}
