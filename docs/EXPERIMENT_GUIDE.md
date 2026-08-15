# 실험 운영 가이드

> 기준일: 2026-07-31  
> 대상 저장소: `aigemro/dream-bike-garage-lab`

이 문서는 게임 코어의 여러 구현안과 플랫폼 기술을 동일한 방식으로 만들고 검토하기 위한 기준입니다. Lab의 목적은 처음 만든 방안을 완성하는 것이 아니라, 비교 가능한 근거를 만든 뒤 메인 프로젝트에 적용할 후보를 선택하는 것입니다.

## 1. 실험 분류

### MVP Core Play

한 주문 안에서 사용자가 직접 수행하는 플레이 구조를 비교합니다.

- Merge Mechanics
- Order Goal
- Parts Supply
- Assembly & Completion

### Meta Progression

주문 완료 뒤 다음 플레이 이유와 장기 성장 구조를 비교합니다.

- Collection
- Reward & Progression
- Level Design & Unlock
- Career Rank
- Difficulty & Economy

### Art & Audio

동일한 게임 상태를 전달하는 시각·청각 표현을 비교합니다.

- Visual Feedback & Motion
- Background, Character, UI Art
- Music & Sound Effects

### Platform & Technology

게임을 실제 환경에서 안정적으로 실행하기 위한 기술을 검증합니다.

- Input & Responsive
- Persistence
- Toss WebView
- Monetization & Operations

두 분류는 평가 목적이 다르므로 같은 비교표에 섞지 않습니다.

## 2. 계층과 식별자

```text
Category / Track / Prototype / Version
game-core / merge / prototype-a / v1
game-core / collection / prototype-b / v2
platform / persistence / indexeddb / v1
```

- **Category**: MVP Core Play, Meta Progression, Art & Audio, Platform 또는 Release Integration
- **Track**: 비교하려는 문제 영역
- **Prototype**: 하나의 독립된 해결 방안
- **Version**: 같은 방안 내부의 의미 있는 변경

새로운 아이디어는 기존 Prototype을 덮어쓰지 않고 새 Prototype으로 추가합니다. 단순 오류 수정이나 작은 튜닝은 같은 Prototype의 버전으로 관리합니다.

## 3. 실험 시작 조건

- 어떤 질문에 답하려는가?
- 기존 실험안과 무엇이 다른가?
- 비교 대상과 공통 초기 조건은 무엇인가?
- 플레이어가 무엇을 조작하고 경험하는가?
- 무엇을 측정하거나 관찰할 것인가?
- 성공, 보류, 폐기 기준은 무엇인가?

## 4. 게임 코어 실험의 공통 평가

모든 항목을 점수화할 필요는 없지만 같은 트랙에서는 동일한 기준을 사용합니다.

| 평가 항목 | 확인 질문 |
|---|---|
| 이해도 | 설명 없이 핵심 조작과 목표를 이해할 수 있는가? |
| 조작감 | 마우스와 터치에서 의도대로 조작되는가? |
| 선택의 재미 | 의미 있는 선택과 전략이 생기는가? |
| 반복 재미 | 같은 루프를 여러 번 해도 변화와 기대가 있는가? |
| 피드백 | 머지·획득·완성 결과가 분명하게 느껴지는가? |
| 게임 연결성 | 주문, 조립, 급여, 드림 바이크 성장과 자연스럽게 이어지는가? |
| 확장성 | 새 부품·자전거·이벤트를 추가하기 쉬운가? |
| 구현 비용 | 메인 게임에 적용하고 유지할 비용이 적절한가? |

### Merge 트랙 추가 기준

- 보드가 막혔을 때의 대응
- 운과 계획의 비율
- 주문 목표를 향해 간다는 느낌
- 연속 머지 또는 콤보의 쾌감
- 한 판의 적정 시간과 템포

### Collection 트랙 추가 기준

