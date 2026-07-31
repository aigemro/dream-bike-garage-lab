import Phaser from 'phaser';
import './styles.css';

type Experiment = {
  id: string;
  category: string;
  title: string;
  description: string;
  status: '체험 가능' | '준비 중';
};

const experiments: Experiment[] = [
  {
    id: 'merge-core',
    category: 'GAME LOGIC',
    title: '머지 코어',
    description: '같은 단계의 자전거 부품 두 개를 합쳐 다음 단계로 성장시키는 핵심 규칙입니다.',
    status: '체험 가능',
  },
  {
    id: 'drag-and-drop',
    category: 'INPUT',
    title: '드래그 앤 드롭',
    description: '마우스와 모바일 터치 환경에서 부품을 선택하고 이동하는 방식을 검증합니다.',
    status: '준비 중',
  },
  {
    id: 'persistence',
    category: 'DATA',
    title: '진행 상태 저장',
    description: '새로고침하거나 다시 방문해도 보드와 재화가 유지되는지 검증합니다.',
    status: '준비 중',
  },
  {
    id: 'responsive-ui',
    category: 'DISPLAY',
    title: '반응형 게임 화면',
    description: '모바일과 데스크톱에서 게임 전체가 한 화면에 들어오는 구성을 실험합니다.',
    status: '준비 중',
  },
  {
    id: 'toss-webview',
    category: 'PLATFORM',
    title: '앱인토스 WebView',
    description: '토스 앱 내부 WebView의 실행 환경과 제약을 단계적으로 확인합니다.',
    status: '준비 중',
  },
];

const app = document.querySelector<HTMLDivElement>('#app')!;
let game: Phaser.Game | undefined;

function destroyGame() {
  game?.destroy(true);
  game = undefined;
}

function renderHome() {
  destroyGame();
  app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="#">
        <span class="brand-mark">DB</span>
        <span><strong>Dream Bike Garage</strong><small>TECHNOLOGY LAB</small></span>
      </a>
      <a class="repo-link" href="https://github.com/aigemro/dream-bike-garage-lab" target="_blank" rel="noreferrer">GitHub 저장소 ↗</a>
    </header>
    <main>
      <section class="hero">
        <p class="eyebrow">BUILD · TEST · LEARN</p>
        <h1>게임 기술을 작게 만들고<br /><em>직접 검증하는 공간</em></h1>
        <p class="hero-copy">Dream Bike Garage에 적용할 기능을 독립적으로 구현하고, 클릭해서 바로 체험할 수 있습니다.</p>
        <div class="summary">
          <span><strong>${experiments.length}</strong> 전체 실험</span>
          <span><strong>${experiments.filter((item) => item.status === '체험 가능').length}</strong> 체험 가능</span>
          <span><strong>Phaser 3</strong> 게임 엔진</span>
        </div>
      </section>
      <section class="catalog">
        <div class="section-heading">
          <div><p class="eyebrow">EXPERIMENT CATALOG</p><h2>기능 실험실</h2></div>
          <p>각 카드를 눌러 구현 상태와 실험 화면을 확인하세요.</p>
        </div>
        <div class="grid">
          ${experiments.map((item, index) => `
            <a class="card ${item.status === '체험 가능' ? 'ready' : ''}" href="#/${item.id}">
              <div class="card-index">${String(index + 1).padStart(2, '0')}</div>
              <p class="category">${item.category}</p>
              <h3>${item.title}</h3>
              <p>${item.description}</p>
              <footer><span class="status">${item.status}</span><span class="arrow">→</span></footer>
            </a>
          `).join('')}
        </div>
      </section>
    </main>
    <footer class="site-footer">Dream Bike Garage · 오늘부터 자전거 부자 <span>LAB v0.1</span></footer>
  `;
}

function renderExperiment(experiment: Experiment) {
  destroyGame();
  const ready = experiment.status === '체험 가능';
  app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="#"><span class="brand-mark">DB</span><span><strong>Dream Bike Garage</strong><small>TECHNOLOGY LAB</small></span></a>
      <a class="back" href="#">← 실험 목록</a>
    </header>
    <main class="experiment-page">
      <section class="experiment-title">
        <p class="eyebrow">${experiment.category} · ${experiment.status}</p>
        <h1>${experiment.title}</h1>
        <p>${experiment.description}</p>
      </section>
      ${ready ? `
        <section class="demo-panel">
          <div class="demo-head"><div><span>LIVE DEMO</span><strong>부품 생성 및 2-to-1 머지</strong></div><button id="reset-demo">초기화</button></div>
          <div id="game-root"></div>
          <p class="hint">빈 칸을 눌러 부품을 만드세요. 같은 색과 같은 단계의 부품을 차례로 누르면 머지됩니다.</p>
        </section>
      ` : `
        <section class="empty-panel">
          <span>EXPERIMENT SLOT</span>
          <h2>이 실험은 아직 준비 중입니다.</h2>
          <p>기능 구현이 시작되면 이 화면에서 목적, 성공 조건, 직접 실행 가능한 데모와 검증 결과를 함께 제공합니다.</p>
        </section>
      `}
    </main>
  `;
  if (ready) {
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
    this.add.text(24, 20, 'MERGE TEST BOARD', { fontFamily: 'Arial', fontSize: '14px', color: '#55d6be', fontStyle: 'bold' });
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
      cell.level = 1;
      cell.item = this.makeItem(x, y, 1);
      this.updateInfo('새 부품을 생성했습니다.');
      return;
    }
    if (this.selected < 0) {
      this.selected = index;
      cell.item.setScale(1.1);
      this.updateInfo('같은 단계의 부품을 선택하세요.');
      return;
    }
    const previous = this.cells[this.selected];
    previous.item?.setScale(1);
    if (this.selected !== index && previous.level === cell.level) {
      previous.item?.destroy();
      previous.item = undefined;
      previous.level = 0;
      cell.level += 1;
      cell.item?.destroy();
      cell.item = this.makeItem(x, y, cell.level);
      this.updateInfo(`Level ${cell.level} 부품으로 머지했습니다!`);
    } else {
      this.updateInfo('같은 단계의 다른 부품이 필요합니다.');
    }
    this.selected = -1;
  }

  private makeItem(x: number, y: number, level: number) {
    const colors = [0x55d6be, 0xffb35c, 0xff6b6b, 0x8c7bff];
    const circle = this.add.circle(0, 0, 32, colors[(level - 1) % colors.length]);
    const icon = this.add.text(0, -5, '⚙', { fontSize: '25px' }).setOrigin(0.5);
    const label = this.add.text(0, 24, `L${level}`, { fontFamily: 'Arial', fontSize: '12px', color: '#07111f', fontStyle: 'bold' }).setOrigin(0.5);
    return this.add.container(x, y, [circle, icon, label]);
  }

  private updateInfo(message: string) {
    const count = this.cells.filter((cell) => cell.item).length;
    this.info.setText(`${message}  ·  부품 ${count}개`);
  }
}

function startMergeDemo() {
  destroyGame();
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-root',
    width: 640,
    height: 440,
    backgroundColor: '#0b1727',
    scene: MergeScene,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  });
}

function route() {
  const id = window.location.hash.replace('#/', '');
  const experiment = experiments.find((item) => item.id === id);
  experiment ? renderExperiment(experiment) : renderHome();
}

window.addEventListener('hashchange', route);
route();
