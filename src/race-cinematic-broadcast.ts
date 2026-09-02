// 대회·레이스 보상 E안 (#231) — 시네마틱 스포츠 중계형
// 특정 게임의 캐릭터·UI를 복제하지 않고, 레이스 중계의 연출 문법
// (국면별 카메라, 라이벌 포커스, 막판 스퍼트 컷인, 사진 판정)을 warm-pixel 테마로 검증합니다.
import Phaser from 'phaser';
import { addPixelBikeImage, makeWarmColorway } from './bike-pixel-sprite';
import type { BikeStats } from './meta-progress';
import { dreamGradeName } from './meta-progress';
import {
  RIVERSIDE_ENDURANCE_RACE,
  applyRaceEntry,
  applyRaceReward,
  formatRaceTime,
  progressAt,
  raceRewardForRank,
  simulateRace,
  type RaceResult,
  type RacerResult,
} from './race-progress';
import type { RaceSceneHooks } from './race-scene-prototype';

const FONT = '"Arial Rounded MT Bold", "Noto Sans KR", sans-serif';
const INK = '#3b2531';
const CREAM_TEXT = '#fff1c6';
const MUTED = '#7b5140';
const BORDER = 0x3b2531;
const CREAM = 0xfff1c6;
const GOLD = 0xf4b84a;
const PALE_GOLD = 0xf6d995;
const RED = 0xc95746;
const GREEN = 0x5e9a67;
const TEAL = 0x4e8092;
const SKY = 0x86c9c8;
const WOOD = 0xa9683f;
const DARK_WOOD = 0x573044;

// C·D안과 같은 3,000m 코스·참가비·보상을 사용해 연출만 비교합니다.
const CINEMATIC_RACE = RIVERSIDE_ENDURANCE_RACE;

const STAT_PRESETS: Array<{ label: string; stats: BikeStats }> = [
  { label: '갓 완성', stats: { 성능: 1, 스타일: 1, 희귀도: 1 } },
  { label: '성장 중', stats: { 성능: 3, 스타일: 2, 희귀도: 2 } },
  { label: '드림 완성', stats: { 성능: 4, 스타일: 4, 희귀도: 4 } },
];

type BroadcastShot = 'opening' | 'pack' | 'rival' | 'final';
type ScenePhase = 'entry' | 'countdown' | 'racing' | 'finish-hold' | 'result';

type RacerVisual = {
  racer: RacerResult;
  container: Phaser.GameObjects.Container;
  name: Phaser.GameObjects.Text;
  progress: number;
  targetX: number;
  targetY: number;
};

class CinematicRaceScene extends Phaser.Scene {
  constructor(private readonly hooks: RaceSceneHooks = {}) {
    super('race-cinematic-broadcast');
  }

  private phase: ScenePhase = 'entry';
  private coins = 0;
  private runSeed = 0;
  private presetIndex = 1;
  private result?: RaceResult;
  private playMs = 0;
  private speedMult = 1;
  private shot: BroadcastShot = 'opening';
  private lastShot: BroadcastShot = 'opening';
  private sprintCutInPlayed = false;
  private finishTriggered = false;
  private presentationPauseMs = 0;
  private visuals: RacerVisual[] = [];

  private hillFar?: Phaser.GameObjects.Container;
  private hillNear?: Phaser.GameObjects.Container;
  private roadDashes?: Phaser.GameObjects.Container;
  private speedLines?: Phaser.GameObjects.Graphics;
  private rankRows: Array<{ panel: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }> = [];
  private progressFill?: Phaser.GameObjects.Rectangle;
  private rankText?: Phaser.GameObjects.Text;
  private distanceText?: Phaser.GameObjects.Text;
  private clockText?: Phaser.GameObjects.Text;
  private shotBadge?: Phaser.GameObjects.Text;
  private announcer?: Phaser.GameObjects.Text;
  private rivalText?: Phaser.GameObjects.Text;
  private speedButtonText?: Phaser.GameObjects.Text;

  create() {
    this.coins = this.coins || (this.hooks.initialCoins ?? 2480);
    this.runSeed = this.runSeed || (this.hooks.seed ?? 20260903);
    this.phase = 'entry';
    this.playMs = 0;
    this.speedMult = 1;
    this.shot = 'opening';
    this.lastShot = 'opening';
    this.sprintCutInPlayed = false;
    this.finishTriggered = false;
    this.presentationPauseMs = 0;
    this.visuals = [];
    this.rankRows = [];
    this.cameras.main.setBackgroundColor('#a9683f');
    this.buildEntry();
  }

