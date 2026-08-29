import Phaser from 'phaser';
import { startTitleLoadingPrototype } from './title-loading-design';
import { startHomeDesignPrototype } from './home-design-prototype';
import { startGuideOverlayPrototype } from './guide-overlay-design';
import { startGameScreenMobilePrototype } from './game-screen-mobile';
import { startRewardSettlementPrototype } from './reward-settlement-design';
import { startBikeCollectionDesignPrototype, type BikeCollectionDesignMode } from './bike-collection-design-prototype';
import { startProfileDesignPrototype } from './profile-design-prototype';
import { startSettingsDrawerPrototype } from './settings-design';
import { ReleaseAudio, type ReleaseAudioRoom, type ReleaseSfxEvent } from './release-audio';
import { applyOrderUnlock, createCollectionProgress, markBikeSeen, orderMetaAt, type OrderUnlockResult } from './meta-progress';

type ReleaseScreen = 'title' | 'home' | 'guide' | 'game' | 'reward' | 'catalog' | 'showcase' | 'dream' | 'profile' | 'settings';
type ReleaseState = {
  version: 1;
  coins: number;
  completedOrders: number;
  orderIndex: number;
  tutorialDone: boolean;
  autoPlacement: boolean;
  bgm: boolean;
  sfx: boolean;
  vibration: boolean;
};

const STORAGE_KEY = 'dbg-lab-mvp-release-integration-v1';
const DEFAULT_STATE: ReleaseState = {
  version: 1,
  coins: 2480,
  completedOrders: 0,
  orderIndex: 0,
  tutorialDone: false,
  autoPlacement: false,
  bgm: true,
  sfx: true,
  vibration: false,
};

const NAV: Array<{ screen: ReleaseScreen; label: string }> = [
  { screen: 'home', label: 'HOME' },
  { screen: 'game', label: 'PLAY' },
  { screen: 'catalog', label: '수집 A · 도감' },
  { screen: 'showcase', label: '수집 B · 전시' },
  { screen: 'dream', label: '수집 C · 성장' },
  { screen: 'profile', label: '프로필 A' },
  { screen: 'settings', label: '설정 A' },
];

const SCREEN_LABELS: Record<ReleaseScreen, string> = {
  title: '01 · 타이틀·로딩 A', home: '02 · Garage 홈 A', guide: '03 · 첫 플레이 안내 A',
  game: '04 · 모바일 플레이 B', reward: '05 · 납품·보상 A', catalog: '06A · 자전거 도감',
  showcase: '06B · Garage 전시', dream: '06C · 드림 바이크 성장', profile: '07 · 프로필 A', settings: '08 · 설정 A',
};

export class MvpReleaseIntegrationController {
  private game?: Phaser.Game;
  private readonly audio = new ReleaseAudio();
  private state = this.loadState();
  private screen: ReleaseScreen = 'title';
  // 컬렉션 진행 상태 (#201): 이 단계에서는 세션 메모리로만 유지하고, 저장·복구는 #204에서 연결한다
  private collection = createCollectionProgress();
  private lastUnlock?: OrderUnlockResult;
  private rewardApplied = false;
  private readonly stageId = `mvp-release-stage-${Math.random().toString(36).slice(2)}`;

  constructor(private readonly parent: HTMLElement) {
    this.audio.setEnabled(this.state.bgm, this.state.sfx);
    this.renderShell();
    this.show('title');
  }

  destroy() {
    this.game?.destroy(true);
    this.audio.destroy();
    this.parent.innerHTML = '';
  }

