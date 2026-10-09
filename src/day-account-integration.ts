import Phaser from 'phaser';
import { BrowserMockAuthProvider, type AuthProvider, type AuthSession } from './auth-provider';
import { DayAccountRepository, type DayAccountProgress, type GameProfile } from './day-account-state';
import {
  DAY_DURATION_MS,
  DAY_DURATION_PRESETS_MS,
  DAY_ORDER_TARGET,
  DAY_ORDER_TARGET_PRESETS,
  canAcceptPlayInput,
  createReadyDay,
  formatDayClock,
  normalizeDurationMs,
  normalizeRestoredDay,
  pauseDay,
  prepareNextDay,
  recordOrderDelivery,
  resumeDay,
  settleDay,
  startDay,
  tickDay,
  trackActiveTime,
  type DayEndReason,
  type DayPauseReason,
} from './day-session-rules';
import { startTitleLoadingPrototype } from './title-loading-design';
import { startHomeDesignPrototype } from './home-design-prototype';
import { startPlacementForDay } from './merge-placement-prototype';
import { REFILL_LABELS, parseRefillRecord, type RefillMode } from './energy-refill';
import { startBikeCollectionDesignPrototype, type BikeCollectionDesignMode } from './bike-collection-design-prototype';
import { startSettingsDrawerPrototype } from './settings-design';
import { ReleaseAudio, type ReleaseAudioRoom, type ReleaseSfxEvent } from './release-audio';
import { RIVERSIDE_RACE, daysUntilRace, isRaceDay, nextRaceDay } from './race-progress';
import {
  ORDER_METAS,
  applyBikeUpgrade,
  applyCraftPart,
  applyOrderDelivery,
  bikeStats,
  computeNextGoal,
  craftedBikeCount,
  dreamGradeName,
  dreamStage,
  dreamTotalLevel,
  markBikeSeen,
  orderMetaAt,
  type CollectionProgress,
  type CraftPartType,
  type DreamStatKey,
  type GrowthProgress,
} from './meta-progress';
import { CATALOG_SIZE, catalogBikeById } from './bike-catalog';

type DayAccountScreen = 'account' | 'profile-create' | 'title' | 'home' | 'day-ready' | 'game'
  | 'day-settlement' | 'catalog' | 'showcase' | 'dream' | 'profile' | 'settings';

// Day 시간이 '진행 중'으로 취급되는 플레이 화면
// (작업대는 머지 코어 E v3입니다. 이전 C안 택배 안내 오버레이는 E안 조작과 맞지 않아 쓰지 않고, 첫 안내는 작업대 안내 문구가 맡습니다.)
const PLAY_SCREENS: DayAccountScreen[] = ['game'];
// Lab 측정용 Day 길이 선택값(브라우저 공통). 계정 진행에는 Day를 시작할 때 고정된 길이만 저장합니다.
const DAY_DURATION_SETTING_KEY = 'dbg-lab-day-duration-ms-v1';
// C안 Lab 측정용 하루 주문 수 선택값(브라우저 공통). Day를 시작할 때 고정된 값만 계정 진행에 저장합니다.
const DAY_ORDER_TARGET_SETTING_KEY = 'dbg-lab-day-order-target-v1';
// C안에서 주문 수를 채운 뒤 납품 도장 연출을 보여 주고 정산 화면으로 넘어가기까지의 시간
const ORDER_TARGET_SETTLE_DELAY_MS = 1800;

// Day가 끝나는 기준: B안 활성 플레이 시간(time) · C안 하루 주문 수(orders)
export type DayLimitMode = 'time' | 'orders';

const NAV: Array<{ screen: DayAccountScreen; label: string }> = [
  { screen: 'home', label: 'HOME' },
  { screen: 'game', label: 'PLAY' },
  { screen: 'catalog', label: '수집 A' },
  { screen: 'showcase', label: '수집 B' },
  { screen: 'dream', label: '성장 C' },
  { screen: 'profile', label: '내 계정' },
  { screen: 'settings', label: '설정' },
];

const SCREEN_LABELS: Record<DayAccountScreen, string> = {
  account: '01 · Lab 계정 로그인',
  'profile-create': '02 · 최초 게임 프로필 생성',
  title: '03 · 타이틀·로딩',
  home: '04 · 계정 Garage 홈',
  'day-ready': '06 · Day 시작 준비',
  game: '07 · 활성 플레이 시간',
  'day-settlement': '08 · Day 정산',
  catalog: '10A · 자전거 도감',
  showcase: '10B · Garage 전시',
  dream: '10C · 드림 바이크 성장',
  profile: '11 · 계정·작업 기록',
  settings: '12 · 설정',
};

const PAUSE_LABELS: Record<DayPauseReason, string> = {
  background: '앱 전환',
  'screen-navigation': '화면 이동',
  logout: '로그아웃',
  destroy: '데모 종료',
  restore: '다시 열기',
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character]!);
}

function durationLabel(durationMs: number) {
  return durationMs < 60_000 ? `${Math.round(durationMs / 1000)}초` : `${Math.round(durationMs / 60_000)}분`;
}

function loadOrderTargetSetting() {
  try {
    const saved = Number(localStorage.getItem(DAY_ORDER_TARGET_SETTING_KEY));
    return DAY_ORDER_TARGET_PRESETS.includes(saved as typeof DAY_ORDER_TARGET_PRESETS[number]) ? saved : DAY_ORDER_TARGET;
  } catch {
    return DAY_ORDER_TARGET;
  }
}

function loadDayDurationSetting() {
  try {
    const saved = Number(localStorage.getItem(DAY_DURATION_SETTING_KEY));
    return DAY_DURATION_PRESETS_MS.includes(saved as typeof DAY_DURATION_PRESETS_MS[number]) ? saved : DAY_DURATION_MS;
  } catch {
    return DAY_DURATION_MS;
  }
}