  private playerStats(): BikeStats {
    return this.hooks.stats ?? STAT_PRESETS[this.presetIndex].stats;
  }

  private buildEntry() {
    this.drawWoodBackdrop();

    this.add.rectangle(195, 30, 358, 40, DARK_WOOD).setStrokeStyle(3, BORDER);
    this.add.text(32, 20, 'E안', this.style(12, CREAM_TEXT, true));
    this.add.text(195, 29, '시네마틱 스포츠 중계형', this.style(15, CREAM_TEXT, true)).setOrigin(0.5);
    this.add.text(195, 58, `${CINEMATIC_RACE.name} · ${CINEMATIC_RACE.distanceMeters.toLocaleString()}m`, this.style(11, CREAM_TEXT, true)).setOrigin(0.5);

    this.add.rectangle(195, 151, 358, 154, CREAM).setStrokeStyle(4, BORDER);
    this.add.text(30, 88, 'TODAY\'S BROADCAST', this.style(9, MUTED, true));
    const beats = [
      { x: 76, number: '01', title: '국면 중계', note: '무리→추적' },
      { x: 195, number: '02', title: '라이벌 포커스', note: '접전 강조' },
      { x: 314, number: '03', title: '막판 스퍼트', note: '컷인·판정' },
    ];
    beats.forEach((beat, index) => {
      this.add.rectangle(beat.x, 151, 106, 90, index === 2 ? PALE_GOLD : 0xffe6a8).setStrokeStyle(2, index === 2 ? RED : 0x8e5136);
      this.add.rectangle(beat.x - 36, 121, 24, 18, index === 2 ? RED : TEAL).setStrokeStyle(2, BORDER);
      this.add.text(beat.x - 36, 121, beat.number, this.style(8, CREAM_TEXT, true)).setOrigin(0.5);
      this.add.text(beat.x, 147, beat.title, this.style(10, INK, true)).setOrigin(0.5);
      this.add.text(beat.x, 169, beat.note, this.style(8, MUTED)).setOrigin(0.5);
    });

    this.add.rectangle(195, 310, 358, 138, 0xd79a63).setStrokeStyle(4, 0x8e5136);
    this.add.text(30, 252, '출전 자전거', this.style(10, MUTED, true));
    addPixelBikeImage(this, 106, 323, 2.2, { category: 'road', colorway: makeWarmColorway(RED) });
    const statText = this.add.text(204, 282, '', this.style(11, INK, true));
    const gradeText = this.add.text(204, 303, '', this.style(9, MUTED));
    const buttons: Phaser.GameObjects.Rectangle[] = [];
    const refresh = () => {
      const stats = this.playerStats();
      statText.setText(`드림 로드 · 성능 Lv.${stats.성능}`);
      gradeText.setText(`등급 ${dreamGradeName(stats)} · 스타일 ${stats.스타일} · 희귀도 ${stats.희귀도}`);
      buttons.forEach((button, index) => button.setFillStyle(index === this.presetIndex ? GOLD : CREAM));
    };
    STAT_PRESETS.forEach((preset, index) => {
      const x = 212 + index * 54;
      const button = this.add.rectangle(x, 340, 50, 28, CREAM).setStrokeStyle(2, BORDER).setInteractive({ useHandCursor: true });
      this.add.text(x, 340, preset.label, this.style(8, INK, true)).setOrigin(0.5);
      button.on('pointerdown', () => {
        if (this.hooks.stats) return;
        this.presetIndex = index;
        refresh();
      });
      buttons.push(button);
    });
    refresh();

    this.add.rectangle(195, 466, 358, 142, CREAM).setStrokeStyle(4, BORDER);
    this.add.text(30, 406, '중계 안내', this.style(10, MUTED, true));
    this.add.text(30, 432, '레이스 결과는 먼저 확정되고, 중계 화면은 같은 결과를 연출만 합니다.', this.style(9, INK)).setWordWrapWidth(330);
    this.add.rectangle(76, 490, 94, 34, PALE_GOLD).setStrokeStyle(2, 0x8e5136);
    this.add.text(76, 490, `참가비 ${CINEMATIC_RACE.entryFee}`, this.style(9, INK, true)).setOrigin(0.5);
    this.add.rectangle(195, 490, 120, 34, 0xffe6a8).setStrokeStyle(2, 0x8e5136);
    this.add.text(195, 490, `1위 ${CINEMATIC_RACE.rankRewards[0]}`, this.style(9, INK, true)).setOrigin(0.5);
    this.add.rectangle(314, 490, 94, 34, 0xffe6a8).setStrokeStyle(2, 0x8e5136);
    this.add.text(314, 490, `보유 ${this.coins}`, this.style(9, INK, true)).setOrigin(0.5);

    const entryButton = this.add.rectangle(195, 580, 310, 50, GREEN).setStrokeStyle(4, BORDER).setInteractive({ useHandCursor: true });
    this.add.text(195, 580, '그랑프리 중계 시작', this.style(15, CREAM_TEXT, true)).setOrigin(0.5);
    const message = this.add.text(195, 620, '카메라 조작 없이 자동 중계를 관람합니다.', this.style(10, CREAM_TEXT, true)).setOrigin(0.5);

    this.add.rectangle(195, 696, 358, 92, DARK_WOOD).setStrokeStyle(3, BORDER);
    this.add.text(30, 660, '연출 참고 범위', this.style(9, PALE_GOLD, true));
    this.add.text(30, 680, '스포츠 중계의 카메라 전환·경쟁자 강조·막판 컷인 문법만 참고하고,\n캐릭터·화면 자산은 Dream Bike Garage 픽셀 테마로 구성했습니다.', this.style(9, CREAM_TEXT)).setLineSpacing(5);

    entryButton.on('pointerdown', () => {
      const entry = applyRaceEntry(this.coins, CINEMATIC_RACE);
      if (!entry.ok) {
        message.setText(`코인이 부족합니다. 보유 ${entry.coins} / 필요 ${entry.entryFee}`);
        return;
      }
      this.coins = entry.coins;
      this.result = simulateRace({
        seed: this.runSeed,
        playerStats: this.playerStats(),
        playerCategory: 'road',
        playerFrameColor: RED,
        meta: CINEMATIC_RACE,
      });
      this.startRace();
    });
  }

