// #231 대회·레이스 순수 로직 단위 테스트
import { describe, expect, it } from 'vitest';
import type { BikeStats } from './meta-progress';
import {
  RACE_SEGMENTS,
  RACE_TICK_MS,
  HYBRID_FINISH_PROGRESS,
  RIVERSIDE_RACE,
  RIVERSIDE_ENDURANCE_RACE,
  applyRaceEntry,
  applyRaceReward,
  daysUntilRace,
  formatRaceTime,
  isRaceDay,
  nextRaceDay,
  progressAt,
  raceRewardForRank,
  racerSpeedScore,
  segmentAt,
  simulateRace,
} from './race-progress';

const MIN_STATS: BikeStats = { 성능: 1, 스타일: 1, 희귀도: 1 };
const MAX_STATS: BikeStats = { 성능: 4, 스타일: 4, 희귀도: 4 };

describe('대회 일정', () => {
  it('5일차마다 대회가 열린다', () => {
    expect(isRaceDay(5)).toBe(true);
    expect(isRaceDay(10)).toBe(true);
    [1, 2, 3, 4, 6, 7, 11].forEach((day) => expect(isRaceDay(day), `${day}일차`).toBe(false));
  });

  it('다음 대회일은 당일을 포함해 계산한다', () => {
    expect(nextRaceDay(1)).toBe(5);
    expect(nextRaceDay(5)).toBe(5);
    expect(nextRaceDay(6)).toBe(10);
    expect(daysUntilRace(1)).toBe(4);
    expect(daysUntilRace(5)).toBe(0);
    expect(daysUntilRace(6)).toBe(4);
  });
});