export class DayAccountIntegrationController {
  private game?: Phaser.Game;
  private readonly audio = new ReleaseAudio();
  private readonly auth: AuthProvider = new BrowserMockAuthProvider();
  private readonly repository: DayAccountRepository;
  private session: AuthSession | null = null;
  private profile: GameProfile | null = null;
  private state: DayAccountProgress | null = null;
  // 계정별 컬렉션·성장. 로그인한 계정의 슬롯에서만 읽고 씁니다.
  private collection: CollectionProgress | null = null;
  private growth: GrowthProgress | null = null;
  private screen: DayAccountScreen = 'account';
  private lastTickAt = 0;
  private lastCheckpointBucket = -1;
  private dayDurationMs = loadDayDurationSetting();
  // C안: 다음에 시작하는 Day의 주문 수 (B안이면 null)
  private orderTarget: number | null;
  private closingAt = 0;
  private readonly stageId = `day-account-stage-${Math.random().toString(36).slice(2)}`;
  private readonly timerId: number;
  private readonly onVisibilityChange = () => this.handleVisibilityChange();

  constructor(private readonly parent: HTMLElement, private readonly mode: DayLimitMode = 'time', private readonly refill?: RefillMode) {
    this.orderTarget = mode === 'orders' ? loadOrderTargetSetting() : null;
    // 같은 계정이라도 B안·C안 진행은 따로 저장해 두 방안을 섞지 않고 비교합니다.
    // 체력 소진 흐름(#263) 방안도 방안마다 진행을 나눕니다.
    this.repository = new DayAccountRepository(localStorage, mode === 'orders' ? (refill ? `order-count-refill-${refill}` : 'order-count') : '');
    this.session = this.auth.getSession();
    this.restoreAccountContext();
    this.audio.setEnabled(this.state?.settings.bgm ?? true, this.state?.settings.sfx ?? true);
    this.renderShell();
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.timerId = window.setInterval(() => this.tickDay(), 250);
    this.show(this.initialScreen());
  }

  destroy(_removeCanvas?: boolean) {
    window.clearInterval(this.timerId);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    // 데모 초기화·라우트 이탈로 파기될 때 'active' 상태가 저장되지 않도록 먼저 일시정지합니다.
    this.pauseCurrentDay('destroy');
    this.persist();
    this.game?.destroy(true);
    this.audio.destroy();
    this.parent.innerHTML = '';
  }

  private initialScreen(): DayAccountScreen {
    if (!this.session) return 'account';
    if (!this.profile || !this.state) return 'profile-create';
    if (this.state.currentDayState.status === 'settlement') return 'day-settlement';
    return 'title';
  }

  private restoreAccountContext() {
    this.profile = this.session ? this.repository.getProfile(this.session.accountId) : null;
    if (!this.profile) {
      this.state = null;
      this.collection = null;
      this.growth = null;
      return;
    }
    this.state = this.repository.loadProgress(this.profile.playerId);
    this.collection = this.repository.loadCollection(this.profile.playerId);
    this.growth = this.repository.loadGrowth(this.profile.playerId);
    this.applyRestoreRules();
  }

  // 새로고침·재로그인으로 다시 열린 Day를 안전한 상태로 맞춥니다.
  // 진행 중(active)이던 Day는 일시정지로, 마감 중(closing)이던 Day는 바로 시간 종료 정산합니다.
  private applyRestoreRules() {
    if (!this.state) return;
    const saved = this.state.currentDayState;
    let restored = normalizeRestoredDay(saved);
    // 아직 시작하지 않은 Day는 Lab에서 선택한 Day 길이로 표시를 맞춥니다 (진행 중인 Day는 그대로).
    if (restored.status === 'ready' && (restored.durationMs !== this.dayDurationMs || restored.orderTarget !== this.orderTarget)) {
      restored = createReadyDay(restored.dayNumber, this.dayDurationMs, this.orderTarget);
    }
    if (restored.status === 'closing') {
      this.state.currentDayState = restored;
      this.settleCurrentDay(this.closingReason());
      return;
    }
    if (restored === saved) return;
    this.state.currentDayState = restored;
    this.persist();
  }

  private renderShell() {
    this.parent.innerHTML = `
      <section class="release-integration-shell day-account-shell">
        <header class="release-flow-header day-account-header">
          <div><span>LAB TEST CONTROLS</span><strong id="day-account-screen-label"></strong></div>
          <div class="release-state day-account-state">
            <button id="day-account-audio" type="button"></button>
            <button id="day-account-duration" type="button" title="다음에 시작하는 Day의 제한 시간 또는 주문 수 (Lab 측정용)"></button>
            <button id="day-account-end" type="button">Lab · Day 종료</button>
            ${this.refill ? '<button id="day-account-drain" type="button" title="작업대 체력을 0으로 만들어 소진 흐름을 바로 확인합니다 (Lab 측정용)">Lab · 체력 0</button>' : ''}
            <button id="day-account-logout" type="button">로그아웃</button>
          </div>
        </header>
        <nav class="release-flow-nav" aria-label="Day·계정 통합 화면 바로가기">
          ${NAV.map((item) => `<button type="button" data-day-screen="${item.screen}">${item.label}</button>`).join('')}
        </nav>
        <div id="${this.stageId}" class="release-stage day-account-stage"></div>
        <footer class="release-flow-footer"><span>로그인 → 프로필 → Day 시작 → 주문·머지·납품 → 정산 → 다음 Day</span><strong>계정별 자동 저장 · ${this.mode === 'orders' ? '주문 N건 = 하루 일정' : '활성 플레이 시간'}${this.refill ? ` · 체력 소진 ${REFILL_LABELS[this.refill]}` : ''}</strong></footer>
      </section>`;

    this.parent.querySelectorAll<HTMLButtonElement>('[data-day-screen]').forEach((button) => {
      button.addEventListener('click', () => {
        this.play('tap');
        const destination = button.dataset.dayScreen as DayAccountScreen;
        if (destination === 'game') this.openPlay();
        else this.show(destination);
      });
    });
    this.parent.querySelector<HTMLButtonElement>('#day-account-audio')?.addEventListener('click', () => {
      if (!this.state) return;
      this.state.settings.bgm = !this.state.settings.bgm;
      this.audio.unlock();
      this.audio.setEnabled(this.state.settings.bgm, this.state.settings.sfx);
      this.persist();
      this.refreshShell();
    });
    this.parent.querySelector<HTMLButtonElement>('#day-account-duration')?.addEventListener('click', () => (this.mode === 'orders' ? this.cycleOrderTarget() : this.cycleDayDuration()));
    this.parent.querySelector<HTMLButtonElement>('#day-account-end')?.addEventListener('click', () => {
      if (!this.state || !['active', 'paused', 'closing'].includes(this.state.currentDayState.status)) return;
      this.endDay('manual-test');
    });
    this.parent.querySelector<HTMLButtonElement>('#day-account-logout')?.addEventListener('click', () => void this.logout());
    this.parent.querySelector<HTMLButtonElement>('#day-account-drain')?.addEventListener('click', () => this.drainEnergyForTest());
  }

