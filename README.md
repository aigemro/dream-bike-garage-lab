# Dream Bike Garage Lab

**Dream Bike Garage(오늘부터 자전거 부자)**의 기술 검증과 프로토타이핑을 위한 실험 저장소입니다.

완성 게임과 기획·설계의 기준은 메인 저장소에서 관리하고, 기술 선택·기능 실험·앱인토스 호환성 검증은 이 Lab에서 관리합니다.

- 메인 저장소: [aigemro/dream-bike-garage](https://github.com/aigemro/dream-bike-garage)
- Lab 실행 화면: [GitHub Pages](https://aigemro.github.io/dream-bike-garage-lab/)
- 기술 구성: [docs/TECH_STACK.md](docs/TECH_STACK.md)
- 실험 운영 기준: [docs/EXPERIMENT_GUIDE.md](docs/EXPERIMENT_GUIDE.md)

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

메인 게임과 동일하게 **Phaser + TypeScript + Vite**를 기본으로 사용합니다. React, 백엔드, 데이터베이스, 모바일 패키징 도구는 필요성과 실험 결과가 확인되기 전까지 기본 스택으로 확정하지 않습니다.

## Lab 화면 운영 방식

Lab은 폴더만 모아두는 저장소가 아니라 기능 카탈로그 형태의 웹사이트로 운영합니다.

1. 메인 화면에서 실험 카드와 현재 상태를 확인합니다.
2. 카드를 선택해 기능별 독립 실험 화면으로 이동합니다.
3. 직접 조작하며 마우스·터치·화면 크기별 동작을 검토합니다.
4. 실험 결과와 결론을 문서에 남깁니다.
5. 검증된 결과만 메인 저장소의 구조에 맞게 다시 적용합니다.

## 실험 목록

| 실험 | 검증 내용 | 상태 |
|---|---|---|
| Merge Core | 부품 생성과 동일 단계 2-to-1 머지 | 진행 |
| Drag & Drop | 마우스·터치 입력과 칸 이동 | 준비 |
| Persistence | 새로고침과 앱 복귀 후 상태 저장 | 준비 |
| Responsive UI | 다양한 모바일 화면과 Safe Area 대응 | 준비 |
| Toss WebView | 앱인토스 SDK 및 WebView 제약 | 준비 |

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

## 저장소 구조

```text
.
├── src/
│   ├── experiments/       # 기능별 실행 가능한 실험
│   ├── game/              # Phaser 공통 설정과 Scene
│   └── ui/                # Lab 카탈로그와 공통 UI
├── docs/
│   ├── TECH_STACK.md      # 기술 구성, 플랫폼 및 검증 우선순위
│   ├── EXPERIMENT_GUIDE.md
│   └── decisions/         # 기술 결정 기록(ADR)
├── .github/
│   └── workflows/         # 빌드 및 GitHub Pages 배포
└── package.json
```

실제 디렉터리는 실험 추가에 따라 확장하며, 공통화가 검증되지 않은 코드를 성급하게 공유 모듈로 이동하지 않습니다.

## 운영 원칙

1. 기획·게임 규칙·화면 설계는 메인 저장소에서 관리합니다.
2. 기술 가능성, 구현 방식 비교, 성능과 플랫폼 제약은 Lab에서 검증합니다.
3. 실험 전 목적과 성공 조건을 작성합니다.
4. 실패한 실험도 원인과 배운 점을 남깁니다.
5. 기술 결정은 [docs/decisions](docs/decisions)에 기록합니다.
6. Lab 코드를 메인에 그대로 복사하지 않고 메인 구조와 설계 기준에 맞게 적용합니다.
7. 앱인토스 관련 구현은 공식 문서의 최신 요구사항을 실험 시점에 다시 확인합니다.
