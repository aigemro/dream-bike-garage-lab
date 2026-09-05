import type { AuthSession } from './auth-provider';

// Lab에서 Day 종료·정산·다음 Day 전환을 빠르게 반복 검증하기 위한 축약 시간입니다.
export const DAY_DURATION_MS = 10 * 1000;
const PROFILE_KEY = 'dbg-lab-day-account-profiles-v1';
const PROGRESS_KEY_PREFIX = 'dbg-lab-day-account-progress-v1';

export type DayStatus = 'ready' | 'active' | 'paused' | 'settlement' | 'completed';
export type DayEndReason = 'time-limit' | 'manual-test';

export type GameProfile = {
  playerId: string;
  accountId: string;
  nickname: string;
  garageName: string;
  createdAt: string;
};

export type DayHistoryEntry = {
  dayNumber: number;
  startedAt: string;
  endedAt: string;
  elapsedActiveMs: number;
  ordersCompleted: number;
  earnings: number;
  endReason: DayEndReason;
  settlementRevision: number;
};

export type CurrentDayState = {
  dayNumber: number;
  status: DayStatus;
  startedAt: string | null;
  elapsedActiveMs: number;
  remainingMs: number;
  pauseReason: string | null;
  ordersCompleted: number;
  earnings: number;
  endReason: DayEndReason | null;
  settlementRevision: number | null;
};

export type DayAccountProgress = {
  schemaVersion: 1;
  revision: number;
  savedAt: string;
  playerId: string;
  coins: number;
  completedOrders: number;
  orderIndex: number;
  tutorialDone: boolean;
  autoPlacement: boolean;
  selectedBikeId: string;
  settings: {
    bgm: boolean;
    sfx: boolean;
    vibration: boolean;
  };
  currentDayState: CurrentDayState;
  dayHistory: DayHistoryEntry[];
};

const DAY_STATUSES: DayStatus[] = ['ready', 'active', 'paused', 'settlement', 'completed'];
// 계정 화면·정산 이력에 보관하는 최대 Day 수
export const MAX_DAY_HISTORY = 14;

// localStorage 대체 가능한 최소 저장소 인터페이스 (테스트·서버 어댑터 교체용)
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function createReadyDay(dayNumber = 1): CurrentDayState {
  return {
    dayNumber,
    status: 'ready',
    startedAt: null,
    elapsedActiveMs: 0,
    remainingMs: DAY_DURATION_MS,
    pauseReason: null,
    ordersCompleted: 0,
    earnings: 0,
    endReason: null,
    settlementRevision: null,
  };
}

export function createDefaultProgress(playerId: string): DayAccountProgress {
  return {
    schemaVersion: 1,
    revision: 0,
    savedAt: new Date(0).toISOString(),
    playerId,
    coins: 2480,
    completedOrders: 0,
    orderIndex: 0,
    tutorialDone: false,
    autoPlacement: false,
    selectedBikeId: 'dream-road',
    settings: { bgm: true, sfx: true, vibration: false },
    currentDayState: createReadyDay(1),
    dayHistory: [],
  };
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeDay(value: unknown, fallback: CurrentDayState): CurrentDayState {
  if (!value || typeof value !== 'object') return fallback;
  const day = value as Partial<CurrentDayState>;
  const status = DAY_STATUSES.includes(day.status as DayStatus) ? day.status as DayStatus : fallback.status;
  const dayNumber = Math.max(1, Math.floor(numberOr(day.dayNumber, fallback.dayNumber)));
  const remainingMs = Math.min(DAY_DURATION_MS, Math.max(0, numberOr(day.remainingMs, fallback.remainingMs)));
  return {
    dayNumber,
    status,
    startedAt: typeof day.startedAt === 'string' ? day.startedAt : null,
    elapsedActiveMs: Math.max(0, numberOr(day.elapsedActiveMs, fallback.elapsedActiveMs)),
    remainingMs,
    pauseReason: typeof day.pauseReason === 'string' ? day.pauseReason : null,
    ordersCompleted: Math.max(0, Math.floor(numberOr(day.ordersCompleted, 0))),
    earnings: Math.max(0, Math.floor(numberOr(day.earnings, 0))),
    endReason: day.endReason === 'time-limit' || day.endReason === 'manual-test' ? day.endReason : null,
    settlementRevision: typeof day.settlementRevision === 'number' ? day.settlementRevision : null,
  };
}

// 손상된 이력 요소는 버리고, 숫자·문자열 필드는 안전한 값으로 보정합니다.
// (요소 검증 없이 캐스팅하면 renderAccountProfile의 toLocaleString에서 예외가 납니다)
function normalizeHistoryEntry(value: unknown): DayHistoryEntry | null {
  if (!value || typeof value !== 'object') return null;
  const entry = value as Partial<DayHistoryEntry>;
  if (typeof entry.dayNumber !== 'number' || !Number.isFinite(entry.dayNumber) || entry.dayNumber < 1) return null;
  const fallbackTime = new Date(0).toISOString();
  return {
    dayNumber: Math.floor(entry.dayNumber),
    startedAt: typeof entry.startedAt === 'string' ? entry.startedAt : fallbackTime,
    endedAt: typeof entry.endedAt === 'string' ? entry.endedAt : fallbackTime,
    elapsedActiveMs: Math.max(0, numberOr(entry.elapsedActiveMs, 0)),
    ordersCompleted: Math.max(0, Math.floor(numberOr(entry.ordersCompleted, 0))),
    earnings: Math.max(0, Math.floor(numberOr(entry.earnings, 0))),
    endReason: entry.endReason === 'time-limit' || entry.endReason === 'manual-test' ? entry.endReason : 'manual-test',
    settlementRevision: Math.max(0, Math.floor(numberOr(entry.settlementRevision, 0))),
  };
}

function normalizeHistory(value: unknown): DayHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeHistoryEntry(entry))
    .filter((entry): entry is DayHistoryEntry => entry !== null)
    .slice(-MAX_DAY_HISTORY);
}

