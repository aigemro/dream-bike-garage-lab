// 대회 시즌 체험 화면 (#267 · DOM)
// 주문 풀 A안으로 성장하며 5 Day마다 대회에 나가는 시즌을 버튼으로 진행하고,
// 대회마다 출전 자전거·출전 전 확률·결과·보상을 방안별로 비교합니다. 레이스 연출은 기존 레이스 E안 체험에서 확인합니다.
import { CATALOG_BIKES } from './bike-catalog';
import {
  COINS_PER_ENERGY, COURSES, LEAGUE_TIERS, SEASON_LABELS, WINS_FOR_DREAM, courseForRace, createSeason, isUncertain, playSeasonDay, raceMetaFor,
  type SeasonState, type SeasonVariant,
} from './race-season';
import './order-pool.css';
import './race-season.css';

const escape = (text: string) => text.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
const bikeName = (bikeId: string) => CATALOG_BIKES.find((bike) => bike.id === bikeId)?.name ?? bikeId;
const percent = (value: number) => `${Math.round(value * 100)}%`;
const SEASON_DAYS = 60;

export function startRaceSeasonPrototype(parent: string, variant: SeasonVariant) {
  const root = document.getElementById(parent);
  if (!root) throw new Error(`race season parent not found: ${parent}`);
  const season: SeasonState = createSeason(variant);

  const nextRaceInfo = () => {
    const meta = raceMetaFor(season);
    const course = variant === 'course' ? courseForRace(season.raceIndex) : undefined;
    const day = Math.ceil(season.pool.day / 5) * 5;
    return `다음 대회 Day ${day} · ${escape(meta.name)}${course ? ` · 코스 ${course.name}(${course.note})` : ''} · 참가비 ${meta.entryFee.toLocaleString()} C · 상대 속도 ${(meta.npcSpeedMin ?? 20.5).toFixed(1)}~${((meta.npcSpeedMin ?? 20.5) + (meta.npcSpeedSpan ?? 9)).toFixed(1)}`;
  };

  const render = () => {
    const entered = season.races.filter((race) => !race.skipped);
    const wins = entered.filter((race) => race.rank === 1).length;
    const net = entered.reduce((sum, race) => sum + race.reward - race.entryFee, 0);
    const extra = variant === 'league' ? `현재 등급 ${escape(LEAGUE_TIERS[season.leagueIndex].name)}`
      : variant === 'rewards' ? `무료 상자 ${season.freeBoxes} · 체력 +${season.energy} (코인 환산 ${((season.freeBoxes + season.energy) * COINS_PER_ENERGY).toLocaleString()}) · 우승 ${season.wins}회(${WINS_FOR_DREAM}회마다 드림 머신)`
        : variant === 'course' ? `코스 순환: ${COURSES.map((course) => course.name).join(' → ')}` : '상대 속도 고정 20.5~29.5';
    const rows = season.races.map((race) => {
      const uncertain = isUncertain(race.odds);
      const result = race.skipped ? '참가비 부족 · 불참' : `${race.rank}위 · ${(race.reward - race.entryFee).toLocaleString()} C`;
      const notes = [race.promotedTo ? `⬆ ${race.promotedTo}` : '', race.items.freeBoxes ? `무료 상자 ${race.items.freeBoxes}` : '', race.items.energy ? `체력 +${race.items.energy}` : '', race.dreamUnlocked ? '🏆 드림 머신 등록' : ''].filter(Boolean).join(' · ');
      return `<tr class="${uncertain ? 'rs-uncertain' : ''}"><td>Day ${race.day}</td><td>${escape(race.courseName ?? race.name)}</td>
        <td>${escape(bikeName(race.bikeId))}${race.bonus ? ` <em>+${race.bonus}</em>` : ''}</td>
        <td>${percent(race.odds.win)} / ${percent(race.odds.podium)}${uncertain ? ' ⚡' : ''}</td><td class="${race.rank === 1 ? 'rs-win' : ''}">${result}</td><td>${notes}</td></tr>`;
    }).join('');
    root.innerHTML = `<div class="op-shell">
      <header class="op-head">
        <div><span>${SEASON_LABELS[variant]}</span><strong>DAY ${Math.min(season.pool.day, SEASON_DAYS)} · 코인 ${season.pool.coins.toLocaleString()} C · 보유 ${season.pool.collection.craftedBikeIds.length}대</strong>
        <small>${extra}</small><small>${season.pool.day <= SEASON_DAYS ? nextRaceInfo() : '시즌 종료'}</small></div>
        <div class="op-actions">
          <button type="button" data-action="race" ${season.pool.day > SEASON_DAYS ? 'disabled' : ''}>다음 대회까지 진행</button>
          <button type="button" data-action="season" ${season.pool.day > SEASON_DAYS ? 'disabled' : ''}>시즌 끝까지 (Day ${SEASON_DAYS})</button>
        </div>
      </header>
      <section class="op-today">
        <h3>대회 기록 · 참가 ${entered.length}회 · 우승 ${wins}회 · 대회 순수익 ${net.toLocaleString()} C</h3>
        <p class="rs-help">출전 전 확률은 같은 조건에서 시드 120개로 잰 우승/시상대 확률입니다. ⚡ 표시는 결과가 미리 정해지지 않은(15~85%) 대회입니다.</p>
        <div class="rs-table-wrap"><table class="rs-table"><thead><tr><th>Day</th><th>대회·코스</th><th>출전 자전거</th><th>우승/시상대 확률</th><th>결과</th><th>보상·변화</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6">아직 대회를 치르지 않았어요. 첫 대회는 Day 5입니다.</td></tr>'}</tbody></table></div>
      </section>
    </div>`;
  };

  const onClick = (event: Event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === 'race') {
      const start = season.races.length;
      for (let guard = 0; guard < 10 && season.races.length === start && season.pool.day <= SEASON_DAYS; guard += 1) playSeasonDay(season);
      render();
    }
    if (action === 'season') {
      while (season.pool.day <= SEASON_DAYS) playSeasonDay(season);
      render();
    }
  };

  root.addEventListener('click', onClick);
  render();
  return { destroy() { root.removeEventListener('click', onClick); root.innerHTML = ''; } };
}
