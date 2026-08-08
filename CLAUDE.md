# CLAUDE.md

에이전트 공통 규칙은 [AGENTS.md](AGENTS.md)를 단일 기준으로 따릅니다.

핵심만 요약하면:

- 이 저장소는 **Dream Bike Garage의 실험실(Lab)** 입니다. 최종 규칙 결정·채택 결정·출시 코드는 메인 저장소([aigemro/dream-bike-garage](https://github.com/aigemro/dream-bike-garage)) 담당이며, Lab은 비교 프로토타입과 검증 결과만 제공합니다.
- Lab 코드는 메인에 그대로 복사하지 않습니다.
- 검증 기준은 `npm run build` 통과입니다 (테스트 프레임워크 없음).
- 메인과의 역할 경계는 [docs/PROJECT_BOUNDARY.md](docs/PROJECT_BOUNDARY.md), 실험 운영은 [docs/EXPERIMENT_GUIDE.md](docs/EXPERIMENT_GUIDE.md)를 따릅니다.
