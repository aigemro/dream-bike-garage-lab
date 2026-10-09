# Day 세션(활성 플레이 시간) 메인 적용안

> 기준일: 2026-10-06 · 메인 기준 커밋 `4a16664` · Lab 트랙 [#207](https://github.com/aigemro/dream-bike-garage-lab/issues/207)  
> 관련: Lab [#210](https://github.com/aigemro/dream-bike-garage-lab/issues/210) · [#212](https://github.com/aigemro/dream-bike-garage-lab/issues/212) / 메인 [#70](https://github.com/aigemro/dream-bike-garage/issues/70) · [#73](https://github.com/aigemro/dream-bike-garage/issues/73) · [#74](https://github.com/aigemro/dream-bike-garage/issues/74) · 머지 코어 [#27](https://github.com/aigemro/dream-bike-garage/issues/27) · [#30](https://github.com/aigemro/dream-bike-garage/issues/30)  
> Lab은 비교 결과와 권고만 제공합니다. 플레이 제한 구조와 수치의 최종 결정은 메인에서 합니다.

## 1. 결론

- Day 세션의 **골격**(준비 → 진행 ⇄ 일시정지 → 마감 → 정산 → 다음 Day, 계정별 저장)은 머지 코어와 무관하게 동작하도록 정리했다. 머지 코어 교체를 기다리지 않고 메인에 먼저 넣을 수 있다.
- 다만 **무엇이 Day를 끝내는지(종료 트리거)** 는 메인의 플레이 제한 결정에 달려 있다. 지금 메인 기획에는 Day 시간(B안), 알바 체력(머지 코어 D/E안), 하트(#73)가 각각 따로 설계돼 있어, 결정 없이 모두 넣으면 레퍼런스 분석에서 피하기로 한 다중 게이트 구조가 된다(3절).
- 권장 순서: ① 플레이 제한 구조 결정 → ② 계정 저장 슬롯과 Day 골격 적용(결정과 무관) → ③ 종료 트리거·HUD 연결 → ④ 머지 코어 교체 시 계약 적용.

## 2. 메인 현재 상태

| 항목 | 상태 | 근거 |
|---|---|---|
| Day 세션 모듈 | `day-session.ts`·`auth-provider.ts`가 있으나 어디서도 import되지 않음 | 메인 PR [#64](https://github.com/aigemro/dream-bike-garage/pull/64) — 기존 저장 유실을 피하려 분리 이식만 함 |
| 실제 Day 번호 | 주문 정산 화면을 지날 때마다 `dayNumber += 1` (주문 1건 = 1 Day) | `mvp-release-integration.ts`의 `advanceOrder`, 메인 PR [#72](https://github.com/aigemro/dream-bike-garage/pull/72) |
| 레이스 | Day 5마다 대회일 — 현재 의미로는 **주문 5건마다** | `race-progress.ts`, PR #72 |
| 저장 | `dbg-lab-mvp-release-integration-v1`(v3), `dbg-lab-meta-collection`, `dbg-lab-meta-growth` — 계정 구분 없음 | `mvp-release-integration.ts`, `meta-progress.ts` |
| 게임 화면 Day 모드 | `continuousOrders`·`getDaySummary` 훅이 남아 있음. 주문을 `% 2`로 순환해 3번째 주문이 안 나오고, HUD·홈 시간이 `00:초` 고정 표기 | `game-screen-mobile.ts`, `home-design-prototype.ts` — 현재 메인은 이 모드를 쓰지 않아 증상 없음 |

## 3. 먼저 결정할 것: 플레이 제한 구조

메인 기획 문서의 기존 결정과 이후 요청이 서로 다르다.

- `docs/planning/REFERENCE_GAMES.md`: **MVP는 에너지 없이 주문 단위 세션**(주문 1건 = 2~3분 = 1세션). 에너지·타이머·자원이 진행을 여러 겹으로 막는 구조(EverMerge)는 피할 반면교사로 기록.
- 2026-09-14 회의: 하트 소모·회복과 보상형 광고 연계 정리 요청(#73), Day 달력·대회일·레이스 진입 연결(#74).
- Lab: Day B안(활성 시간 제한)과 머지 코어 D/E안(체력 30·상자당 1·10분당 1 회복)이 각각 구현됨.

Lab 권고는 **MVP에는 제한 장치를 하나만 두는 것**이다. 후보는 다음 셋이다.

| 안 | Day를 끝내는 것 | 장점 | 비용·위험 |
|---|---|---|---|
| ① 주문 단위 | 주문 1건 납품 (현행 메인) | 기존 결정과 일치, 추가 구현 거의 없음, 레이스 주기 그대로 | Day가 시간 단위 목표·정산의 의미를 갖지 못함. 하트를 도입하면 별도 게이트가 됨 |
| ② 활성 시간 (B안) | 플레이 화면 활성 시간 소진 | 하루 단위 목표·정산 리듬, 백그라운드 공정성 검증 완료(Lab) | Day 길이 실측 필요, 레이스 주기·보상 재조정. 체력·하트를 함께 쓰면 다중 게이트 |
| ③ 체력 1회분 | 알바 체력 소진(또는 플레이어의 영업 종료) | 타이머 없이 Day·체력·하트(광고 충전)를 한 축으로 묶음, 백그라운드 처리 단순 | 체력 수치·회복 시간 설계 필요, 머지 코어(D/E안) 채택과 같이 결정해야 함 |

결정 근거로 쓸 Lab 측정: 헤더의 `Day 10초/1분/3분` 전환으로 같은 사람이 1분·3분 Day에서 처리한 주문 수와 체감 긴장도를 기록한다(목표: 하루 주문 2~3건).

## 4. 모듈 경계와 머지 코어 계약

### 4.1 Day 도메인 (결정과 무관하게 공통)

Lab `src/day-session-rules.ts`의 규칙을 메인 아키텍처에 맞게 `src/domain/day-session.ts`로 **재구현**한다(코드 복사 금지, 테스트 기준만 이식). 메인의 기존 `src/game/release/day-session.ts`를 대체한다.

| 함수 | 규칙 |
|---|---|
| `startDay(day, startedAt, durationMs)` | `ready`에서만 시작, 제한 시간은 시작 시점에 고정 |
| `tickDay(day, deltaMs)` | `active`에서만 차감, 0이 되면 `closing` (②에서만 사용) |
| `pauseDay(day, reason)` / `resumeDay(day)` | `active` ⇄ `paused`, 사유: 앱 전환·화면 이동·로그아웃·종료·다시 열기 |
| `canAcceptPlayInput(day)` | `active`일 때만 공급·배치·머지 입력 허용 |
| `recordOrderDelivery(day, reward)` | `active`·`paused`·`closing`에서 확정된 납품을 Day 통계에 반영 |
| `settleDay(day, history, input)` | `active`·`paused`·`closing`만 정산, 같은 Day 번호 이력은 한 번만 |
| `prepareNextDay(day)` | 정산 확인 후에만 다음 Day 번호 |
| `normalizeRestoredDay(day)` | 저장된 `active`는 `paused(restore)`로, `closing`은 즉시 정산 |

③을 택하면 `tickDay` 대신 체력 소진 시 `closing`으로 넘기는 함수(예: `closeDay(day, 'stamina')`)와 종료 사유 `stamina`를 추가한다. 나머지 전이는 그대로 쓴다.

### 4.2 머지 코어가 지켜야 할 계약

> 2026-10-09: Lab Day 데모에 머지 코어 E v3를 이 계약으로 연결했다(Lab [#256](https://github.com/aigemro/dream-bike-garage-lab/issues/256)). E안은 1번(동기 확정)을 만족해 4번 알림 없이 시간 종료 즉시 정산하고, 보드는 계정별로 저장해 Day 사이에 이월한다.

머지 코어(현행 C안, 후보 D/E안)가 바뀌어도 Day 쪽 코드를 고치지 않도록 다음 네 가지만 약속한다.

1. **상태 확정은 행동 시점에 동기적으로** 한다. 장착·납품 연출은 확정 뒤 이벤트로 재생한다. (D/E안의 `resolveProgress`처럼 확정과 연출을 분리하면 Day 종료가 거래 중간을 끊지 않는다. 현행 C안은 연출이 끝난 뒤 확정하므로 Lab에서는 마감 대기(최대 3초)로 보완했다.)
2. `canAcceptPlayInput()`이 거짓이면 공급·배치·이동·머지 입력과 자동 공급을 멈춘다.
3. 납품이 확정되면 `onOrderDelivered({ orderIndex, reward })`를 정확히 한 번 호출한다. 코인·이해도는 컨트롤러가 이 시점에 반영한다.
4. (선택) 확정되지 않은 연출이 남아 있으면 `onBusyChange(true/false)`로 알린다.

**보드 이월**은 Day 규칙이 아니라 머지 코어 저장 정책이 정한다. 체력으로 받은 부품을 쓰는 코어(D/E안)라면 Day 사이에 보드를 유지하는 것이 자연스럽고, 이때 보드 스냅샷 저장은 메인 [#69](https://github.com/aigemro/dream-bike-garage/issues/69)와 함께 처리한다.

### 4.3 HUD

Day HUD(일차·남은 시간·오늘 수입)는 머지 씬 내부가 아니라 **씬 밖의 공용 HUD 레이어**로 둔다. Lab은 C안 씬 안에 그렸지만, 메인에서는 머지 코어 교체 때 HUD를 다시 만들지 않도록 분리한다. 시간 표기는 `mm:ss`, 종료 임박 강조는 Day 길이의 10%(최소 3초) 기준을 권장한다.

## 5. 저장 구조와 마이그레이션

- **계정 저장 슬롯**: `playerId` 범위로 키를 나눈다. 슬롯 안의 각 모듈(릴리스 진행·컬렉션·성장·Day)은 기존 직렬화 함수를 그대로 쓰고 키만 계정별로 바꾼다(Lab `DayAccountRepository`의 `…:{playerId}` 방식).
- 저장소는 `KeyValueStorage`(getItem·setItem·removeItem) 인터페이스로 주입한다. 로컬 저장이 실패해도 메모리 진행을 유지하고 경고만 띄운다. 서버 동기화는 같은 인터페이스의 어댑터로 교체하되, 쓰기마다 `expectedRevision`을 보내 오래된 상태가 최신 상태를 덮지 않게 한다.
- **MVP 계정**: 토스 로그인 연동(#33) 전까지는 기기 로컬 단일 슬롯(`local`)으로 시작한다. 로그인 연동 후 같은 구조에 실제 `playerId`를 넣는다.
- **기존 진행 마이그레이션**: 첫 실행에서 슬롯이 비어 있고 기존 키(`dbg-lab-mvp-release-integration-v1`, `dbg-lab-meta-collection`, `dbg-lab-meta-growth`)가 있으면 슬롯으로 복사하고 마이그레이션 완료 표시를 남긴다. 원본 키는 한 버전 동안 지우지 않는다. 기존 `dayNumber`는 그대로 승계해 레이스 진행이 뒤로 가지 않게 한다.
- 키 이름은 `dbg-release-*`로 정리한다(메인 `auth-provider.ts`는 이미 `dbg-release-auth-session-v1` 사용).

## 6. 화면 흐름 변경 (②·③ 공통)

- 홈의 PLAY → Day 준비(일차·대회 달력·오늘 영업 길이) → 진행 → 정산 → 다음 Day 준비.
- 주문별 보상 화면은 유지할 수 있다. 보상 화면은 플레이 화면이 아니므로 Day가 자동으로 일시정지된다. Lab처럼 연속 주문으로 바꿀지는 별도 UX 결정이다.
- 레이스: 대회일 판단을 주문 수가 아니라 Day 번호로 바꾼다. 주문 1건 = 1 Day에서 세션 = 1 Day로 바뀌면 5일 주기가 주문 약 10~15건 주기가 되므로 참가비·상금을 다시 본다. 대회 참가는 그날 Day 상태와 무관하게 하루 한 번(현행 규칙 유지)을 권장한다.
- 백그라운드: `visibilitychange`와 함께 `pagehide`에서도 일시정지·저장한다(WebView에서 visibility 이벤트가 누락되는 경우 대비). 복원 시 `active`는 일시정지로 연다.

## 7. 단계별 적용 계획

| 단계 | 내용 | 완료 기준 | 선행 |
|---|---|---|---|
| 0 | 플레이 제한 구조(①②③)·Day 길이·보드 이월·레이스 주기 결정 | 회의 기록과 이슈에 결정 근거 | 이 문서, Lab 측정 |
| 1 | 게임 화면 Day 모드 잠재 버그 수정 (`% ORDERS.length`, `mm:ss`) | 테스트·빌드 통과 | 없음 |
| 2 | 계정 저장 슬롯 + 기존 진행 마이그레이션 | 마이그레이션·슬롯 분리·저장 실패 테스트 | 없음 |
| 3 | `src/domain/day-session.ts` 재구현 + `tests/day-session.test.ts` | 8절 규칙 테스트 통과, 기존 모듈 대체 | 없음 |
| 4 | 컨트롤러 연결: Day 준비·HUD·일시정지·마감·정산·다음 Day, 레이스 기준 전환 | 9절 E2E 체크리스트 | 0, 2, 3 |
| 5 | 머지 코어 교체 시 4.2 계약 적용, 보드 이월 | 교체 코어로 E2E 재확인 | 머지 코어 채택(#30) |
| 6 | 토스 로그인 어댑터·서버 동기화 | #212 실패 시나리오 통과 | #33 |

1~3단계는 0단계 결정과 무관하게 바로 진행할 수 있다.

## 8. 메인 단위 테스트 기준

Lab `src/day-session-rules.test.ts`, `src/day-account-state.test.ts`의 다음 항목을 메인 테스트 기준으로 옮긴다.

- 준비 상태에서만 시작, 진행·정산 중 재시작 금지, 제한 시간 1초~30분 보정
- 활성 상태에서만 차감, 0 이하·NaN 경과 무시, 0 도달 시 마감·초과 시간 미포함
- 일시정지·재개 대상 상태와 사유
- 활성·일시정지·마감 중 납품만 Day 통계 반영, 보상 정수·음수 방지
- 정산 1회(시간 종료·수동 종료 중복, 같은 Day 번호 이력), 이력 최근 14일
- 정산 확인 후에만 다음 Day
- 복원: `active` → `paused(restore)`, 이전 `completed` → 다음 Day 준비, 길이 필드 없는 이전 저장 보정
- 계정 슬롯: 한 계정의 컬렉션·성장이 다른 계정에 보이지 않음, 초기화는 해당 계정만, 손상 데이터 기본값 복구

## 9. 메인 E2E 체크리스트

1. 첫 실행: 기존 진행이 슬롯으로 옮겨지고 코인·컬렉션·성장·`dayNumber`가 유지된다.
2. Day 시작 → 주문 1건 이상 납품 → 오늘 수입·이해도 반영.
3. 앱 전환·화면 이동 시 남은 시간이 멈추고 돌아오면 이어진다.
4. 장착 연출 중 Day가 끝나도 그 납품이 오늘 수입에 들어간다.
5. 정산 화면에서 새로고침·재진입해도 정산이 한 번만 적용된다.
6. 다음 Day 준비 후 대회일 표시·레이스 참가·상금 저장이 Day 번호 기준으로 동작한다.
7. 진행 중 강제 종료 후 재실행하면 Day가 일시정지 상태로 열리고 시간이 흐르지 않는다.
8. 저장 실패(프라이빗 모드 등)에서도 플레이가 이어지고 경고가 보인다.

## 10. 메인 후속 이슈 초안

1. **[기획] 플레이 제한 구조 결정: Day 시간·체력·하트 중 하나** — 3절 표와 Lab 측정 결과로 ①②③ 중 선택, Day 길이·보드 이월·레이스 주기 함께 결정. 관련 #73, #70.
2. **[적용] 게임 화면 Day 모드 잠재 버그 수정** — `% 2` 주문 순환, `00:초` 표기. 머지 코어 교체 전이라도 즉시 가능.
3. **[적용] 계정 저장 슬롯 도입과 기존 진행 마이그레이션** — 5절. `KeyValueStorage` 주입, 로컬 단일 슬롯, 마이그레이션 테스트.
4. **[적용] Day 세션 도메인 모듈 재구현** — 4.1절, 8절 테스트. 기존 미사용 `day-session.ts` 대체.
5. **[적용] Day 세션 화면 연결과 레이스 기준 전환** — 6절, 9절 E2E. 1번 결정 후 진행. #74 달력 점검 범위 포함.

## 11. Lab 잔여 과제

- #210: A(실제 시각)·C(행동 단위) Variant 비교. 메인에서 ②를 택하지 않으면 보류 사유를 남기고 종료한다.
- #212: 로그인 → Day → 재로그인 E2E 기록과 실패 시나리오(세션 만료·저장 실패·오래된 상태 충돌). 이번 보완으로 저장·복원 규칙은 단위 테스트로 고정했고, 실기기 백그라운드·WebView 생명주기 확인이 남았다.
- 머지 코어 D/E안 비교(#243, #247)가 끝나면 4.2 계약으로 연결해 Day 사이 보드 이월을 검증한다.