  // Lab 측정용: 작업대 체력과 무료 상자를 0으로 만듭니다.
  // 작업대가 열려 있으면 장면에 직접 요청합니다(Phaser 게임 파기는 다음 프레임에 저장하므로 저장본을 고치면 덮어써짐).
  private drainEnergyForTest() {
    if (!this.profile) return;
    const scene = this.screen === 'game' ? this.game?.scene.getScene('merge-placement-e-v3') as unknown as { labDrain?: () => void } | undefined : undefined;
    if (scene?.labDrain) { scene.labDrain(); return; }
    const playerId = this.profile.playerId;
    try {
      const saved = JSON.parse(this.repository.loadPlacement(playerId) ?? 'null') as { energy?: number; anchor?: number; freeBoxes?: number } | null;
      if (!saved) return;
      saved.energy = 0;
      saved.anchor = Date.now();
      saved.freeBoxes = 0;
      this.repository.savePlacement(playerId, JSON.stringify(saved));
    } catch {
      // 저장본이 손상됐으면 작업대가 새로 시작할 때 기본값을 씁니다.
    }
  }

  private show(screen: DayAccountScreen): void {
    if (!this.profile && screen !== 'account' && screen !== 'profile-create') {
      screen = this.session ? 'profile-create' : 'account';
    }
    // 플레이 화면을 벗어나 다른 화면으로 가면 Day를 일시정지합니다.
    if (PLAY_SCREENS.includes(this.screen) && !PLAY_SCREENS.includes(screen)) this.pauseCurrentDay('screen-navigation');
    this.game?.destroy(true);
    this.game = undefined;
    this.screen = screen;
    const stage = this.parent.querySelector<HTMLElement>(`#${this.stageId}`);
    if (!stage) return;
    stage.innerHTML = '';
    this.audio.setRoom(this.roomFor(screen));
    this.refreshShell();

    if (screen === 'account') return this.renderAccount(stage);
    if (screen === 'profile-create') return this.renderProfileCreate(stage);
    if (!this.state || !this.profile || !this.collection || !this.growth) return;
    const collection = this.collection;

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
        progress: this.buildHomeProgress(),
        dayNumber: this.state.currentDayState.dayNumber,
        dayRemainingMs: this.state.currentDayState.remainingMs,
        dayStatusLabel: this.dayStatusLabel(),
        dayProgressLabel: this.dayProgressLabel(),
        onPlay: () => this.openPlay(),
        onCraft: (bikeId) => { collection.selectedBikeId = bikeId; this.saveCollection(); this.show('dream'); },
        onHeroBike: (bikeId) => { collection.selectedBikeId = bikeId; this.saveCollection(); this.show('dream'); },
        onCollection: () => this.show('catalog'),
        onShowcase: () => this.show('showcase'),
        onProfile: () => this.show('profile'),
        onSettings: () => this.show('settings'),
        onSfx: (event) => this.play(event),
      });
      return;
    }
    if (screen === 'day-ready') return this.renderDayReady(stage);
    if (screen === 'game') {
      this.resumeCurrentDay();
      const playerId = this.profile.playerId;
      // 머지 코어 E v3 작업대. Day는 '입력 허용 여부'와 '확정된 납품'만 주고받습니다(적용안 4.2 계약).
      // E안은 납품을 행동 시점에 확정하므로, 시간이 끝나면 마감 대기 없이 바로 정산합니다.
      this.game = startPlacementForDay(this.stageId, {
        load: () => this.repository.loadPlacement(playerId),
        save: (raw) => this.repository.savePlacement(playerId, raw),
        initialOrder: this.state.orderIndex,
        getDay: () => {
          const day = this.state?.currentDayState;
          return {
            dayNumber: day?.dayNumber ?? 1,
            remainingMs: day?.remainingMs ?? 0,
            durationMs: day?.durationMs ?? DAY_DURATION_MS,
            earnings: day?.earnings ?? 0,
            closing: day?.status === 'closing',
            orders: day && day.orderTarget !== null ? { done: day.ordersCompleted, target: day.orderTarget } : undefined,
          };
        },
        isInputLocked: () => !this.state || !canAcceptPlayInput(this.state.currentDayState),
        onOrderDelivered: ({ orderIndex }) => this.completeOrder(orderIndex),
        onSfx: (event) => this.play(event),
        refill: this.refill ? {
          mode: this.refill,
          loadRecord: () => parseRefillRecord(this.repository.loadRefill(playerId)),
          saveRecord: (record) => this.repository.saveRefill(playerId, JSON.stringify(record)),
          onRest: (target) => this.show(target),
          onHome: () => this.show('home'),
        } : undefined,
      });
      return;
    }
    if (screen === 'day-settlement') return this.renderDaySettlement(stage);
    if (screen === 'profile') return this.renderAccountProfile(stage);
    if (screen === 'catalog' || screen === 'showcase' || screen === 'dream') {
      const mode: BikeCollectionDesignMode = screen === 'catalog' ? 'warm-catalog' : screen === 'showcase' ? 'warm-showcase' : 'warm-dream-growth';
      this.game = startBikeCollectionDesignPrototype(this.stageId, mode, {
        coins: this.state.coins,
        initialBikeId: collection.selectedBikeId,
        // 계정별 컬렉션 진행을 그대로 연결합니다 (릴리스 통합과 같은 규칙, 저장 위치만 계정 슬롯).
        ownedBikeIds: [...collection.craftedBikeIds],
        registeredBikeIds: [...collection.registeredBikeIds],
        understandingByBikeId: { ...collection.understandingByBikeId },
        craftPartsByBikeId: Object.fromEntries(Object.entries(collection.craftPartsByBikeId).map(([id, parts]) => [id, [...parts]])),
        // 자전거 만들기: 코인 차감과 부품 장착을 한 번에 적용·저장하고 결과만 화면에 돌려줍니다.
        onCraftPart: (bikeId: string, part: CraftPartType) => {
          if (!this.state) return { ok: false, reason: 'unknown' as const, coins: 0, installedParts: [], completed: false };
          const result = applyCraftPart(collection, this.state.coins, bikeId, part);
          if (result.ok) {
            this.state.coins = result.coins;
            this.saveCollection();
            this.persist();
            this.refreshShell();
            return { ok: true, coins: result.coins, installedParts: [...result.installedParts], completed: result.completed };
          }
          return {
            ok: false,
            reason: result.reason,
            coins: result.coins,
            installedParts: [...(collection.craftPartsByBikeId[bikeId] ?? [])],
            completed: false,
          };
        },
        newBikeIds: [...collection.newBikeIds],
        showcaseSlots: [...collection.showcaseSlots],
        onShowcaseChange: (slots) => { collection.showcaseSlots = slots; this.saveCollection(); },
        onBikeSeen: (bikeId) => { markBikeSeen(collection, bikeId); this.saveCollection(); },
        // 자전거 강화: 코인 차감과 강화 반영을 같은 처리에서 저장합니다.
        // (이전 Day 데모는 이 훅이 없어 코인만 차감·저장되고 강화 단계는 화면을 나가면 사라졌습니다)
        dreamStats: bikeStats(this.growth, collection.selectedBikeId),
        onDreamUpgrade: (stat: DreamStatKey) => this.upgradeSelectedBike(stat),
        onHome: () => this.show('home'),
        onCatalog: () => this.show('catalog'),
        onShowcase: () => this.show('showcase'),
        onDreamGrowth: () => this.show('dream'),
        onBikeDetail: (bikeId) => { collection.selectedBikeId = bikeId; this.saveCollection(); this.show('dream'); },
        onCoinsChange: (coins) => {
          if (!this.state) return;
          this.state.coins = coins;
          this.persist();
          this.refreshShell();
        },
        onSfx: (event) => this.play(event === 'reward' ? 'reward' : event),
      });
      return;
    }
    this.game = startSettingsDrawerPrototype(this.stageId, {
      toggles: { ...this.state.settings },
      onHome: () => this.show('home'),
      onTutorial: () => {
        if (!this.state) return;
        this.state.tutorialDone = false;
        this.persist();
      },
      onReset: () => {
        if (!this.profile) return;
        // 이 계정의 Day·재화·컬렉션·성장만 초기화합니다.
        this.state = this.repository.resetProgress(this.profile.playerId);
        this.collection = this.repository.loadCollection(this.profile.playerId);
        this.growth = this.repository.loadGrowth(this.profile.playerId);
        this.audio.setEnabled(this.state.settings.bgm, this.state.settings.sfx);
        window.setTimeout(() => this.show('title'), 0);
      },
      onToggle: (key, value) => {
        if (!this.state) return;
        this.state.settings[key] = value;
        this.audio.setEnabled(this.state.settings.bgm, this.state.settings.sfx);
        this.persist();
        this.refreshShell();
      },
      onSfx: (event) => this.play(event),
    });
  }

  // 납품 확정: 코인·누적 납품·이해도는 즉시 반영하고, Day 통계는 정산 전까지 기록합니다.
  private completeOrder(completedOrderIndex: number) {
    if (!this.state || !this.collection) return;
    const reward = orderMetaAt(completedOrderIndex)?.reward ?? 1000 + completedOrderIndex * 400;
    this.state.coins += reward;
    this.state.completedOrders += 1;
    this.state.orderIndex = (completedOrderIndex + 1) % ORDER_METAS.length;
    const record = recordOrderDelivery(this.state.currentDayState, reward);
    this.state.currentDayState = record.day;
    // C안: 오늘 주문 수를 채우면 입력을 막고, 납품 도장을 보여 준 뒤 정산합니다(tickDay).
    if (record.targetReached) this.closingAt = performance.now();
    applyOrderDelivery(this.collection, completedOrderIndex);
    this.saveCollection();
    this.persist();
    this.refreshShell();
    return { reward, totalDayIncome: this.state.currentDayState.earnings };
  }

  private upgradeSelectedBike(stat: DreamStatKey) {
    const collection = this.collection!;
    const growth = this.growth!;
    const coins = this.state?.coins ?? 0;
    const result = applyBikeUpgrade(collection, growth, coins, collection.selectedBikeId, stat);
    if (result.ok && this.state) {
      this.growth = result.growth;
      this.state.coins = result.coins;
      this.saveGrowth();
      this.persist();
      this.refreshShell();
    }
    return {
      ok: result.ok,
      reason: result.ok ? undefined : result.reason,
      coins: result.coins,
      stats: { ...result.stats },
      stageUp: result.ok ? result.stageUp : false,
    };
  }

  private renderAccount(stage: HTMLElement) {
    stage.innerHTML = `
      <section class="day-account-panel account-login-panel">
        <p class="day-account-eyebrow">BROWSER MOCK AUTH · ISSUE #211</p>
        <h2>정비사 계정으로 로그인</h2>
        <p>실제 비밀번호를 저장하지 않는 Lab 테스트입니다. 계정마다 프로필·Day·코인·주문·컬렉션·성장 진행이 분리됩니다.</p>
        <div class="mock-account-grid">
          ${this.auth.listAccounts().map((account) => `
            <button type="button" data-mock-account="${account.accountId}">
              <strong>${account.displayLabel}</strong><span>${account.description}</span><em>${account.providerUserKey}</em>
            </button>`).join('')}
        </div>
        <p id="day-account-message" class="day-account-message">운영 적용 시 앱인토스 인증 어댑터와 서버 게임 프로필 조회로 교체합니다.</p>
      </section>`;
    stage.querySelectorAll<HTMLButtonElement>('[data-mock-account]').forEach((button) => {
      button.addEventListener('click', async () => {
        const message = stage.querySelector<HTMLElement>('#day-account-message');
        try {
          this.session = await this.auth.login(button.dataset.mockAccount ?? '');
          this.restoreAccountContext();
          // 계정별 BGM·SFX 설정을 즉시 적용합니다 (로그아웃 시 true/true로 리셋된 값이 남지 않도록)
          this.audio.setEnabled(this.state?.settings.bgm ?? true, this.state?.settings.sfx ?? true);
          this.audio.unlock();
          this.show(this.initialScreen());
        } catch (error) {
          if (message) message.textContent = error instanceof Error ? error.message : '로그인에 실패했습니다.';
        }
      });
    });
  }

  private renderProfileCreate(stage: HTMLElement): void {
    if (!this.session) return this.show('account');
    stage.innerHTML = `
      <section class="day-account-panel profile-create-panel">
        <p class="day-account-eyebrow">FIRST LOGIN · GAME PROFILE</p>
        <h2>나의 Garage 만들기</h2>
        <p><strong>${escapeHtml(this.session.displayLabel)}</strong>에 연결할 게임 프로필을 한 번만 생성합니다.</p>
        <label>정비사 닉네임<input id="profile-nickname" maxlength="12" value="두리" /></label>
        <label>Garage 이름<input id="profile-garage" maxlength="18" value="두리 자전거 공방" /></label>
        <button id="profile-create" class="day-account-primary" type="button">프로필 생성하고 시작</button>
        <p id="profile-create-message" class="day-account-message">계정 식별 정보와 게임 진행 데이터는 분리해 저장합니다.</p>
      </section>`;
    stage.querySelector<HTMLButtonElement>('#profile-create')?.addEventListener('click', () => {
      const nickname = stage.querySelector<HTMLInputElement>('#profile-nickname')?.value ?? '';
      const garageName = stage.querySelector<HTMLInputElement>('#profile-garage')?.value ?? '';
      const message = stage.querySelector<HTMLElement>('#profile-create-message');
      try {
        this.repository.createProfile(this.session!, nickname, garageName);
        this.restoreAccountContext();
        this.persist();
        this.show('title');
      } catch (error) {
        if (message) message.textContent = error instanceof Error ? error.message : '프로필 생성에 실패했습니다.';
      }
    });
  }

  private renderDayReady(stage: HTMLElement) {
    if (!this.state || !this.profile) return;
    const day = this.state.currentDayState;
    stage.innerHTML = `
      <section class="day-account-panel day-ready-panel">
        <p class="day-account-eyebrow">${escapeHtml(this.profile.garageName)} · WORK PLAN</p>
        <div class="day-number-badge">DAY ${day.dayNumber}</div>
        <h2>오늘 공방을 열까요?</h2>
        <p>${this.orderTarget !== null
          ? `주문 ${this.orderTarget}건을 납품하면 오늘 일정이 끝나고 정산합니다. 시간 제한은 없고, 알바 체력이 떨어지면 다음에 이어서 영업합니다.`
          : `${formatDayClock(this.dayDurationMs)} 동안 플레이하면 오늘 수입을 정산합니다. 게임 밖에서는 시간이 멈춥니다.`}</p>
        ${this.renderDayCalendar(day.dayNumber)}
        <div class="day-goal-grid"><div><span>오늘 영업</span><strong>${this.orderTarget !== null ? `주문 ${this.orderTarget}건` : durationLabel(this.dayDurationMs)}</strong></div><div><span>현재 코인</span><strong>${this.state.coins.toLocaleString()}</strong></div><div><span>지난 기록</span><strong>${this.state.dayHistory.length}일</strong></div></div>
        <button id="start-day" class="day-account-primary" type="button">DAY ${day.dayNumber} START</button>
      </section>`;
    stage.querySelector<HTMLButtonElement>('#start-day')?.addEventListener('click', () => this.beginDay());
  }

  // 공방 달력 (#231 후속): 대회 주기(5일)에 맞춘 한 줄 5칸 달력으로 대회일을 표시합니다.
  // 패널이 스크롤 없이 스테이지에 맞아야 하므로(#230) 현재 주기 한 줄만 보여주고,
  // 다음 대회 일정은 머리글의 D-day 문구로 전달합니다.
  private renderDayCalendar(dayNumber: number): string {
    const cycle = RIVERSIDE_RACE.heldEveryDays;
    const calendarStart = Math.floor((dayNumber - 1) / cycle) * cycle + 1;
    const calendarDays = Array.from({ length: cycle }, (_, index) => calendarStart + index);
    const dday = daysUntilRace(dayNumber);
    const raceNote = dday === 0
      ? `오늘 ${RIVERSIDE_RACE.name} 개최!`
      : `다음 대회 D-${dday} · DAY ${nextRaceDay(dayNumber)}`;
    const cells = calendarDays.map((n) => {
      const classes = ['day-calendar-cell'];
      if (n === dayNumber) classes.push('today');
      if (isRaceDay(n)) classes.push('race');
      if (n < dayNumber) classes.push('past');
      const tag = isRaceDay(n) ? '<em>대회</em>' : n === dayNumber ? '<em class="today-tag">오늘</em>' : '';
      return `<div class="${classes.join(' ')}"><span>${n}</span>${tag}</div>`;
    }).join('');
    return `
      <div class="day-calendar">
        <div class="day-calendar-head"><span>공방 달력</span><strong>${raceNote}</strong></div>
        <div class="day-calendar-grid">${cells}</div>
      </div>`;
  }

  private renderDaySettlement(stage: HTMLElement) {
    if (!this.state || !this.profile) return;
    const day = this.state.currentDayState;
    const reason = day.endReason === 'time-limit'
      ? '영업 시간이 종료되었습니다.'
      : day.endReason === 'order-target'
        ? `오늘 주문 ${day.orderTarget}건을 모두 납품했습니다.`
        : 'Lab 검증으로 Day를 조기 종료했습니다.';
    stage.innerHTML = `
      <section class="day-account-panel day-settlement-panel">
        <p class="day-account-eyebrow">DAY ${day.dayNumber} · SETTLEMENT r${day.settlementRevision ?? this.state.revision}</p>
        <h2>${escapeHtml(this.profile.nickname)} 정비사, 오늘도 수고했어요!</h2>
        <p>${reason} 미완료 주문과 작업대 부품·알바 체력(E안)은 계정에 저장되어 다음 Day에 그대로 이어집니다.</p>
        <div class="settlement-income"><span>오늘 수입</span><strong>+ ${day.earnings.toLocaleString()} COIN</strong></div>
        <div class="settlement-grid"><div><span>완료 주문</span><strong>${day.ordersCompleted}건</strong></div><div><span>종료 Day</span><strong>DAY ${day.dayNumber}</strong></div><div><span>활성 시간</span><strong>${formatDayClock(day.elapsedActiveMs)}</strong></div><div><span>누적 코인</span><strong>${this.state.coins.toLocaleString()}</strong></div></div>
        <button id="prepare-next-day" class="day-account-primary" type="button">DAY ${day.dayNumber + 1} 준비하기</button>
        <button id="settlement-profile" type="button">작업 기록 보기</button>
      </section>`;
    stage.querySelector<HTMLButtonElement>('#prepare-next-day')?.addEventListener('click', () => this.goToNextDay());
    stage.querySelector<HTMLButtonElement>('#settlement-profile')?.addEventListener('click', () => this.show('profile'));
  }

  private renderAccountProfile(stage: HTMLElement) {
    if (!this.state || !this.profile || !this.session) return;
    const recent = [...this.state.dayHistory].reverse().slice(0, 3);
    stage.innerHTML = `
      <section class="day-account-panel account-profile-panel">
        <p class="day-account-eyebrow">PLAYER ACCOUNT · GAME PROGRESS</p>
        <div class="profile-id-card"><div><span>정비사</span><strong>${escapeHtml(this.profile.nickname)}</strong><em>${escapeHtml(this.profile.garageName)}</em></div><div><span>계정</span><strong>${escapeHtml(this.session.displayLabel)}</strong><em>${escapeHtml(this.profile.playerId)}</em></div></div>
        <div class="profile-progress-grid"><div><span>현재 Day</span><strong>${this.state.currentDayState.dayNumber}</strong></div><div><span>누적 납품</span><strong>${this.state.completedOrders}</strong></div><div><span>코인</span><strong>${this.state.coins.toLocaleString()}</strong></div><div><span>저장 revision</span><strong>${this.state.revision}</strong></div></div>
        <div class="day-history-list"><h3>최근 Day 기록 · 3일</h3>${recent.length ? recent.map((entry) => `<p><strong>DAY ${entry.dayNumber}</strong><span>주문 ${entry.ordersCompleted} · 급여 ${entry.earnings.toLocaleString()} · ${formatDayClock(entry.elapsedActiveMs)}</span></p>`).join('') : '<p><span>아직 정산된 Day가 없습니다.</span></p>'}</div>
        <button id="profile-home" class="day-account-primary" type="button">Garage Home</button>
      </section>`;
    stage.querySelector<HTMLButtonElement>('#profile-home')?.addEventListener('click', () => this.show('home'));
  }

  // 홈 화면에 표시할 계정별 메타 루프 진행 요약 (릴리스 통합과 같은 규칙)
  private buildHomeProgress() {
    const collection = this.collection!;
    const growth = this.growth!;
    const orderMeta = orderMetaAt(this.state?.orderIndex ?? 0) ?? ORDER_METAS[0];
    const goal = computeNextGoal(collection, growth);
    const selectedCrafted = collection.craftedBikeIds.includes(collection.selectedBikeId);
    const hero = (selectedCrafted ? catalogBikeById(collection.selectedBikeId) : undefined) ?? catalogBikeById('dream-road')!;
    const heroStats = bikeStats(growth, hero.id);
    return {
      ownedCount: craftedBikeCount(collection),
      catalogSize: CATALOG_SIZE,
      orderName: orderMeta.name,
      orderCategory: orderMeta.bikeCategory,
      orderReward: orderMeta.reward,
      nextGoalLabel: goal.kind === 'understand' ? goal.bikeName
        : goal.kind === 'craft' ? `${goal.bikeName} 제작`
        : goal.kind === 'upgrade' ? `${goal.bikeName} ${goal.stat} 강화`
        : '주문 반복 플레이',
      nextGoalHint: goal.kind === 'understand'
        ? `이해도 ${goal.understanding}% · 납품 ${goal.deliveriesLeft}회 남음`
        : goal.kind === 'craft'
          ? `다음 부품 ${goal.partName} · ${goal.cost.toLocaleString()}코인`
          : goal.kind === 'upgrade'
            ? `강화 비용 ${goal.cost.toLocaleString()}코인`
            : '모든 목표 달성 · 급여를 모아보세요',
      craft: goal.kind === 'craft'
        ? { bikeId: goal.bikeId, bikeName: goal.bikeName, installedCount: goal.installedCount, totalParts: goal.totalParts }
        : undefined,
      growthPercent: Math.round((dreamTotalLevel(heroStats) - 3) / 9 * 100),
      heroBike: {
        id: hero.id,
        name: hero.name,
        category: hero.category,
        color: hero.color,
        grade: dreamGradeName(heroStats),
        stage: dreamStage(heroStats),
      },
    };
  }

  private openPlay() {
    if (!this.state) return this.show(this.session ? 'profile-create' : 'account');
    const status = this.state.currentDayState.status;
    if (status === 'closing') return this.endDay('time-limit');
    if (status === 'settlement') return this.show('day-settlement');
    if (status === 'ready' || status === 'completed') return this.show('day-ready');
    this.show('game');
  }

  private beginDay() {
    if (!this.state) return;
    const started = startDay(this.state.currentDayState, new Date().toISOString(), this.dayDurationMs, this.orderTarget);
    if (started === this.state.currentDayState) return;
    this.state.currentDayState = started;
    this.lastTickAt = performance.now();
    this.lastCheckpointBucket = -1;
    this.persist();
    this.show('game');
  }

  private tickDay() {
    const now = performance.now();
    if (!this.state) {
      this.lastTickAt = now;
      return;
    }
    const day = this.state.currentDayState;
    if (day.status === 'closing') {
      this.lastTickAt = now;
      // C안은 마지막 주문의 납품 도장을 잠깐 보여 준 뒤 정산합니다.
      const showingStamp = day.orderTarget !== null && this.screen === 'game' && !document.hidden && now - this.closingAt < ORDER_TARGET_SETTLE_DELAY_MS;
      if (!showingStamp) this.endDay(this.closingReason());
      return;
    }
    if (this.screen !== 'game' || document.hidden || day.status !== 'active') {
      this.lastTickAt = now;
      return;
    }
    const delta = this.lastTickAt ? Math.min(1000, now - this.lastTickAt) : 0;
    this.lastTickAt = now;
    if (day.orderTarget !== null) {
      // C안: 시간 제한 없이 영업 시간만 기록하고, 5초마다 저장합니다.
      const tracked = trackActiveTime(day, delta);
      this.state.currentDayState = tracked;
      const bucket = Math.floor(tracked.elapsedActiveMs / 5000);
      if (bucket !== this.lastCheckpointBucket) {
        this.lastCheckpointBucket = bucket;
        this.persist();
      }
      return;
    }
    const { day: next, timeUp } = tickDay(day, delta);
    this.state.currentDayState = next;
    if (timeUp) {
      // E안 작업대는 납품을 행동 시점에 확정하므로 미확정 납품이 없습니다. 바로 시간 종료 정산합니다.
      this.persist();
      this.endDay('time-limit');
      return;
    }
    const checkpointBucket = Math.floor(next.remainingMs / 5000);
    if (checkpointBucket !== this.lastCheckpointBucket) {
      this.lastCheckpointBucket = checkpointBucket;
      this.persist();
    }
    this.refreshShell();
  }

  private pauseCurrentDay(reason: DayPauseReason) {
    if (!this.state) return;
    const paused = pauseDay(this.state.currentDayState, reason);
    if (paused === this.state.currentDayState) return;
    this.state.currentDayState = paused;
    this.persist();
    this.refreshShell();
  }

  private resumeCurrentDay() {
    if (!this.state) return;
    this.lastTickAt = performance.now();
    const resumed = resumeDay(this.state.currentDayState);
    if (resumed === this.state.currentDayState) return;
    this.state.currentDayState = resumed;
    this.persist();
    this.refreshShell();
  }

  // 정산은 Day마다 한 번만 적용됩니다. 화면 전환 없이 상태만 확정합니다.
  private settleCurrentDay(reason: DayEndReason) {
    if (!this.state) return false;
    const result = settleDay(this.state.currentDayState, this.state.dayHistory, {
      reason,
      endedAt: new Date().toISOString(),
      settlementRevision: this.state.revision + 1,
    });
    if (!result.settled) return false;
    this.state.currentDayState = result.day;
    this.state.dayHistory = result.history;
    this.persist();
    return true;
  }

  private endDay(reason: DayEndReason) {
    if (!this.settleCurrentDay(reason)) return;
    this.show('day-settlement');
  }

  private goToNextDay() {
    if (!this.state) return;
    const next = prepareNextDay(this.state.currentDayState, this.dayDurationMs, this.orderTarget);
    if (next === this.state.currentDayState) return;
    this.state.currentDayState = next;
    this.persist();
    this.show('home');
  }

  // Lab 측정 도구: 다음에 시작하는 Day의 제한 시간을 10초 → 1분 → 3분 순서로 바꿉니다.
  private cycleDayDuration() {
    const index = DAY_DURATION_PRESETS_MS.findIndex((value) => value === this.dayDurationMs);
    this.dayDurationMs = normalizeDurationMs(DAY_DURATION_PRESETS_MS[(index + 1) % DAY_DURATION_PRESETS_MS.length]);
    try {
      localStorage.setItem(DAY_DURATION_SETTING_KEY, String(this.dayDurationMs));
    } catch {
      // 저장이 막혀도 현재 탭에서는 선택값을 그대로 씁니다.
    }
    // 아직 시작하지 않은 Day는 표시 시간도 새 길이로 맞춥니다. 진행 중인 Day는 바꾸지 않습니다.
    if (this.state?.currentDayState.status === 'ready') {
      this.state.currentDayState = createReadyDay(this.state.currentDayState.dayNumber, this.dayDurationMs);
      this.persist();
    }
    this.refreshShell();
    if (this.screen === 'day-ready' || this.screen === 'home') this.show(this.screen);
  }

  // C안 Lab 측정 도구: 다음에 시작하는 Day의 주문 수를 2 → 3 → 5건 순서로 바꿉니다.
  private cycleOrderTarget() {
    const index = DAY_ORDER_TARGET_PRESETS.findIndex((value) => value === this.orderTarget);
    this.orderTarget = DAY_ORDER_TARGET_PRESETS[(index + 1) % DAY_ORDER_TARGET_PRESETS.length];
    try {
      localStorage.setItem(DAY_ORDER_TARGET_SETTING_KEY, String(this.orderTarget));
    } catch {
      // 저장이 막혀도 현재 탭에서는 선택값을 그대로 씁니다.
    }
    if (this.state?.currentDayState.status === 'ready') {
      this.state.currentDayState = createReadyDay(this.state.currentDayState.dayNumber, this.dayDurationMs, this.orderTarget);
      this.persist();
    }
    this.refreshShell();
    if (this.screen === 'day-ready' || this.screen === 'home') this.show(this.screen);
  }

  private closingReason(): DayEndReason {
    return (this.state?.currentDayState.orderTarget ?? null) !== null ? 'order-target' : 'time-limit';
  }

  private async logout() {
    this.pauseCurrentDay('logout');
    this.persist();
    await this.auth.logout();
    this.session = null;
    this.profile = null;
    this.state = null;
    this.collection = null;
    this.growth = null;
    this.audio.setEnabled(true, true);
    this.show('account');
  }

  private handleVisibilityChange() {
    if (document.hidden) this.pauseCurrentDay('background');
    else if (this.screen === 'game' && this.state?.currentDayState.status === 'paused' && this.state.currentDayState.pauseReason === 'background') this.resumeCurrentDay();
  }

  private persist() {
    if (!this.state) return;
    this.state = this.repository.saveProgress(this.state);
  }

  private saveCollection() {
    if (this.profile && this.collection) this.repository.saveCollection(this.profile.playerId, this.collection);
  }

  private saveGrowth() {
    if (this.profile && this.growth) this.repository.saveGrowth(this.profile.playerId, this.growth);
  }

  private play(event: ReleaseSfxEvent) {
    this.audio.unlock();
    this.audio.play(event);
  }

  private roomFor(screen: DayAccountScreen): ReleaseAudioRoom {
    if (screen === 'title' || screen === 'account' || screen === 'profile-create') return 'title';
    if (screen === 'game' || screen === 'day-ready') return 'work';
    if (screen === 'day-settlement') return 'reward';
    return 'home';
  }

  private refreshShell() {
    const label = this.parent.querySelector<HTMLElement>('#day-account-screen-label');
    const audio = this.parent.querySelector<HTMLButtonElement>('#day-account-audio');
    const duration = this.parent.querySelector<HTMLButtonElement>('#day-account-duration');
    const end = this.parent.querySelector<HTMLButtonElement>('#day-account-end');
    const logout = this.parent.querySelector<HTMLButtonElement>('#day-account-logout');
    const screenLabel = this.screen === 'game' && this.mode === 'orders' ? '07 · 오늘 일정 (주문 N건)' : SCREEN_LABELS[this.screen];
    if (label) label.textContent = screenLabel + (this.repository.lastSaveError ? ' · ⚠ 저장 실패 (메모리 진행만 유지)' : '');
    if (audio) {
      audio.textContent = this.state?.settings.bgm === false ? '♫ OFF' : '♫ ON';
      audio.disabled = !this.state;
    }
    if (duration) {
      duration.textContent = this.orderTarget !== null ? `주문 ${this.orderTarget}건` : `Day ${durationLabel(this.dayDurationMs)}`;
      duration.disabled = !this.state;
    }
    if (end) end.hidden = !this.state || !['active', 'paused', 'closing'].includes(this.state.currentDayState.status);
    if (logout) logout.hidden = !this.session;
    this.parent.querySelectorAll<HTMLButtonElement>('[data-day-screen]').forEach((button) => {
      button.disabled = !this.profile;
      const destination = button.dataset.dayScreen;
      button.classList.toggle('active', destination === this.screen || (destination === 'game' && ['day-ready', 'day-settlement'].includes(this.screen)));
    });
  }

  // 홈 상단에 남은 시간 대신 보여 줄 C안 주문 진행 (B안이면 undefined)
  private dayProgressLabel() {
    const day = this.state?.currentDayState;
    if (!day || day.orderTarget === null) return undefined;
    return `주문 ${Math.min(day.ordersCompleted, day.orderTarget)}/${day.orderTarget}`;
  }

  private dayStatusLabel() {
    const day = this.state?.currentDayState;
    if (!day) return '준비';
    if (day.status === 'active') return '영업 중';
    if (day.status === 'paused') return day.pauseReason ? `일시정지 · ${PAUSE_LABELS[day.pauseReason]}` : '일시정지';
    if (day.status === 'closing') return '마감 중';
    if (day.status === 'settlement') return '정산';
    return '준비';
  }
}

export function startDayAccountIntegration(parent: string, mode: DayLimitMode = 'time', refill?: RefillMode) {
  const element = document.getElementById(parent);
  if (!element) throw new Error(`Day account integration parent not found: ${parent}`);
  return new DayAccountIntegrationController(element, mode, refill);
}
