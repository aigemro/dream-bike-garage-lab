import Phaser from 'phaser';
import './styles.css';
import variantDocs from './variant-docs';
import { startMergePrototype, type MergePrototypeMode } from './merge-prototype';
import { startCollectionPrototype, type CollectionPrototypeMode } from './collection-prototype';
import { startSupplyPrototype, type SupplyPrototypeMode } from './supply-prototype';
import { startRewardPrototype, type RewardPrototypeMode } from './reward-prototype';

type Status = '체험 가능' | '준비 중';
type Variant = {
  id: string;
  label: string;
  title: string;
  description: string;
  status: Status;
  question: string;
  controls: string;
  demo?: MergePrototypeMode;
  collectionDemo?: CollectionPrototypeMode;
  supplyDemo?: SupplyPrototypeMode;
  rewardDemo?: RewardPrototypeMode;
  issueNumber: number;
  documentId: string;
};
type Track = {
  id: string;
  group: 'GAME CORE' | 'PLATFORM & TECHNOLOGY';
  title: string;
  description: string;
  variants: Variant[];
};

const tracks: Track[] = [
  {
    id: 'merge-core',
    group: 'GAME CORE',
    title: '머지 코어',
    description: '머지를 만드는 조작과 진행 규칙을 여러 방안으로 구현해 재미와 이해도를 비교합니다.',
    variants: [
      {
        id: 'tap-select',
        label: 'A안',
        title: '자유 보드 2-to-1 머지',
        description: '부품별 점유 크기와 회전·이동을 이용해 공간을 설계한 뒤 같은 부품을 합치는 2차 구현안입니다.',
        status: '체험 가능',
        question: '모바일에서도 가장 단순한 입력만으로 머지 규칙을 쉽게 이해할 수 있는가?',
        controls: '− / +로 보드 크기를 바꾸고 부품을 골라 배치합니다. 부품을 다시 누르면 회전하며, 선택 후 이동·머지할 수 있습니다.',
        demo: 'free', issueNumber: 10, documentId: 'merge-free-board',
      },
      {
        id: 'order-merge',
        label: 'B안',
        title: '주문 목표 중심 머지',
        description: '커스텀 주문에 부품을 직접 추가하고 주문 안에서 자동 머지하는 방식입니다.',
        status: '체험 가능',
        question: '자유 보드보다 목표성과 플레이 템포가 좋아지는가?',
        controls: '오른쪽 부품을 클릭하면 주문에 Lv.1이 추가되며, 같은 레벨 2개는 자동으로 머지됩니다.',
        demo: 'order', issueNumber: 13, documentId: 'merge-order',
      },
      {
        id: 'guided-merge',
        label: 'C안',
        title: '자유 보드 + 주문 가이드',
        description: '자유로운 선행 제작은 유지하면서 현재 주문에 필요한 부품만 최소한으로 안내합니다.',
        status: '체험 가능',
        question: '자유 보드의 공간 관리 재미와 주문 목표의 명확성을 함께 확보할 수 있는가?',
        controls: '원하는 부품을 자유롭게 만들되, 빛나는 목표 표시와 다음 행동 힌트를 참고합니다.',
        demo: 'guided', issueNumber: 25, documentId: 'merge-guided',
      },
      {
        id: 'board-size',
        label: '검증',
        title: '보드 크기·잠금 칸 검증',
        description: '같은 머지 규칙에서 6×7, 7×9, 잠금 해제형 보드 조건만 바꿔 공간 전략과 난이도를 비교합니다.',
        status: '준비 중',
        question: '어떤 보드 크기와 잠금 칸 구성이 공간 전략의 재미와 난이도 균형에 가장 적합한가?',
        controls: '같은 부품 구성으로 보드 크기와 잠금 칸 조건만 바꿔 비교합니다.',
        issueNumber: 74, documentId: 'merge-board-size',
      },
    ],
  },
  {
    id: 'parts-supply',
    group: 'GAME CORE',
    title: '부품 수급',
    description: '머지 재료인 부품이 보드에 공급되는 방식을 비교해 플레이 템포와 기대감을 검증합니다.',
    variants: [
      { id: 'instant-button', label: 'A안', title: '즉시 생성 버튼형', description: '생성 버튼을 누르면 부품이 지연 없이 보드에 추가되는 현행 기준선입니다.', status: '체험 가능', question: '지연 없는 공급이 머지 플레이 템포를 가장 잘 유지하는가?', controls: '부품 생성 버튼으로 Lv.1 부품을 추가하고, 부품 탭 → 같은 레벨 탭으로 머지해 Lv.3 부품 2개를 만듭니다.', supplyDemo: 'instant', issueNumber: 71, documentId: 'supply-instant' },
      { id: 'parcel-box', label: 'B안', title: '택배 상자 개봉형', description: '주문한 부품이 택배 상자로 도착하고 상자를 개봉해 부품을 얻습니다.', status: '체험 가능', question: '개봉 연출의 기대감이 템포 저하보다 큰 가치를 주는가?', controls: '부품 주문 → 배송 대기 → 상자 개봉으로 부품을 받고, 같은 목표(Lv.3 ×2)까지의 템포를 A안과 비교합니다.', supplyDemo: 'parcel', issueNumber: 72, documentId: 'supply-parcel' },
      { id: 'cooldown-generator', label: 'C안', title: '쿨다운·충전식 생성기형', description: '충전량이 있는 생성기를 탭해 부품을 뽑고 쿨다운 후 다시 충전되는 장르 표준 방식입니다.', status: '체험 가능', question: '장르 표준 생성기가 주문 단위의 짧은 세션 구조와 잘 맞는가?', controls: '생성기 가동으로 충전량을 소모해 부품을 뽑고, 쿨다운 재충전을 관리하며 같은 목표까지 진행합니다.', supplyDemo: 'generator', issueNumber: 73, documentId: 'supply-generator' },
    ],
  },
  {
    id: 'reward-progression',
    group: 'GAME CORE',
    title: '보상과 성장',
    description: '납품 보상과 성장 구조가 다음 플레이 동기를 만드는 방식을 비교합니다.',
    variants: [
      { id: 'fixed-salary', label: 'A안', title: '고정 급여·직선 성장', description: '납품마다 정해진 급여를 받고 정해진 순서로 성장하는 기준선입니다.', status: '체험 가능', question: '예측 가능한 보상이 안정적인 반복 플레이 동기를 만드는가?', controls: '주문을 납품해 고정 급여를 받고, 정해진 순서대로 성장 항목을 해금합니다.', rewardDemo: 'fixed', issueNumber: 20, documentId: 'reward-fixed-salary' },
      { id: 'performance-bonus', label: 'B안', title: '성과 보너스·성장 선택', description: '납품 성과에 따라 보너스가 달라지고 성장 방향을 직접 선택합니다.', status: '체험 가능', question: '변동 보상과 성장 선택지가 반복 플레이 동기를 높이는가?', controls: '납품 품질을 선택해 성과 보너스를 받고, 원하는 성장 경로에 급여를 투자합니다.', rewardDemo: 'performance', issueNumber: 21, documentId: 'reward-performance-bonus' },
      { id: 'soft-timer', label: 'C안', title: '소프트 타이머·시간 vs 품질', description: '시간 안에 납품하면 시간 보너스, 늦더라도 품질을 높이면 품질 보너스를 받습니다.', status: '체험 가능', question: '시간과 품질 중 선택하는 긴장감이 실제 재미로 이어지는가?', controls: '빠른 기본 품질 납품과 시간이 걸리는 고품질 납품의 보상 차이를 비교합니다. 시간이 지나도 주문은 실패하지 않습니다.', rewardDemo: 'soft-timer', issueNumber: 75, documentId: 'reward-soft-timer' },
    ],
  },
  {
    id: 'collection',
    group: 'GAME CORE',
    title: '자전거 수집',
    description: '완성한 자전거를 어떻게 보여주고 성장 동기로 연결할지 비교합니다.',
    variants: [
      { id: 'catalog', label: 'A안', title: '도감형 수집', description: '종류와 등급별 빈칸을 채우는 방식입니다.', status: '체험 가능', question: '미완성 항목이 다음 수집 동기를 만드는가?', controls: '카드를 선택하고 미획득 자전거의 신규 획득 흐름을 체험합니다.', collectionDemo: 'catalog', issueNumber: 14, documentId: 'collection-catalog' },
      { id: 'garage', label: 'B안', title: 'Garage 전시', description: '보유 자전거를 공간에 배치하고 감상하는 방식입니다.', status: '체험 가능', question: '전시가 자전거 소유감과 애착을 높이는가?', controls: '보유 자전거를 선택해 전시대에 배치하고 성장시킵니다.', collectionDemo: 'garage', issueNumber: 12, documentId: 'collection-garage' },
      { id: 'dream-bike', label: 'C안', title: '드림 바이크 성장', description: '한 대의 자전거를 지속적으로 업그레이드하는 방식입니다.', status: '체험 가능', question: '집중 성장 방식이 장기 목표를 더 선명하게 만드는가?', controls: '같은 조건의 코인을 성능·스타일·희귀도에 투자해 등급 변화를 확인합니다.', collectionDemo: 'dream-bike', issueNumber: 60, documentId: 'collection-dream-bike' },
    ],
  },
  {
    id: 'order-assembly',
    group: 'GAME CORE',
    title: '주문과 조립',
    description: '머지한 부품이 고객 주문과 자전거 조립으로 이어지는 방식을 검증합니다.',
    variants: [
      { id: 'parts-delivery', label: 'A안', title: '조건 충족 자동 조립', description: '요구 부품을 완성하면 즉시 자전거를 조립합니다.', status: '준비 중', question: '주문 목표를 가장 빠르게 이해할 수 있는가?', controls: '필요한 부품을 완성해 자동 조립 결과를 확인합니다.', issueNumber: 17, documentId: 'assembly-auto' },
      { id: 'assembly-slots', label: 'B안', title: '슬롯 조립형', description: '프레임·휠·구동계 슬롯을 모두 채워 자전거를 완성합니다.', status: '준비 중', question: '자전거를 조립한다는 느낌이 충분히 전달되는가?', controls: '부품을 해당 조립 슬롯에 장착합니다.', issueNumber: 18, documentId: 'assembly-slots' },
    ],
  },
  {
    id: 'input-methods',
    group: 'PLATFORM & TECHNOLOGY',
    title: '입력 방식',
    description: '화면 구성과 분리해 탭·드래그 조작을 어떤 규칙으로 처리할지 비교합니다.',
    variants: [
      { id: 'tap-move', label: 'A안', title: '탭 선택·탭 이동', description: '부품과 목적지를 순서대로 탭해 이동하거나 머지합니다.', status: '준비 중', question: '작은 모바일 화면에서 가장 정확하고 이해하기 쉬운가?', controls: '부품을 탭한 뒤 목적지 칸을 다시 탭합니다.', issueNumber: 32, documentId: 'input-tap' },
      { id: 'drag-drop', label: 'B안', title: '직접 드래그 앤 드롭', description: '부품을 직접 끌어 목적지에 놓아 이동하거나 머지합니다.', status: '준비 중', question: '직접 조작하는 손맛과 의도가 가장 잘 전달되는가?', controls: '부품을 누른 채 끌어서 목적지에 놓습니다.', issueNumber: 34, documentId: 'input-drag' },
      { id: 'hybrid-input', label: 'C안', title: '탭·드래그 하이브리드', description: '탭과 드래그를 모두 허용하고 같은 명령으로 연결합니다.', status: '준비 중', question: '선택권을 늘리면서도 입력 규칙의 혼란을 피할 수 있는가?', controls: '짧게 탭하거나 일정 거리 이상 끌어 같은 부품 조작을 수행합니다.', issueNumber: 37, documentId: 'input-hybrid' },
    ],
  },
  {
    id: 'responsive-layout',
    group: 'PLATFORM & TECHNOLOGY',
    title: '반응형 화면',
    description: '모바일·태블릿·데스크톱에서 보드와 정보 영역을 구성하는 방식을 비교합니다.',
    variants: [
      { id: 'fit-layout', label: 'A안', title: '전체 화면 FIT', description: '고정된 게임 화면 전체를 기기 안에 축소·확대해 맞춥니다.', status: '준비 중', question: '가장 단순한 구조로 화면 잘림을 안정적으로 방지하는가?', controls: '화면 크기와 방향을 바꿔 전체 스케일과 여백을 확인합니다.', issueNumber: 36, documentId: 'responsive-fit' },
      { id: 'reflow-layout', label: 'B안', title: '영역 재배치 반응형', description: '보드·주문·조작 영역을 화면 폭에 맞춰 재배치합니다.', status: '준비 중', question: '각 기기에서 정보성과 조작 크기를 함께 유지하는가?', controls: '모바일 단일 열과 데스크톱 병렬 배치를 비교합니다.', issueNumber: 38, documentId: 'responsive-reflow' },
      { id: 'safe-area-layout', label: 'C안', title: 'Safe Area 중심 적응형', description: '실제 가용 높이와 Safe Area를 기준으로 보드를 우선 보존합니다.', status: '준비 중', question: 'WebView 환경에서도 핵심 보드 크기와 조작 영역을 유지하는가?', controls: '노치·홈 영역과 화면 높이 변화에서 보드와 부가 UI를 확인합니다.', issueNumber: 35, documentId: 'responsive-safe-area' },
    ],
  },
  {
    id: 'persistence',
    group: 'PLATFORM & TECHNOLOGY',
    title: '진행 상태 저장',
    description: '보드와 재화를 유지하는 저장 방식을 단계적으로 비교합니다.',
    variants: [
      { id: 'local-storage', label: 'A안', title: 'localStorage', description: '가장 단순한 브라우저 저장 방식입니다.', status: '준비 중', question: 'MVP 진행 상태를 충분히 안정적으로 보존하는가?', controls: '플레이 후 새로고침하고 상태를 비교합니다.', issueNumber: 3, documentId: 'storage-local' },
      { id: 'indexed-db', label: 'B안', title: 'IndexedDB', description: '더 큰 구조화 데이터를 브라우저에 저장합니다.', status: '준비 중', question: '복잡한 상태와 버전 변경을 관리하기 쉬운가?', controls: '여러 저장 슬롯과 데이터 변경을 검증합니다.', issueNumber: 3, documentId: 'storage-indexed-db' },
    ],
  },
  {
    id: 'toss-webview',
    group: 'PLATFORM & TECHNOLOGY',
    title: '앱인토스 WebView',
    description: '토스 앱 내부 환경에서 필요한 기능을 작은 실험으로 분리해 확인합니다.',
    variants: [
      { id: 'lifecycle', label: 'A안', title: '라이프사이클', description: '진입·백그라운드·복귀 시 게임 상태를 확인합니다.', status: '준비 중', question: '앱 전환 뒤에도 게임이 정상 복귀하는가?', controls: '앱 상태를 전환하고 게임 상태를 비교합니다.', issueNumber: 5, documentId: 'toss-lifecycle' },
      { id: 'sdk-bridge', label: 'B안', title: 'SDK 연결', description: '앱인토스 기능을 어댑터를 통해 호출합니다.', status: '준비 중', question: '웹 게임 코드와 플랫폼 기능을 분리할 수 있는가?', controls: '지원 기능 호출과 실패 처리를 확인합니다.', issueNumber: 6, documentId: 'toss-sdk' },
    ],
  },
];

