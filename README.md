# Dream Bike Garage Lab

**Dream Bike Garage(오늘부터 자전거 부자)**의 기술 검증과 프로토타이핑을 위한 실험 저장소입니다.

완성 게임과 기획·설계의 기준은 메인 저장소에서 관리합니다.

- 메인 저장소: [aigemro/dream-bike-garage](https://github.com/aigemro/dream-bike-garage)
- Lab 저장소: 기술 가능성 검증, 구현 방식 비교, 성능 측정, 실패 기록

## 운영 원칙

1. 하나의 실험은 `experiments/<experiment-name>/` 아래에서 관리합니다.
2. 실험을 시작하기 전에 목적과 성공 조건을 먼저 작성합니다.
3. 결과가 실패하더라도 원인과 배운 점을 기록합니다.
4. 검증된 코드를 메인 저장소에 그대로 복사하지 않습니다.
5. 메인 게임에 반영할 때는 메인 저장소의 구조와 설계 기준에 맞게 다시 구현합니다.
6. 기술 선택의 근거가 되는 결론은 `docs/decisions/`에 남깁니다.

## 권장 실험 목록

| 실험 | 검증 내용 | 상태 |
|---|---|---|
| Merge Core | 동일 종류·동일 단계 아이템의 2-to-1 머지 | 대기 |
| Drag & Drop | 마우스·터치 입력과 칸 이동 | 대기 |
| Persistence | 새로고침 후 진행 상태 저장 | 대기 |
| Responsive UI | 모바일·데스크톱 한 화면 대응 | 대기 |
| Toss WebView | 앱인토스 WebView 실행 및 제약 확인 | 대기 |

## 저장소 구조

```text
.
├── experiments/
│   └── README.md
├── docs/
│   ├── TECH_STACK.md
│   ├── EXPERIMENT_GUIDE.md
│   └── decisions/
│       └── README.md
└── .github/
    ├── ISSUE_TEMPLATE/
    │   └── experiment.yml
    └── pull_request_template.md
```

## 실험 진행 흐름

1. Experiment Issue 생성
2. 목적·가설·성공 조건 정의
3. `experiment/<name>` 브랜치에서 구현
4. 테스트 결과와 알려진 문제 기록
5. PR 리뷰 후 Lab에 병합
6. 메인 반영이 필요하면 메인 저장소에 별도 Issue 생성

## 시작 방법

실험별 실행 방법은 각 `experiments/<experiment-name>/README.md`에 기록합니다. 저장소 전체에 하나의 프레임워크를 강제하지 않으며, 첫 실험의 요구사항에 맞춰 최소 환경부터 구성합니다.