  private renderShell() {
    this.parent.innerHTML = `
      <section class="release-integration-shell">
        <header class="release-flow-header">
          <div><span>MVP RELEASE VERTICAL SLICE</span><strong id="release-screen-label"></strong></div>
          <div class="release-state"><span id="release-coins"></span><button id="release-audio" type="button"></button></div>
        </header>
        <nav class="release-flow-nav" aria-label="통합 MVP 화면 바로가기">
          ${NAV.map((item) => `<button type="button" data-release-screen="${item.screen}">${item.label}</button>`).join('')}
        </nav>
        <div id="${this.stageId}" class="release-stage"></div>
        <footer class="release-flow-footer"><span>타이틀 → 홈 → 안내 → 주문·택배·머지·장착 → 정산 → 성장·수집</span><strong>자동 저장 · BGM/SFX 연결</strong></footer>
      </section>`;
    this.parent.querySelectorAll<HTMLButtonElement>('[data-release-screen]').forEach((button) => {
      button.addEventListener('click', () => {
        this.play('tap');
        this.show(button.dataset.releaseScreen as ReleaseScreen);
      });
    });
    this.parent.querySelector<HTMLButtonElement>('#release-audio')?.addEventListener('click', () => {
      this.state.bgm = !this.state.bgm;
      this.audio.unlock();
      this.audio.setEnabled(this.state.bgm, this.state.sfx);
      this.saveState();
      this.refreshShell();
    });
  }

  private show(screen: ReleaseScreen) {
    this.game?.destroy(true);
    this.game = undefined;
    this.screen = screen;
    const stage = this.parent.querySelector<HTMLElement>(`#${this.stageId}`);
    if (!stage) return;
    stage.innerHTML = '';
    this.audio.setRoom(this.roomFor(screen));
    this.refreshShell();

    if (screen === 'title') {
      this.game = startTitleLoadingPrototype(this.stageId, {
        onEnterHome: () => this.show('home'),
        onSfx: (event) => this.play(event),
      });
      return;
    }
    if (screen === 'home') {
      this.game = startHomeDesignPrototype(this.stageId, 'warm-pixel-garage', {
        coins: this.state.coins,
        completedOrders: this.state.completedOrders,
        onPlay: () => this.show(this.state.tutorialDone ? 'game' : 'guide'),
        onCollection: () => this.show('catalog'),
        onShowcase: () => this.show('showcase'),
        onProfile: () => this.show('profile'),
        onSettings: () => this.show('settings'),
        onSfx: (event) => this.play(event),
      });
      return;
    }
    if (screen === 'guide') {
      this.game = startGuideOverlayPrototype(this.stageId, {
        onFinish: () => { this.state.tutorialDone = true; this.saveState(); this.show('game'); },
        onSfx: (event) => this.play(event),
      });
      return;
    }
    if (screen === 'game') {
      this.rewardApplied = false;
      this.game = startGameScreenMobilePrototype(this.stageId, {
        orderIndex: this.state.orderIndex,
        autoPlacement: this.state.autoPlacement,
        onAutoPlacementChange: (enabled) => {
          this.state.autoPlacement = enabled;
          this.saveState();
        },
        onOrderComplete: (orderIndex) => {
          this.state.completedOrders += 1;
          // 납품한 주문에 매핑된 자전거를 컬렉션에 해금하고, 결과를 정산 화면에 전달한다 (#201)
          this.lastUnlock = applyOrderUnlock(this.collection, orderIndex);
          this.saveState();
          this.show('reward');
        },
        onSfx: (event) => this.play(event),
      });
      return;
    }
    if (screen === 'reward') {
      const orderMeta = orderMetaAt(this.state.orderIndex);
      const reward = orderMeta?.reward ?? 1000 + this.state.orderIndex * 400;
      this.game = startRewardSettlementPrototype(this.stageId, {
        initialCoins: this.state.coins,
        reward,
        orderName: orderMeta?.name,
        bikeCategory: orderMeta?.bikeCategory,
        unlockedBike: this.lastUnlock?.unlockedBike
          ? { name: this.lastUnlock.unlockedBike.name, grade: this.lastUnlock.unlockedBike.grade, isNew: this.lastUnlock.isNew }
          : undefined,
        onReward: (coins) => {
          if (this.rewardApplied) return;
          this.rewardApplied = true;
          this.state.coins = coins;
          this.saveState();
          this.refreshShell();
        },
        onNext: () => { this.advanceOrder(); this.show('game'); },
        onHome: () => { this.advanceOrder(); this.show('home'); },
        onSfx: (event) => this.play(event),
      });
      return;
    }
    if (screen === 'catalog' || screen === 'showcase' || screen === 'dream') {
      const mode: BikeCollectionDesignMode = screen === 'catalog' ? 'warm-catalog' : screen === 'showcase' ? 'warm-showcase' : 'warm-dream-growth';
      this.game = startBikeCollectionDesignPrototype(this.stageId, mode, {
        coins: this.state.coins,
        initialBikeId: this.collection.selectedBikeId,
        // 실제 컬렉션 진행 데이터 연결 (#201): 보유·신규 발견·전시 슬롯을 단일 상태로 공유
        ownedBikeIds: [...this.collection.ownedBikeIds],
        newBikeIds: [...this.collection.newBikeIds],
        showcaseSlots: [...this.collection.showcaseSlots],
        onShowcaseChange: (slots) => { this.collection.showcaseSlots = slots; },
        onBikeSeen: (bikeId) => markBikeSeen(this.collection, bikeId),
        onHome: () => this.show('home'),
        onCatalog: () => this.show('catalog'),
        onShowcase: () => this.show('showcase'),
        onDreamGrowth: () => this.show('dream'),
        onBikeDetail: (bikeId) => { this.collection.selectedBikeId = bikeId; this.show('dream'); },
        onCoinsChange: (coins) => { this.state.coins = coins; this.saveState(); this.refreshShell(); },
        onSfx: (event) => this.play(event === 'reward' ? 'reward' : event),
      });
      return;
    }
    if (screen === 'profile') {
      this.game = startProfileDesignPrototype(this.stageId, 'warm-id-card', { onHome: () => this.show('home'), onSfx: (event) => this.play(event) });
      return;
    }
    this.game = startSettingsDrawerPrototype(this.stageId, {
      toggles: { bgm: this.state.bgm, sfx: this.state.sfx, vibration: this.state.vibration },
      onHome: () => this.show('home'),
      onTutorial: () => { this.state.tutorialDone = false; this.saveState(); },
      onReset: () => {
        this.state = { ...DEFAULT_STATE };
        this.collection = createCollectionProgress();
        this.lastUnlock = undefined;
        localStorage.removeItem(STORAGE_KEY);
        window.setTimeout(() => this.show('title'), 0);
      },
      onToggle: (key, value) => {
        this.state[key] = value;
        this.audio.setEnabled(this.state.bgm, this.state.sfx);
        this.saveState();
        this.refreshShell();
      },
      onSfx: (event) => this.play(event),
    });
  }

