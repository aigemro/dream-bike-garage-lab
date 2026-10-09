// 알바 체력 소진 흐름과 보상형 광고 충전 규칙 (#263 · 순수 로직, Phaser·DOM·광고 SDK 비의존)
// 광고 SDK 연동은 메인에서 앱인토스 SDK와 함께 합니다. Lab은 아래 어댑터 인터페이스 뒤에 가짜 광고를 두고
// 게임 쪽 흐름(언제 무엇을 보여 주고, 결과별로 무엇을 지급하는지)과 저장 계약만 검증합니다.
import { localDate } from './merge-assist';

export { localDate };

/**
 * 소진 흐름 3안
 * - card(A안): 소진 안내 카드 — 회복 시간과 [광고 보고 +10] [홈으로]
 * - daily(B안): 하루 1회 무료 충전(가득) + 광고 충전
 * - rest(C안): 휴식 전환 — 체력이 필요 없는 다음 목표(도감·강화)로 안내하고 광고는 보조 선택지
 */
export type RefillMode = 'card' | 'daily' | 'rest';

/** 보상형 광고 결과. 메인 SDK 어댑터도 이 세 결과로 맞추면 게임 규칙을 바꾸지 않고 교체할 수 있습니다. */
export type RewardedAdResult = 'completed' | 'failed' | 'dismissed';
export interface RewardedAdAdapter {
  requestRewardedAd(): Promise<RewardedAdResult>;
}

/** 광고 1회 충전량 (후보값, #262 시뮬레이터 표 7로 비교) */
export const AD_REFILL_AMOUNT = 10;

export type RefillPolicy = { adsPerDay: number; freePerDay: number };
export const REFILL_POLICIES: Record<RefillMode, RefillPolicy> = {
  card: { adsPerDay: 3, freePerDay: 0 },
  daily: { adsPerDay: 2, freePerDay: 1 },
  rest: { adsPerDay: 3, freePerDay: 0 },
};
export const REFILL_LABELS: Record<RefillMode, string> = {
  card: 'A안 소진 안내 카드',
  daily: 'B안 일일 무료 충전 + 광고',
  rest: 'C안 휴식 전환',
};

/** 오늘 충전 기록. 날짜(기기 기준)가 바뀌면 횟수를 0으로 봅니다. */
export type RefillRecord = { date: string; adsWatched: number; freeUsed: number };

const todays = (record: RefillRecord | null, today: string): RefillRecord =>
  record && record.date === today ? record : { date: today, adsWatched: 0, freeUsed: 0 };

export type RefillStatus = { adsLeft: number; freeLeft: number };

export function refillStatus(mode: RefillMode, record: RefillRecord | null, today: string): RefillStatus {
  const policy = REFILL_POLICIES[mode];
  const current = todays(record, today);
  return {
    adsLeft: Math.max(0, policy.adsPerDay - current.adsWatched),
    freeLeft: Math.max(0, policy.freePerDay - current.freeUsed),
  };
}

export type RefillClaim = { record: RefillRecord; amount: number };

/**
 * 광고 결과로 충전합니다. 끝까지 본 경우(completed)에만, 오늘 남은 횟수가 있을 때 지급하고 횟수를 셉니다.
 * 실패·중간 닫기는 지급도 횟수 차감도 하지 않습니다.
 */
export function claimAdRefill(mode: RefillMode, record: RefillRecord | null, today: string, result: RewardedAdResult): RefillClaim {
  const current = todays(record, today);
  if (result !== 'completed' || refillStatus(mode, current, today).adsLeft <= 0) return { record: current, amount: 0 };
  return { record: { ...current, adsWatched: current.adsWatched + 1 }, amount: AD_REFILL_AMOUNT };
}

/** B안 하루 무료 충전: 체력을 가득 채웁니다. 오늘 이미 썼으면 null */
export function claimFreeRefill(mode: RefillMode, record: RefillRecord | null, today: string, energy: number, cap: number): RefillClaim | null {
  const current = todays(record, today);
  if (refillStatus(mode, current, today).freeLeft <= 0) return null;
  return { record: { ...current, freeUsed: current.freeUsed + 1 }, amount: Math.max(0, cap - energy) };
}

/** 체력에 충전량을 더합니다. 최대치를 넘지 않습니다. */
export function addEnergy(energy: number, cap: number, amount: number) {
  return Math.min(cap, Math.max(0, energy) + Math.max(0, amount));
}

/** 상자를 열 수 없는 체력 소진 상태(무료 상자도 없음) */
export function isEnergyEmpty(state: { energy: number; freeBoxes: number }) {
  return state.energy < 1 && state.freeBoxes < 1;
}

/** 가득 찰 때까지 남은 시간(ms). anchor는 마지막 회복 기준 시각입니다. */
export function msUntilFull(energy: number, anchor: number, now: number, cap: number, recoveryMs: number) {
  if (energy >= cap) return 0;
  const sinceAnchor = Math.max(0, now - anchor);
  return Math.max(0, (cap - energy) * recoveryMs - sinceAnchor);
}

export function formatDuration(ms: number) {
  const minutes = Math.ceil(Math.max(0, ms) / 60_000);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}시간 ${minutes % 60}분` : `${minutes}분`;
}

export function parseRefillRecord(raw: string | null): RefillRecord | null {
  try {
    const value = JSON.parse(raw ?? 'null') as Partial<RefillRecord> | null;
    const count = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
    if (!value || typeof value.date !== 'string' || !count(value.adsWatched) || !count(value.freeUsed)) return null;
    return { date: value.date, adsWatched: value.adsWatched!, freeUsed: value.freeUsed! };
  } catch {
    return null;
  }
}
