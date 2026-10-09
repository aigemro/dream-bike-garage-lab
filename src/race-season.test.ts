// 대회 난이도·보상 곡선 테스트 (#267)
import { describe, expect, it } from 'vitest';
import { RIVERSIDE_ENDURANCE_RACE, simulateRace } from './race-progress';
import { createPoolState } from './order-pool';
import {
  COURSE_BONUS, COURSES, LEAGUE_TIERS, RANK_ITEMS, chooseEntry, courseForRace, createSeason, isUncertain, playSeasonDay, raceMetaFor, raceOddsFor,
  runRace, simulateSeason,
} from './race-season';

const maxed = { 성능: 4, 스타일: 3, 희귀도: 3 };

describe('레이스 시뮬레이션 확장', () => {
  it('상대 밴드·속도 보정을 주지 않으면 기존 결과와 같다', () => {
    const base = simulateRace({ seed: 42, playerStats: maxed, meta: RIVERSIDE_ENDURANCE_RACE });
    const same = simulateRace({ seed: 42, playerStats: maxed, meta: { ...RIVERSIDE_ENDURANCE_RACE }, playerSpeedBonus: 0 });
    expect(same.racers.map((r) => r.finishTimeMs)).toEqual(base.racers.map((r) => r.finishTimeMs));
  });

  it('상대가 빨라지면 우승 확률이 내려가고, 속도 보너스는 올린다', () => {
    const entry = { bikeId: 'dream-road', stats: maxed, bonus: 0 };
    const easy = raceOddsFor(entry, RIVERSIDE_ENDURANCE_RACE, 80);
    const hard = raceOddsFor(entry, LEAGUE_TIERS[3].meta, 80);
    const boosted = raceOddsFor({ ...entry, bonus: COURSE_BONUS }, LEAGUE_TIERS[3].meta, 80);
    expect(easy.win).toBeGreaterThan(hard.win);
    expect(boosted.win).toBeGreaterThan(hard.win);
  });
});

describe('A안 대회 등급 리그', () => {
  it('실버는 현행과 같은 값이고, 등급이 오를수록 참가비·상금·상대 속도가 오른다', () => {
    const silver = LEAGUE_TIERS[1].meta;
    expect(silver).toMatchObject({ entryFee: RIVERSIDE_ENDURANCE_RACE.entryFee, rankRewards: RIVERSIDE_ENDURANCE_RACE.rankRewards, npcSpeedMin: 20.5, npcSpeedSpan: 9 });
    for (let i = 1; i < LEAGUE_TIERS.length; i += 1) {
      expect(LEAGUE_TIERS[i].meta.entryFee).toBeGreaterThan(LEAGUE_TIERS[i - 1].meta.entryFee);
      expect(LEAGUE_TIERS[i].meta.rankRewards[0]).toBeGreaterThan(LEAGUE_TIERS[i - 1].meta.rankRewards[0]);
      expect(LEAGUE_TIERS[i].meta.npcSpeedMin!).toBeGreaterThan(LEAGUE_TIERS[i - 1].meta.npcSpeedMin!);
    }
  });

  it('우승하면 다음 등급으로 오르고, 참가비가 모자라면 건너뛴다', () => {
    const season = createSeason('league');
    season.pool.coins = 10_000;
    season.pool.growth.statsByBikeId['dream-road'] = { ...maxed }; // 강화를 마친 대표 자전거
    const first = runRace(season);
    expect(first.rank).toBe(1);
    expect(first.promotedTo).toBe(LEAGUE_TIERS[1].name);
    season.pool.coins = 0;
    expect(runRace(season).skipped).toBe(true);
  });
});

describe('B안 코스 상성', () => {
  it('코스가 대회마다 돌고, 코스와 맞는 카테고리 자전거가 보너스를 받는다', () => {
    expect(courseForRace(0)).toBe(COURSES[0]);
    expect(courseForRace(5)).toBe(COURSES[1]);
    const pool = createPoolState('tiers');
    pool.collection.craftedBikeIds.push('trail-mtb');
    const hill = chooseEntry(pool, COURSES[1]);
    expect(hill).toMatchObject({ bikeId: 'trail-mtb', bonus: COURSE_BONUS });
    expect(chooseEntry(pool, COURSES[0]).bikeId).toBe('dream-road');
  });

  it('시즌이 진행될수록 상대가 강해진다', () => {
    const season = createSeason('course');
    const before = raceMetaFor(season).npcSpeedMin!;
    season.raceIndex = 4;
    expect(raceMetaFor(season).npcSpeedMin!).toBeGreaterThan(before);
  });
});

describe('C안 보상 다변화', () => {
  it('순위에 따라 무료 상자·체력을 주고, 우승 3회마다 드림 머신을 등록한다', () => {
    expect(RANK_ITEMS[0]).toEqual({ freeBoxes: 2, energy: 10 });
    const season = createSeason('rewards');
    season.pool.coins = 100_000;
    season.pool.growth.statsByBikeId['dream-road'] = { ...maxed };
    let unlocked = false;
    for (let i = 0; i < 3; i += 1) unlocked = runRace(season).dreamUnlocked ?? unlocked;
    expect(season.wins).toBe(3);
    expect(unlocked).toBe(true);
    expect(season.freeBoxes).toBe(6);
  });
});

describe('시즌 비교', () => {
  it('현행은 결과가 정해진 대회뿐이고, A·B안은 긴장 있는 대회가 생긴다', () => {
    const current = simulateSeason('current', 30);
    const league = simulateSeason('league', 30);
    expect(current.uncertainRate).toBe(0);
    expect(league.uncertainRate).toBeGreaterThan(0);
    expect(simulateSeason('league', 30)).toEqual(league);
  }, 60_000);

  it('긴장 판정: 우승 또는 시상대 확률이 15~85%', () => {
    expect(isUncertain({ win: 1, podium: 1 })).toBe(false);
    expect(isUncertain({ win: 0.08, podium: 0.69 })).toBe(true);
    expect(isUncertain({ win: 0, podium: 0.05 })).toBe(false);
  });

  it('하루 진행: 대회일에만 대회를 치른다', () => {
    const season = createSeason('current');
    for (let day = 1; day <= 4; day += 1) expect(playSeasonDay(season)).toBeNull();
    expect(playSeasonDay(season)?.day).toBe(5);
  });
});