  private advanceOrder() {
    this.state.orderIndex = (this.state.orderIndex + 1) % 2;
    this.saveState();
  }

  private play(event: ReleaseSfxEvent) {
    this.audio.unlock();
    this.audio.play(event);
  }

  private roomFor(screen: ReleaseScreen): ReleaseAudioRoom {
    if (screen === 'title') return 'title';
    if (screen === 'game' || screen === 'guide') return 'work';
    if (screen === 'reward') return 'reward';
    return 'home';
  }

  private refreshShell() {
    const label = this.parent.querySelector<HTMLElement>('#release-screen-label');
    const coins = this.parent.querySelector<HTMLElement>('#release-coins');
    const audio = this.parent.querySelector<HTMLButtonElement>('#release-audio');
    if (label) label.textContent = SCREEN_LABELS[this.screen];
    if (coins) coins.textContent = `COIN ${this.state.coins.toLocaleString()} · 납품 ${this.state.completedOrders}`;
    if (audio) audio.textContent = this.state.bgm ? '♫ BGM ON' : '♫ BGM OFF';
    this.parent.querySelectorAll<HTMLButtonElement>('[data-release-screen]').forEach((button) => button.classList.toggle('active', button.dataset.releaseScreen === this.screen));
  }

  private loadState(): ReleaseState {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<ReleaseState> | null;
      if (!saved || saved.version !== 1) return { ...DEFAULT_STATE };
      return { ...DEFAULT_STATE, ...saved };
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  private saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }
}

export function startMvpReleaseIntegration(parent: string) {
  const element = document.getElementById(parent);
  if (!element) throw new Error(`MVP release integration parent not found: ${parent}`);
  return new MvpReleaseIntegrationController(element);
}