const app = document.querySelector<HTMLDivElement>('#app')!;
let game: Phaser.Game | undefined;
const allVariants = tracks.flatMap((track) => track.variants);

function destroyGame() {
  game?.destroy(true);
  game = undefined;
}

function shell(content: string, back?: { href: string; label: string }) {
  app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="#"><span class="brand-mark">DB</span><span><strong>Dream Bike Garage</strong><small>TECHNOLOGY LAB</small></span></a>
      ${back ? `<a class="back" href="${back.href}">← ${back.label}</a>` : '<a class="repo-link" href="https://github.com/aigemro/dream-bike-garage-lab" target="_blank" rel="noreferrer">GitHub 저장소 ↗</a>'}
    </header>
    ${content}
    <footer class="site-footer">Dream Bike Garage · 오늘부터 자전거 부자 <span>LAB v0.2</span></footer>`;
}

function renderHome() {
  destroyGame();
  const groups = ['GAME CORE', 'PLATFORM & TECHNOLOGY'] as const;
  shell(`<main>
    <section class="hero">
      <p class="eyebrow">TRACK · VARIANT · COMPARE</p>
      <h1>하나의 기능을<br /><em>여러 방안으로 검증</em></h1>
      <p class="hero-copy">먼저 실험 트랙을 선택하고, 트랙 안에서 서로 다른 구현안을 직접 체험하고 비교합니다.</p>
      <div class="summary"><span><strong>${tracks.length}</strong> 실험 트랙</span><span><strong>${allVariants.length}</strong> 전체 방안</span><span><strong>${allVariants.filter((item) => item.status === '체험 가능').length}</strong> 체험 가능</span></div>
    </section>
    ${groups.map((group) => `<section class="catalog">
      <div class="section-heading"><div><p class="eyebrow">${group}</p><h2>${group === 'GAME CORE' ? '게임 코어 트랙' : '플랫폼 기술 트랙'}</h2></div><p>트랙을 선택하면 내부의 여러 실험안을 확인할 수 있습니다.</p></div>
      <div class="grid">${tracks.filter((track) => track.group === group).map((track, index) => `
        <a class="card ${track.variants.some((item) => item.status === '체험 가능') ? 'ready' : ''}" href="#/track/${track.id}">
          <div class="card-index">${String(index + 1).padStart(2, '0')}</div><p class="category">${track.group}</p><h3>${track.title}</h3><p>${track.description}</p>
          <footer><span class="status">${track.variants.length}개 방안 · ${track.variants.filter((item) => item.status === '체험 가능').length}개 체험 가능</span><span class="arrow">→</span></footer>
        </a>`).join('')}</div>
    </section>`).join('')}
  </main>`);
}

function renderTrack(track: Track) {
  destroyGame();
  shell(`<main class="track-page">
    <section class="experiment-title"><p class="eyebrow">${track.group} · EXPERIMENT TRACK</p><h1>${track.title}</h1><p>${track.description}</p></section>
    <section class="comparison-note"><strong>비교 원칙</strong><span>각 방안은 독립 URL과 실행 화면을 가지며, 같은 질문과 조건으로 비교합니다.</span></section>
    <div class="variant-grid">${track.variants.map((item) => `
      <a class="variant-card ${item.status === '체험 가능' ? 'ready' : ''}" href="#/track/${track.id}/${item.id}">
        <div class="variant-top"><span class="variant-label">${item.label}</span><span class="status">${item.status}</span></div>
        <h2>${item.title}</h2><p>${item.description}</p>
        <dl><dt>검증 질문</dt><dd>${item.question}</dd></dl><span class="open">방안 확인 →</span>
      </a>`).join('')}</div>
  </main>`, { href: '#', label: '전체 트랙' });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#039;' })[character]!);
}

function renderMarkdown(markdown: string) {
  return markdown.split('\n').map((line) => {
    if (line.startsWith('## ')) return `<h3>${escapeHtml(line.slice(3))}</h3>`;
    if (line.startsWith('# ')) return `<h2>${escapeHtml(line.slice(2))}</h2>`;
    if (line.startsWith('- ')) return `<li>${escapeHtml(line.slice(2))}</li>`;
    return line.trim() ? `<p>${escapeHtml(line)}</p>` : '';
  }).join('');
}

function renderVariant(track: Track, variant: Variant) {
  destroyGame();
  const issueUrl = `https://github.com/aigemro/dream-bike-garage-lab/issues/${variant.issueNumber}`;
  shell(`<main class="experiment-page variant-detail-page">
    <section class="variant-detail-head">
      <div class="experiment-title"><p class="eyebrow">${track.title} · ${variant.label} · ${variant.status}</p><h1>${variant.title}</h1><p>${variant.description}</p></div>
      <aside class="variant-actions">
        <a class="issue-action" href="${issueUrl}" target="_blank" rel="noreferrer"><span>RELATED ISSUE</span><strong>Issue #${variant.issueNumber}</strong><em>GitHub에서 확인 ↗</em></a>
        ${variant.status === '체험 가능' ? `<a class="primary-action" href="#/track/${track.id}/${variant.id}/demo">체험 화면으로 이동 →</a>` : '<span class="disabled-action">체험 화면 준비 중</span>'}
      </aside>
    </section>
    <article class="implementation-doc"><p class="panel-label">IMPLEMENTATION NOTE · MARKDOWN</p>${renderMarkdown(variantDocs[variant.documentId])}</article>
  </main>`, { href: `#/track/${track.id}`, label: `${track.title} 방안 목록` });
}

