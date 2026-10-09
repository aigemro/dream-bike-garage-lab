import type { AuthSession } from './auth-provider';
import {
  createReadyDay,
  normalizeDayState,
  normalizeHistory,
  MAX_DAY_HISTORY,
  type CurrentDayState,
  type DayHistoryEntry,
} from './day-session-rules';
import {
  createCollectionProgress,
  createGrowthProgress,
  parseCollectionProgress,
  parseGrowthProgress,
  serializeCollectionProgress,
  serializeGrowthProgress,
  type CollectionProgress,
  type GrowthProgress,
} from './meta-progress';

// Day 규칙(상태·시간·정산)은 day-session-rules가 단일 기준입니다. 기존 import 경로 호환을 위해 다시 내보냅니다.
export {
  DAY_DURATION_MS,
  MAX_DAY_HISTORY,
  createReadyDay,
  type CurrentDayState,
  type DayEndReason,
  type DayHistoryEntry,
  type DayStatus,
} from './day-session-rules';

const PROFILE_KEY = 'dbg-lab-day-account-profiles-v1';
const PROGRESS_KEY_PREFIX = 'dbg-lab-day-account-progress-v1';
// 컬렉션·성장은 meta-progress 직렬화 규칙을 그대로 쓰되, 계정(playerId)별 키로 분리 저장합니다.
const COLLECTION_KEY_PREFIX = 'dbg-lab-day-account-collection-v1';
const GROWTH_KEY_PREFIX = 'dbg-lab-day-account-growth-v1';
// 머지 코어 E안 작업대(보드·체력·주문 진행)도 계정별로 저장해 다음 Day에 그대로 이어집니다.
const PLACEMENT_KEY_PREFIX = 'dbg-lab-day-account-placement-v1';
// 체력 소진 흐름(#263)의 오늘 광고·무료 충전 기록. 검증은 energy-refill의 parseRefillRecord가 맡습니다.
const REFILL_KEY_PREFIX = 'dbg-lab-day-account-refill-v1';

export type GameProfile = {
  playerId: string;
  accountId: string;
  nickname: string;
  garageName: string;
  createdAt: string;
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
  // 이전 버전 호환용 필드. 현재 선택 자전거는 계정별 컬렉션(selectedBikeId)이 기준입니다.
  selectedBikeId: string;
  settings: {
    bgm: boolean;
    sfx: boolean;
    vibration: boolean;
  };
  currentDayState: CurrentDayState;
  dayHistory: DayHistoryEntry[];
};

// localStorage 대체 가능한 최소 저장소 인터페이스 (테스트·서버 어댑터 교체용)
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

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
    // 손상된 이력 요소는 버리고 숫자 필드를 보정합니다 (renderAccountProfile의 toLocaleString 예외 방지)
    currentDayState: normalizeDayState(saved.currentDayState, fallback.currentDayState),
    dayHistory: normalizeHistory(saved.dayHistory),
  };
}

export class DayAccountRepository {
  // 마지막 저장 실패 메시지. 용량 초과·프라이빗 모드 등으로 setItem이 실패하면 기록되고,
  // 다음 저장이 성공하면 비워집니다. 셸이 이 값을 읽어 경고를 표시합니다.
  lastSaveError: string | null = null;

  // scope: 같은 계정이라도 Day 방안(B안 시간·C안 주문 수)마다 진행을 따로 저장하기 위한 구분값.
  // 빈 값이면 기존 B안 키를 그대로 씁니다. 계정 프로필은 방안과 관계없이 공유합니다.
  constructor(private readonly storage: KeyValueStorage = localStorage, private readonly scope = '') {}

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

  // 계정별 컬렉션(이해도·등록·제작·전시). 저장 원본이 없거나 손상되면 meta-progress 기본값으로 복구합니다.
  loadCollection(playerId: string): CollectionProgress {
    try {
      return parseCollectionProgress(this.storage.getItem(this.scopedKey(COLLECTION_KEY_PREFIX, playerId)));
    } catch {
      return createCollectionProgress();
    }
  }

  saveCollection(playerId: string, collection: CollectionProgress) {
    this.write(this.scopedKey(COLLECTION_KEY_PREFIX, playerId), serializeCollectionProgress(collection));
  }

  // 계정별 자전거 성장. 코인 차감과 같은 처리에서 함께 저장해야 강화 결과가 유실되지 않습니다.
  loadGrowth(playerId: string): GrowthProgress {
    try {
      return parseGrowthProgress(this.storage.getItem(this.scopedKey(GROWTH_KEY_PREFIX, playerId)));
    } catch {
      return createGrowthProgress();
    }
  }

  saveGrowth(playerId: string, growth: GrowthProgress) {
    this.write(this.scopedKey(GROWTH_KEY_PREFIX, playerId), serializeGrowthProgress(growth));
  }

  // 계정별 E안 작업대 원본(JSON 문자열). 검증·이전은 merge-placement-state의 restore가 맡습니다.
  loadPlacement(playerId: string): string | null {
    try {
      return this.storage.getItem(this.scopedKey(PLACEMENT_KEY_PREFIX, playerId));
    } catch {
      return null;
    }
  }

  savePlacement(playerId: string, raw: string) {
    this.write(this.scopedKey(PLACEMENT_KEY_PREFIX, playerId), raw);
    return this.lastSaveError === null;
  }

  loadRefill(playerId: string): string | null {
    try {
      return this.storage.getItem(this.scopedKey(REFILL_KEY_PREFIX, playerId));
    } catch {
      return null;
    }
  }

  saveRefill(playerId: string, raw: string) {
    this.write(this.scopedKey(REFILL_KEY_PREFIX, playerId), raw);
  }

  // 계정 진행 초기화는 Day·재화 진행과 컬렉션·성장·작업대를 함께 지웁니다. 다른 계정 슬롯은 건드리지 않습니다.
  resetProgress(playerId: string) {
    for (const key of [
      this.progressKey(playerId),
      this.scopedKey(COLLECTION_KEY_PREFIX, playerId),
      this.scopedKey(GROWTH_KEY_PREFIX, playerId),
      this.scopedKey(PLACEMENT_KEY_PREFIX, playerId),
      this.scopedKey(REFILL_KEY_PREFIX, playerId),
    ]) {
      try {
        this.storage.removeItem(key);
      } catch (error) {
        console.warn('[day-account] 진행 초기화 실패', error);
      }
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
    return this.scopedKey(PROGRESS_KEY_PREFIX, playerId);
  }

  private scopedKey(prefix: string, playerId: string) {
    return `${prefix}${this.scope ? `-${this.scope}` : ''}:${playerId}`;
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
