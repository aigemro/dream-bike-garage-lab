# Dream Bike Garage Lab

**Dream Bike Garage(오늘부터 자전거 부자)**의 게임 코어 비교 실험과 기술 검증을 위한 저장소입니다.

완성 게임과 기획·설계의 기준은 메인 저장소에서 관리하고, 여러 구현안의 비교·기술 선택·앱인토스 호환성 검증은 이 Lab에서 관리합니다.

- 메인 저장소: [aigemro/dream-bike-garage](https://github.com/aigemro/dream-bike-garage)
- Lab 실행 화면: [GitHub Pages](https://aigemro.github.io/dream-bike-garage-lab/)
- 기술 구성: [docs/TECH_STACK.md](docs/TECH_STACK.md)
- Phaser + Vite 실행·배포 기준: [docs/PHASER_VITE_GUIDE.md](docs/PHASER_VITE_GUIDE.md)
- 실험 운영 기준: [docs/EXPERIMENT_GUIDE.md](docs/EXPERIMENT_GUIDE.md)
- 전체 트랙·프로토타입 지도: [docs/LAB_PROTOTYPE_MAP.md](docs/LAB_PROTOTYPE_MAP.md)
- GitHub Issue 의견 연동: [docs/GITHUB_ISSUE_INTEGRATION.md](docs/GITHUB_ISSUE_INTEGRATION.md)
- 메인 프로젝트와의 역할 경계: [docs/PROJECT_BOUNDARY.md](docs/PROJECT_BOUNDARY.md)

## Lab의 역할

Lab은 기능 하나를 완성하는 저장소가 아니라, 같은 게임 코어에 대해 여러 방안을 직접 만들고 비교하는 실험실입니다.

```text
게임 코어 카테고리
└── 실험 트랙
    ├── Prototype A
    ├── Prototype B
    └── Prototype C
         ↓
    공통 기준으로 비교
         ↓
    채택 / 조건부 채택 / 보류 / 폐기
         ↓
    선택된 결과만 메인 프로젝트에 재구현
```

## 실험 트랙

### Game Core

| 트랙 | 실험 예시 | 확인할 핵심 |
|---|---|---|
| Merge Mechanics | 자유 보드 머지, 주문 중심 머지, 체인/콤보 머지 | 조작감, 전략성, 반복 재미, 주문과의 연결 |
| Collection | 도감형, 전시형 Garage, 성장형 Dream Bike | 수집 동기, 완성감, 장기 목표, 반복 플레이 연결 |
| Order & Assembly | 부품 납품형, 슬롯 조립형, 단계별 조립형 | 주문 이해도, 머지 결과의 사용감 |
| Reward & Progression | 급여 중심, 컬렉션 해금, 드림 바이크 성장 | 보상 체감, 다음 플레이 동기 |

처음에는 **Merge Mechanics**와 **Collection**을 우선 트랙으로 운영합니다. 실험안은 A/B/C로 고정하지 않고 필요할 때 계속 추가할 수 있습니다.

### Platform & Technology

| 트랙 | 검증 내용 |
|---|---|
| Input & Responsive | 마우스·터치, 화면 비율, Safe Area |
| Persistence | localStorage, IndexedDB, 서버 저장 |
| Toss WebView | 앱인토스 SDK, 라이프사이클, 로그인 |
| Monetization & Operations | 결제, 광고, 성능, 분석, 오류 수집 |

게임 코어의 재미 비교와 플랫폼 기술 검증을 같은 목록에 섞지 않고 별도 트랙으로 관리합니다.

## Lab 화면 구성

1. 메인 화면에서 **Game Core**와 **Platform & Technology** 영역을 구분합니다.
2. Game Core에서 머지·수집 등 원하는 트랙을 선택합니다.
3. 트랙 화면에서 Prototype A/B/C를 같은 기준으로 비교합니다.
4. 방안 카드를 선택하면 구현 설명과 연결 Issue 댓글을 확인합니다.
5. `체험 화면으로 이동` 버튼을 눌러 독립 실행 화면으로 이동합니다.
6. 의견은 `GitHub에서 댓글 등록` 버튼으로 연결된 Issue에서 등록합니다.
7. 비교 결과를 남기고 선택된 결과만 메인 저장소의 Issue로 연결합니다.

## 프로토타입 공통 정보

각 실험 카드와 결과 문서는 아래 정보를 가집니다.

- 실험 ID와 버전
- 해결하려는 질문과 가설
- 조작 방법
- 공통 평가 항목
- 현재 상태: 준비 / 진행 / 검토 / 완료 / 보류 / 폐기
- 결과: 채택 / 조건부 채택 / 보류 / 폐기
- 관련 Issue와 메인 반영 Issue
- 스크린샷 또는 짧은 플레이 기록

## 현재 기술 구성

| 영역 | 기술 | 용도 |
|---|---|---|
| 언어 | TypeScript 5.8 | 게임과 실험 코드 |
| 게임 엔진 | Phaser 3.90 | Canvas 렌더링, Scene, 입력 |
| 개발·빌드 | Vite 7 | 개발 서버와 정적 빌드 |
| 패키지 관리 | npm | 의존성 및 재현 가능한 설치 |
| 런타임 | Node.js 20.19 이상 | 로컬 개발과 CI |
| 배포 | GitHub Actions + GitHub Pages | main 반영 시 Lab 화면 배포 |
| 목표 화면 | 모바일 세로 우선 | 브라우저 및 WebView 검증 |
| 출시 검증 | 앱인토스 WebView | SDK, 입력, 저장, 결제·광고 실험 |

## 권장 저장소 구조

```text
src/
├── catalog/                         # 카테고리·트랙·실험 메타데이터
├── experiments/
│   ├── game-core/
│   │   ├── merge/
│   │   │   ├── prototype-a/
│   │   │   ├── prototype-b/
│   │   │   └── prototype-c/
│   │   ├── collection/
│   │   │   ├── prototype-a/
│   │   │   └── prototype-b/
│   │   ├── order-assembly/
│   │   └── reward-progression/
│   └── platform/
│       ├── input-responsive/
│       ├── persistence/
│       └── toss-webview/
├── shared/                          # 두 개 이상 실험에서 검증된 공통 코드만 배치
└── ui/                              # Lab 카탈로그와 비교 화면

docs/
├── tracks/                          # 트랙별 질문·공통 평가 기준
├── experiments/                     # 프로토타입별 결과 기록
├── decisions/                       # 최종 기술·게임 코어 결정(ADR)
├── TECH_STACK.md
└── EXPERIMENT_GUIDE.md
```

공통화가 검증되지 않은 코드는 각 프로토타입 안에 둡니다. 실험끼리 억지로 같은 구조를 쓰게 만들지 않아야 비교가 왜곡되지 않습니다.

## 실행 방법

Node.js 20.19 이상이 필요합니다.

```bash
npm ci
npm run dev
```

프로덕션 빌드 확인:

```bash
npm run build
npm run preview
```

## 운영 원칙

1. 기획·게임 규칙·화면 설계의 최종 기준은 메인 저장소에서 관리합니다.
2. Lab에서는 하나의 방안을 바로 정답으로 확정하지 않고 비교 가능한 프로토타입으로 만듭니다.
3. 같은 트랙의 실험은 가능한 한 같은 초기 조건과 평가 항목으로 비교합니다.
4. 실패한 실험도 원인과 배운 점을 남깁니다.
5. 게임 코어 비교와 플랫폼 기술 검증을 별도 트랙으로 관리합니다.
6. Lab 코드를 메인에 그대로 복사하지 않고 메인 구조와 설계 기준에 맞게 적용합니다.
7. 앱인토스 관련 구현은 실험 시점의 공식 문서를 다시 확인합니다.