function renderDemo(track: Track, variant: Variant) {
  destroyGame();
  shell(`<main class="experiment-page demo-page">
    ${variant.demo || variant.collectionDemo || variant.supplyDemo || variant.rewardDemo ? `<section class="demo-panel"><div class="demo-head"><div><span>${track.title} · ${variant.label} · LIVE DEMO · ${variant.rewardDemo ? '동일 시작 급여 1,000 · 기본 보상 500' : variant.supplyDemo ? '동일 5×4 보드 · 목표 Lv.3 ×2' : variant.collectionDemo ? '동일 데이터 · 3,000코인' : variant.demo === 'free' ? '4~10 가변 보드 · 4 PARTS · 2차 구현' : '6×7 · 4 PARTS'}</span><strong>${variant.title}</strong></div><button id="reset-demo">초기화</button></div><div id="game-root" class="demo-${variant.rewardDemo ?? variant.supplyDemo ?? variant.collectionDemo ?? variant.demo}"></div><p class="hint">${variant.controls}</p></section>` : `<section class="empty-panel"><span>VARIANT SLOT</span><h2>이 방안은 아직 준비 중입니다.</h2></section>`}
  </main>`, { href: `#/track/${track.id}/${variant.id}`, label: `${variant.title} 상세` });
  if (variant.demo || variant.collectionDemo || variant.supplyDemo || variant.rewardDemo) {
    const start = () => { destroyGame(); game = variant.rewardDemo ? startRewardPrototype('game-root', variant.rewardDemo) : variant.supplyDemo ? startSupplyPrototype('game-root', variant.supplyDemo) : variant.collectionDemo ? startCollectionPrototype('game-root', variant.collectionDemo) : startMergePrototype('game-root', variant.demo!); };
    start();
    document.querySelector('#reset-demo')?.addEventListener('click', start);
  }
}

function route() {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] !== 'track') return renderHome();
  const track = tracks.find((item) => item.id === parts[1]);
  if (!track) return renderHome();
  const variant = track.variants.find((item) => item.id === parts[2]);
  if (!variant) return renderTrack(track);
  parts[3] === 'demo' ? renderDemo(track, variant) : renderVariant(track, variant);
}

window.addEventListener('hashchange', route);
route();
