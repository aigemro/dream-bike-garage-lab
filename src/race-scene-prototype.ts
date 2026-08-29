// 대회·레이스 화면 프로토타입 (#231) — 390×810 모바일 세로, warm-pixel 디자인
// 급여로 참가비를 내고 보유 자전거로 출전하는 자동 관람형 대회.
// 결과는 race-progress.simulateRace가 선확정하고, 이 씬은 타임라인을 재생만 합니다.
// A안 side-follow: 카메라가 내 자전거를 따라가는 사이드뷰 트랙
// B안 lane-board: 트랙 전체를 8레인 전광판으로 중계하는 관람 뷰
import Phaser from 'phaser';
import { addPixelBikeImage, drawPixelBike, makeWarmColorway, type BikeCategory } from './bike-pixel-sprite';
import type { BikeStats } from './meta-progress';
import { dreamGradeName } from './meta-progress';
import {
  RACE_SEGMENTS,
  RIVERSIDE_RACE,
  applyRaceEntry,
  applyRaceReward,
  formatRaceTime,
  progressAt,
  raceRewardForRank,
  segmentAt,
  simulateRace,
  type RaceResult,
  type RacerResult,
} from './race-progress';

const FONT = '"Arial Rounded MT Bold", "Noto Sans KR", sans-serif';
const INK = '#3b2531';
const MUTED = '#7b5140';
const CREAM_TEXT = '#fff1c6';
const CREAM = 0xfff1c6;
const GOLD = 0xf6d995;
const BORDER = 0x3b2531;
const BROWN = 0x8e5136;
const RED = 0xc95746;
const GREEN = 0x5e9a67;
const DARK_WOOD = 0x573044;

export type RaceSceneMode = 'side-follow' | 'lane-board';

export type RaceSceneHooks = {
  initialCoins?: number;
  stats?: BikeStats;
  dayNumber?: number;
  seed?: number;
  onSettled?: (settlement: { rank: number; reward: number; coins: number }) => void;
};

// 성장 체감 비교용 프리셋: 등수 차이가 성장에서 오는지 데모 안에서 바로 바꿔 확인합니다.
const STAT_PRESETS: Array<{ label: string; stats: BikeStats }> = [
  { label: '갓 완성', stats: { 성능: 1, 스타일: 1, 희귀도: 1 } },
  { label: '성장 중', stats: { 성능: 3, 스타일: 2, 희귀도: 2 } },
  { label: '드림 완성', stats: { 성능: 4, 스타일: 4, 희귀도: 4 } },
];

// 사이드뷰: 진행률 1.0이 화면 픽셀로 환산되는 길이 (1% ≈ 24px)
const SPREAD_PX = 2400;
const PLAYER_X = 130;
const ROAD_Y = 384;

// ─── 착좌 라이더 (페달링) ──────────────────────────────────────────────
// bike-pixel-sprite의 그리드 지오메트리(64×40, 앵커 x=32 / y=바퀴 축)를 기준으로
// 안장(hip)·핸들바(hand)·크랭크 중심(crank)을 카테고리별로 맞춥니다.
const RIDER_GEOM: Record<BikeCategory, { axle: number; hip: [number, number]; hand: [number, number]; crank: [number, number] }> = {
  road: { axle: 27, hip: [22, 6], hand: [46, 9], crank: [30, 30] },
  gravel: { axle: 27, hip: [22, 6], hand: [46, 9], crank: [30, 30] },
  mtb: { axle: 27, hip: [21, 6], hand: [44, 9], crank: [30, 30] },
  city: { axle: 27, hip: [22, 6], hand: [43, 9], crank: [30, 30] },
  minivelo: { axle: 30, hip: [22, 6], hand: [42, 6], crank: [30, 32] },
};

const RIDER_SKIN = 0xf2c77e;
const RIDER_PANTS = 0x573044;
const RIDER_PANTS_FAR = 0x41202f;
const RIDER_SHOE = 0x302936;
const RIDER_SHOE_FAR = 0x241f28;
// 페달 회전 반경(그리드 단위)과 이동 픽셀 → 크랭크 회전량 환산 계수
const PEDAL_RADIUS_UNITS = 3.5;
const PEDAL_PX_PER_RADIAN = 12;

