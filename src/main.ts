import Phaser from 'phaser';
import './styles.css';
import variantDocs from './variant-docs';
import { startMergePrototype, type MergePrototypeMode } from './merge-prototype';

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
        description: '자유 보드에서 부품 두 개를 차례로 선택하여 합치는 현재 기준안입니다.',
        status: '체험 가능',
        question: '모바일에서도 가장 단순한 입력만으로 머지 규칙을 쉽게 이해할 수 있는가?',
        controls: '빈 칸을 눌러 생성하고, 같은 단계의 부품 두 개를 차례로 누릅니다.',
        demo: 'free', issueNumber: 10, documentId: 'merge-free-board',
      },
      {
        id: 'order-merge',
        label: 'B안',
        title: '주문 목표 중심 머지',
        description: '고객 주문에 필요한 부품을 먼저 보여주고 목표를 향해 머지하는 방식입니다.',
        status: '체험 가능',
        question: '자유 보드보다 목표성과 플레이 템포가 좋아지는가?',
        controls: '주문 목표를 확인하고 필요한 종류를 생성해 요구 단계까지 머지한 뒤 납품합니다.',
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
    ],
  },
  {
    id: 'collection',
    group: 'GAME CORE',
    title: '자전거 수집',
    description: '완성한 자전거를 어떻게 보여주고 성장 동기로 연결할지 비교합니다.',
    variants: [
      { id: 'catalog', label: 'A안', title: '도감형 수집', description: '종류와 등급별 빈칸을 채우는 방식입니다.', status: '준비 중', question: '미완성 항목이 다음 수집 동기를 만드는가?', controls: '자전거를 획득하고 도감의 빈칸을 확인합니다.', issueNumber: 14, documentId: 'collection-catalog' },
      { id: 'garage', label: 'B안', title: 'Garage 전시', description: '보유 자전거를 공간에 배치하고 감상하는 방식입니다.', status: '준비 중', question: '전시가 자전거 소유감과 애착을 높이는가?', controls: '자전거를 선택해 Garage에 배치합니다.', issueNumber: 12, documentId: 'collection-garage' },
      { id: 'dream-bike', label: 'C안', title: '드림 바이크 성장', description: '한 대의 자전거를 지속적으로 업그레이드하는 방식입니다.', status: '준비 중', question: '집중 성장 방식이 장기 목표를 더 선명하게 만드는가?', controls: '획득한 재화와 부품으로 내 자전거를 성장시킵니다.', issueNumber: 11, documentId: 'collection-dream-bike' },
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
    id: 'input-responsive',
    group: 'PLATFORM & TECHNOLOGY',
    title: '입력과 반응형 화면',
    description: '마우스·터치 입력과 다양한 화면 비율의 동작을 비교합니다.',
    variants: [
      { id: 'pointer-input', label: 'A안', title: '통합 Pointer 입력', description: '마우스와 터치를 하나의 입력 흐름으로 처리합니다.', status: '준비 중', question: '기기별 입력 차이를 안정적으로 흡수하는가?', controls: '마우스와 터치로 동일 동작을 반복합니다.', issueNumber: 4, documentId: 'input-pointer' },
      { id: 'fit-layout', label: 'B안', title: '화면 맞춤형 레이아웃', description: '게임 전체를 화면 안에 맞추고 여백을 조절합니다.', status: '준비 중', question: '주요 해상도에서 잘림 없이 조작 가능한가?', controls: '화면 크기와 방향을 바꿔 레이아웃을 확인합니다.', issueNumber: 4, documentId: 'input-layout' },
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
  shell(`<main class="experiment-page">
    <section class="experiment-title"><p class="eyebrow">${track.title} · ${variant.label} · ${variant.status}</p><h1>${variant.title}</h1><p>${variant.description}</p></section>
    <section class="variant-meta"><div><span>검증 질문</span><strong>${variant.question}</strong></div><div><span>조작 방법</span><strong>${variant.controls}</strong></div></section>
    <div class="detail-layout">
      <article class="implementation-doc"><p class="panel-label">IMPLEMENTATION NOTE · MARKDOWN</p>${renderMarkdown(variantDocs[variant.documentId])}</article>
      <aside class="discussion-panel">
        <div class="discussion-head"><div><p class="panel-label">GITHUB DISCUSSION</p><h2>Issue #${variant.issueNumber} 의견</h2></div><a href="${issueUrl}" target="_blank" rel="noreferrer">Issue 열기 ↗</a></div>
        <div id="issue-comments" class="comments"><p class="comment-state">댓글을 불러오는 중입니다.</p></div>
        <label class="comment-compose"><span>의견 작성</span><textarea id="comment-draft" rows="4" placeholder="이 방안에 대한 의견을 작성하세요."></textarea></label>
        <button id="open-comment" class="secondary-action">내용 복사 후 GitHub에서 등록</button>
        <p class="auth-note">보안을 위해 GitHub에서 로그인한 뒤 Issue 댓글로 등록합니다.</p>
      </aside>
    </div>
    <section class="launch-panel"><div><p class="panel-label">PROTOTYPE</p><h2>${variant.status === '체험 가능' ? '상세 내용을 확인했다면 방안을 직접 체험해보세요.' : '이 방안은 아직 구현 준비 중입니다.'}</h2></div>${variant.status === '체험 가능' ? `<a class="primary-action" href="#/track/${track.id}/${variant.id}/demo">체험 화면으로 이동 →</a>` : '<span class="disabled-action">준비 중</span>'}</section>
  </main>`, { href: `#/track/${track.id}`, label: `${track.title} 방안 목록` });
  loadIssueComments(variant.issueNumber);
  document.querySelector('#open-comment')?.addEventListener('click', async () => {
    const draft = (document.querySelector<HTMLTextAreaElement>('#comment-draft')?.value ?? '').trim();
    if (draft) await navigator.clipboard?.writeText(draft).catch(() => undefined);
    window.open(`${issueUrl}#new_comment_field`, '_blank', 'noopener,noreferrer');
  });
}

async function loadIssueComments(issueNumber: number) {
  const target = document.querySelector<HTMLDivElement>('#issue-comments');
  if (!target) return;
  try {
    const response = await fetch(`https://api.github.com/repos/aigemro/dream-bike-garage-lab/issues/${issueNumber}/comments`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) throw new Error(String(response.status));
    const comments = await response.json() as Array<{ id: number; body: string; created_at: string; user: { login: string; avatar_url: string; html_url: string } }>;
    target.innerHTML = comments.length ? comments.map((comment) => `<article class="comment"><header><img src="${comment.user.avatar_url}" alt="" /><a href="${comment.user.html_url}" target="_blank" rel="noreferrer">${escapeHtml(comment.user.login)}</a><time>${new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(comment.created_at))}</time></header><div>${renderMarkdown(comment.body)}</div></article>`).join('') : '<p class="comment-state">아직 등록된 의견이 없습니다. 첫 의견을 남겨보세요.</p>';
  } catch {
    target.innerHTML = '<p class="comment-state">댓글을 불러오지 못했습니다. GitHub Issue에서 직접 확인할 수 있습니다.</p>';
  }
}

function renderDemo(track: Track, variant: Variant) {
  destroyGame();
  shell(`<main class="experiment-page"><section class="experiment-title"><p class="eyebrow">${track.title} · ${variant.label} · LIVE DEMO</p><h1>${variant.title}</h1><p>${variant.controls}</p></section>
    ${variant.demo ? `<section class="demo-panel"><div class="demo-head"><div><span>LIVE DEMO · 6×7 · 4 PARTS</span><strong>${variant.title}</strong></div><button id="reset-demo">초기화</button></div><div id="game-root"></div><p class="hint">${variant.controls}</p></section>` : `<section class="empty-panel"><span>VARIANT SLOT</span><h2>이 방안은 아직 준비 중입니다.</h2></section>`}
  </main>`, { href: `#/track/${track.id}/${variant.id}`, label: `${variant.title} 상세` });
  if (variant.demo) {
    const start = () => { destroyGame(); game = startMergePrototype('game-root', variant.demo!); };
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