describe('참가비 (원자적 처리)', () => {
  it('코인이 부족하면 실패하고 코인은 변하지 않는다', () => {
    const result = applyRaceEntry(RIVERSIDE_RACE.entryFee - 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('coins');
    expect(result.coins).toBe(RIVERSIDE_RACE.entryFee - 1);
  });

  it('성공하면 참가비만큼 차감한다', () => {
    const result = applyRaceEntry(2480);
    expect(result.ok).toBe(true);
    expect(result.coins).toBe(2480 - RIVERSIDE_RACE.entryFee);
  });
});

describe('트랙 구간', () => {
  it('구간은 진행률 0~1을 빈틈없이 덮는다', () => {
    expect(RACE_SEGMENTS[0].from).toBe(0);
    expect(RACE_SEGMENTS[RACE_SEGMENTS.length - 1].to).toBe(1);
    for (let index = 1; index < RACE_SEGMENTS.length; index += 1) {
      expect(RACE_SEGMENTS[index].from).toBe(RACE_SEGMENTS[index - 1].to);
    }
  });

  it('C안은 3,000m 중 마지막 600m를 결승 중계 구간으로 사용한다', () => {
    expect(RIVERSIDE_ENDURANCE_RACE.distanceMeters).toBe(3000);
    expect(RIVERSIDE_ENDURANCE_RACE.distanceMeters * HYBRID_FINISH_PROGRESS).toBe(2400);
    expect(RIVERSIDE_ENDURANCE_RACE.distanceMeters * (1 - HYBRID_FINISH_PROGRESS)).toBeCloseTo(600);
    expect(RIVERSIDE_ENDURANCE_RACE.entryFee).toBe(RIVERSIDE_RACE.entryFee);
    expect(RIVERSIDE_ENDURANCE_RACE.rankRewards).toEqual(RIVERSIDE_RACE.rankRewards);
  });

  it('진행률에 맞는 구간을 돌려준다', () => {
    expect(segmentAt(0).id).toBe('start');
    expect(segmentAt(0.3).id).toBe('climb');
    expect(segmentAt(0.5).id).toBe('descent');
    expect(segmentAt(0.8).id).toBe('sprint');
    expect(segmentAt(1).id).toBe('sprint');
  });
});

describe('속도 점수', () => {
  it('성능·드림 단계가 오르면 속도 점수도 오른다', () => {
    expect(racerSpeedScore(MAX_STATS)).toBeGreaterThan(racerSpeedScore(MIN_STATS));
    expect(racerSpeedScore(MIN_STATS)).toBe(21);
    expect(racerSpeedScore(MAX_STATS)).toBe(31.5);
  });
});

describe('레이스 시뮬레이션', () => {
  const run = (seed: number, stats: BikeStats = MIN_STATS) => simulateRace({ seed, playerStats: stats });

  it('같은 시드는 같은 결과를 만든다 (재현성)', () => {
    expect(run(42)).toEqual(run(42));
  });

  it('다른 시드는 다른 기록을 만든다', () => {
    expect(run(1).playerTimeMs).not.toBe(run(2).playerTimeMs);
  });

  it('참가자는 8명이고 플레이어는 정확히 1명이다', () => {
    const result = run(7);
    expect(result.racers).toHaveLength(RIVERSIDE_RACE.racerCount);
    expect(result.racers.filter((racer) => racer.isPlayer)).toHaveLength(1);
  });

  it('등수는 1~8이 중복 없이 부여되고 기록 순서와 일치한다', () => {
    const result = run(11);
    const ranks = result.racers.map((racer) => racer.rank).sort((a, b) => a - b);
    expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const ordered = [...result.racers].sort((a, b) => a.rank - b.rank);
    for (let index = 1; index < ordered.length; index += 1) {
      expect(ordered[index].finishTimeMs).toBeGreaterThanOrEqual(ordered[index - 1].finishTimeMs);
    }
  });

  it('타임라인은 모두 같은 길이로 0에서 시작해 1로 끝나며 줄어들지 않는다', () => {
    const result = run(23);
    result.racers.forEach((racer) => {
      expect(racer.timeline).toHaveLength(result.totalTicks + 1);
      expect(racer.timeline[0]).toBe(0);
      expect(racer.timeline[racer.timeline.length - 1]).toBe(1);
      for (let index = 1; index < racer.timeline.length; index += 1) {
        expect(racer.timeline[index]).toBeGreaterThanOrEqual(racer.timeline[index - 1]);
      }
    });
  });

  it('전원이 완주한다 (완주 실패 없음)', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      run(seed).racers.forEach((racer) => expect(racer.finishTimeMs).toBeGreaterThan(0));
    }
  });

  it('C안 장거리 코스도 같은 시드 결과로 전원이 완주한다', () => {
    const result = simulateRace({ seed: 231, playerStats: MIN_STATS, meta: RIVERSIDE_ENDURANCE_RACE });
    expect(result.meta.distanceMeters).toBe(3000);
    expect(result.racers.every((racer) => racer.timeline.at(-1) === 1)).toBe(true);
    expect(result.totalTicks).toBeGreaterThan(run(231).totalTicks);
  });

  it('성장한 자전거가 낮은 자전거보다 명확히 유리하다', () => {
    let maxTop3 = 0;
    let minTop3 = 0;
    let maxTimeSum = 0;
    let minTimeSum = 0;
    const seeds = 30;
    for (let seed = 1; seed <= seeds; seed += 1) {
      const maxResult = run(seed, MAX_STATS);
      const minResult = run(seed, MIN_STATS);
      if (maxResult.playerRank <= 3) maxTop3 += 1;
      if (minResult.playerRank <= 3) minTop3 += 1;
      maxTimeSum += maxResult.playerTimeMs;
      minTimeSum += minResult.playerTimeMs;
    }
    expect(maxTop3).toBeGreaterThan(minTop3);
    expect(maxTop3).toBeGreaterThanOrEqual(seeds * 0.7);
    expect(maxTimeSum).toBeLessThan(minTimeSum);
  });

  it('재생 보간은 틱 사이를 선형으로 잇는다', () => {
    expect(progressAt([0, 0.4, 1], 0)).toBe(0);
    expect(progressAt([0, 0.4, 1], 0.5)).toBeCloseTo(0.2);
    expect(progressAt([0, 0.4, 1], 1.5)).toBeCloseTo(0.7);
    expect(progressAt([0, 0.4, 1], 99)).toBe(1);
  });
});

describe('보상 정산', () => {
  it('1·2·3위는 상금, 그 외 순위는 완주 수당을 받는다', () => {
    expect(raceRewardForRank(1)).toBe(2000);
    expect(raceRewardForRank(2)).toBe(1200);
    expect(raceRewardForRank(3)).toBe(800);
    [4, 5, 6, 7, 8].forEach((rank) => expect(raceRewardForRank(rank)).toBe(200));
  });

  it('보상은 코인에 가산된다', () => {
    const result = applyRaceReward(1000, 1);
    expect(result).toEqual({ coins: 3000, reward: 2000, rank: 1 });
    expect(applyRaceReward(1000, 8).coins).toBe(1200);
  });

  it('참가비 대비 손익: 3위 이내는 이익, 4위 이하는 손해', () => {
    [1, 2, 3].forEach((rank) => expect(raceRewardForRank(rank)).toBeGreaterThan(RIVERSIDE_RACE.entryFee));
    expect(RIVERSIDE_RACE.finishReward).toBeLessThan(RIVERSIDE_RACE.entryFee);
  });
});

describe('기록 표기', () => {
  it('분:초.1자리 형식으로 표기한다', () => {
    expect(formatRaceTime(0)).toBe('00:00.0');
    expect(formatRaceTime(83_400)).toBe('01:23.4');
    expect(formatRaceTime(RACE_TICK_MS * 100)).toBe('01:00.0');
  });
});