- 획득한 자전거의 소유감
- 미완성 항목을 채우고 싶은 동기
- 중복 획득의 가치
- 전시·성장·도감 중 어떤 경험이 강한지
- 장기 플레이 목표와의 연결

## 5. 실험 문서 템플릿

```markdown
# [Track] Prototype 이름

## 질문
이 실험으로 답하려는 한 문장

## 가설
이 방식이 재미 또는 기술 문제를 해결할 것으로 보는 이유

## 비교 대상
같은 트랙의 다른 Prototype과 공통 초기 조건

## 핵심 규칙
플레이어 입력, 상태 변화, 종료 또는 보상 조건

## 검증 환경
- 브라우저/앱:
- OS/기기:
- 화면 크기:
- 관련 버전:

## 평가 기준
- [ ] 트랙 공통 기준
- [ ] 이 실험만의 성공 조건

## 실행 방법
설치, 이동 경로, 조작 및 재현 절차

## 결과
관찰, 측정값, 스크린샷, 발견한 문제

## 비교 요약
다른 Prototype보다 나은 점과 불리한 점

## 결론
채택 / 조건부 채택 / 보류 / 폐기

## 메인 반영
관련 메인 저장소 Issue 또는 반영하지 않는 이유
```

## 6. 화면과 코드 독립성

- 각 Prototype은 독립 URL과 독립 실행 화면을 가집니다.
- 같은 트랙의 Prototype은 카탈로그의 한 그룹 안에서 나란히 표시합니다.
- 공통 비교 화면에서 규칙, 상태, 결과를 확인할 수 있게 합니다.
- 프로토타입 코드는 기본적으로 자기 폴더 안에 둡니다.
- 두 개 이상 실험에서 필요성이 확인된 코드만 `shared`로 이동합니다.
- Phaser Scene은 입력과 렌더링을 맡고 게임 규칙은 가능한 한 순수 TypeScript로 분리합니다.
- 앱인토스 SDK는 플랫폼 어댑터 뒤로 분리합니다.

## 7. 상태와 결론

| 상태 | 의미 |
|---|---|
| 준비 | 질문·가설·평가 기준 작성 |
| 진행 | 실행 가능한 프로토타입 개발 |
| 검토 | 동일 조건으로 플레이 및 비교 |
| 완료 | 결과와 메인 반영 여부 기록 |
| 보류 | 선행 결정 또는 환경 대기 |
| 폐기 | 더 개발하지 않으며 이유 보존 |

결론은 **채택 / 조건부 채택 / 보류 / 폐기** 중 하나로 기록합니다. 채택은 Lab 코드의 자동 복사를 의미하지 않습니다.

## 8. GitHub 작업 단위

- 상위 Issue: 실험 트랙과 공통 평가 기준
- 하위 Issue: Prototype 하나의 구현과 결과 기록
- PR: 한 Prototype 또는 한 번의 비교 가능한 변경
- Project View: MVP Core Play / Meta Progression / Art & Audio / Platform / Release Integration으로 분리
- 권장 필드: Track, Prototype, Status, Result, Priority, Main 적용 여부

Prototype Issue 제목 예시:

- `[Merge A] 자유 보드 2-to-1 머지`
- `[Merge B] 주문 목표 중심 머지`
- `[Collection A] 자전거 도감형 수집`
- `[Collection B] Garage 전시형 수집`

## 9. 메인 저장소 반영

1. 같은 트랙의 후보를 공통 기준으로 비교합니다.
2. 채택 또는 조건부 채택 근거를 결과 문서에 남깁니다.
3. 메인 저장소에 적용 범위가 분명한 Issue를 생성합니다.
4. 기획·설계와 충돌 여부를 확인합니다.
5. 메인 구조에 맞춰 재구현하고 Lab 실험을 링크합니다.

Lab에는 여러 시도와 실패 기록을 유지하고, 메인 저장소에는 선택된 설계와 제품 구현만 남깁니다.
