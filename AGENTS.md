# AGENTS.md

## Project

**Dream Bike Garage(오늘부터 자전거 부자)의 실험실(Lab) 저장소**입니다. 완성 게임을 만드는 곳이 아니라, 같은 게임 코어에 대해 여러 구현안(Prototype A/B/C)을 만들어 동일 조건에서 비교·검증하는 곳입니다.

| 저장소 | 역할 |
|---|---|
| [dream-bike-garage](https://github.com/aigemro/dream-bike-garage) (메인) | 기획·설계 기준, 채택안 결정, 최종 출시 코드. 단일 기준(source of truth) |
| **dream-bike-garage-lab** (이 저장소) | 프로토타입 비교 실험, 기술 검증, 결과 권고 |

## Lab에서 하지 않는 것 (중요)

상세는 [docs/PROJECT_BOUNDARY.md](docs/PROJECT_BOUNDARY.md) 참고.

- 게임 콘셉트, 머지·주문·조립·수집의 **최종 규칙 결정** — 메인에서 결정합니다.
- 콘텐츠·보상·밸런스 수치 확정
- 채택/폐기 결정 — Lab은 비교 결과와 권고만 제공합니다.
- 출시 코드 작성 — Lab 코드는 검증용이며, 메인에 그대로 복사하지 않습니다.
- 하나의 방안을 처음부터 정답으로 확정하는 것 — 항상 비교 가능한 복수 안으로 만듭니다.

## Commands

- Install: `npm ci`
- Develop: `npm run dev`
- Build: `npm run build` (`tsc -b && vite build`)
- Preview: `npm run preview`

테스트 프레임워크는 아직 없습니다(도메인 규칙 분리 시 Vitest 도입 검토). 검증은 `npm run build` 통과 기준입니다.
`main` 병합 시 GitHub Pages([aigemro.github.io/dream-bike-garage-lab](https://aigemro.github.io/dream-bike-garage-lab/))로 자동 배포됩니다. `vite.config.ts`의 `base: '/dream-bike-garage-lab/'`를 유지합니다.

## 코드 구조 (현재 기준)

README의 "권장 저장소 구조"(`src/experiments/...`)는 아직 **목표**입니다. 현재 실제 구조와 혼동하지 않습니다 ([docs/PHASER_VITE_GUIDE.md](docs/PHASER_VITE_GUIDE.md) 참고).

```text
src/
├── main.ts                  트랙/방안 메타데이터 + 해시 라우팅 + 화면 렌더링
├── merge-prototype.ts       머지 코어 A/B/C 프로토타입 (Phaser Scene)
├── collection-prototype.ts  자전거 수집 A/B/C 프로토타입 (Phaser Scene)
├── variant-docs.ts          docs/variants/*.md 를 ?raw import
└── styles.css
```

- 새 방안 추가 시: `src/main.ts`의 메타데이터에 등록 + `docs/variants/*.md`에 방안 설명 문서 작성 + 관련 GitHub Issue 연결
- 데모 화면 이탈 시 `game.destroy(true)`로 Phaser Canvas 중복을 방지하는 기존 패턴을 유지합니다.
- 공통화가 검증되지 않은 코드는 각 프로토타입 안에 둡니다. 실험끼리 억지로 같은 구조를 공유하지 않습니다.

## 실험 운영 규칙

- 실험 분류·식별자·평가 기준·문서 템플릿: [docs/EXPERIMENT_GUIDE.md](docs/EXPERIMENT_GUIDE.md)
- 전체 트랙·프로토타입 지도와 진행 현황: [docs/LAB_PROTOTYPE_MAP.md](docs/LAB_PROTOTYPE_MAP.md)
- 상태 흐름: 아이디어 → 준비 → 개발 중 → 검토 준비 → 검토 → 완료 / 결과: 채택·조건부 채택·보류·폐기
- 같은 트랙의 실험은 가능한 한 같은 초기 조건과 평가 항목으로 비교합니다.
- 실패한 실험도 원인과 배운 점을 기록합니다.
- MVP Core Play(한 판의 직접 플레이), Meta Progression(장기 성장), Screen Design(화면 구조·사용성), Art & Audio(에셋·감각 표현), Platform & Technology(기술), Release Integration(출시 연결)을 별도 상위 영역으로 관리합니다.
- 상세 분류와 현재 통합 선택안은 [docs/TRACK_CLASSIFICATION.md](docs/TRACK_CLASSIFICATION.md)를 따릅니다.
- 이슈 접두어: `[실험]` `[기술]` `[검증]` (메인은 `[기획]` `[설계]` `[적용]`)
- 실험 완료 기준: 메인 이슈에 결과가 전달되고 양방향 링크가 남는 것

## 기술 기준

- TypeScript 5.8 + Phaser 3.90 + Vite 7, Node.js 20.19 이상, React 미사용(순수 DOM)
- 화면 기준: 모바일 세로 우선 (390×810, Phaser Scale FIT), 최종 목표는 앱인토스 WebView
- 스택 확정/미정 항목: [docs/TECH_STACK.md](docs/TECH_STACK.md)
- 앱인토스 관련 구현은 실험 시점의 공식 문서를 다시 확인합니다.