function normalizeProgress(value: unknown, playerId: string): DayAccountProgress {
  const fallback = createDefaultProgress(playerId);
  if (!value || typeof value !== 'object') return fallback;
  const saved = value as Partial<DayAccountProgress>;
  if (saved.schemaVersion !== 1 || saved.playerId !== playerId) return fallback;
  return {
    ...fallback,
    revision: Math.max(0, Math.floor(numberOr(saved.revision, 0))),
    savedAt: typeof saved.savedAt === 'string' ? saved.savedAt : fallback.savedAt,
    coins: Math.max(0, Math.floor(numberOr(saved.coins, fallback.coins))),
    completedOrders: Math.max(0, Math.floor(numberOr(saved.completedOrders, 0))),
    orderIndex: Math.max(0, Math.floor(numberOr(saved.orderIndex, 0))),
    tutorialDone: Boolean(saved.tutorialDone),
    autoPlacement: Boolean(saved.autoPlacement),
    selectedBikeId: typeof saved.selectedBikeId === 'string' ? saved.selectedBikeId : fallback.selectedBikeId,
    settings: {
      bgm: saved.settings?.bgm ?? fallback.settings.bgm,
      sfx: saved.settings?.sfx ?? fallback.settings.sfx,
      vibration: saved.settings?.vibration ?? fallback.settings.vibration,
    },
    currentDayState: normalizeDay(saved.currentDayState, fallback.currentDayState),
    dayHistory: normalizeHistory(saved.dayHistory),
  };
}

export class DayAccountRepository {
  // 마지막 저장 실패 메시지. 용량 초과·프라이빗 모드 등으로 setItem이 실패하면 기록되고,
  // 다음 저장이 성공하면 비워집니다. 셸이 이 값을 읽어 경고를 표시합니다.
  lastSaveError: string | null = null;

  constructor(private readonly storage: KeyValueStorage = localStorage) {}

  getProfile(accountId: string): GameProfile | null {
    try {
      const profiles = JSON.parse(this.storage.getItem(PROFILE_KEY) ?? '{}') as Record<string, GameProfile>;
      const profile = profiles[accountId];
      if (!profile || profile.accountId !== accountId || typeof profile.playerId !== 'string') return null;
      return { ...profile };
    } catch {
      return null;
    }
  }

  createProfile(session: AuthSession, nickname: string, garageName: string): GameProfile {
    const existing = this.getProfile(session.accountId);
    if (existing) return existing;
    const cleanNickname = nickname.trim().slice(0, 12);
    const cleanGarageName = garageName.trim().slice(0, 18);
    if (!cleanNickname || !cleanGarageName) throw new Error('닉네임과 Garage 이름을 모두 입력하세요.');
    const profile: GameProfile = {
      playerId: `player-${session.providerUserKey}`,
      accountId: session.accountId,
      nickname: cleanNickname,
      garageName: cleanGarageName,
      createdAt: new Date().toISOString(),
    };
    const profiles = this.readProfiles();
    profiles[session.accountId] = profile;
    this.write(PROFILE_KEY, JSON.stringify(profiles));
    return { ...profile };
  }

  loadProgress(playerId: string) {
    try {
      const parsed = JSON.parse(this.storage.getItem(this.progressKey(playerId)) ?? 'null') as unknown;
      return normalizeProgress(parsed, playerId);
    } catch {
      return createDefaultProgress(playerId);
    }
  }

  saveProgress(progress: DayAccountProgress) {
    const next: DayAccountProgress = {
      ...progress,
      revision: progress.revision + 1,
      savedAt: new Date().toISOString(),
      currentDayState: { ...progress.currentDayState },
      settings: { ...progress.settings },
      dayHistory: progress.dayHistory.map((entry) => ({ ...entry })).slice(-MAX_DAY_HISTORY),
    };
    // 저장이 실패해도 메모리 상태는 계속 진행합니다 (250ms 틱마다 예외가 나며 화면 전환이 끊기지 않도록).
    this.write(this.progressKey(progress.playerId), JSON.stringify(next));
    return next;
  }

  resetProgress(playerId: string) {
    try {
      this.storage.removeItem(this.progressKey(playerId));
    } catch (error) {
      console.warn('[day-account] 진행 초기화 실패', error);
    }
    return createDefaultProgress(playerId);
  }

  private write(key: string, value: string) {
    try {
      this.storage.setItem(key, value);
      this.lastSaveError = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.lastSaveError !== message) console.warn('[day-account] 저장 실패', error);
      this.lastSaveError = message;
    }
  }

  private progressKey(playerId: string) {
    return `${PROGRESS_KEY_PREFIX}:${playerId}`;
  }

  private readProfiles() {
    try {
      const parsed = JSON.parse(this.storage.getItem(PROFILE_KEY) ?? '{}') as unknown;
      return parsed && typeof parsed === 'object' ? parsed as Record<string, GameProfile> : {};
    } catch {
      return {};
    }
  }
}
