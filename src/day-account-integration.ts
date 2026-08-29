import Phaser from 'phaser';
import { BrowserMockAuthProvider, type AuthProvider, type AuthSession } from './auth-provider';
import {
  DAY_DURATION_MS,
  DayAccountRepository,
  createReadyDay,
  type DayAccountProgress,
  type DayEndReason,
  type GameProfile,
} from './day-account-state';
import { startTitleLoadingPrototype } from './title-loading-design';
import { startHomeDesignPrototype } from './home-design-prototype';
import { startGuideOverlayPrototype } from './guide-overlay-design';
import { startGameScreenMobilePrototype } from './game-screen-mobile';
import { startBikeCollectionDesignPrototype, type BikeCollectionDesignMode } from './bike-collection-design-prototype';
import { startSettingsDrawerPrototype } from './settings-design';
import { ReleaseAudio, type ReleaseAudioRoom, type ReleaseSfxEvent } from './release-audio';

type DayAccountScreen = 'account' | 'profile-create' | 'title' | 'home' | 'guide' | 'day-ready' | 'game'
  | 'day-settlement' | 'catalog' | 'showcase' | 'dream' | 'profile' | 'settings';

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
  guide: '05 · 첫 플레이 안내',
  'day-ready': '06 · Day 시작 준비',
  game: '07 · 활성 플레이 시간',
  'day-settlement': '08 · Day 정산',
  catalog: '10A · 자전거 도감',
  showcase: '10B · Garage 전시',
  dream: '10C · 드림 바이크 성장',
  profile: '11 · 계정·작업 기록',
  settings: '12 · 설정',
};

function formatTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character]!);
}

export class DayAccountIntegrationController {
  private game?: Phaser.Game;
  private readonly audio = new ReleaseAudio();
  private readonly auth: AuthProvider = new BrowserMockAuthProvider();
  private readonly repository = new DayAccountRepository();
  private session: AuthSession | null = null;
  private profile: GameProfile | null = null;
  private state: DayAccountProgress | null = null;
  private screen: DayAccountScreen = 'account';
  private lastTickAt = 0;
  private lastCheckpointSecond = -1;
  private readonly stageId = `day-account-stage-${Math.random().toString(36).slice(2)}`;
  private readonly timerId: number;
  private readonly onVisibilityChange = () => this.handleVisibilityChange();

  constructor(private readonly parent: HTMLElement) {
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
    if (!this.session) {
      this.profile = null;
      this.state = null;
      return;
    }
    this.profile = this.repository.getProfile(this.session.accountId);
    this.state = this.profile ? this.repository.loadProgress(this.profile.playerId) : null;
  }

