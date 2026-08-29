# 메타 루프 검증 결과와 메인 적용 기준 (#200 트랙)

> 기준일: 2026-08-29
> 관련 이슈: Lab [#200](https://github.com/aigemro/dream-bike-garage-lab/issues/200) · [#201](https://github.com/aigemro/dream-bike-garage-lab/issues/201) · [#204](https://github.com/aigemro/dream-bike-garage-lab/issues/204) · [#203](https://github.com/aigemro/dream-bike-garage-lab/issues/203) · [#205](https://github.com/aigemro/dream-bike-garage-lab/issues/205) · [#202](https://github.com/aigemro/dream-bike-garage-lab/issues/202)

## 1. 결론 요약

MVP 협의안의 핵심 흐름 **고객 주문 → 부품 머지 → 자전거 조립·납품 → 급여·자전거 해금 → 드림 바이크 성장 → 다음 목표 → 새로운 주문**을 Lab 릴리스 통합 화면에서 끊김 없이 완주할 수 있음을 확인했다.

- 첫 주문부터 다음 주문까지 전체 메타 루프 완주: **통과** (자동 시뮬레이션 + 실제 화면 구동)
- 주문 3종 연속 완료·반복 순환: **통과**
- 새로고침 후 코인·주문·컬렉션·성장 복구: **통과**
- 보상 중복 지급·코인만 차감되는 상태 불일치: **없음** (원자적 처리 검증)
- 다음 목표 상시 표시: **통과** (해금 → 강화 → 반복 안내로 자동 전환)

## 2. 검증 방법

### 2-1. 자동 테스트 (`npm test` · Vitest 33건)

| 파일 | 내용 |
|---|---|
| `src/meta-progress.test.ts` | 주문↔자전거 매핑, 중복 해금 방지, 저장 직렬화·손상 복구·버전 처리·값 보정, 강화 비용·원자성·등급 상승, 다음 목표 규칙 |
| `src/meta-loop-e2e.test.ts` | 이슈 #202 검증 시나리오 10단계 전체를 순수 로직 수준에서 시뮬레이션 (새 게임→3종 주문→강화→새로고침 복구→반복), 빠른 연속 입력, 저장 손상 부분 복구, 새 게임 초기화 |

### 2-2. 실제 화면 구동 검증 (재현 가능한 수동 테스트)

`npm run dev` 후 `#/track/mvp-release-integration/vertical-slice/demo`에서 아래 절차로 재현한다.
(자율 세션에서는 RAF 심 + `renderer.snapshot` 방식으로 동일 절차를 구동해 확인했다.)

1. 설정 → 처음부터 시작으로 새 게임 (코인 0 · 보유 1대 · NEXT GOAL "어반 로드 / 이번 주문 납품 시 해금")
2. 첫 주문(통학용 어반 로드) 부품 4종 완성 → 자동 장착 → 정산 화면 전환
3. 급여 봉투 개봉 → 코인 +1,000, **"NEW BIKE! 어반 로드 (입문) 도감 등록"** 배너, NEXT ORDER "트레일 MTB · 부품 4종 · 예상 급여 1,400코인"
4. 도감 진입 → 수집 2/24, 어반 로드 NEW 배지 → 칸 확인 시 NEW 해제·저장
5. 성장 C안에서 성능 강화(350) → 코인 650, 즉시 재강화 시도(700 필요) → 차감 없이 거부
6. 홈 → 납품 1건 · 2/24 · NEXT GOAL "트레일 MTB / 주문 2건 남음" · Garage 성장 11% · 샘플 문구(ENERGY·EVENT·Lv.12) 없음
7. 새로고침 → 코인·보유·강화 단계·홈 표시 전부 복구
8. 같은 주문 재완료 → "이미 도감에 있는 자전거입니다" 배너 · 보유 중복 없음
9. 주문 2·3(트레일 MTB → 엔듀런스 로드) 연속 완료 → 트레일 MTB(중급)·에어로 스프린터(고급) 해금, 주문 인덱스 0으로 반복 순환
10. 전체 해금 후 NEXT GOAL이 "스타일 강화 / 강화 비용 350코인"으로 자동 전환, 합계 7 도달 시 고급 등급 배지·홈 반영

## 3. 채택 데이터 모델·이벤트 흐름

### 데이터 모델 (모두 `src/meta-progress.ts`)

```text
OrderMeta            { orderIndex, name, bikeCategory, reward, unlockBikeId }   ← ORDERS(부품 목표)와 인덱스 1:1
CollectionProgress   { ownedBikeIds[], newBikeIds[], selectedBikeId, showcaseSlots[3] }
DreamGrowth          { targetBikeId, stats: { 성능·스타일·희귀도 (Lv.1~4) } }
NextGoal             unlock(다음 해금 주문) | upgrade(최저 파츠 강화) | repeat
```

### 저장 스키마 (localStorage · 모두 version 필드 포함)

| 키 | 버전 | 내용 | 복구 규칙 |
|---|---|---|---|
| `dbg-lab-mvp-release-integration-v1` | 2 | 코인·주문 인덱스·완료 수·설정 | 버전 불일치 → 기본값 |
| `dbg-lab-meta-collection` | 1 | 컬렉션 진행 | 손상·구버전 → 기본값, 필드 단위 보정(미등록 ID 제거·중복 제거·미보유 전시 슬롯 비움·시작 자전거 유지) |
| `dbg-lab-meta-growth` | 1 | 성장 단계 | 손상·구버전 → 기본값, 레벨 1~4 클램프·미등록 대상 보정 |

### 이벤트 흐름 (컨트롤러 = 단일 상태 소유자)

```text
주문 완료(onOrderComplete) ─→ applyOrderUnlock → 저장 → 정산 화면(해금 배너·다음 주문 예고)
봉투 개봉(onReward)        ─→ 코인 반영 → 저장
강화(onDreamUpgrade)       ─→ applyDreamUpgrade(원자적: 차감+상승 동시, 실패 시 무변화) → 저장
도감 확인(onBikeSeen)      ─→ markBikeSeen → 저장
전시 배치(onShowcaseChange)─→ 슬롯 갱신 → 저장
홈 진입                    ─→ buildHomeProgress(computeNextGoal 포함)로 요약 재계산
```

핵심 원칙: **화면(Phaser Scene)은 상태를 소유하지 않는다.** 모든 진행 상태는 통합 컨트롤러가 소유·저장하고, 화면은 훅으로 받은 데이터 표시와 결과 반영만 한다. 도감 A/전시 B/성장 C가 자연히 단일 상태를 공유한다.

## 4. 메인 프로젝트 적용 기준

### 옮길 개념 (재구현 대상 — 코드 복사 금지)

| Lab 모듈 | 메인에서 재구현할 내용 |
|---|---|
| `src/bike-catalog.ts` | 자전거 카탈로그 단일 출처 (ID·이름·카테고리·등급) — 화면과 로직이 공유 |
| `src/meta-progress.ts` | 주문 메타(해금 매핑·보상), 컬렉션 진행, 성장 모델, 저장 스키마+버전+보정, 다음 목표 규칙. **Phaser 비의존 순수 모듈로 분리**할 것 |
| 컨트롤러 패턴 | 단일 상태 소유자 + 화면 훅 구조, 상태 변경 시점마다 저장 |
| `src/meta-progress.test.ts` `src/meta-loop-e2e.test.ts` | 동일 관점의 테스트 기준: 매핑 정합·중복 방지·저장 왕복·손상 복구·원자성·다음 목표 전이·E2E 시나리오 |

### 테스트 기준 (메인 이관 시 최소 통과 조건)

1. 주문 완료 → 해금 → 정산 표시 → 도감 반영의 상태 전이 테스트
2. 저장 왕복·손상 복구·스키마 버전 마이그레이션 테스트
3. 코인 차감·강화의 원자성(연속 입력 포함) 테스트
4. 상태별 다음 목표 규칙 테스트
5. 새 게임 → 3종 주문 → 성장 → 재실행 복구 → 반복의 E2E 시나리오 테스트

### Lab 전용 코드 (메인 적용 제외)

- `mvp-release-integration.ts`의 화면 바로가기 네비게이션(개발용 셸) — 이 네비로 정산을 건너뛰면 주문 인덱스가 진행되지 않는 것은 셸 한계로, 메인에서는 정산 화면 경유가 강제되므로 해당 없음
- 디자인 비교용 독립 데모의 샘플 데이터(8/24 보유, ENERGY 72/100, EVENT·RANK·STATUS 스텁)
- C안 성장 화면이 "선택 자전거 이름 + 드림 바이크 공용 스탯"을 함께 표시하는 단순화 — 메인에서는 성장 대상(드림 바이크) 화면과 일반 자전거 상세 화면을 분리 권고

### 확정하지 않은 것 (메인 결정 사항)

- 보상·강화 비용·등급 임계값 수치 (Lab 값은 검증용: 급여 1,000/1,400/1,800 · 강화 350×레벨 · 등급 7/10)
- 주문 4종 이상 확장, 주문 반복 시 보상 감소 여부
- 신규 발견 연출의 최종 디자인

## 5. 후속

- 메인 저장소에 `[적용]` 이슈로 위 채택 기준 전달 (양방향 링크)
- 서버 저장·계정 동기화·앱인토스 SDK 연동은 별도 트랙

---

## 6. 변경 이력: 이해도·제작 메타 루프 개편 (#220 트랙 · 2026-08-29)

기획 협의로 '납품 즉시 도감 등록·보유' 구조를 아래로 개편했다. 관련 이슈: [#220](https://github.com/aigemro/dream-bike-garage-lab/issues/220) [#221](https://github.com/aigemro/dream-bike-garage-lab/issues/221) [#222](https://github.com/aigemro/dream-bike-garage-lab/issues/222) [#223](https://github.com/aigemro/dream-bike-garage-lab/issues/223)

> 주문 납품 → 자전거 **이해도 +50%** → 100%에 **도감 등록(제작 가능)** → Garage에서 **급여로 부품 4종을 하나씩 장착해 완성(보유)** → Garage에서 자전거 **클릭으로 성장**

### 데이터 모델 변경

```text
CollectionProgress v2   { understandingByBikeId, registeredBikeIds(등록), craftedBikeIds(완성),
                          craftPartsByBikeId(제작 진행), newBikeIds, selectedBikeId, showcaseSlots }
CRAFT_PARTS             프레임 400 · 휠셋 300 · 구동계 200 · 핸들바 100 (합 1,000 = 첫 급여)
GrowthProgress v2       { statsByBikeId } — 완성 자전거별 독립 성장
NextGoal                craft(제작) → understand(이해도 학습) → upgrade(강화) → repeat
```

- 저장 스키마: 컬렉션 v1→v2 마이그레이션(기존 보유 = 이해도 100%·등록·완성 승계), 성장 v1→v2 마이그레이션(단일 드림 바이크 스탯 → 자전거별 스탯 승계)
- 원자 처리 3종: 납품 이해도 반영 / 부품 장착+코인 차감(+완성 승격) / 강화+코인 차감 (완성 자전거만)
- 등록 ≠ 보유: 전시·수집 수·성장은 완성 자전거만

### 검증 (Vitest 37건 + 실제 화면 구동)

- 납품 1회 "이해도 0% → 50%" 배너, 2회째 "도감 등록! … 제작 가능" 배너 확인
- 홈 NEXT GOAL·만들기 버튼(조립 N/4) → 제작 화면(미장착 부품 반투명 + 부품 슬롯 4개) → 4종 장착 시 완성 승격·저장 확인
- Garage 대표 자전거 클릭 → 성장 화면 진입, 강화 결과가 자전거별로 저장(v2 statsByBikeId) 확인
- 중복 납품·연속 강화 입력·저장 손상·새 게임 초기화 방어 테스트 통과

### 메인 적용 시 추가 결정 사항

- 납품 1회당 이해도 상승치(Lab 50%)와 자전거별 차등 여부
- 부품 제작 비용·등급별 차등, 제작 시간(즉시 vs 대기) 도입 여부
- 주문 순환이 고정 순서(0→1→2)라 특정 자전거 이해도만 올리는 선택권이 없음 — 주문 선택 UI 필요 여부