// 채널별 밝기 보정: 프레임색에서 저지(상의) 색을 파생합니다.
function lighten(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

type RacerView = {
  data: RacerResult;
  container: Phaser.GameObjects.Container;
  dot: Phaser.GameObjects.Rectangle;
  progress: number;
  // 사이드뷰 페달링 라이더 (lane-board에는 없음)
  farLegs?: Phaser.GameObjects.Graphics;
  nearLegs?: Phaser.GameObjects.Graphics;
  pedalAngle: number;
  lastProgress: number;
};

class RaceScene extends Phaser.Scene {
  constructor(private readonly mode: RaceSceneMode, private readonly hooks: RaceSceneHooks = {}) {
    super(`race-${mode}`);
  }

  private phase: 'entry' | 'countdown' | 'racing' | 'result' = 'entry';
  private coins!: number;
  private runSeed!: number;
  private statPresetIndex = 0;
  private result?: RaceResult;
  private views: RacerView[] = [];

  // 재생 상태
  private playMs = 0;
  private speedMult = 1;
  private slowmo = 1;
  private playerFinished = false;
  private currentSegmentId = '';

  // 사이드뷰 파랄락스 레이어
  private hillFar?: Phaser.GameObjects.Container;
  private hillNear?: Phaser.GameObjects.Container;
  private dashLayer?: Phaser.GameObjects.Container;
  private worldMarkers: Array<{ progress: number; objects: Phaser.GameObjects.GameObject[] }> = [];

  // HUD
  private rankText?: Phaser.GameObjects.Text;
  private distanceText?: Phaser.GameObjects.Text;
  private elapsedText?: Phaser.GameObjects.Text;
  private gapText?: Phaser.GameObjects.Text;
  private minimapFill?: Phaser.GameObjects.Rectangle;
  private speedButtonText?: Phaser.GameObjects.Text;
  private laneRankChips: Phaser.GameObjects.Text[] = [];
  private message?: Phaser.GameObjects.Text;

  private playerStats(): BikeStats {
    return this.hooks.stats ?? STAT_PRESETS[this.statPresetIndex].stats;
  }

  private dayNumber(): number {
    return this.hooks.dayNumber ?? 5;
  }

  create() {
    // 씬 재시작(한 번 더) 시에도 코인·시드는 유지하고 재생 상태만 초기화합니다.
    this.coins = this.coins ?? (this.hooks.initialCoins ?? 2480);
    this.runSeed = this.runSeed ?? (this.hooks.seed ?? 20260829);
    this.phase = 'entry';
    this.result = undefined;
    this.views = [];
    this.worldMarkers = [];
    this.laneRankChips = [];
    this.playMs = 0;
    this.speedMult = 1;
    this.slowmo = 1;
    this.playerFinished = false;
    this.currentSegmentId = '';

    this.cameras.main.setBackgroundColor('#c78452');
    this.buildEntry();
  }

  // ─── 참가 화면 (공통) ─────────────────────────────────────────────

  private buildEntry() {
    this.drawWoodBackdrop();

    this.add.rectangle(46, 30, 68, 22, RED).setStrokeStyle(2, BORDER).setDepth(9);
    this.add.text(46, 30, `DAY ${this.dayNumber()}`, this.style(10, CREAM_TEXT, true)).setOrigin(0.5).setDepth(10);
    this.add.rectangle(232, 30, 288, 26, 0xf4b84a).setStrokeStyle(2, BORDER).setDepth(9);
    this.add.text(232, 30, `${RIVERSIDE_RACE.name} · 오늘 개최!`, this.style(12, INK, true)).setOrigin(0.5).setDepth(10);
    this.add.text(195, 56, `${RIVERSIDE_RACE.distanceMeters.toLocaleString()}m · 참가 ${RIVERSIDE_RACE.racerCount}명 · 자동 관람 레이스`, this.style(10, CREAM_TEXT)).setOrigin(0.5).setDepth(10);

    // 트랙 프로필 포스터: 구간 4개(직선→오르막→내리막→스퍼트)의 고저를 보여줍니다.
    this.add.rectangle(195, 148, 358, 128, CREAM).setStrokeStyle(4, BORDER).setDepth(2);
    this.add.text(30, 96, '코스 안내', this.style(10, MUTED, true)).setDepth(3);
    const profile = this.add.graphics().setDepth(3);
    const profileY = (progress: number) => {
      if (progress <= 0.25) return 168;
      if (progress <= 0.45) return 168 - ((progress - 0.25) / 0.2) * 34;
      if (progress <= 0.65) return 134 + ((progress - 0.45) / 0.2) * 34;
      return 168;
    };
    profile.lineStyle(4, BORDER, 1);
    profile.beginPath();
    profile.moveTo(38, profileY(0));
    for (let step = 1; step <= 40; step += 1) profile.lineTo(38 + (step / 40) * 314, profileY(step / 40));
    profile.strokePath();
    RACE_SEGMENTS.forEach((segment) => {
      const centerX = 38 + ((segment.from + segment.to) / 2) * 314;
      this.add.text(centerX, 186, segment.name, this.style(8, MUTED)).setOrigin(0.5).setDepth(3);
    });
    this.add.rectangle(38 + 314, profileY(1) - 12, 4, 24, BORDER).setDepth(3);
    this.add.text(352, 156, 'FINISH', this.style(7, MUTED, true)).setOrigin(0.5).setDepth(3);

    // 출전 자전거 + 성장 프리셋
    this.add.rectangle(195, 300, 358, 156, 0xd79a63, 0.85).setStrokeStyle(4, BROWN).setDepth(2);
    this.add.text(30, 230, '출전 자전거', this.style(10, MUTED, true)).setDepth(3);
    drawPixelBike(this, 110, 316, 2.4, { category: 'road', colorway: makeWarmColorway(RED), depth: 3 });
    const statsLabel = this.add.text(216, 268, '', this.style(11, INK, true)).setDepth(3);
    const gradeLabel = this.add.text(216, 286, '', this.style(10, MUTED)).setDepth(3);
    const presetButtons: Array<{ panel: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }> = [];
    const refreshStats = () => {
      const stats = this.playerStats();
      statsLabel.setText(`드림 로드 · 성능 Lv.${stats.성능}`);
      gradeLabel.setText(`등급 ${dreamGradeName(stats)} · 스타일 Lv.${stats.스타일} · 희귀도 Lv.${stats.희귀도}`);
      presetButtons.forEach((button, index) => button.panel.setFillStyle(index === this.statPresetIndex ? 0xf4b84a : CREAM));
    };
    STAT_PRESETS.forEach((preset, index) => {
      const x = 216 + index * 56;
      const panel = this.add.rectangle(x, 324, 52, 30, CREAM).setStrokeStyle(2, BORDER).setDepth(3)
        .setInteractive({ useHandCursor: true });
      const text = this.add.text(x, 324, preset.label, this.style(8, INK, true)).setOrigin(0.5).setDepth(4);
      panel.on('pointerdown', () => {
        if (this.hooks.stats) return;
        this.statPresetIndex = index;
        refreshStats();
      });
      presetButtons.push({ panel, text });
    });
    this.add.text(216, 346, this.hooks.stats ? '보유 자전거 성장 상태로 출전합니다' : '성장 단계를 바꿔 등수 체감을 비교하세요', this.style(8, MUTED)).setDepth(3);
    refreshStats();

    // 상금표 + 참가비
    this.add.rectangle(195, 470, 358, 138, CREAM).setStrokeStyle(4, BORDER).setDepth(2);
    this.add.text(30, 412, '상금 안내', this.style(10, MUTED, true)).setDepth(3);
    const prizeRows: Array<[string, string]> = [
      ['1위', `${RIVERSIDE_RACE.rankRewards[0].toLocaleString()}코인`],
      ['2위', `${RIVERSIDE_RACE.rankRewards[1].toLocaleString()}코인`],
      ['3위', `${RIVERSIDE_RACE.rankRewards[2].toLocaleString()}코인`],
      ['완주', `${RIVERSIDE_RACE.finishReward.toLocaleString()}코인`],
    ];
    prizeRows.forEach(([rank, prize], index) => {
      const x = 74 + index * 82;
      this.add.rectangle(x, 448, 74, 24, index === 0 ? 0xf4b84a : 0xffe6a8).setStrokeStyle(2, BROWN).setDepth(3);
      this.add.text(x, 448, `${rank} ${prize}`, this.style(8, INK, true)).setOrigin(0.5).setDepth(4);
    });
    this.add.text(30, 472, `참가비 ${RIVERSIDE_RACE.entryFee.toLocaleString()}코인 · 3위 이내면 참가비보다 이익`, this.style(9, MUTED)).setDepth(3);
    this.add.text(30, 492, '보유 코인', this.style(10, MUTED)).setDepth(3);
    const coinText = this.add.text(360, 488, this.coins.toLocaleString(), this.style(16, INK, true)).setOrigin(1, 0).setDepth(3);

    // 출전 버튼
    const entryButton = this.add.rectangle(195, 576, 300, 46, GREEN).setStrokeStyle(3, BORDER).setDepth(3)
      .setInteractive({ useHandCursor: true });
    this.add.text(195, 576, `참가비 ${RIVERSIDE_RACE.entryFee}코인 내고 출전!`, this.style(13, CREAM_TEXT, true)).setOrigin(0.5).setDepth(4);
    this.message = this.add.text(195, 616, this.mode === 'side-follow' ? 'A안 · 사이드뷰: 카메라가 내 자전거를 따라갑니다.' : 'B안 · 전광판: 8레인 전체를 한눈에 중계합니다.', this.style(10, CREAM_TEXT, true)).setOrigin(0.5, 0).setDepth(10);

    entryButton.on('pointerdown', () => {
      if (this.phase !== 'entry') return;
      const entry = applyRaceEntry(this.coins);
      if (!entry.ok) {
        this.message?.setText(`코인이 부족합니다. (보유 ${entry.coins.toLocaleString()} / 참가비 ${entry.entryFee.toLocaleString()})`);
        return;
      }
      this.coins = entry.coins;
      coinText.setText(this.coins.toLocaleString());
      this.result = simulateRace({
        seed: this.runSeed,
        playerStats: this.playerStats(),
        playerCategory: 'road',
        playerFrameColor: RED,
      });
      this.phase = 'countdown';
      this.startRace();
    });
  }

  // ─── 레이스 시작 (화면 재구성 + 카운트다운) ───────────────────────

  private startRace() {
    // 참가 화면 오브젝트를 전부 걷어내고 레이스 뷰를 새로 만듭니다.
    this.children.removeAll(true);
    if (this.mode === 'side-follow') this.buildSideView();
    else this.buildLaneBoard();
    this.buildRaceHud();

    const countdownSteps = ['3', '2', '1', 'GO!'];
    countdownSteps.forEach((step, index) => {
      this.time.delayedCall(700 * index, () => {
        const text = this.add.text(195, 250, step, this.style(step === 'GO!' ? 40 : 48, CREAM_TEXT, true))
          .setOrigin(0.5).setDepth(30).setStroke(INK, 8);
        this.tweens.add({ targets: text, scale: { from: 0.4, to: 1.15 }, alpha: { from: 1, to: 0 }, duration: 640, ease: 'Cubic.easeOut', onComplete: () => text.destroy() });
        if (step === 'GO!') {
          this.phase = 'racing';
          this.playMs = 0;
        }
      });
    });
  }

  // ─── A안: 사이드뷰 (카메라 추적) ──────────────────────────────────

  private buildSideView() {
    // 하늘·언덕 2겹·노면: 홈 화면 야외 팔레트
    this.add.rectangle(195, 218, 390, 252, 0x86c9c8).setDepth(0);
    this.add.rectangle(90, 140, 46, 12, CREAM, 0.8).setDepth(0);
    this.add.rectangle(280, 168, 58, 12, CREAM, 0.8).setDepth(0);

    // 언덕 실루엣 2겹: 패턴 주기(540px/360px)에 맞춰 modulo 스크롤합니다.
    this.hillFar = this.add.container(0, 0).setDepth(1);
    this.hillNear = this.add.container(0, 0).setDepth(2);
    for (let index = 0; index < 9; index += 1) {
      const farHeight = 74 + (index % 3) * 16;
      this.hillFar.add(this.add.triangle(index * 180, 344, 0, farHeight, 90, 0, 180, farHeight, 0x86ba6f).setOrigin(0, 1));
      if (index < 8) {
        const nearHeight = 52 + (index % 2) * 14;
        this.hillNear.add(this.add.triangle(index * 180 - 120, 352, 0, nearHeight, 110, 0, 220, nearHeight, GREEN).setOrigin(0, 1));
      }
    }

    this.add.rectangle(195, 384, 390, 60, 0xb66f45).setDepth(3);
    this.add.rectangle(195, 356, 390, 5, 0x8a5231).setDepth(3);
    this.add.rectangle(195, 412, 390, 4, 0x8a5231).setDepth(3);
    // 뷰포트 아래 정보 영역: 게임 화면과 같은 나무 바닥
    this.add.rectangle(195, 612, 390, 396, 0xa9683f).setDepth(3);
    for (let y = 428; y < 810; y += 26) this.add.rectangle(195, y, 390, 2, 0x8a5231, 0.5).setDepth(3);
    this.dashLayer = this.add.container(0, 0).setDepth(3);
    for (let index = 0; index < 9; index += 1) {
      this.dashLayer.add(this.add.rectangle(index * 60, 400, 26, 4, CREAM, 0.65).setOrigin(0, 0.5));
    }

    // 구간 표지판 + 결승선: 진행률 좌표를 가진 월드 마커
    RACE_SEGMENTS.slice(1).forEach((segment) => {
      const post = this.add.rectangle(0, 346, 6, 26, BROWN).setStrokeStyle(2, BORDER).setDepth(4);
      const sign = this.add.rectangle(0, 328, 58, 18, 0xffe6a8).setStrokeStyle(2, BROWN).setDepth(4);
      const label = this.add.text(0, 328, segment.name, this.style(8, INK, true)).setOrigin(0.5).setDepth(5);
      this.worldMarkers.push({ progress: segment.from, objects: [post, sign, label] });
    });
    const finishPost = this.add.rectangle(0, 340, 8, 60, BORDER).setDepth(4);
    const finishFlag = this.add.graphics().setDepth(5);
    for (let row = 0; row < 3; row += 1) for (let column = 0; column < 5; column += 1) {
      finishFlag.fillStyle((row + column) % 2 === 0 ? 0x3b2531 : 0xfff1c6, 1);
      finishFlag.fillRect(column * 8, row * 8, 8, 8);
    }
    const finishLabel = this.add.text(0, 296, 'FINISH', this.style(9, CREAM_TEXT, true)).setOrigin(0.5).setDepth(5).setStroke(INK, 4);
    this.worldMarkers.push({ progress: 1, objects: [finishPost, finishFlag, finishLabel] });

    // 참가자: 텍스처 캐시 경로(addPixelBikeImage)로 8대 동시 렌더링.
    // 라이더는 안장에 앉은 자세로 그리고, 다리(원경/근경)는 매 프레임 크랭크 각도에 맞춰 다시 그립니다.
    this.result!.racers.forEach((racer, index) => {
      const container = this.add.container(PLAYER_X, ROAD_Y + (racer.isPlayer ? 0 : (index % 3) - 1)).setDepth(racer.isPlayer ? 7 : 6);
      const farLegs = this.add.graphics();
      container.add(farLegs);
      const bike = addPixelBikeImage(this, 0, 0, 2, { category: racer.category, colorway: makeWarmColorway(racer.frameColor) });
      container.add(bike);
      const body = this.add.graphics();
      this.paintRiderBody(body, racer, 2);
      container.add(body);
      const nearLegs = this.add.graphics();
      container.add(nearLegs);
      if (racer.isPlayer) {
        const tag = this.add.rectangle(0, -84, 36, 18, RED).setStrokeStyle(2, BORDER);
        const tagText = this.add.text(0, -84, '나', this.style(10, CREAM_TEXT, true)).setOrigin(0.5);
        container.add([tag, tagText]);
      } else {
        container.add(this.add.text(0, -78, racer.name, this.style(8, INK, true)).setOrigin(0.5));
      }
      this.tweens.add({ targets: container, y: '-=2', duration: 240 + index * 22, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const view: RacerView = {
        data: racer, container, dot: this.add.rectangle(0, 0, 1, 1, 0, 0), progress: 0,
        farLegs, nearLegs, pedalAngle: index * 2.1, lastProgress: 0,
      };
      this.drawRiderLegs(view);
      this.views.push(view);
    });
  }

  // ─── B안: 8레인 전광판 ────────────────────────────────────────────

  private buildLaneBoard() {
    this.drawWoodBackdrop();
    this.add.rectangle(195, 330, 374, 452, DARK_WOOD).setStrokeStyle(4, BORDER).setDepth(1);
    const laneTop = 112;
    const laneHeight = 54;
    const trackFrom = 64;
    const trackTo = 330;

    this.result!.racers.forEach((racer, index) => {
      const laneY = laneTop + index * laneHeight;
      this.add.rectangle(195, laneY + laneHeight / 2, 358, laneHeight - 6, index % 2 === 0 ? 0x6a4a3a : 0x5f4234)
        .setDepth(2);
      if (racer.isPlayer) {
        this.add.rectangle(195, laneY + laneHeight / 2, 358, laneHeight - 6).setStrokeStyle(3, 0xf4b84a).setDepth(3);
      }
      this.add.rectangle(195, laneY + laneHeight - 10, 358, 2, CREAM, 0.35).setDepth(2);
      this.add.text(24, laneY + 4, this.racerLabel(racer), this.style(9, racer.isPlayer ? '#f4b84a' : CREAM_TEXT, true)).setDepth(4);
      const chip = this.add.text(348, laneY + 4, '-위', this.style(9, CREAM_TEXT, true)).setOrigin(1, 0).setDepth(4);
      this.laneRankChips.push(chip);

      // 결승 체커
      const checker = this.add.graphics().setDepth(3);
      for (let row = 0; row < 4; row += 1) {
        checker.fillStyle(row % 2 === 0 ? 0x3b2531 : 0xfff1c6, 1);
        checker.fillRect(trackTo + 26, laneY + 12 + row * 8, 8, 8);
      }

      const container = this.add.container(trackFrom, laneY + laneHeight - 12).setDepth(racer.isPlayer ? 6 : 5);
      const bike = addPixelBikeImage(this, 0, 0, 1, { category: racer.category, colorway: makeWarmColorway(racer.frameColor) });
      container.add(bike);
      this.tweens.add({ targets: container, y: '-=1.5', duration: 220 + index * 18, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.views.push({ data: racer, container, dot: this.add.rectangle(0, 0, 1, 1, 0, 0), progress: 0, pedalAngle: 0, lastProgress: 0 });
    });

    // 레인 좌표 갱신에 쓰는 상수 저장
    this.laneTrack = { from: trackFrom, to: trackTo };
  }

  private laneTrack = { from: 64, to: 330 };

  // ─── 공통 HUD (Day HUD 문법 재사용) ───────────────────────────────

  private buildRaceHud() {
    this.add.rectangle(195, 44, 390, 88, 0x3b2531, this.mode === 'side-follow' ? 0.28 : 0).setDepth(9);
    this.add.rectangle(46, 17, 68, 22, RED).setStrokeStyle(2, BORDER).setDepth(10);
    this.add.text(46, 17, `DAY ${this.dayNumber()}`, this.style(10, CREAM_TEXT, true)).setOrigin(0.5).setDepth(11);
    this.add.rectangle(172, 17, 168, 22, 0xf4b84a).setStrokeStyle(2, BORDER).setDepth(10);
    this.add.text(172, 17, RIVERSIDE_RACE.name, this.style(10, INK, true)).setOrigin(0.5).setDepth(11);
    this.add.rectangle(330, 17, 100, 22, CREAM).setStrokeStyle(2, BORDER).setDepth(10);
    this.rankText = this.add.text(330, 17, '-위 / 8', this.style(10, INK, true)).setOrigin(0.5).setDepth(11);

    // 미니맵 진행 바: Day 타이머 바(darkWood + green)와 동일 문법
    this.add.rectangle(6, 40, 378, 8, DARK_WOOD).setOrigin(0, 0.5).setDepth(10);
    this.minimapFill = this.add.rectangle(6, 40, 0, 6, GREEN).setOrigin(0, 0.5).setDepth(11);
    RACE_SEGMENTS.slice(1).forEach((segment) => {
      this.add.rectangle(6 + segment.from * 378, 40, 2, 12, 0xf6d995, 0.8).setDepth(12);
    });
    this.views.forEach((view) => {
      view.dot.destroy();
      view.dot = view.data.isPlayer
        ? this.add.rectangle(6, 40, 8, 14, RED).setStrokeStyle(2, CREAM).setDepth(14)
        : this.add.rectangle(6, 40, 5, 9, 0xd9c197).setDepth(13);
    });

    this.distanceText = this.add.text(8, 54, `0m / ${RIVERSIDE_RACE.distanceMeters.toLocaleString()}m`, this.style(9, CREAM_TEXT, true)).setDepth(11).setStroke(INK, 3);
    this.elapsedText = this.add.text(382, 54, '기록 00:00.0', this.style(9, CREAM_TEXT, true)).setOrigin(1, 0).setDepth(11).setStroke(INK, 3);

    // 하단 정보 패널
    const infoTop = this.mode === 'side-follow' ? 432 : 576;
    this.add.rectangle(103, infoTop + 26, 178, 52, CREAM).setStrokeStyle(3, BROWN).setDepth(9);
    this.add.text(24, infoTop + 8, '현재 구간', this.style(9, MUTED)).setDepth(10);
    this.gapText = this.add.text(24, infoTop + 24, '출발 준비', this.style(12, INK, true)).setDepth(10);
    this.add.rectangle(287, infoTop + 26, 178, 52, CREAM).setStrokeStyle(3, BROWN).setDepth(9);
    this.add.text(208, infoTop + 8, '선두와 간격', this.style(9, MUTED)).setDepth(10);
    this.leadGapText = this.add.text(208, infoTop + 24, '-', this.style(12, INK, true)).setDepth(10);

    const speedButton = this.add.rectangle(195, infoTop + 82, 120, 32, GOLD).setStrokeStyle(3, BORDER).setDepth(9)
      .setInteractive({ useHandCursor: true });
    this.speedButtonText = this.add.text(195, infoTop + 82, '배속 x1', this.style(11, INK, true)).setOrigin(0.5).setDepth(10);
    speedButton.on('pointerdown', () => {
      this.speedMult = this.speedMult === 1 ? 2 : 1;
      this.speedButtonText?.setText(`배속 x${this.speedMult}`);
    });

    this.message = this.add.text(195, infoTop + 110, '레이스는 자동으로 진행됩니다 — 관람 모드', this.style(10, CREAM_TEXT, true)).setOrigin(0.5, 0).setDepth(10);
  }

  private leadGapText?: Phaser.GameObjects.Text;

  // ─── 재생 루프 ────────────────────────────────────────────────────

  update(_time: number, delta: number) {
    if (this.phase !== 'racing' || !this.result) return;
    this.playMs += delta * this.speedMult * this.slowmo;
    const tickFloat = this.playMs / this.result.tickMs;

    this.views.forEach((view) => {
      view.progress = progressAt(view.data.timeline, tickFloat);
    });
    const player = this.views.find((view) => view.data.isPlayer)!;
    const leaderProgress = Math.max(...this.views.map((view) => view.progress));

    if (this.mode === 'side-follow') this.updateSideView(player);
    else this.updateLaneBoard();

    // HUD 갱신
    const liveRank = 1 + this.views.filter((view) => !view.data.isPlayer
      && (view.progress > player.progress + 1e-9
        || (view.progress >= 1 && player.progress >= 1 && view.data.finishTimeMs < player.data.finishTimeMs))).length;
    this.rankText?.setText(`${this.playerFinished ? this.result.playerRank : liveRank}위 / ${this.result.meta.racerCount}`);
    this.views.forEach((view) => view.dot.setPosition(6 + view.progress * 378, 40));
    this.minimapFill?.setDisplaySize(Math.max(1, player.progress * 378), 6);
    const meters = Math.round(player.progress * this.result.meta.distanceMeters);
    this.distanceText?.setText(`${meters.toLocaleString()}m / ${this.result.meta.distanceMeters.toLocaleString()}m`);
    this.elapsedText?.setText(`기록 ${formatRaceTime(Math.min(this.playMs, player.data.finishTimeMs))}`);

    const segment = segmentAt(Math.min(player.progress, 0.999));
    this.gapText?.setText(this.playerFinished ? '완주!' : segment.name);
    if (segment.id !== this.currentSegmentId && !this.playerFinished) {
      this.currentSegmentId = segment.id;
      const bannerTexts: Record<string, string> = {
        climb: '오르막 구간! 순위 변동 주의',
        descent: '내리막 구간! 가속',
        sprint: '피니시 스퍼트!',
      };
      if (segment.id !== 'start') this.showSegmentBanner(bannerTexts[segment.id] ?? segment.name, segment.speedFactor < 1);
    }
    const gapMeters = Math.round((leaderProgress - player.progress) * this.result.meta.distanceMeters);
    this.leadGapText?.setText(this.playerFinished ? formatRaceTime(player.data.finishTimeMs) : gapMeters <= 0 ? '선두 유지!' : `${gapMeters}m 뒤`);
    this.leadGapText?.setColor(gapMeters <= 0 ? '#3f7851' : INK);

    // 결승선 통과 → 짧은 슬로모션 → 결과 발표
    if (!this.playerFinished && player.progress >= 1) {
      this.playerFinished = true;
      this.slowmo = 0.3;
      this.showSegmentBanner('결승선 통과!', false);
      this.time.delayedCall(1000, () => { this.slowmo = 1; });
      this.time.delayedCall(2000, () => this.showResult());
    }
  }

  // 그리드 좌표(64×40) → 자전거 앵커(x=중앙, y=바퀴 축) 기준 픽셀 좌표
  private riderPoint(category: BikeCategory, point: [number, number], cell: number): { x: number; y: number } {
    return { x: (point[0] - 32) * cell, y: (point[1] - RIDER_GEOM[category].axle) * cell };
  }

  // 안장에 앉아 핸들바를 잡은 상반신 (정적 1회 드로잉)
  private paintRiderBody(g: Phaser.GameObjects.Graphics, racer: RacerResult, cell: number) {
    const geom = RIDER_GEOM[racer.category];
    const hip = this.riderPoint(racer.category, geom.hip, cell);
    const hand = this.riderPoint(racer.category, geom.hand, cell);
    const shoulder = this.riderPoint(racer.category, [33, -1], cell);
    const jersey = racer.isPlayer ? CREAM : lighten(racer.frameColor, 1.3);
    const helmet = racer.isPlayer ? RED : lighten(racer.frameColor, 0.6);
    // 몸통: 안장에서 어깨로 앞으로 기운 착좌 자세
    g.lineStyle(3.4 * cell, jersey);
    g.lineBetween(hip.x, hip.y, shoulder.x, shoulder.y);
    // 엉덩이(팬츠): 안장 접점
    g.fillStyle(RIDER_PANTS);
    g.fillRect(hip.x - 2 * cell, hip.y - 1.5 * cell, 4.5 * cell, 3 * cell);
    // 팔: 어깨→핸들바, 손은 그립 위
    g.lineStyle(1.8 * cell, jersey);
    g.lineBetween(shoulder.x, shoulder.y + cell, hand.x, hand.y);
    g.fillStyle(RIDER_SKIN);
    g.fillRect(hand.x - cell, hand.y - cell, 2 * cell, 2 * cell);
    // 어깨 관절: 몸통·팔·목을 잇는 블록
    g.fillStyle(jersey);
    g.fillRect(shoulder.x - 1.5 * cell, shoulder.y - 1.5 * cell, 3 * cell, 3 * cell);
    // 머리 + 헬멧 (어깨 위에 붙여 그림)
    const headX = shoulder.x + 0.5 * cell;
    const headY = shoulder.y - 6.5 * cell;
    g.fillStyle(RIDER_SKIN);
    g.fillRect(headX, headY, 5 * cell, 5 * cell);
    g.fillStyle(helmet);
    g.fillRect(headX - cell, headY - 2 * cell, 6.5 * cell, 2.6 * cell);
    g.fillRect(headX + 4.5 * cell, headY + 0.4 * cell, 1.6 * cell, 1 * cell); // 헬멧 챙
    g.lineStyle(2, BORDER);
    g.strokeRect(headX - cell, headY - 2 * cell, 6.5 * cell, 7 * cell);
  }

  // 크랭크 각도에 맞춰 원경/근경 다리를 다시 그립니다 (라이더당 드로잉 6개 수준)
  private drawRiderLegs(view: RacerView) {
    const { farLegs, nearLegs } = view;
    if (!farLegs || !nearLegs) return;
    const cell = 2;
    const category = view.data.category;
    const geom = RIDER_GEOM[category];
    const hip = this.riderPoint(category, geom.hip, cell);
    const crank = this.riderPoint(category, geom.crank, cell);
    const radius = PEDAL_RADIUS_UNITS * cell;
    farLegs.clear();
    nearLegs.clear();
    const drawLeg = (g: Phaser.GameObjects.Graphics, angle: number, pants: number, shoe: number) => {
      const pedal = { x: crank.x + Math.cos(angle) * radius, y: crank.y + Math.sin(angle) * radius };
      const dx = pedal.x - hip.x;
      const dy = pedal.y - hip.y;
      const length = Math.hypot(dx, dy) || 1;
      // 무릎: 엉덩이→페달 중점에서 전방(진행 방향) 위쪽으로 굽힘
      const knee = {
        x: (hip.x + pedal.x) / 2 + (dy / length) * 3 * cell,
        y: (hip.y + pedal.y) / 2 - (dx / length) * 3 * cell,
      };
      g.lineStyle(2.4 * cell, pants);
      g.lineBetween(hip.x, hip.y, knee.x, knee.y);
      g.lineStyle(1.7 * cell, pants);
      g.lineBetween(knee.x, knee.y, pedal.x, pedal.y);
      g.fillStyle(shoe);
      g.fillRect(pedal.x - 1.6 * cell, pedal.y - 0.9 * cell, 3.4 * cell, 1.8 * cell);
    };
    drawLeg(farLegs, view.pedalAngle + Math.PI, RIDER_PANTS_FAR, RIDER_SHOE_FAR);
    drawLeg(nearLegs, view.pedalAngle, RIDER_PANTS, RIDER_SHOE);
  }

  private updateSideView(player: RacerView) {
    // 페달링: 실제 이동량에 비례해 크랭크를 돌립니다 (슬로모션·완주 후 관성도 자연히 반영)
    this.views.forEach((view) => {
      const moved = view.progress - view.lastProgress;
      view.lastProgress = view.progress;
      if (moved > 0) {
        view.pedalAngle += (moved * SPREAD_PX) / PEDAL_PX_PER_RADIAN;
        this.drawRiderLegs(view);
      }
    });
    const offset = player.progress * SPREAD_PX;
    if (this.hillFar) this.hillFar.x = -((offset * 0.22) % 540);
    if (this.hillNear) this.hillNear.x = -((offset * 0.45) % 360);
    if (this.dashLayer) this.dashLayer.x = -(offset % 60);
    this.worldMarkers.forEach((marker) => {
      const x = PLAYER_X + (marker.progress - player.progress) * SPREAD_PX;
      const visible = x > -80 && x < 470;
      marker.objects.forEach((object) => {
        const item = object as Phaser.GameObjects.Rectangle;
        item.setVisible(visible);
        if (visible) item.setX(object instanceof Phaser.GameObjects.Graphics ? x - 20 : x);
      });
    });
    this.views.forEach((view) => {
      if (view.data.isPlayer) {
        view.container.setX(PLAYER_X);
        return;
      }
      const x = PLAYER_X + (view.progress - player.progress) * SPREAD_PX;
      view.container.setVisible(x > -90 && x < 480);
      view.container.setX(x);
    });
  }

  private updateLaneBoard() {
    const span = this.laneTrack.to - this.laneTrack.from;
    this.views.forEach((view) => {
      view.container.setX(this.laneTrack.from + view.progress * span);
    });
    // 레인 오른쪽 순위 칩 실시간 갱신
    const ordered = [...this.views].sort((a, b) => (b.progress - a.progress) || (a.data.finishTimeMs - b.data.finishTimeMs));
    this.views.forEach((view, index) => {
      const rank = view.progress >= 1 ? view.data.rank : ordered.indexOf(view) + 1;
      this.laneRankChips[index]?.setText(`${rank}위`);
      this.laneRankChips[index]?.setColor(rank === 1 ? '#f4b84a' : CREAM_TEXT);
    });
  }

  private showSegmentBanner(text: string, isSlowdown: boolean) {
    const y = this.mode === 'side-follow' ? 120 : 92;
    const banner = this.add.rectangle(195, y, 250, 32, isSlowdown ? 0xffe6a8 : 0xf4b84a).setStrokeStyle(3, BORDER).setDepth(25).setAlpha(0);
    const label = this.add.text(195, y, text, this.style(12, INK, true)).setOrigin(0.5).setDepth(26).setAlpha(0);
    this.tweens.add({ targets: [banner, label], alpha: 1, y: '-=6', duration: 260, ease: 'Cubic.easeOut' });
    this.time.delayedCall(1500, () => {
      this.tweens.add({ targets: [banner, label], alpha: 0, duration: 300, onComplete: () => { banner.destroy(); label.destroy(); } });
    });
  }

  // ─── 결과·정산 ────────────────────────────────────────────────────

  private showResult() {
    if (this.phase === 'result' || !this.result) return;
    this.phase = 'result';
    const result = this.result;
    const reward = raceRewardForRank(result.playerRank);
    const isPodium = result.playerRank <= 3;

    this.add.rectangle(195, 405, 390, 810, 0x3b2531, 0.55).setDepth(40);
    this.add.rectangle(195, 388, 342, 440, CREAM).setStrokeStyle(4, BORDER).setDepth(41);
    this.add.rectangle(195, 208, 200, 30, isPodium ? 0xf4b84a : 0xffe6a8).setStrokeStyle(3, BORDER).setDepth(42);
    this.add.text(195, 208, isPodium ? 'RACE RESULT · 입상!' : 'RACE RESULT · 완주', this.style(11, INK, true)).setOrigin(0.5).setDepth(43);
    this.add.text(195, 256, `${result.playerRank}위`, this.style(44, isPodium ? '#b8761a' : INK, true)).setOrigin(0.5).setDepth(43);
    this.add.text(195, 292, `기록 ${formatRaceTime(result.playerTimeMs)} · ${result.meta.name}`, this.style(11, MUTED, true)).setOrigin(0.5).setDepth(43);

    // 입상자 + 내 기록
    const ordered = [...result.racers].sort((a, b) => a.rank - b.rank);
    const rows = ordered.filter((racer) => racer.rank <= 3 || racer.isPlayer);
    rows.forEach((racer, index) => {
      const y = 330 + index * 26;
      this.add.rectangle(195, y, 294, 22, racer.isPlayer ? 0xffe6a8 : 0xf6d995, racer.isPlayer ? 1 : 0.7)
        .setStrokeStyle(2, racer.isPlayer ? BROWN : 0xd9c197).setDepth(42);
      this.add.text(60, y, `${racer.rank}위`, this.style(10, racer.rank === 1 ? '#b8761a' : INK, true)).setOrigin(0, 0.5).setDepth(43);
      this.add.text(96, y, this.racerLabel(racer), this.style(10, INK, racer.isPlayer)).setOrigin(0, 0.5).setDepth(43);
      this.add.text(330, y, formatRaceTime(racer.finishTimeMs), this.style(10, MUTED)).setOrigin(1, 0.5).setDepth(43);
    });

    const rewardRowY = 330 + rows.length * 26 + 18;
    this.add.text(60, rewardRowY, isPodium ? '상금' : '완주 수당', this.style(10, MUTED)).setOrigin(0, 0.5).setDepth(43);
    this.add.text(330, rewardRowY, `+${reward.toLocaleString()}코인`, this.style(14, '#3f7851', true)).setOrigin(1, 0.5).setDepth(43);
    this.add.text(60, rewardRowY + 22, '보유 코인', this.style(10, MUTED)).setOrigin(0, 0.5).setDepth(43);
    const coinText = this.add.text(330, rewardRowY + 22, this.coins.toLocaleString(), this.style(14, INK, true)).setOrigin(1, 0.5).setDepth(43);
    this.add.text(195, rewardRowY + 44, isPodium ? '' : `참가비 ${result.meta.entryFee}코인보다 적어요 — 자전거를 성장시켜 보세요`, this.style(9, MUTED)).setOrigin(0.5).setDepth(43);

    // 입상 시 픽셀 색종이
    if (isPodium) {
      for (let index = 0; index < 14; index += 1) {
        const confetti = this.add.rectangle(60 + (index * 53) % 270, 180, 8, 8, [0xf4b84a, RED, GREEN, 0x4e8092][index % 4]).setStrokeStyle(1, BORDER).setDepth(44);
        this.tweens.add({ targets: confetti, y: 560 + (index % 5) * 24, angle: 180 + index * 40, alpha: { from: 1, to: 0.1 }, duration: 1400 + index * 90, ease: 'Sine.easeIn', onComplete: () => confetti.destroy() });
      }
    }

    const claimButton = this.add.rectangle(195, 556, 220, 42, GREEN).setStrokeStyle(3, BORDER).setDepth(42)
      .setInteractive({ useHandCursor: true });
    const claimText = this.add.text(195, 556, '보상 받기', this.style(13, CREAM_TEXT, true)).setOrigin(0.5).setDepth(43);
    let claimed = false;
    claimButton.on('pointerdown', () => {
      if (claimed) {
        // 두 번째 탭: 같은 조건(코인 유지)으로 새 시드 레이스
        this.runSeed += 1;
        this.scene.restart();
        return;
      }
      claimed = true;
      const settlement = applyRaceReward(this.coins, result.playerRank);
      this.coins = settlement.coins;
      this.hooks.onSettled?.({ rank: result.playerRank, reward: settlement.reward, coins: settlement.coins });
      // 코인 카운트업 연출
      const from = settlement.coins - settlement.reward;
      this.tweens.addCounter({
        from, to: settlement.coins, duration: 900, ease: 'Cubic.easeOut',
        onUpdate: (tween) => coinText.setText(Math.round(tween.getValue() ?? settlement.coins).toLocaleString()),
      });
      claimButton.setFillStyle(GOLD);
      claimText.setText('한 번 더 (새 시드)').setColor(INK);
    });
  }

  // ─── 공통 유틸 ────────────────────────────────────────────────────

  // 플레이어 표기: 기본 이름이 '나'면 그대로, 통합에서 닉네임이 오면 '나 (닉네임)'
  private racerLabel(racer: RacerResult): string {
    if (!racer.isPlayer) return racer.name;
    return racer.name === '나' ? '나' : `나 (${racer.name})`;
  }

  private drawWoodBackdrop() {
    this.add.rectangle(195, 300, 390, 600, 0xc78452).setDepth(0);
    this.add.rectangle(195, 705, 390, 210, 0xa9683f).setDepth(0);
    for (let y = 626; y < 810; y += 26) this.add.rectangle(195, y, 390, 2, 0x8a5231, 0.5).setDepth(0);
    for (let x = 24; x < 390; x += 52) this.add.rectangle(x, 300, 2, 600, 0xb37246, 0.35).setDepth(0);
  }

  private style(fontSize: number, color: string, bold = false): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: FONT, fontSize: `${fontSize}px`, color, ...(bold ? { fontStyle: 'bold' } : {}) };
  }
}

export function startRaceScenePrototype(parent: string, mode: RaceSceneMode, hooks: RaceSceneHooks = {}) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 390,
    height: 810,
    backgroundColor: '#c78452',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: new RaceScene(mode, hooks),
  });
}
