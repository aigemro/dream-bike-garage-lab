import type { AuthSession } from './auth-provider';

export const DAY_DURATION_MS = 5 * 60 * 1000;
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
    dayHistory: Array.isArray(saved.dayHistory) ? saved.dayHistory.slice(-14) as DayHistoryEntry[] : [],
  };
}

export class DayAccountRepository {
  getProfile(accountId: string): GameProfile | null {
    try {
      const profiles = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}') as Record<string, GameProfile>;
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
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
    return { ...profile };
  }

  loadProgress(playerId: string) {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.progressKey(playerId)) ?? 'null') as unknown;
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
      dayHistory: progress.dayHistory.map((entry) => ({ ...entry })).slice(-14),
    };
    localStorage.setItem(this.progressKey(progress.playerId), JSON.stringify(next));
    return next;
  }

  resetProgress(playerId: string) {
    localStorage.removeItem(this.progressKey(playerId));
    return createDefaultProgress(playerId);
  }

  private progressKey(playerId: string) {
    return `${PROGRESS_KEY_PREFIX}:${playerId}`;
  }

  private readProfiles() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}') as unknown;
      return parsed && typeof parsed === 'object' ? parsed as Record<string, GameProfile> : {};
    } catch {
      return {};
    }
  }
}
