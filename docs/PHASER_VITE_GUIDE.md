# Phaser + Vite 실행 및 배포 기준

> 기준일: 2026-08-03  
> 관련 Issue: [#2 Phaser + Vite 기본 실행 및 배포 기준 검증](https://github.com/aigemro/dream-bike-garage-lab/issues/2)

이 문서는 Dream Bike Garage Lab의 기본 개발 환경과 GitHub Pages 배포 기준을 정의합니다. 새 실험안도 이 기준 위에서 만들고, 다른 구성이 필요한 경우 해당 실험 문서에 차이를 기록합니다.

## 1. 검증 결과

| 항목 | 기준 | 검증 결과 |
|---|---|---|
| Node.js | 20.19 이상 | `package.json`의 `engines`로 명시 |
| 패키지 설치 | `npm ci` | `package-lock.json` 기준 설치 성공 |
| 게임 엔진 | Phaser 3.90 | 최소 `Phaser.Scene`과 Canvas 실행 코드 확인 |
| 개발·빌드 | Vite 7 + TypeScript | `npm run build` 성공 |
| 로컬 배포본 확인 | `npm run preview` | `dist` 정적 결과 확인용 명령 제공 |
| Pages 경로 | `/dream-bike-garage-lab/` | `vite.config.ts`의 `base`와 저장소명 일치 |
| 자동 배포 | `main` push | GitHub Actions가 `dist`를 Pages에 배포 |
| 공개 주소 | https://aigemro.github.io/dream-bike-garage-lab/ | HTTP 200 응답 확인 |

현재 자동화된 테스트 명령은 없습니다. Issue에서 말하는 기본 테스트는 개발 서버 화면 확인과 프로덕션 빌드·Preview 확인을 뜻합니다. 도메인 규칙이 추가되면 Vitest를 별도 도입합니다.

## 2. 현재 프로젝트 구조

```text
dream-bike-garage-lab/
├── .github/workflows/
│   └── deploy-pages.yml    # main 빌드 및 GitHub Pages 배포
├── docs/                   # 기술 기준과 실험 운영 문서
├── src/
│   ├── main.ts             # Lab 화면, 라우팅, Phaser Scene 진입점
│   └── styles.css          # Lab 화면 및 Canvas 레이아웃
├── index.html              # Vite HTML 진입점
├── package.json            # 실행 명령, Phaser/Vite/TypeScript 버전
├── package-lock.json       # 재현 가능한 npm 설치 기준
├── tsconfig.json           # TypeScript 컴파일 기준
└── vite.config.ts          # GitHub Pages base 경로
```

현재는 Lab 카탈로그와 첫 데모 규모가 작아 `src/main.ts`에 함께 있습니다. 실험이 늘어나면 README의 권장 구조에 따라 `catalog`, `experiments`, `shared`, `ui`로 분리합니다. 현재 구조와 목표 구조를 혼동하지 않습니다.

## 3. Phaser와 Vite의 역할

| 구성 | 담당 역할 |
|---|---|
| Phaser | Scene 생명주기, Canvas 렌더링, Pointer 입력, 게임 오브젝트 |
| TypeScript | 게임 코드의 타입 검사와 컴파일 |
| Vite | 개발 서버, 모듈 번들링, 정적 배포 파일 생성 |
| HTML/CSS | Lab 탐색 UI, 설명, Canvas 바깥 레이아웃 |

Vite가 웹 앱을 시작하고 `src/main.ts`를 불러오면, 필요한 실험 화면에서 `new Phaser.Game(...)`으로 Phaser Canvas를 생성합니다. 화면을 떠날 때는 `game.destroy(true)`로 기존 인스턴스를 정리해 Canvas가 중복 생성되지 않게 합니다.

## 4. 로컬 실행

### 준비

Node.js 20.19 이상과 npm을 사용합니다.

```bash
node --version
npm --version
```

### 최초 설치 및 개발 서버

```bash
npm ci
npm run dev
```

터미널에 표시된 로컬 주소를 열고 다음을 확인합니다.

1. Lab 메인 화면이 표시되는가
2. `머지 코어 → A안 탭 선택 머지`로 이동되는가
3. 빈 칸을 눌러 부품을 생성할 수 있는가
4. 같은 단계 부품 두 개를 선택하면 상위 단계로 합쳐지는가
5. 화면을 이동하고 다시 들어왔을 때 Canvas가 중복되지 않는가

### 프로덕션 빌드 및 Preview

```bash
npm run build
npm run preview
```

`npm run build`는 TypeScript 검사 후 `dist/`를 만듭니다. Preview에서는 직접 URL 입력, 새로고침, CSS·JavaScript 에셋 로딩 오류를 함께 확인합니다.

## 5. GitHub Pages 배포

배포 흐름은 다음과 같습니다.

1. 변경사항을 PR로 검토하고 `main`에 병합합니다.
2. `.github/workflows/deploy-pages.yml`이 실행됩니다.
3. Node.js 22 환경에서 `npm ci`와 `npm run build`를 실행합니다.
4. 생성된 `dist/`를 GitHub Pages artifact로 업로드합니다.
5. `github-pages` 환경에 배포합니다.
6. https://aigemro.github.io/dream-bike-garage-lab/ 에서 결과를 확인합니다.

`vite.config.ts`의 아래 경로는 저장소명과 반드시 일치해야 합니다.

```ts
export default defineConfig({
  base: '/dream-bike-garage-lab/',
});
```

저장소명을 바꾸면 이 값, README의 Pages 주소, 관련 문서 링크를 함께 수정합니다.

## 6. 배포 완료 확인 기준

- GitHub Actions의 `Deploy GitHub Pages` 워크플로가 성공했는가
- Pages 주소가 HTTP 200으로 응답하는가
- 메인 화면의 CSS와 JavaScript가 정상 로드되는가
- Lab 내부 트랙과 방안 URL 이동이 정상인가
- Phaser Canvas가 표시되고 Pointer 입력이 동작하는가
- 브라우저 콘솔에 에셋 404나 런타임 오류가 없는가

## 7. 알려진 기준과 후속 작업

- 현재 빌드는 성공하지만 Phaser가 포함된 JavaScript chunk가 500 kB를 넘어 Vite 경고가 발생합니다. 기능 오류는 아니며, 실험 수가 늘어날 때 동적 import와 실험별 코드 분할을 검토합니다.
- 자동화 테스트는 아직 도입하지 않았습니다. 순수 게임 규칙을 `domain` 모듈로 분리할 때 Vitest를 추가합니다.
- GitHub Actions는 Node.js 22, 로컬 최소 기준은 Node.js 20.19 이상입니다. 두 환경 모두 Vite 7 요구사항을 충족합니다.
- 앱인토스 WebView 검증은 이 웹 기준선이 확정된 뒤 별도 실험 Issue에서 진행합니다.