  private startRace() {
    this.phase = 'countdown';
    this.children.removeAll(true);
    this.buildBroadcastWorld();
    this.buildBroadcastHud();

    const lineup = this.add.container(195, 254).setDepth(40);
    lineup.add(this.add.rectangle(0, 0, 330, 94, DARK_WOOD, 0.96).setStrokeStyle(4, PALE_GOLD));
    lineup.add(this.add.text(0, -22, 'RIVERSIDE 3K CHALLENGE', this.style(13, CREAM_TEXT, true)).setOrigin(0.5));
    lineup.add(this.add.text(0, 9, '8 RIDERS · 3,000m · READY', this.style(10, '#f6d995', true)).setOrigin(0.5));
    lineup.add(this.add.text(0, 30, '오늘부터 자전거 부자 특별 중계', this.style(9, CREAM_TEXT)).setOrigin(0.5));
    this.tweens.add({ targets: lineup, alpha: { from: 0, to: 1 }, y: { from: 270, to: 254 }, duration: 320 });

    ['3', '2', '1', 'START!'].forEach((value, index) => {
      this.time.delayedCall(620 * index, () => {
        if (index === 0) lineup.destroy(true);
        const text = this.add.text(195, 255, value, this.style(value === 'START!' ? 34 : 48, CREAM_TEXT, true))
          .setOrigin(0.5).setDepth(41).setStroke(INK, 8);
        this.tweens.add({ targets: text, scale: { from: 0.55, to: 1.18 }, alpha: { from: 1, to: 0 }, duration: 560, onComplete: () => text.destroy() });
        if (value === 'START!') {
          this.phase = 'racing';
          this.playMs = 0;
          this.setAnnouncer('출발했습니다! 여덟 대의 자전거가 첫 코너로 향합니다.');
        }
      });
    });
  }

