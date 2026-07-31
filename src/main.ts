import Phaser from 'phaser';
import './styles.css';

type Status = '체험 가능' | '준비 중';
type Variant = {
  id: string;
  label: string;
  title: string;
  description: string;
  status: Status;
  question: string;
  controls: string;
  demo?: 'tap-merge';
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
        title: '탭 선택 머지',
        description: '부품 두 개를 차례로 선택하여 합치는 현재 기준안입니다.',
        status: '체험 가능',
        question: '모바일에서도 가장 단순한 입력만으로 머지 규칙을 쉽게 이해할 수 있는가?',
        controls: '빈 칸을 눌러 생성하고, 같은 단계의 부품 두 개를 차례로 누릅니다.',
        demo: 'tap-merge',
      },
      {
        id: 'drag-merge',
        label: 'B안',
        title: '드래그 머지',
        description: '부품을 직접 끌어 같은 부품 위에 놓는 전통적인 머지 방식입니다.',
        status: '준비 중',
        question: '직접 움직이는 손맛이 탭 방식보다 명확하고 재미있는가?',
        controls: '부품을 드래그해 같은 단계의 부품 위에 놓습니다.',
      },
      {
        id: 'auto-merge',
        label: 'C안',
        title: '자동 머지',
        description: '같은 부품이 조건을 만족하면 자동으로 합쳐져 빠른 템포를 만드는 방식입니다.',
        status: '준비 중',
        question: '조작 부담을 줄이면서도 플레이어의 선택과 성취감을 유지할 수 있는가?',
        controls: '부품을 생성·배치하면 조건에 따라 자동 머지가 실행됩니다.',
      },
    ],
  },
  {
    id: 'collection',
    group: 'GAME CORE',
    title: '자전거 수집',
    description: '완성한 자전거를 어떻게 보여주고 성장 동기로 연결할지 비교합니다.',
    variants: [
      { id: 'catalog', label: 'A안', title: '도감형 수집', description: '종류와 등급별 빈칸을 채우는 방식입니다.', status: '준비 중', question: '미완성 항목이 다음 수집 동기를 만드는가?', controls: '자전거를 획득하고 도감의 빈칸을 확인합니다.' },
      { id: 'garage', label: 'B안', title: 'Garage 전시', description: '보유 자전거를 공간에 배치하고 감상하는 방식입니다.', status: '준비 중', question: '전시가 자전거 소유감과 애착을 높이는가?', controls: '자전거를 선택해 Garage에 배치합니다.' },
      { id: 'dream-bike', label: 'C안', title: '드림 바이크 성장', description: '한 대의 자전거를 지속적으로 업그레이드하는 방식입니다.', status: '준비 중', question: '집중 성장 방식이 장기 목표를 더 선명하게 만드는가?', controls: '획득한 재화와 부품으로 내 자전거를 성장시킵니다.' },
    ],
  },
  {
    id: 'order-assembly',
    group: 'GAME CORE',
    title: '주문과 조립',
    description: '머지한 부품이 고객 주문과 자전거 조립으로 이어지는 방식을 검증합니다.',
    variants: [
      { id: 'parts-delivery', label: 'A안', title: '부품 납품형', description: '요구 부품을 완성하면 즉시 주문에 납품합니다.', status: '준비 중', question: '주문 목표를 가장 빠르게 이해할 수 있는가?', controls: '완성 부품을 주문 슬롯으로 전달합니다.' },
      { id: 'assembly-slots', label: 'B안', title: '슬롯 조립형', description: '프레임·휠·구동계 슬롯을 모두 채워 자전거를 완성합니다.', status: '준비 중', question: '자전거를 조립한다는 느낌이 충분히 전달되는가?', controls: '부품을 해당 조립 슬롯에 장착합니다.' },
    ],
  },
  {
    id: 'input-responsive',
    group: 'PLATFORM & TECHNOLOGY',
    title: '입력과 반응형 화면',
    description: '마우스·터치 입력과 다양한 화면 비율의 동작을 비교합니다.',
    variants: [
      { id: 'pointer-input', label: 'A안', title: '통합 Pointer 입력', description: '마우스와 터치를 하나의 입력 흐름으로 처리합니다.', status: '준비 중', question: '기기별 입력 차이를 안정적으로 흡수하는가?', controls: '마우스와 터치로 동일 동작을 반복합니다.' },
      { id: 'fit-layout', label: 'B안', title: '화면 맞춤형 레이아웃', description: '게임 전체를 화면 안에 맞추고 여백을 조절합니다.', status: '준비 중', question: '주요 해상도에서 잘림 없이 조작 가능한가?', controls: '화면 크기와 방향을 바꿔 레이아웃을 확인합니다.' },
    ],
  },
  {
    id: 'persistence',
    group: 'PLATFORM & TECHNOLOGY',
    title: '진행 상태 저장',
    description: '보드와 재화를 유지하는 저장 방식을 단계적으로 비교합니다.',
    variants: [
      { id: 'local-storage', label: 'A안', title: 'localStorage', description: '가장 단순한 브라우저 저장 방식입니다.', status: '준비 중', question: 'MVP 진행 상태를 충분히 안정적으로 보존하는가?', controls: '플레이 후 새로고침하고 상태를 비교합니다.' },
      { id: 'indexed-db', label: 'B안', title: 'IndexedDB', description: '더 큰 구조화 데이터를 브라우저에 저장합니다.', status: '준비 중', question: '복잡한 상태와 버전 변경을 관리하기 쉬운가?', controls: '여러 저장 슬롯과 데이터 변경을 검증합니다.' },
    ],
  },
  {
    id: 'toss-webview',
    group: 'PLATFORM & TECHNOLOGY',
    title: '앱인토스 WebView',
    description: '토스 앱 내부 환경에서 필요한 기능을 작은 실험으로 분리해 확인합니다.',
    variants: [
      { id: 'lifecycle', label: 'A안', title: '라이프사이클', description: '진입·백그라운드·복귀 시 게임 상태를 확인합니다.', status: '준비 중', question: '앱 전환 뒤에도 게임이 정상 복귀하는가?', controls: '앱 상태를 전환하고 게임 상태를 비교합니다.' },
      { id: 'sdk-bridge', label: 'B안', title: 'SDK 연결', description: '앱인토스 기능을 어댑터를 통해 호출합니다.', status: '준비 중', question: '웹 게임 코드와 플랫폼 기능을 분리할 수 있는가?', controls: '지원 기능 호출과 실패 처리를 확인합니다.' },
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

function renderVariant(track: Track, variant: Variant) {
  destroyGame();
  const ready = variant.status === '체험 가능';
  shell(`<main class="experiment-page">
    <section class="experiment-title"><p class="eyebrow">${track.title} · ${variant.label} · ${variant.status}</p><h1>${variant.title}</h1><p>${variant.description}</p></section>
    <section class="variant-meta"><div><span>검증 질문</span><strong>${variant.question}</strong></div><div><span>조작 방법</span><strong>${variant.controls}</strong></div></section>
    ${ready ? `<section class="demo-panel"><div class="demo-head"><div><span>LIVE DEMO</span><strong>${variant.title}</strong></div><button id="reset-demo">초기화</button></div><div id="game-root"></div><p class="hint">${variant.controls}</p></section>`
      : `<section class="empty-panel"><span>VARIANT SLOT</span><h2>이 방안은 아직 준비 중입니다.</h2><p>별도 Issue에서 구현한 뒤 이 URL에 데모와 비교 결과를 연결할 수 있습니다.</p></section>`}
  </main>`, { href: `#/track/${track.id}`, label: `${track.title} 방안 목록` });
  if (variant.demo === 'tap-merge') {
    startMergeDemo();
    document.querySelector('#reset-demo')?.addEventListener('click', startMergeDemo);
  }
}

class MergeScene extends Phaser.Scene {
  private cells: Array<{ level: number; item?: Phaser.GameObjects.Container }> = [];
  private selected = -1;
  private info!: Phaser.GameObjects.Text;
  create() {
    this.cameras.main.setBackgroundColor('#0b1727');
    this.add.text(24, 20, 'TAP SELECT MERGE', { fontFamily: 'Arial', fontSize: '14px', color: '#55d6be', fontStyle: 'bold' });
    this.info = this.add.text(616, 22, '부품 0개', { fontFamily: 'Arial', fontSize: '14px', color: '#aebfd0' }).setOrigin(1, 0);
    for (let i = 0; i < 12; i += 1) {
      const x = 56 + (i % 4) * 142;
      const y = 78 + Math.floor(i / 4) * 122;
      const zone = this.add.rectangle(x, y, 112, 94, 0x13263b).setStrokeStyle(2, 0x28455f).setInteractive({ useHandCursor: true });
      this.add.text(x, y, '+', { fontFamily: 'Arial', fontSize: '24px', color: '#36546d' }).setOrigin(0.5);
      this.cells.push({ level: 0 });
      zone.on('pointerdown', () => this.handleCell(i, x, y));
    }
  }
  private handleCell(index: number, x: number, y: number) {
    const cell = this.cells[index];
    if (!cell.item) {
      cell.level = 1; cell.item = this.makeItem(x, y, 1); this.updateInfo('새 부품을 생성했습니다.'); return;
    }
    if (this.selected < 0) {
      this.selected = index; cell.item.setScale(1.1); this.updateInfo('같은 단계의 부품을 선택하세요.'); return;
    }
    const previous = this.cells[this.selected];
    previous.item?.setScale(1);
    if (this.selected !== index && previous.level === cell.level) {
      previous.item?.destroy(); previous.item = undefined; previous.level = 0;
      cell.level += 1; cell.item?.destroy(); cell.item = this.makeItem(x, y, cell.level);
      this.updateInfo(`Level ${cell.level} 부품으로 머지했습니다!`);
    } else this.updateInfo('같은 단계의 다른 부품이 필요합니다.');
    this.selected = -1;
  }
  private makeItem(x: number, y: number, level: number) {
    const colors = [0x55d6be, 0xffb35c, 0xff6b6b, 0x8c7bff];
    return this.add.container(x, y, [
      this.add.circle(0, 0, 32, colors[(level - 1) % colors.length]),
      this.add.text(0, -5, '⚙', { fontSize: '25px' }).setOrigin(0.5),
      this.add.text(0, 24, `L${level}`, { fontFamily: 'Arial', fontSize: '12px', color: '#07111f', fontStyle: 'bold' }).setOrigin(0.5),
    ]);
  }
  private updateInfo(message: string) {
    this.info.setText(`${message}  ·  부품 ${this.cells.filter((cell) => cell.item).length}개`);
  }
}

function startMergeDemo() {
  destroyGame();
  game = new Phaser.Game({ type: Phaser.AUTO, parent: 'game-root', width: 640, height: 440, backgroundColor: '#0b1727', scene: MergeScene, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH } });
}

function route() {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] !== 'track') return renderHome();
  const track = tracks.find((item) => item.id === parts[1]);
  if (!track) return renderHome();
  const variant = track.variants.find((item) => item.id === parts[2]);
  variant ? renderVariant(track, variant) : renderTrack(track);
}

window.addEventListener('hashchange', route);
route();