  private renderShell() {
    this.parent.innerHTML = `
      <section class="release-integration-shell day-account-shell">
        <header class="release-flow-header day-account-header">
          <div><span>LAB TEST CONTROLS</span><strong id="day-account-screen-label"></strong></div>
          <div class="release-state day-account-state">
            <button id="day-account-audio" type="button"></button>
            <button id="day-account-end" type="button">Lab · Day 종료</button>
            <button id="day-account-logout" type="button">로그아웃</button>
          </div>
        </header>
        <nav class="release-flow-nav" aria-label="Day·계정 통합 화면 바로가기">
          ${NAV.map((item) => `<button type="button" data-day-screen="${item.screen}">${item.label}</button>`).join('')}
        </nav>
        <div id="${this.stageId}" class="release-stage day-account-stage"></div>
        <footer class="release-flow-footer"><span>로그인 → 프로필 → Day 시작 → 주문·머지·납품 → 정산 → 다음 Day</span><strong>계정별 자동 저장 · 활성 플레이 시간</strong></footer>
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
    this.parent.querySelector<HTMLButtonElement>('#day-account-end')?.addEventListener('click', () => {
      if (!this.state || !['active', 'paused'].includes(this.state.currentDayState.status)) return;
      this.endDay('manual-test');
    });
    this.parent.querySelector<HTMLButtonElement>('#day-account-logout')?.addEventListener('click', () => void this.logout());
  }

  private show(screen: DayAccountScreen): void {
    if (!this.profile && screen !== 'account' && screen !== 'profile-create') {
      screen = this.session ? 'profile-create' : 'account';
    }
    if (this.screen === 'game' && screen !== 'game') this.pauseDay('screen-navigation');
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
    if (!this.state || !this.profile) return;

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
        dayNumber: this.state.currentDayState.dayNumber,
        dayRemainingMs: this.state.currentDayState.remainingMs,
        dayStatusLabel: this.dayStatusLabel(),
        onPlay: () => this.openPlay(),
        onCollection: () => this.show('catalog'),
        onShowcase: () => this.show('showcase'),
        onProfile: () => this.show('profile'),
        onSettings: () => this.show('settings'),
        onSfx: (event) => this.play(event),
      });
      return;
    }
    if (screen === 'day-ready') return this.renderDayReady(stage);
    if (screen === 'guide') {
      this.game = startGuideOverlayPrototype(this.stageId, {
        onFinish: () => {
          if (!this.state) return;
          this.state.tutorialDone = true;
          this.persist();
          this.show('game');
        },
        onSfx: (event) => this.play(event),
      });
      return;
    }
    if (screen === 'game') {
      this.resumeDay();
      this.game = startGameScreenMobilePrototype(this.stageId, {
        orderIndex: this.state.orderIndex,
        autoPlacement: this.state.autoPlacement,
        continuousOrders: true,
        getDaySummary: () => ({
          dayNumber: this.state?.currentDayState.dayNumber ?? 1,
          remainingMs: this.state?.currentDayState.remainingMs ?? 0,
          durationMs: DAY_DURATION_MS,
          earnings: this.state?.currentDayState.earnings ?? 0,
        }),
        onAutoPlacementChange: (enabled) => {
          if (!this.state) return;
          this.state.autoPlacement = enabled;
          this.persist();
        },
        onOrderComplete: (completedOrderIndex) => {
          if (!this.state) return;
          const reward = 1000 + completedOrderIndex * 400;
          this.state.completedOrders += 1;
          this.state.currentDayState.ordersCompleted += 1;
          this.state.currentDayState.earnings += reward;
          this.state.coins += reward;
          this.state.orderIndex = (completedOrderIndex + 1) % 2;
          this.persist();
          this.refreshShell();
          return { reward, totalDayIncome: this.state.currentDayState.earnings };
        },
        onSfx: (event) => this.play(event),
      });
      return;
    }
    if (screen === 'day-settlement') return this.renderDaySettlement(stage);
    if (screen === 'profile') return this.renderAccountProfile(stage);
    if (screen === 'catalog' || screen === 'showcase' || screen === 'dream') {
      const mode: BikeCollectionDesignMode = screen === 'catalog' ? 'warm-catalog' : screen === 'showcase' ? 'warm-showcase' : 'warm-dream-growth';
      this.game = startBikeCollectionDesignPrototype(this.stageId, mode, {
        coins: this.state.coins,
        initialBikeId: this.state.selectedBikeId,
        onHome: () => this.show('home'),
        onCatalog: () => this.show('catalog'),
        onShowcase: () => this.show('showcase'),
        onDreamGrowth: () => this.show('dream'),
        onBikeDetail: (bikeId) => {
          if (!this.state) return;
          this.state.selectedBikeId = bikeId;
          this.persist();
          this.show('dream');
        },
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
        this.state = this.repository.resetProgress(this.profile.playerId);
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

  private renderAccount(stage: HTMLElement) {
    stage.innerHTML = `
      <section class="day-account-panel account-login-panel">
        <p class="day-account-eyebrow">BROWSER MOCK AUTH · ISSUE #211</p>
        <h2>정비사 계정으로 로그인</h2>
        <p>실제 비밀번호를 저장하지 않는 Lab 테스트입니다. 계정마다 프로필·Day·코인·주문 진행이 분리됩니다.</p>
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
          this.audio.unlock();
          this.show(this.profile ? (this.state?.currentDayState.status === 'settlement' ? 'day-settlement' : 'title') : 'profile-create');
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
        this.profile = this.repository.createProfile(this.session!, nickname, garageName);
        this.state = this.repository.loadProgress(this.profile.playerId);
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
        <h2>오늘의 공방 문을 열까요?</h2>
        <p>Lab 테스트용 활성 플레이 시간 ${formatTime(DAY_DURATION_MS)}가 지나면 오늘 수입 정산으로 이동합니다. 홈·설정·수집·백그라운드에서는 시간이 멈춥니다.</p>
        <div class="day-goal-grid"><div><span>오늘 검증</span><strong>납품·정산 전환</strong></div><div><span>현재 코인</span><strong>${this.state.coins.toLocaleString()}</strong></div><div><span>지난 기록</span><strong>${this.state.dayHistory.length}일</strong></div></div>
        <button id="start-day" class="day-account-primary" type="button">DAY ${day.dayNumber} START</button>
      </section>`;
    stage.querySelector<HTMLButtonElement>('#start-day')?.addEventListener('click', () => this.startDay());
  }

  private renderDaySettlement(stage: HTMLElement) {
    if (!this.state || !this.profile) return;
    const day = this.state.currentDayState;
    const reason = day.endReason === 'time-limit' ? '영업 시간이 종료되었습니다.' : 'Lab 검증으로 Day를 조기 종료했습니다.';
    stage.innerHTML = `
      <section class="day-account-panel day-settlement-panel">
        <p class="day-account-eyebrow">DAY ${day.dayNumber} · SETTLEMENT r${day.settlementRevision ?? this.state.revision}</p>
        <h2>${escapeHtml(this.profile.nickname)} 정비사, 오늘도 수고했어요!</h2>
        <p>${reason} 미완료 주문 번호는 다음 Day로 이월하고, 임시 보드는 초기화하는 B안 검증 규칙을 적용합니다.</p>
        <div class="settlement-income"><span>오늘 수입</span><strong>+ ${day.earnings.toLocaleString()} COIN</strong></div>
        <div class="settlement-grid"><div><span>완료 주문</span><strong>${day.ordersCompleted}건</strong></div><div><span>종료 Day</span><strong>DAY ${day.dayNumber}</strong></div><div><span>활성 시간</span><strong>${formatTime(day.elapsedActiveMs)}</strong></div><div><span>누적 코인</span><strong>${this.state.coins.toLocaleString()}</strong></div></div>
        <button id="prepare-next-day" class="day-account-primary" type="button">DAY ${day.dayNumber + 1} 준비하기</button>
        <button id="settlement-profile" type="button">작업 기록 보기</button>
      </section>`;
    stage.querySelector<HTMLButtonElement>('#prepare-next-day')?.addEventListener('click', () => this.prepareNextDay());
    stage.querySelector<HTMLButtonElement>('#settlement-profile')?.addEventListener('click', () => this.show('profile'));
  }

  private renderAccountProfile(stage: HTMLElement) {
    if (!this.state || !this.profile || !this.session) return;
    const recent = [...this.state.dayHistory].reverse().slice(0, 4);
    stage.innerHTML = `
      <section class="day-account-panel account-profile-panel">
        <p class="day-account-eyebrow">PLAYER ACCOUNT · GAME PROGRESS</p>
        <div class="profile-id-card"><div><span>정비사</span><strong>${escapeHtml(this.profile.nickname)}</strong><em>${escapeHtml(this.profile.garageName)}</em></div><div><span>계정</span><strong>${escapeHtml(this.session.displayLabel)}</strong><em>${escapeHtml(this.profile.playerId)}</em></div></div>
        <div class="profile-progress-grid"><div><span>현재 Day</span><strong>${this.state.currentDayState.dayNumber}</strong></div><div><span>누적 납품</span><strong>${this.state.completedOrders}</strong></div><div><span>코인</span><strong>${this.state.coins.toLocaleString()}</strong></div><div><span>저장 revision</span><strong>${this.state.revision}</strong></div></div>
        <div class="day-history-list"><h3>최근 Day 기록</h3>${recent.length ? recent.map((entry) => `<p><strong>DAY ${entry.dayNumber}</strong><span>주문 ${entry.ordersCompleted} · 급여 ${entry.earnings.toLocaleString()} · ${formatTime(entry.elapsedActiveMs)}</span></p>`).join('') : '<p><span>아직 정산된 Day가 없습니다.</span></p>'}</div>
        <button id="profile-home" class="day-account-primary" type="button">Garage Home</button>
      </section>`;
    stage.querySelector<HTMLButtonElement>('#profile-home')?.addEventListener('click', () => this.show('home'));
  }

  private openPlay() {
    if (!this.state) return this.show(this.session ? 'profile-create' : 'account');
    const status = this.state.currentDayState.status;
    if (status === 'settlement') return this.show('day-settlement');
    if (status === 'ready' || status === 'completed') return this.show('day-ready');
    this.show(this.state.tutorialDone ? 'game' : 'guide');
  }

  private startDay() {
    if (!this.state) return;
    const dayNumber = this.state.currentDayState.dayNumber;
    this.state.currentDayState = {
      ...createReadyDay(dayNumber),
      status: 'active',
      startedAt: new Date().toISOString(),
    };
    this.lastTickAt = performance.now();
    this.lastCheckpointSecond = -1;
    this.persist();
    this.show(this.state.tutorialDone ? 'game' : 'guide');
  }

  private tickDay() {
    if (!this.state || this.screen !== 'game' || document.hidden || this.state.currentDayState.status !== 'active') {
      this.lastTickAt = performance.now();
      return;
    }
    const now = performance.now();
    const delta = this.lastTickAt ? Math.min(1000, now - this.lastTickAt) : 0;
    this.lastTickAt = now;
    const day = this.state.currentDayState;
    day.elapsedActiveMs += delta;
    day.remainingMs = Math.max(0, day.remainingMs - delta);
    const checkpointSecond = Math.floor(day.remainingMs / 5000);
    if (checkpointSecond !== this.lastCheckpointSecond) {
      this.lastCheckpointSecond = checkpointSecond;
      this.persist();
    }
    this.refreshShell();
    if (day.remainingMs <= 0) this.endDay('time-limit');
  }

  private pauseDay(reason: string) {
    if (!this.state || this.state.currentDayState.status !== 'active') return;
    this.state.currentDayState.status = 'paused';
    this.state.currentDayState.pauseReason = reason;
    this.persist();
    this.refreshShell();
  }

  private resumeDay() {
    if (!this.state) return;
    const day = this.state.currentDayState;
    if (day.status !== 'paused' && day.status !== 'active') return;
    day.status = 'active';
    day.pauseReason = null;
    this.lastTickAt = performance.now();
    this.persist();
    this.refreshShell();
  }

  private endDay(reason: DayEndReason) {
    if (!this.state) return;
    const day = this.state.currentDayState;
    if (day.status === 'settlement' || day.status === 'completed' || day.status === 'ready') return;
    const settlementRevision = this.state.revision + 1;
    day.status = 'settlement';
    day.pauseReason = null;
    day.endReason = reason;
    day.settlementRevision = settlementRevision;
    if (reason === 'time-limit') day.remainingMs = 0;
    if (!this.state.dayHistory.some((entry) => entry.dayNumber === day.dayNumber)) {
      this.state.dayHistory.push({
        dayNumber: day.dayNumber,
        startedAt: day.startedAt ?? new Date().toISOString(),
        endedAt: new Date().toISOString(),
        elapsedActiveMs: day.elapsedActiveMs,
        ordersCompleted: day.ordersCompleted,
        earnings: day.earnings,
        endReason: reason,
        settlementRevision,
      });
    }
    this.persist();
    this.show('day-settlement');
  }

  private prepareNextDay() {
    if (!this.state || this.state.currentDayState.status !== 'settlement') return;
    this.state.currentDayState.status = 'completed';
    const nextNumber = this.state.currentDayState.dayNumber + 1;
    this.state.currentDayState = createReadyDay(nextNumber);
    this.persist();
    this.show('home');
  }

  private async logout() {
    this.pauseDay('logout');
    this.persist();
    await this.auth.logout();
    this.session = null;
    this.profile = null;
    this.state = null;
    this.audio.setEnabled(true, true);
    this.show('account');
  }

  private handleVisibilityChange() {
    if (document.hidden) this.pauseDay('background');
    else if (this.screen === 'game' && this.state?.currentDayState.status === 'paused' && this.state.currentDayState.pauseReason === 'background') this.resumeDay();
  }

  private persist() {
    if (!this.state) return;
    this.state = this.repository.saveProgress(this.state);
  }

  private play(event: ReleaseSfxEvent) {
    this.audio.unlock();
    this.audio.play(event);
  }

  private roomFor(screen: DayAccountScreen): ReleaseAudioRoom {
    if (screen === 'title' || screen === 'account' || screen === 'profile-create') return 'title';
    if (screen === 'game' || screen === 'guide' || screen === 'day-ready') return 'work';
    if (screen === 'day-settlement') return 'reward';
    return 'home';
  }

  private refreshShell() {
    const label = this.parent.querySelector<HTMLElement>('#day-account-screen-label');
    const audio = this.parent.querySelector<HTMLButtonElement>('#day-account-audio');
    const end = this.parent.querySelector<HTMLButtonElement>('#day-account-end');
    const logout = this.parent.querySelector<HTMLButtonElement>('#day-account-logout');
    if (label) label.textContent = SCREEN_LABELS[this.screen];
    if (audio) {
      audio.textContent = this.state?.settings.bgm === false ? '♫ OFF' : '♫ ON';
      audio.disabled = !this.state;
    }
    if (end) end.hidden = !this.state || !['active', 'paused'].includes(this.state.currentDayState.status);
    if (logout) logout.hidden = !this.session;
    this.parent.querySelectorAll<HTMLButtonElement>('[data-day-screen]').forEach((button) => {
      button.disabled = !this.profile;
      const destination = button.dataset.dayScreen;
      button.classList.toggle('active', destination === this.screen || (destination === 'game' && ['guide', 'day-ready', 'day-settlement'].includes(this.screen)));
    });
  }

  private dayStatusLabel() {
    const status = this.state?.currentDayState.status;
    if (status === 'active') return '영업 중';
    if (status === 'paused') return '일시정지';
    if (status === 'settlement') return '정산';
    return '준비';
  }
}

export function startDayAccountIntegration(parent: string) {
  const element = document.getElementById(parent);
  if (!element) throw new Error(`Day account integration parent not found: ${parent}`);
  return new DayAccountIntegrationController(element);
}
