// Day 세션 순수 규칙 (B안 · 활성 플레이 시간 + 소프트 Day 종료)
// 시간 차감·일시정지·마감·정산·다음 Day 전환만 다루며 DOM·Phaser·저장소에 의존하지 않습니다.
// 머지 코어(보드 모델·부품 공급 방식)가 바뀌어도 그대로 쓸 수 있도록, 플레이 쪽에서는
// "확정된 납품 결과(recordOrderDelivery)"와 "입력 허용 여부(canAcceptPlayInput)"만 주고받습니다.

// Lab에서 Day 종료·정산·다음 Day 전환을 빠르게 반복 검증하기 위한 기본 시간입니다.
export const DAY_DURATION_MS = 10 * 1000;
// Lab 측정용 Day 길이 후보. 최종 값은 메인 기획에서 결정합니다(1일 주문 2~3건 목표).
export const DAY_DURATION_PRESETS_MS = [10 * 1000, 60 * 1000, 3 * 60 * 1000] as const;
const MIN_DAY_DURATION_MS = 1000;
const MAX_DAY_DURATION_MS = 30 * 60 * 1000;
// 시간 종료 시점에 진행 중이던 장착·납품 처리를 마무리할 수 있도록 기다리는 최대 시간
export const DAY_CLOSING_GRACE_MS = 3000;
// 계정 화면·정산 이력에 보관하는 최대 Day 수
export const MAX_DAY_HISTORY = 14;

// closing: 시간이 0이 되어 새 입력은 막고, 이미 시작된 납품 처리만 마무리하는 짧은 마감 단계
// completed: 이전 버전에서 다음 Day 준비 직전에 잠깐 쓰던 상태 (저장 데이터 호환용)
export type DayStatus = 'ready' | 'active' | 'paused' | 'closing' | 'settlement' | 'completed';
export type DayEndReason = 'time-limit' | 'manual-test';
export type DayPauseReason = 'background' | 'screen-navigation' | 'logout' | 'destroy' | 'restore';