  private buildBroadcastWorld() {
    this.add.rectangle(195, 220, 390, 440, SKY);
    this.add.rectangle(88, 92, 56, 12, CREAM, 0.75);
    this.add.rectangle(292, 128, 72, 12, CREAM, 0.75);

    this.hillFar = this.add.container(0, 0);
    this.hillNear = this.add.container(0, 0);
    for (let index = 0; index < 8; index += 1) {
      this.hillFar.add(this.add.triangle(index * 160 - 70, 328, 0, 86, 80, 0, 160, 86, 0x86ba6f).setOrigin(0, 1));
      this.hillNear.add(this.add.triangle(index * 150 - 40, 342, 0, 62, 75, 0, 150, 62, GREEN).setOrigin(0, 1));
    }
    this.hillFar.setDepth(1);
    this.hillNear.setDepth(2);

    this.add.rectangle(195, 355, 390, 96, 0xb66f45).setDepth(3);
    this.add.rectangle(195, 311, 390, 5, 0x8a5231).setDepth(4);
    this.add.rectangle(195, 401, 390, 5, 0x8a5231).setDepth(4);
    this.roadDashes = this.add.container(0, 0).setDepth(4);
    for (let index = 0; index < 10; index += 1) this.roadDashes.add(this.add.rectangle(index * 52, 382, 24, 4, CREAM, 0.65));
    this.speedLines = this.add.graphics().setDepth(8);

    this.result!.racers.forEach((racer, index) => {
      const container = this.add.container(-100, 348 + (index % 4) * 8).setDepth(racer.isPlayer ? 7 : 6);
      const bike = addPixelBikeImage(this, 0, 0, 1.55, { category: racer.category, colorway: makeWarmColorway(racer.frameColor) });
      container.add(bike);
      this.addTinyRider(container, racer.isPlayer ? RED : racer.frameColor);
      const name = this.add.text(0, -55, racer.isPlayer ? '나 · 드림 로드' : racer.name, this.style(7, racer.isPlayer ? CREAM_TEXT : INK, true))
        .setOrigin(0.5).setStroke(racer.isPlayer ? INK : CREAM_TEXT, 3);
      container.add(name);
      if (racer.isPlayer) {
        const tag = this.add.rectangle(0, -73, 34, 16, RED).setStrokeStyle(2, BORDER);
        const tagText = this.add.text(0, -73, 'PLAYER', this.style(6, CREAM_TEXT, true)).setOrigin(0.5);
        container.add([tag, tagText]);
      }
      this.visuals.push({ racer, container, name, progress: 0, targetX: -100, targetY: container.y });
      this.tweens.add({ targets: container, y: '-=2', duration: 210 + index * 18, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });

    this.add.rectangle(195, 610, 390, 400, WOOD).setDepth(9);
    for (let y = 430; y < 810; y += 26) this.add.rectangle(195, y, 390, 2, 0x8a5231, 0.5).setDepth(9);
  }

  private addTinyRider(container: Phaser.GameObjects.Container, jersey: number) {
    const rearLeg = this.add.rectangle(-6, -18, 5, 18, 0x53341f).setAngle(-34);
    const body = this.add.rectangle(-2, -35, 13, 20, jersey).setStrokeStyle(2, BORDER).setAngle(25);
    const head = this.add.rectangle(5, -51, 12, 12, 0xeeb07c).setStrokeStyle(2, BORDER);
    const helmet = this.add.rectangle(4, -58, 16, 6, jersey).setStrokeStyle(2, BORDER);
    const arm = this.add.rectangle(11, -31, 4, 22, 0xeeb07c).setAngle(-50);
    const frontLeg = this.add.rectangle(5, -17, 5, 19, 0x6b4534).setAngle(38);
    container.add([rearLeg, body, head, helmet, arm, frontLeg]);
  }

  private buildBroadcastHud() {
    this.add.rectangle(195, 47, 390, 94, DARK_WOOD, 0.94).setDepth(20);
    this.add.rectangle(44, 17, 66, 22, RED).setStrokeStyle(2, BORDER).setDepth(21);
    this.add.text(44, 17, `DAY ${this.hooks.dayNumber ?? 5}`, this.style(9, CREAM_TEXT, true)).setOrigin(0.5).setDepth(22);
    this.add.rectangle(183, 17, 192, 22, GOLD).setStrokeStyle(2, BORDER).setDepth(21);
    this.add.text(183, 17, CINEMATIC_RACE.name, this.style(10, INK, true)).setOrigin(0.5).setDepth(22);
    this.rankText = this.add.text(365, 10, '-위', this.style(13, CREAM_TEXT, true)).setOrigin(1, 0).setDepth(22);
    this.add.rectangle(10, 43, 370, 8, BORDER).setOrigin(0, 0.5).setDepth(21);
    this.progressFill = this.add.rectangle(10, 43, 0, 6, GREEN).setOrigin(0, 0.5).setDepth(22);
    this.distanceText = this.add.text(12, 54, '0 / 3,000m', this.style(9, CREAM_TEXT, true)).setDepth(22);
    this.clockText = this.add.text(378, 54, '00:00.0', this.style(9, CREAM_TEXT, true)).setOrigin(1, 0).setDepth(22);

    this.shotBadge = this.add.text(14, 102, 'OPENING SHOT', this.style(8, CREAM_TEXT, true)).setPadding(8, 4, 8, 4)
      .setBackgroundColor('#c95746').setDepth(22);

    this.add.rectangle(95, 542, 164, 210, DARK_WOOD, 0.96).setStrokeStyle(3, BORDER).setDepth(20);
    this.add.text(24, 447, 'LIVE RANKING', this.style(9, PALE_GOLD, true)).setDepth(21);
    for (let index = 0; index < 8; index += 1) {
      const y = 474 + index * 22;
      const panel = this.add.rectangle(95, y, 150, 19, index === 0 ? 0x6a4a3a : 0x5f4234).setDepth(21);
      const label = this.add.text(24, y, `${index + 1}  ---`, this.style(8, CREAM_TEXT, index < 3)).setOrigin(0, 0.5).setDepth(22);
      this.rankRows.push({ panel, label });
    }

    this.add.rectangle(282, 520, 192, 166, CREAM).setStrokeStyle(3, BORDER).setDepth(20);
    this.add.text(202, 447, 'RACE DESK', this.style(9, MUTED, true)).setDepth(21);
    this.rivalText = this.add.text(200, 474, '주목 선수\n선두 그룹 탐색 중', this.style(10, INK, true)).setLineSpacing(5).setDepth(22);
    this.add.rectangle(282, 560, 166, 2, 0x8e5136, 0.45).setDepth(21);
    this.announcer = this.add.text(200, 575, '출발 준비 중입니다.', this.style(9, MUTED)).setWordWrapWidth(165).setLineSpacing(4).setDepth(22);

    const speedButton = this.add.rectangle(282, 646, 166, 38, GREEN).setStrokeStyle(3, BORDER).setInteractive({ useHandCursor: true }).setDepth(21);
    this.speedButtonText = this.add.text(282, 646, '중계 속도 x1', this.style(11, CREAM_TEXT, true)).setOrigin(0.5).setDepth(22);
    speedButton.on('pointerdown', () => {
      this.speedMult = this.speedMult === 1 ? 2 : 1;
      this.speedButtonText?.setText(`중계 속도 x${this.speedMult}`);
    });

    this.add.rectangle(195, 723, 358, 72, DARK_WOOD).setStrokeStyle(3, BORDER).setDepth(20);
    this.add.text(30, 696, 'BROADCAST NOTE', this.style(8, PALE_GOLD, true)).setDepth(21);
    this.add.text(30, 716, '국면에 따라 카메라가 자동 전환됩니다.\n순위 결과·보상 수치는 A~D안과 동일한 시뮬레이션 규칙을 사용합니다.', this.style(8, CREAM_TEXT)).setLineSpacing(4).setDepth(22);
  }

  update(_: number, delta: number) {
    if (this.phase !== 'racing' || !this.result) return;
    if (this.presentationPauseMs > 0) {
      this.presentationPauseMs = Math.max(0, this.presentationPauseMs - delta);
      return;
    }

    this.playMs += delta * this.speedMult;
    const tickFloat = this.playMs / this.result.tickMs;
    this.visuals.forEach((visual) => {
      visual.progress = progressAt(visual.racer.timeline, tickFloat);
    });
    const player = this.visuals.find((visual) => visual.racer.isPlayer)!;
    const ordered = [...this.visuals].sort((a, b) => b.progress - a.progress || a.racer.finishTimeMs - b.racer.finishTimeMs);
    const playerRank = ordered.findIndex((visual) => visual.racer.isPlayer) + 1;

    this.shot = this.shotFor(player.progress);
    if (this.shot !== this.lastShot) {
      this.onShotChanged(this.shot, player, ordered);
      this.lastShot = this.shot;
    }
    if (player.progress >= 0.82 && !this.sprintCutInPlayed) this.playSprintCutIn();

    this.positionRacers(player, ordered);
    this.updateWorldScroll(player.progress, delta);
    this.updateHud(player, ordered, playerRank);

    if (player.progress >= 1 && !this.finishTriggered) this.triggerPhotoFinish();
  }

  private shotFor(progress: number): BroadcastShot {
    if (progress < 0.12) return 'opening';
    if (progress < 0.58) return 'pack';
    if (progress < 0.82) return 'rival';
    return 'final';
  }

  private onShotChanged(shot: BroadcastShot, player: RacerVisual, ordered: RacerVisual[]) {
    const nearest = this.nearestRival(player, ordered);
    if (shot === 'pack') this.setAnnouncer('선두 그룹이 길게 늘어집니다. 내 자전거는 자리를 지킵니다.');
    if (shot === 'rival') this.setAnnouncer(`${nearest.racer.name}와 나란히! 오르막 뒤 승부처입니다.`);
    if (shot === 'final') this.setAnnouncer('마지막 600m! 남은 힘을 모두 쏟아붓습니다!');
    this.cameras.main.flash(120, 255, 241, 198, false);
  }

  private positionRacers(player: RacerVisual, ordered: RacerVisual[]) {
    const leaderProgress = ordered[0].progress;
    const focusProgress = this.shot === 'opening' || this.shot === 'pack' ? leaderProgress : player.progress;
    const spread = this.shot === 'opening' ? 470 : this.shot === 'pack' ? 620 : this.shot === 'rival' ? 930 : 1120;
    const focusX = this.shot === 'opening' ? 210 : this.shot === 'pack' ? 188 : 146;
    const nearest = this.nearestRival(player, ordered);

    ordered.forEach((visual, rankIndex) => {
      const packOffset = this.shot === 'opening' ? rankIndex * 22 : this.shot === 'pack' ? rankIndex * 12 : 0;
      const rawX = focusX + (visual.progress - focusProgress) * spread - packOffset;
      visual.targetX = Phaser.Math.Clamp(rawX, -96, 486);
      visual.targetY = 338 + (rankIndex % 4) * 12;
      const isFocus = visual.racer.isPlayer || (this.shot === 'rival' && visual === nearest) || this.shot === 'opening' || this.shot === 'pack';
      const scale = this.shot === 'opening' ? 0.7 : this.shot === 'pack' ? 0.78 : isFocus ? (this.shot === 'final' ? 1.08 : 0.94) : 0.62;
      const alpha = isFocus ? 1 : 0.42;
      visual.container.x = Phaser.Math.Linear(visual.container.x, visual.targetX, 0.14);
      visual.container.y = Phaser.Math.Linear(visual.container.y, visual.targetY, 0.14);
      visual.container.setScale(Phaser.Math.Linear(visual.container.scaleX, scale, 0.12));
      visual.container.setAlpha(Phaser.Math.Linear(visual.container.alpha, alpha, 0.12));
      visual.container.setDepth(visual.racer.isPlayer ? 7 : 6 - rankIndex * 0.01);
      visual.name.setVisible(scale >= 0.75);
    });
  }

  private updateWorldScroll(progress: number, delta: number) {
    const pace = (this.shot === 'final' ? 0.36 : 0.2) * delta * this.speedMult;
    if (this.hillFar) this.hillFar.x = -((progress * 500) % 160);
    if (this.hillNear) this.hillNear.x = -((progress * 860) % 150);
    if (this.roadDashes) this.roadDashes.x = (this.roadDashes.x - pace) % 52;
    this.speedLines?.clear();
    if (this.shot === 'final') {
      this.speedLines?.lineStyle(2, CREAM, 0.45);
      for (let index = 0; index < 12; index += 1) {
        const y = 165 + index * 18;
        const length = 28 + (index % 4) * 17;
        this.speedLines?.lineBetween(390 - ((this.playMs * 0.32 + index * 47) % 430), y, 390 - ((this.playMs * 0.32 + index * 47) % 430) + length, y);
      }
    }
  }

  private updateHud(player: RacerVisual, ordered: RacerVisual[], playerRank: number) {
    const distance = Math.min(CINEMATIC_RACE.distanceMeters, Math.round(player.progress * CINEMATIC_RACE.distanceMeters));
    this.progressFill?.setDisplaySize(Math.max(1, player.progress * 370), 6);
    this.rankText?.setText(`${playerRank}위`);
    this.distanceText?.setText(`${distance.toLocaleString()} / ${CINEMATIC_RACE.distanceMeters.toLocaleString()}m`);
    this.clockText?.setText(formatRaceTime(this.playMs));
    const labels: Record<BroadcastShot, string> = {
      opening: 'OPENING · 전체 무리',
      pack: 'PACK CAM · 선두 그룹',
      rival: 'RIVAL FOCUS · 접전',
      final: 'FINAL 600m · 스퍼트',
    };
    this.shotBadge?.setText(labels[this.shot]);
    this.shotBadge?.setBackgroundColor(this.shot === 'final' ? '#c95746' : this.shot === 'rival' ? '#8e5136' : '#4e8092');

    ordered.forEach((visual, index) => {
      const row = this.rankRows[index];
      if (!row) return;
      row.label.setText(`${index + 1}  ${visual.racer.isPlayer ? '나 · 드림 로드' : visual.racer.name}`);
      row.label.setColor(visual.racer.isPlayer ? '#f6d995' : CREAM_TEXT);
      row.panel.setFillStyle(visual.racer.isPlayer ? 0x8e5136 : index === 0 ? 0x6a4a3a : 0x5f4234);
    });

    const rival = this.nearestRival(player, ordered);
    const gapMeters = Math.abs(rival.progress - player.progress) * CINEMATIC_RACE.distanceMeters;
    const relation = rival.progress >= player.progress ? '앞' : '뒤';
    this.rivalText?.setText(`주목 선수\n${rival.racer.name}\n${relation} ${gapMeters.toFixed(0)}m 접전`);
  }

  private nearestRival(player: RacerVisual, ordered: RacerVisual[]): RacerVisual {
    return ordered
      .filter((visual) => !visual.racer.isPlayer)
      .sort((a, b) => Math.abs(a.progress - player.progress) - Math.abs(b.progress - player.progress))[0];
  }

  private playSprintCutIn() {
    this.sprintCutInPlayed = true;
    this.presentationPauseMs = 760;
    const overlay = this.add.container(195, 264).setDepth(50);
    const slash = this.add.rectangle(0, 0, 470, 126, PALE_GOLD, 0.97).setStrokeStyle(5, BORDER).setAngle(-4);
    const accent = this.add.rectangle(-142, 0, 54, 126, RED).setAngle(-4);
    const bike = addPixelBikeImage(this, -95, 20, 1.7, { category: 'road', colorway: makeWarmColorway(RED) });
    const title = this.add.text(48, -26, '라스트 스퍼트!', this.style(24, INK, true)).setOrigin(0.5);
    const note = this.add.text(48, 15, 'FINAL 600m · 드림 로드 전력 질주', this.style(10, MUTED, true)).setOrigin(0.5);
    overlay.add([slash, accent, bike, title, note]);
    overlay.setX(520);
    this.tweens.add({
      targets: overlay,
      x: 195,
      duration: 170,
      ease: 'Back.easeOut',
      hold: 390,
      yoyo: true,
      onComplete: () => overlay.destroy(true),
    });
    this.cameras.main.shake(260, 0.008);
  }

  private triggerPhotoFinish() {
    this.finishTriggered = true;
    this.phase = 'finish-hold';
    this.cameras.main.flash(260, 255, 255, 255, false);
    this.cameras.main.shake(180, 0.006);
    const shutter = this.add.rectangle(195, 260, 390, 112, CREAM, 0.94).setStrokeStyle(5, BORDER).setDepth(51);
    const finish = this.add.text(195, 242, 'PHOTO FINISH', this.style(28, INK, true)).setOrigin(0.5).setDepth(52);
    const rank = this.add.text(195, 286, `드림 로드 ${this.result!.playerRank}위`, this.style(16, '#c95746', true)).setOrigin(0.5).setDepth(52);
    this.time.delayedCall(900, () => {
      shutter.destroy();
      finish.destroy();
      rank.destroy();
      this.showResult();
    });
  }

  private showResult() {
    this.phase = 'result';
    this.children.removeAll(true);
    this.drawWoodBackdrop();
    const player = this.result!.racers.find((racer) => racer.isPlayer)!;
    const ordered = [...this.result!.racers].sort((a, b) => a.rank - b.rank);
    const reward = raceRewardForRank(player.rank, CINEMATIC_RACE);

    this.add.rectangle(195, 54, 358, 76, DARK_WOOD).setStrokeStyle(4, PALE_GOLD);
    this.add.text(195, 37, 'RACE RESULT', this.style(11, PALE_GOLD, true)).setOrigin(0.5);
    this.add.text(195, 65, `${player.rank}위 · ${formatRaceTime(player.finishTimeMs)}`, this.style(24, CREAM_TEXT, true)).setOrigin(0.5);

    this.add.rectangle(195, 228, 358, 244, CREAM).setStrokeStyle(4, BORDER);
    this.add.text(30, 120, '결승 리플레이 보드', this.style(10, MUTED, true));
    ordered.slice(0, 3).forEach((racer, index) => {
      const y = 162 + index * 62;
      const colors = [GOLD, PALE_GOLD, 0xd79a63];
      this.add.rectangle(195, y, 326, 50, colors[index]).setStrokeStyle(3, BORDER);
      this.add.text(48, y, `${index + 1}`, this.style(18, INK, true)).setOrigin(0.5);
      this.add.text(76, y - 10, racer.isPlayer ? '나 · 드림 로드' : racer.name, this.style(11, INK, true));
      this.add.text(76, y + 9, formatRaceTime(racer.finishTimeMs), this.style(9, MUTED));
      addPixelBikeImage(this, 320, y + 12, 0.75, { category: racer.category, colorway: makeWarmColorway(racer.frameColor) });
    });

    this.add.rectangle(195, 434, 358, 132, 0xd79a63).setStrokeStyle(4, 0x8e5136);
    this.add.text(30, 382, 'GARAGE REWARD', this.style(10, MUTED, true));
    this.add.text(42, 416, `${player.rank <= 3 ? `${player.rank}위 상금` : '완주 수당'}`, this.style(12, INK, true));
    this.add.text(348, 406, `+${reward}`, this.style(28, INK, true)).setOrigin(1, 0);
    this.add.text(348, 450, `코인 ${this.coins.toLocaleString()} → ${(this.coins + reward).toLocaleString()}`, this.style(10, MUTED, true)).setOrigin(1, 0);

    this.add.rectangle(195, 558, 358, 76, DARK_WOOD).setStrokeStyle(3, BORDER);
    this.add.text(30, 532, '중계 요약', this.style(9, PALE_GOLD, true));
    this.add.text(30, 552, '전체 무리 → 라이벌 접전 → 마지막 600m 컷인 → 사진 판정', this.style(9, CREAM_TEXT, true));
    this.add.text(30, 573, '성장 결과는 그대로 두고, 관람의 감정 곡선을 강화하는 E안입니다.', this.style(8, CREAM_TEXT));

    const settleButton = this.add.rectangle(195, 650, 310, 48, GREEN).setStrokeStyle(4, BORDER).setInteractive({ useHandCursor: true });
    this.add.text(195, 650, `보상 ${reward}코인 받기`, this.style(14, CREAM_TEXT, true)).setOrigin(0.5);
    const message = this.add.text(195, 690, '보상을 받은 뒤 성장 프리셋을 바꿔 다시 비교할 수 있습니다.', this.style(9, CREAM_TEXT)).setOrigin(0.5);
    settleButton.on('pointerdown', () => {
      if (!settleButton.input?.enabled) return;
      settleButton.disableInteractive().setFillStyle(0x8b7d6b);
      const settlement = applyRaceReward(this.coins, player.rank, CINEMATIC_RACE);
      this.coins = settlement.coins;
      this.hooks.onSettled?.({ rank: player.rank, reward: settlement.reward, coins: settlement.coins });
      message.setText(`정산 완료 · 보유 ${this.coins.toLocaleString()}코인`);
      const retry = this.add.rectangle(195, 748, 260, 42, GOLD).setStrokeStyle(3, BORDER).setInteractive({ useHandCursor: true });
      this.add.text(195, 748, '다른 성장 단계로 한 번 더', this.style(11, INK, true)).setOrigin(0.5);
      retry.on('pointerdown', () => {
        this.runSeed += 101;
        this.scene.restart();
      });
    });
  }

  private setAnnouncer(text: string) {
    this.announcer?.setText(text);
  }

  private drawWoodBackdrop() {
    this.add.rectangle(195, 405, 390, 810, WOOD);
    for (let y = 0; y < 810; y += 26) this.add.rectangle(195, y, 390, 2, 0x8a5231, 0.5);
    for (let x = 30; x < 390; x += 86) this.add.circle(x, 14 + (x % 5) * 31, 3, 0x8a5231, 0.4);
  }

  private style(size: number, color: string | number, bold = false): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: FONT,
      fontSize: `${size}px`,
      color: typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : color,
      fontStyle: bold ? 'bold' : 'normal',
    };
  }
}

export function startRaceCinematicBroadcast(parent: string, hooks: RaceSceneHooks = {}) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    width: 390,
    height: 810,
    parent,
    backgroundColor: '#a9683f',
    pixelArt: true,
    roundPixels: true,
    scene: new CinematicRaceScene(hooks),
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  });
}