export type CurrentDayState = {
  dayNumber: number;
  status: DayStatus;
  // Day를 시작할 때 고정한 제한 시간. 진행 중에 설정을 바꿔도 현재 Day에는 영향이 없습니다.
  durationMs: number;
  startedAt: string | null;
  elapsedActiveMs: number;
  remainingMs: number;
  pauseReason: DayPauseReason | null;
  ordersCompleted: number;
  earnings: number;
  endReason: DayEndReason | null;
  settlementRevision: number | null;
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

const DAY_STATUSES: DayStatus[] = ['ready', 'active', 'paused', 'closing', 'settlement', 'completed'];
const PAUSE_REASONS: DayPauseReason[] = ['background', 'screen-navigation', 'logout', 'destroy', 'restore'];
// 납품을 Day 통계에 반영하는 상태. 일시정지·마감 중 확정된 납품도 잃지 않도록 포함합니다.
const ORDER_RECORDING_STATUSES: DayStatus[] = ['active', 'paused', 'closing'];
const SETTLEABLE_STATUSES: DayStatus[] = ['active', 'paused', 'closing'];

function numberOr(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function normalizeDurationMs(value: unknown, fallback = DAY_DURATION_MS): number {
  const duration = Math.floor(numberOr(value, fallback));
  return Math.min(MAX_DAY_DURATION_MS, Math.max(MIN_DAY_DURATION_MS, duration));
}

export function createReadyDay(dayNumber = 1, durationMs = DAY_DURATION_MS): CurrentDayState {
  const duration = normalizeDurationMs(durationMs);
  return {
    dayNumber: Math.max(1, Math.floor(dayNumber)),
    status: 'ready',
    durationMs: duration,
    startedAt: null,
    elapsedActiveMs: 0,
    remainingMs: duration,
    pauseReason: null,
    ordersCompleted: 0,
    earnings: 0,
    endReason: null,
    settlementRevision: null,
  };
}

// 준비 상태의 Day만 시작합니다. 제한 시간은 시작 시점에 확정합니다.
export function startDay(day: CurrentDayState, startedAt: string, durationMs = day.durationMs): CurrentDayState {
  if (day.status !== 'ready') return day;
  return { ...createReadyDay(day.dayNumber, durationMs), status: 'active', startedAt };
}

export type DayTickResult = { day: CurrentDayState; timeUp: boolean };

// 활성 상태에서만 시간을 차감합니다. 남은 시간이 0이 되면 마감(closing) 단계로 넘깁니다.
export function tickDay(day: CurrentDayState, deltaMs: number): DayTickResult {
  if (day.status !== 'active' || !(deltaMs > 0)) return { day, timeUp: false };
  const used = Math.min(deltaMs, day.remainingMs);
  const remainingMs = day.remainingMs - used;
  const next: CurrentDayState = { ...day, elapsedActiveMs: day.elapsedActiveMs + used, remainingMs };
  if (remainingMs > 0) return { day: next, timeUp: false };
  return { day: { ...next, status: 'closing', remainingMs: 0 }, timeUp: true };
}

export function pauseDay(day: CurrentDayState, reason: DayPauseReason): CurrentDayState {
  if (day.status !== 'active') return day;
  return { ...day, status: 'paused', pauseReason: reason };
}

export function resumeDay(day: CurrentDayState): CurrentDayState {
  if (day.status !== 'paused') return day;
  return { ...day, status: 'active', pauseReason: null };
}

// 새 부품 공급·머지 같은 플레이 입력은 활성 상태에서만 받습니다.
export function canAcceptPlayInput(day: CurrentDayState): boolean {
  return day.status === 'active';
}

export type DayOrderRecord = { day: CurrentDayState; counted: boolean };

// 머지 코어가 확정한 납품 1건을 Day 통계에 반영합니다. 코인 지급은 호출 측이 따로 처리합니다.
export function recordOrderDelivery(day: CurrentDayState, reward: number): DayOrderRecord {
  if (!ORDER_RECORDING_STATUSES.includes(day.status)) return { day, counted: false };
  return {
    day: { ...day, ordersCompleted: day.ordersCompleted + 1, earnings: day.earnings + Math.max(0, Math.floor(numberOr(reward, 0))) },
    counted: true,
  };
}

export type DaySettlementInput = { reason: DayEndReason; endedAt: string; settlementRevision: number };
export type DaySettlementResult = { day: CurrentDayState; history: DayHistoryEntry[]; settled: boolean };

// 정산은 Day마다 한 번만 적용합니다. 같은 Day 번호의 이력이 이미 있으면 추가하지 않습니다.
export function settleDay(day: CurrentDayState, history: DayHistoryEntry[], input: DaySettlementInput): DaySettlementResult {
  if (!SETTLEABLE_STATUSES.includes(day.status)) return { day, history, settled: false };
  const settled: CurrentDayState = {
    ...day,
    status: 'settlement',
    pauseReason: null,
    endReason: input.reason,
    settlementRevision: input.settlementRevision,
    remainingMs: input.reason === 'time-limit' ? 0 : day.remainingMs,
  };
  if (history.some((entry) => entry.dayNumber === day.dayNumber)) return { day: settled, history, settled: true };
  const entry: DayHistoryEntry = {
    dayNumber: day.dayNumber,
    startedAt: day.startedAt ?? input.endedAt,
    endedAt: input.endedAt,
    elapsedActiveMs: day.elapsedActiveMs,
    ordersCompleted: day.ordersCompleted,
    earnings: day.earnings,
    endReason: input.reason,
    settlementRevision: input.settlementRevision,
  };
  return { day: settled, history: [...history, entry].slice(-MAX_DAY_HISTORY), settled: true };
}

// 정산을 확인한 뒤에만 다음 Day 번호로 넘어갑니다.
export function prepareNextDay(day: CurrentDayState, durationMs = day.durationMs): CurrentDayState {
  if (day.status !== 'settlement' && day.status !== 'completed') return day;
  return createReadyDay(day.dayNumber + 1, durationMs);
}

// 저장된 Day를 다시 열 때의 안전 규칙.
// - active: 앱이 강제 종료됐거나 백그라운드 이벤트 없이 닫힌 경우이므로 일시정지로 복원
// - completed: 다음 Day 준비 직전 상태이므로 다음 Day 준비로 복원
// - closing: 마감 중 종료된 경우이며, 호출 측이 바로 시간 종료 정산을 적용합니다.
export function normalizeRestoredDay(day: CurrentDayState): CurrentDayState {
  if (day.status === 'active') return { ...day, status: 'paused', pauseReason: 'restore' };
  if (day.status === 'completed') return createReadyDay(day.dayNumber + 1, day.durationMs);
  return day;
}

export function normalizeDayState(value: unknown, fallback: CurrentDayState = createReadyDay()): CurrentDayState {
  if (!value || typeof value !== 'object') return fallback;
  const day = value as Partial<CurrentDayState>;
  const status = DAY_STATUSES.includes(day.status as DayStatus) ? day.status as DayStatus : fallback.status;
  const durationMs = normalizeDurationMs(day.durationMs, fallback.durationMs);
  return {
    dayNumber: Math.max(1, Math.floor(numberOr(day.dayNumber, fallback.dayNumber))),
    status,
    durationMs,
    startedAt: typeof day.startedAt === 'string' ? day.startedAt : null,
    elapsedActiveMs: Math.max(0, numberOr(day.elapsedActiveMs, fallback.elapsedActiveMs)),
    remainingMs: Math.min(durationMs, Math.max(0, numberOr(day.remainingMs, durationMs))),
    pauseReason: PAUSE_REASONS.includes(day.pauseReason as DayPauseReason) ? day.pauseReason as DayPauseReason : null,
    ordersCompleted: Math.max(0, Math.floor(numberOr(day.ordersCompleted, 0))),
    earnings: Math.max(0, Math.floor(numberOr(day.earnings, 0))),
    endReason: day.endReason === 'time-limit' || day.endReason === 'manual-test' ? day.endReason : null,
    settlementRevision: typeof day.settlementRevision === 'number' && Number.isFinite(day.settlementRevision) ? day.settlementRevision : null,
  };
}

// 손상된 이력 요소는 버리고, 숫자·문자열 필드는 안전한 값으로 보정합니다.
export function normalizeHistoryEntry(value: unknown): DayHistoryEntry | null {
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

export function normalizeHistory(value: unknown): DayHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeHistoryEntry(entry))
    .filter((entry): entry is DayHistoryEntry => entry !== null)
    .slice(-MAX_DAY_HISTORY);
}

// HUD·준비 화면 공용 표기 (mm:ss). 남은 시간이 1초 미만이어도 올림해 00:00 직전까지 1초로 보입니다.
export function formatDayClock(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// 종료 임박 강조 기준: Day 길이의 10% (최소 3초)
export function isDayUrgent(remainingMs: number, durationMs: number): boolean {
  return remainingMs <= Math.max(3000, durationMs * 0.1);
}
