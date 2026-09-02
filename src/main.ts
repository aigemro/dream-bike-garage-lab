import Phaser from 'phaser';
import './styles.css';
import variantDocs from './variant-docs';
import { startMergePrototype, type MergePrototypeMode } from './merge-prototype';
import { startGameScreenMobilePrototype } from './game-screen-mobile';
import { startRewardSettlementPrototype } from './reward-settlement-design';
import { startGuideOverlayPrototype } from './guide-overlay-design';
import { startSettingsDrawerPrototype } from './settings-design';
import { startTitleLoadingPrototype } from './title-loading-design';
import { startCollectionPrototype, type CollectionPrototypeMode } from './collection-prototype';
import { startSupplyPrototype, type SupplyPrototypeMode } from './supply-prototype';
import { startRewardPrototype, type RewardPrototypeMode } from './reward-prototype';
import { startAssemblyPrototype, type AssemblyPrototypeMode } from './assembly-prototype';
import { startHomePlayPrototype, type HomePlayPrototypeMode } from './home-play-prototype';
import { startHomeDesignPrototype, type HomeDesignPrototypeMode } from './home-design-prototype';
import { startBikeCollectionDesignPrototype, type BikeCollectionDesignMode } from './bike-collection-design-prototype';
import { startProfileDesignPrototype, type ProfileDesignMode } from './profile-design-prototype';
import { startArtAudioPrototype, type ArtAudioPrototypeMode } from './art-audio-prototype';
import { startInputPrototype, type InputPrototypeMode } from './input-prototype';
import { startStoragePrototype, type StoragePrototypeMode } from './storage-prototype';
import { startIntegratedSavePrototype } from './integrated-save-prototype';
import { startGameSystemPrototype, type GameSystemPrototypeMode } from './game-system-prototype';
import { startBoardSizePrototype, type BoardSizeMode } from './board-size-prototype';
import { startCoreLoopPrototype, type CoreLoopPrototypeMode } from './core-loop-prototype';
import { startMvpReleaseIntegration } from './mvp-release-integration';
import { startDayAccountIntegration } from './day-account-integration';
import { startRaceScenePrototype, type RaceSceneMode } from './race-scene-prototype';
import garage16Bit from './assets/background-art/garage-16bit.png';
import garage32Bit from './assets/background-art/garage-32bit.png';
import garageUiFriendly from './assets/background-art/garage-ui-friendly.png';

type Status = '체험 가능' | '준비 중';
type GameScreenDesignMode = 'warm-pixel-game-garage' | 'warm-pixel-game-mobile';
type ScreenDesignMode = 'reward-settlement' | 'guide-overlay' | 'settings-drawer' | 'title-loading';
type Variant = {
  id: string;
  label: string;
  title: string;
  description: string;
  status: Status;
  question: string;
  controls: string;
  demo?: MergePrototypeMode;
  collectionDemo?: CollectionPrototypeMode;
  supplyDemo?: SupplyPrototypeMode;
  rewardDemo?: RewardPrototypeMode;
  assemblyDemo?: AssemblyPrototypeMode;
  homePlayDemo?: HomePlayPrototypeMode;
  homeDesignDemo?: HomeDesignPrototypeMode;
  gameScreenDesignDemo?: GameScreenDesignMode;
  screenDesignDemo?: ScreenDesignMode;
  collectionDesignDemo?: BikeCollectionDesignMode;
  profileDesignDemo?: ProfileDesignMode;
  artAudioDemo?: ArtAudioPrototypeMode;
  inputDemo?: InputPrototypeMode;
  storageDemo?: StoragePrototypeMode | 'integrated-auto';
  systemDemo?: GameSystemPrototypeMode;
  boardSizeDemo?: BoardSizeMode;
  coreLoopDemo?: CoreLoopPrototypeMode;
  releaseIntegrationDemo?: 'vertical-slice';
  dayAccountDemo?: 'active-time-soft-day';
  raceDemo?: RaceSceneMode;
  imageDemo?: string;
  issueNumber: number;
  documentId: string;
};
type Track = {
  id: string;
  group: 'MVP CORE PLAY' | 'META PROGRESSION' | 'SCREEN DESIGN' | 'ART & AUDIO' | 'PLATFORM & TECHNOLOGY' | 'RELEASE INTEGRATION';
  title: string;
  description: string;
  issueNumber?: number;
  variants: Variant[];
};

const screenDesignLabels: Record<ScreenDesignMode, string> = {
  'reward-settlement': '홈 A안 시각 언어 · 390×810 · 동일 정산 데이터',
  'guide-overlay': '게임 화면 B안 기준 · 390×810 · 동일 안내 6단계',
  'settings-drawer': '홈 A안 시각 언어 · 390×810 · 동일 설정 항목',
  'title-loading': '홈 A안 시각 언어 · 390×810 · 앱 시작 첫인상',
};
const screenDesignStarters: Record<ScreenDesignMode, (parent: string) => Phaser.Game> = {
  'reward-settlement': startRewardSettlementPrototype,
  'guide-overlay': startGuideOverlayPrototype,
  'settings-drawer': startSettingsDrawerPrototype,
  'title-loading': startTitleLoadingPrototype,
};

const tracks: Track[] = [
  {
    id: 'order-repeat', group: 'MVP CORE PLAY', title: '주문 목표·반복 플레이', issueNumber: 144,
    description: '초기 주문 3종의 학습 흐름과 이후 변형 주문이 계속 플레이할 목표를 만드는지 검증합니다.',
    variants: [
      { id: 'cycle-set', label: 'A안', title: '순환 주문 세트', description: '어반 로드·MTB·그래블을 순서대로 학습한 뒤 요구 레벨과 보상이 오른 변형 주문을 반복합니다.', status: '체험 가능', question: '초기 3종 이후에도 다음 변형 주문이 분명한 재플레이 목표를 만드는가?', controls: '현재 주문 완료를 눌러 주문 3종을 진행하고, 2회차에서 요구 레벨·보상과 다음 목표가 어떻게 바뀌는지 확인합니다.', coreLoopDemo: 'order-cycle', issueNumber: 144, documentId: 'order-cycle' },
    ],
  },
  {
    id: 'board-recovery', group: 'MVP CORE PLAY', title: '보드 막힘·복구', issueNumber: 145,
    description: '빈 칸과 유효 머지가 없는 상태를 감지하고 핵심 플레이로 되돌리는 구제 규칙을 비교합니다.',
    variants: [
      { id: 'free-cleanup', label: 'A안', title: '1회 무료 정리', description: '낮은 레벨의 불필요 부품 한 개를 무료로 정리하고 주문 부품을 보급해 유효 머지로 복귀합니다.', status: '체험 가능', question: '무료 정리 1회가 실패감을 줄이면서 막힘 관리의 의미를 유지하는가?', controls: '막힘 진단 → 무료 정리 → 주문 부품 보급 → 유효 머지 순서로 복구하고 행동 수와 상태 변화를 확인합니다.', coreLoopDemo: 'free-cleanup', issueNumber: 145, documentId: 'board-free-cleanup' },
    ],
  },
  {
    id: 'level-design', group: 'META PROGRESSION', title: '레벨 디자인·콘텐츠 해금',
    description: '초반 10레벨에서 규칙을 공개하는 순서와 큰 콘텐츠 해금 기준을 비교합니다.',
    variants: [
      { id: 'linear', label: 'A안', title: '레벨 선형 해금', description: '레벨마다 새 규칙과 콘텐츠를 한 단계씩 공개합니다.', status: '체험 가능', question: '가장 예측 가능하고 이해하기 쉬운 초반 진행인가?', controls: '현재 레벨 주문을 반복 완료하며 Lv.1~10 공개 순서와 성장 속도를 확인합니다.', systemDemo: 'level-linear', issueNumber: 106, documentId: 'level-linear' },
      { id: 'chapter', label: 'B안', title: '주문 챕터 해금', description: '세 개의 주문을 하나의 챕터로 묶어 다음 콘텐츠를 공개합니다.', status: '체험 가능', question: '작은 목표 묶음이 진행 방향과 완주감을 더 잘 전달하는가?', controls: '주문을 완료해 챕터 단위 해금과 다음 목표의 가시성을 확인합니다.', systemDemo: 'level-chapter', issueNumber: 106, documentId: 'level-chapter' },
      { id: 'career', label: 'C안', title: '직급·Garage 결합 해금', description: '레벨과 직급 구간을 함께 사용해 큰 기능을 공개합니다.', status: '체험 가능', question: '직급 게이트가 장기 성장 목표를 더 선명하게 만드는가?', controls: '레벨 진행과 직급 게이트가 콘텐츠 공개에 미치는 영향을 확인합니다.', systemDemo: 'level-career', issueNumber: 106, documentId: 'level-career' },
    ],
  },
  {
    id: 'career-rank', group: 'META PROGRESSION', title: '직급·커리어 성장',
    description: '견습 알바에서 샵 오너까지 승진하는 조건과 기능 해금 체감을 비교합니다.',
    variants: [
      { id: 'auto', label: 'A안', title: '레벨 자동 승진', description: '기준 레벨에 도달하면 자동으로 다음 직급이 됩니다.', status: '체험 가능', question: '추가 조건 없는 승진이 캐주얼 성장에 가장 적합한가?', controls: '주문으로 경험치를 얻어 자동 승진 속도와 기능 해금을 확인합니다.', systemDemo: 'career-auto', issueNumber: 107, documentId: 'career-auto' },
      { id: 'mission', label: 'B안', title: '승진 과제형', description: '레벨과 지정 주문을 모두 완료해야 승진합니다.', status: '체험 가능', question: '대표 과제가 승진의 성취감을 높이는가?', controls: '레벨과 승진 주문 조건을 채운 뒤 승진 판정을 실행합니다.', systemDemo: 'career-mission', issueNumber: 107, documentId: 'career-mission' },
      { id: 'collection', label: 'C안', title: '성과·수집 복합형', description: '레벨·주문·자전거 수집을 함께 승진 조건으로 사용합니다.', status: '체험 가능', question: '복합 목표가 장기 동기를 높이면서도 과도하지 않은가?', controls: '주문과 수집 조건을 함께 달성해 승진 조건의 이해도와 부담을 비교합니다.', systemDemo: 'career-collection', issueNumber: 107, documentId: 'career-collection' },
    ],
  },
  {
    id: 'difficulty-economy', group: 'META PROGRESSION', title: '주문 난이도·게임 경제',
    description: '주문 시간·행동 수·수입·소비를 같은 형식으로 측정해 성장 곡선을 비교합니다.',
    variants: [
      { id: 'fixed', label: 'A안', title: '고정 난이도·보상 곡선', description: '주문 순서에 따라 요구량과 보상이 예측 가능하게 증가합니다.', status: '체험 가능', question: '예측 가능한 곡선이 정체 없이 안정적으로 성장시키는가?', controls: '주문을 반복 완료하고 평균 시간·행동·수입과 Garage 비용을 비교합니다.', systemDemo: 'economy-fixed', issueNumber: 108, documentId: 'economy-fixed' },
      { id: 'performance', label: 'B안', title: '성과 기반 보너스 곡선', description: '행동 효율과 완료 시간에 따라 추가 보상을 받습니다.', status: '체험 가능', question: '성과 보너스가 재도전 동기를 만들면서 격차를 과도하게 벌리지 않는가?', controls: '빠르게 주문을 완료해 고정안과 주문당 평균 수입을 비교합니다.', systemDemo: 'economy-performance', issueNumber: 108, documentId: 'economy-performance' },
      { id: 'choice', label: 'C안', title: '주문 선택형 경제', description: '쉬운 일반 주문과 어려운 고보상 주문 중 하나를 선택합니다.', status: '체험 가능', question: '난이도와 보상의 선택이 의미 있는 판단을 만드는가?', controls: '두 주문을 번갈아 완료하고 행동 수 대비 수입을 확인합니다.', systemDemo: 'economy-choice', issueNumber: 108, documentId: 'economy-choice' },
    ],
  },
  {
    id: 'feedback-presentation', group: 'ART & AUDIO', title: '게임 피드백·연출',
    description: '동일 이벤트에서 연출의 길이와 강도를 바꿔 결과 인지·손맛·반복 피로를 비교합니다.',
    variants: [
      { id: 'casual', label: 'A안', title: '빠른 캐주얼 연출', description: '짧은 확대와 색상 피드백으로 플레이 템포를 유지합니다.', status: '체험 가능', question: '최소 연출만으로 결과가 충분히 명확한가?', controls: '여섯 이벤트를 반복 실행해 짧은 연출의 인지성과 피로도를 확인합니다.', systemDemo: 'feedback-casual', issueNumber: 109, documentId: 'feedback-casual' },
      { id: 'mechanical', label: 'B안', title: '기계적 조립감 연출', description: '흡착·체결·금속성 움직임으로 조립 과정을 강조합니다.', status: '체험 가능', question: '조립감 강화가 추가 대기시간보다 큰 가치를 주는가?', controls: '머지·장착 이벤트의 체결선과 연출 길이를 A/C와 비교합니다.', systemDemo: 'feedback-mechanical', issueNumber: 109, documentId: 'feedback-mechanical' },
      { id: 'reward', label: 'C안', title: '완성·보상 강조 연출', description: '완성차·납품·승진 같은 중요 순간을 크게 보여줍니다.', status: '체험 가능', question: '큰 연출이 중요 순간의 성취감을 높이면서 반복을 방해하지 않는가?', controls: '중요 이벤트를 반복해 650ms 강조 연출의 성취감과 피로도를 확인합니다.', systemDemo: 'feedback-reward', issueNumber: 109, documentId: 'feedback-reward' },
    ],
  },
  {
    id: 'background-art', group: 'ART & AUDIO', title: '배경 디자인·Garage 공간 연출',
    description: '동일한 자전거 작업실을 서로 다른 픽셀 밀도와 UI 여백으로 표현해 감성·가독성·제작 비용을 비교합니다.',
    issueNumber: 119,
    variants: [
      { id: 'pixel-16bit', label: 'A안', title: '정통 16비트 픽셀 공방', description: '굵은 실루엣과 제한된 색상으로 복고적인 작업실 감성을 강조합니다.', status: '체험 가능', question: '강한 픽셀 정체성이 모바일 가독성과 따뜻한 작업실 감성을 함께 전달하는가?', controls: '390×810 기준으로 중앙 자전거, 주문 게시판, 상·하단 UI 여백과 반복 노출 피로도를 확인합니다.', imageDemo: garage16Bit, issueNumber: 120, documentId: 'background-16bit' },
      { id: 'pixel-32bit', label: 'B안', title: '고밀도 32비트 생활형 픽셀', description: '풍부한 공구·부품·질감과 섬세한 조명으로 생활감과 수집 공간의 디테일을 강화합니다.', status: '체험 가능', question: '풍부한 공간 디테일이 애착을 높이면서 플레이 UI와 경쟁하지 않는가?', controls: '작은 화면에서 디테일이 뭉치지 않는지, 중앙 자전거의 주목도와 완성차 전시 확장성을 확인합니다.', imageDemo: garage32Bit, issueNumber: 121, documentId: 'background-32bit' },
      { id: 'ui-friendly', label: 'C안', title: '픽셀 배경 + 캐주얼 UI 친화형', description: '중간 수준의 픽셀 디테일과 넓은 저밀도 영역으로 모바일 UI가 올라갈 공간을 확보합니다.', status: '체험 가능', question: '픽셀 생활감은 유지하면서 주문·PLAY·성장 UI를 가장 명확하게 수용하는가?', controls: '상·하단 UI 안전 영역, 배경 대비, 중앙 자전거 식별성과 Garage 성장 표현의 확장성을 확인합니다.', imageDemo: garageUiFriendly, issueNumber: 122, documentId: 'background-ui-friendly' },
    ],
  },
  {
    id: 'character-art', group: 'ART & AUDIO', title: '캐릭터 디자인·표현 방향',
    description: '플레이어·점장·고객 NPC의 비율, 실루엣, 초상화와 감정 표현 방향을 비교합니다.', issueNumber: 125,
    variants: [
      { id: 'warm-pixel-characters', label: 'A안', title: '따뜻한 생활형 픽셀 정비사·고객', description: '홈 A안의 목재 Garage에 맞춘 독자적 3등신 캐릭터와 역할별 색·소품·감정 초상화를 비교합니다.', status: '체험 가능', question: '작은 필드 캐릭터와 큰 대화 초상화에서 역할과 감정이 일관되게 읽히는가?', controls: '정비사·점장·고객을 바꾸고 기본·기쁨·고민 감정을 눌러 실루엣과 초상화 연결을 확인합니다.', artAudioDemo: 'character-warm-pixel', issueNumber: 133, documentId: 'character-warm-pixel' },
    ],
  },
  {
    id: 'ui-icon-art', group: 'ART & AUDIO', title: 'UI·아이콘 아트 방향',
    description: '픽셀 배경 위에서 주문·부품·재화·상태 정보를 명확하게 전달하는 시각 체계를 비교합니다.', issueNumber: 126,
    variants: [
      { id: 'workshop-paper-ui', label: 'A안', title: '종이·목재 픽셀 공방 UI', description: '홈 A안의 크림 종이·목재 프레임을 주문 카드, 부품 타일, 재화와 상태 아이콘으로 확장합니다.', status: '체험 가능', question: '따뜻한 픽셀 감성을 유지하면서 READY·부족·잠금 상태가 색상 없이도 구분되는가?', controls: '기본·완료 가능·잠금 상태를 전환해 아이콘 형태, 텍스트와 배지의 중복 정보 전달을 확인합니다.', artAudioDemo: 'ui-warm-pixel', issueNumber: 134, documentId: 'ui-warm-pixel' },
    ],
  },
  {
    id: 'animation-motion', group: 'ART & AUDIO', title: '애니메이션·모션 표현 방향',
    description: '캐릭터 행동, 부품 머지, 자전거 조립과 화면 전환의 움직임과 제작 범위를 비교합니다.', issueNumber: 127,
    variants: [
      { id: 'cozy-short-motion', label: 'A안', title: '짧고 포근한 픽셀 모션', description: '흡착·스쿼시·체결·반짝임을 0.4초 이하로 조합해 홈 A안의 포근함과 빠른 템포를 함께 유지합니다.', status: '체험 가능', question: '짧은 픽셀 모션만으로 머지·장착·완성 결과가 명확하고 반복 입력을 방해하지 않는가?', controls: 'MERGE·장착·완성 버튼을 반복해 연출 길이, 결과 인지와 반복 피로를 확인합니다.', artAudioDemo: 'motion-warm-pixel', issueNumber: 135, documentId: 'motion-warm-pixel' },
    ],
  },
  {
    id: 'background-music', group: 'ART & AUDIO', title: '배경음악·공간 분위기',
    description: 'Garage 홈과 플레이 상태에 어울리는 음악 방향, 반복 피로와 전환 규칙을 비교합니다.', issueNumber: 128,
    variants: [
      { id: 'cozy-garage-chiptune', label: 'A안', title: '포근한 Garage 칩튠 루프', description: '홈 A안의 햇살과 목재 공방 분위기를 짧은 절차 생성 칩튠으로 표현하고 HOME·WORK 변주를 비교합니다.', status: '체험 가능', question: '포근한 칩튠이 Garage 생활감을 높이고 상태 전환 후에도 반복 피로 없이 이어지는가?', controls: 'PLAY MUSIC을 누른 뒤 HOME·WORK를 전환하고 루프 연결, 분위기 차이와 반복 피로를 확인합니다.', artAudioDemo: 'music-warm-pixel', issueNumber: 136, documentId: 'music-warm-pixel' },
    ],
  },
  {
    id: 'sound-effects', group: 'ART & AUDIO', title: '효과음·조작 피드백',
    description: '탭·생성·머지·장착·납품·보상의 소리와 기계적 조립감의 균형을 비교합니다.', issueNumber: 129,
    variants: [
      { id: 'soft-workshop-sfx', label: 'A안', title: '부드러운 공방 조작 피드백', description: '짧은 목재 톡, 상자 팝, 상승음, 체결 클릭과 벨을 낮은 음량으로 구성해 홈 A안의 포근함을 유지합니다.', status: '체험 가능', question: '핵심 행동 여섯 가지가 소리만으로 구분되면서 연속 입력에서도 과도하지 않은가?', controls: '탭·생성·머지·장착·납품·보상 타일을 반복해 구분감과 반복 피로를 확인합니다.', artAudioDemo: 'sfx-warm-pixel', issueNumber: 137, documentId: 'sfx-warm-pixel' },
    ],
  },
  {
    id: 'home-screen-design', group: 'SCREEN DESIGN', title: '홈 화면 디자인',
    description: '회의안 기반 Garage 홈의 정보 구조와 데이터를 고정하고, 실제 게임 화면의 아트 스타일·UI·공간 연출만 바꿔 비교합니다.',
    variants: [
      { id: 'warm-pixel-garage', label: 'A안', title: '따뜻한 생활형 픽셀 Garage', description: '목재 공방과 계절감 있는 창밖 풍경 위에 중앙 드림 바이크와 하단 PLAY를 선명하게 배치합니다.', status: '체험 가능', question: '따뜻한 픽셀 생활감이 Garage 소유감을 높이면서 주문·PLAY·수집 UI의 가독성을 유지하는가?', controls: '대표 자전거와 수집 목표를 확인하고 PLAY로 작업 화면에 진입한 뒤 HOME으로 돌아와 화면 흐름을 비교합니다.', homeDesignDemo: 'warm-pixel-garage', issueNumber: 130, documentId: 'home-design-warm-pixel' },
      { id: 'dusk-workshop', label: 'B안', title: '블루아워 정비소 Garage', description: '해질녘 정비소의 차분한 조명 아래 정비 스탠드 위 상세 드림 바이크를 주인공으로 세웁니다.', status: '체험 가능', question: '차분한 블루아워 정비소 무드가 소유감과 몰입을 높이면서 어두운 배경 위 정보 가독성을 유지하는가?', controls: '동일한 주문·수집 데이터로 상세 자전거 모델과 스포트라이트 연출을 확인하고, 어두운 배경 위 상단 주문과 좌우 메뉴의 가독성을 A안과 비교합니다.', homeDesignDemo: 'dusk-workshop-garage', issueNumber: 141, documentId: 'home-design-dusk-workshop' },
      { id: 'retro-pixel', label: 'C안', title: '레트로 아케이드 픽셀 Garage', description: '굵은 픽셀 격자와 제한 팔레트, 도트 프레임 HUD로 강한 레트로 정체성을 만듭니다.', status: '체험 가능', question: '강한 레트로 픽셀 정체성이 차별화를 만들면서 작은 화면 가독성과 따뜻함을 잃지 않는가?', controls: '픽셀 격자 기반 HUD의 판독성과 중앙 자전거 실루엣을 확인하고, 같은 데이터로 PLAY 진입·복귀 흐름을 비교합니다.', homeDesignDemo: 'retro-pixel-garage', issueNumber: 142, documentId: 'home-design-retro-pixel' },
      { id: 'modern-casual', label: 'D안', title: '모던 캐주얼 모바일 Garage', description: '밝은 그라데이션과 글로시 라운드 카드 등 최신 캐주얼 모바일 게임 UI 문법으로 구성합니다.', status: '체험 가능', question: '익숙한 캐주얼 모바일 UI 문법이 진입 장벽을 낮추면서 Garage 고유의 공방 감성을 잃지 않는가?', controls: '라운드 카드 UI의 정보 계층과 큰 PLAY 버튼의 시인성을 확인하고, 같은 데이터로 A~C안과 비교합니다.', homeDesignDemo: 'modern-casual-garage', issueNumber: 143, documentId: 'home-design-modern-casual' },
    ],
  },
  {
    id: 'game-screen-design', group: 'SCREEN DESIGN', title: '게임 화면 디자인', issueNumber: 166,
    description: 'MVP 핵심 기능 통합의 기능·상태는 그대로 유지하고, 실제 주문·택배·머지·자동 장착 화면의 아트 스타일과 정보 전달만 비교합니다.',
    variants: [
      { id: 'warm-pixel-garage', label: 'A안', title: 'MVP 통합 따뜻한 생활형 픽셀 Garage', description: '홈 A안의 목재 공방·크림 종이 UI·따뜻한 부품 팔레트를 #114 통합 플레이 화면에 적용합니다.', status: '체험 가능', question: '따뜻한 Garage 생활감이 주문·택배·보드·장착 상태의 가독성을 유지하면서 홈에서 작업 화면으로 자연스럽게 이어지는가?', controls: '주문 목표 확인 → 필요한 택배 주문·개봉 → 보드 배치·2-to-1 머지 → 고객 자전거 자동 장착 흐름을 진행하며 #114 기능 화면과 표현 차이를 확인합니다.', gameScreenDesignDemo: 'warm-pixel-game-garage', issueNumber: 166, documentId: 'game-screen-design-warm-pixel' },
      { id: 'warm-pixel-mobile', label: 'B안', title: '모바일 세로 따뜻한 픽셀 Garage', description: '같은 #114 통합 규칙을 홈 A안과 동일한 390×810 세로 화면에 주문 카드 → 머지 보드 → 택배 선반 순서로 재배치합니다.', status: '체험 가능', question: '모바일 세로 폭에서 주문·보드·택배 3영역이 스크롤 없이 읽히고 홈 A안과 같은 Garage로 이어지는가?', controls: '하단 택배 선반에서 주문·개봉 → 보드 배치·2-to-1 머지 → 자동 장착을 진행합니다. 잘못 고른 부품이나 수동 배치는 보드 아래 선택 취소 버튼으로 해제합니다.', gameScreenDesignDemo: 'warm-pixel-game-mobile', issueNumber: 177, documentId: 'game-screen-design-warm-mobile' },
    ],
  },
  {
    id: 'bike-collection-design', group: 'SCREEN DESIGN', title: '자전거 수집 화면 디자인',
    description: '홈 화면 A안의 자전거 탭에서 진입하는 수집 화면을 동일 데이터(8/24)로 고정하고, 도감·전시·드림 바이크 세 형태를 비교합니다.',
    issueNumber: 147,
    variants: [
      { id: 'warm-catalog', label: 'A안', title: '따뜻한 픽셀 자전거 도감', description: '24칸 도감 그리드에서 빈칸을 채우는 수집 화면입니다. 미획득 자전거는 실루엣과 힌트로 다음 목표를 안내합니다.', status: '체험 가능', question: '390 폭에서 24칸 도감이 읽히면서, 빈칸이 다음 수집 동기를 만드는가?', controls: '도감 칸을 눌러 하단 상세 카드를 확인하고 미획득 자전거의 획득 연출을 미리 봅니다. ← HOME으로 홈 축약 화면과의 진입·복귀 흐름을 확인합니다.', collectionDesignDemo: 'warm-catalog', issueNumber: 148, documentId: 'collection-design-catalog' },
      { id: 'warm-showcase', label: 'B안', title: '따뜻한 픽셀 Garage 전시', description: '대표 전시대와 보조 전시대에 보유 자전거를 직접 배치하는 내 공간형 수집 화면입니다.', status: '체험 가능', question: '전시대 배치 상호작용이 자전거 소유감과 애착을 가장 높이는가?', controls: '보관 선반에서 자전거를 선택한 뒤 전시대를 눌러 배치합니다. ← HOME으로 자전거 탭 진입 흐름을 확인합니다.', collectionDesignDemo: 'warm-showcase', issueNumber: 149, documentId: 'collection-design-showcase' },
      { id: 'warm-dream-growth', label: 'C안', title: '따뜻한 픽셀 드림 바이크 성장', description: '한 대의 드림 바이크를 화면 중심에 두고 파츠 강화로 등급을 키우는 집중 성장형 수집 화면입니다.', status: '체험 가능', question: '한 대 집중 성장이 장기 수집 목표를 가장 선명하게 만드는가?', controls: '성능·스타일·희귀도를 강화해 등급 배지와 외형 강조 변화를 확인합니다. ← HOME으로 홈 중앙 자전거와의 연속성을 확인합니다.', collectionDesignDemo: 'warm-dream-growth', issueNumber: 150, documentId: 'collection-design-dream' },
    ],
  },
  {
    id: 'profile-design', group: 'SCREEN DESIGN', title: '프로필 화면 디자인',
    description: '홈 화면 A안의 프로필 탭에서 진입하는 프로필 화면을 동일 데이터로 고정하고, 사원증·승진 보드·기록 대시보드 세 형태를 비교합니다.',
    issueNumber: 157,
    variants: [
      { id: 'warm-id-card', label: 'A안', title: '따뜻한 픽셀 정비사 사원증', description: '정비사 캐릭터·닉네임·직급 스탬프를 담은 사원증 카드가 주인공인 정체성 중심 프로필입니다.', status: '체험 가능', question: '캐릭터와 정체성 중심의 사원증 구성이 Garage 애착을 가장 높이는가?', controls: '사원증 카드와 통계 요약·승진 진행을 확인하고 카드 배경 변경으로 꾸미기 동기를 확인합니다. ← HOME으로 프로필 탭 진입 흐름을 확인합니다.', profileDesignDemo: 'warm-id-card', issueNumber: 158, documentId: 'profile-design-id-card' },
      { id: 'warm-career-board', label: 'B안', title: '따뜻한 픽셀 커리어 승진 보드', description: '견습 알바부터 샵 오너까지 6단계 직급 사다리와 다음 승진 조건이 주인공인 성장 경로 중심 프로필입니다.', status: '체험 가능', question: '승진 로드맵 중심 구성이 장기 목표를 가장 선명하게 만드는가?', controls: '다음 승진 조건 진행 바를 확인하고 직급 단계를 눌러 해금 기능 안내를 봅니다. ← HOME으로 프로필 탭 진입 흐름을 확인합니다.', profileDesignDemo: 'warm-career-board', issueNumber: 159, documentId: 'profile-design-career-board' },
      { id: 'warm-stats-dashboard', label: 'C안', title: '따뜻한 픽셀 작업 기록 대시보드', description: '작업 통계 6타일과 주간 기록 픽셀 그래프가 주인공인 기록 중심 프로필입니다.', status: '체험 가능', question: '숫자와 그래프 중심 구성이 반복 플레이 성취를 가장 잘 보여주는가?', controls: '통계 타일을 눌러 상세 기록을 확인하고 주간 그래프를 납품 ↔ 머지 기록으로 전환합니다. ← HOME으로 프로필 탭 진입 흐름을 확인합니다.', profileDesignDemo: 'warm-stats-dashboard', issueNumber: 160, documentId: 'profile-design-stats-dashboard' },
    ],
  },
  {
    id: 'reward-settlement-design', group: 'SCREEN DESIGN', title: '납품·보상 정산 화면 디자인', issueNumber: 179,
    description: '주문 납품 순간을 급여 수령 → 성장 게이지 → 다음 주문 예고로 잇는 정산 화면을 화면의 주인공을 달리해 비교합니다.',
    variants: [
      { id: 'warm-pay-envelope', label: 'A안', title: '따뜻한 픽셀 급여 봉투', description: '고객이 건네는 급여 봉투를 탭으로 개봉해 코인 상승과 감사 인사를 중심에 둔 성취감 우선 정산입니다.', status: '체험 가능', question: '봉투 개봉의 성취감이 급여와 사용처(성장)의 연결을 3초 안에 전달하는가?', controls: '급여 봉투를 탭해 개봉하고 코인 카운트업·성장 게이지 진행·다음 주문 예고까지의 흐름을 확인합니다.', screenDesignDemo: 'reward-settlement', issueNumber: 179, documentId: 'reward-settlement-envelope' },
    ],
  },
  {
    id: 'guide-overlay-design', group: 'SCREEN DESIGN', title: '첫 플레이 안내 오버레이 디자인', issueNumber: 180,
    description: '#115가 안내 규칙을 비교한다면, 이 트랙은 같은 6단계 안내를 어떤 화면 표현으로 전달할지 비교합니다.',
    variants: [
      { id: 'warm-mechanic-bubble', label: 'A안', title: '따뜻한 픽셀 정비사 말풍선', description: '정비사 두리가 말풍선으로 안내하고 대상 영역만 스포트라이트로 밝히는 캐릭터 중심 안내입니다.', status: '체험 가능', question: '캐릭터 말풍선과 스포트라이트가 다음 행동을 3초 안에 찾게 하면서 보드·버튼을 가리지 않는가?', controls: '다음 버튼으로 첫 주문 6단계 안내를 진행하고, 건너뛰기·안내 다시 보기 진입점과 대상 가림 여부를 확인합니다.', screenDesignDemo: 'guide-overlay', issueNumber: 180, documentId: 'guide-overlay-bubble' },
    ],
  },
  {
    id: 'settings-design', group: 'SCREEN DESIGN', title: '설정 화면 디자인', issueNumber: 181,
    description: '출시 QA 최소 설정(사운드·진동·튜토리얼 재보기·데이터 초기화·버전)을 어떤 화면 형태로 담을지 비교합니다.',
    variants: [
      { id: 'warm-workshop-drawer', label: 'A안', title: '따뜻한 픽셀 공방 관리 서랍', description: '공방 서랍장을 여는 메타포로 나무 스위치 토글과 종이 라벨을 사용하는 공간 몰입형 설정입니다.', status: '체험 가능', question: '서랍장 메타포가 몰입을 유지하면서 토글 상태와 초기화의 위험을 명확히 전달하는가?', controls: '소리 서랍의 나무 스위치 3종을 켜고 끄고, 튜토리얼 다시 보기와 데이터 초기화의 2단계 확인 흐름을 확인합니다.', screenDesignDemo: 'settings-drawer', issueNumber: 181, documentId: 'settings-drawer' },
    ],
  },
  {
    id: 'title-loading-design', group: 'SCREEN DESIGN', title: '타이틀·로딩 화면 디자인', issueNumber: 182,
    description: '앱 실행 직후 홈 화면 전까지의 첫인상(로고·로딩·시작)을 어떤 장면으로 전달할지 비교합니다.',
    variants: [
      { id: 'warm-signboard', label: 'A안', title: '따뜻한 픽셀 공방 간판', description: '사슬에 걸린 목재 간판 로고와 대표 자전거·정비사 장면, 자전거 바퀴 회전 로딩으로 구성한 간판 중심 타이틀입니다.', status: '체험 가능', question: '3초 안에 자전거 공방 게임임이 전달되고 대표 이미지(스토어 스크린샷) 후보로 쓸 구도인가?', controls: '바퀴 로딩과 진행 바가 100%가 되면 TAP TO START로 홈 전환 연출을 확인합니다. 초기화로 로딩부터 다시 볼 수 있습니다.', screenDesignDemo: 'title-loading', issueNumber: 182, documentId: 'title-loading-signboard' },
    ],
  },
  {
    id: 'main-home-play',
    group: 'META PROGRESSION',
    title: '메인 홈·플레이 화면',
    description: '게임 접속 후 계속 머무는 메인 화면에서 플레이와 주요 기능을 어떤 우선순위로 보여줄지 비교합니다.',
    variants: [
      { id: 'play-focus', label: 'A안', title: '플레이 집중형', description: '회의 화이트보드 배치를 바탕으로 머지 보드를 가장 크게 유지합니다.', status: '체험 가능', question: '머지 보드를 우선한 구성이 첫 행동을 가장 명확하게 만드는가?', controls: '보드의 같은 레벨 부품을 차례로 눌러 머지하고, 가장자리 메뉴의 발견성을 확인합니다.', homePlayDemo: 'play-focus', issueNumber: 95, documentId: 'home-play-focus' },
      { id: 'order-focus', label: 'B안', title: '주문·자전거 강조형', description: '현재 주문 자전거와 조립 진행률을 큰 상단 카드로 강조합니다.', status: '체험 가능', question: '주문과 자전거를 먼저 보여주면 목표 이해와 완성 기대감이 높아지는가?', controls: '상단 주문 카드와 보드 사이의 시선 흐름을 확인하고 같은 방식으로 부품을 머지합니다.', homePlayDemo: 'order-focus', issueNumber: 96, documentId: 'home-order-focus' },
      { id: 'hub-focus', label: 'C안', title: '홈 허브 강조형', description: '이벤트·Tour·랭킹의 접근성을 높이면서 중앙 플레이 영역을 유지합니다.', status: '체험 가능', question: '홈 기능 진입성을 높여도 주문과 머지 플레이의 집중도가 유지되는가?', controls: '상단 허브 메뉴를 눌러 피드백을 확인하고 중앙 보드에서 같은 조건으로 머지합니다.', homePlayDemo: 'hub-focus', issueNumber: 97, documentId: 'home-hub-focus' },
      { id: 'garage-lobby', label: 'D안', title: 'Garage 로비·플레이 분리형', description: '중앙 Garage에서 자전거 수집 현황을 확인하고 PLAY로 별도 머지 화면에 진입합니다.', status: '체험 가능', question: '자전거 수집 중심의 로비와 게임 화면을 분리하면 장기 동기와 플레이 집중도가 함께 좋아지는가?', controls: 'Garage의 수집 현황을 확인한 뒤 PLAY로 머지 화면에 진입하고 HOME으로 돌아옵니다.', homePlayDemo: 'garage-lobby', issueNumber: 100, documentId: 'home-garage-lobby' },
      { id: 'garage-agreement', label: 'E안', title: '회의안 기반 Garage 홈', description: '회의 배치대로 중앙에 자전거 수집 Garage를 두고 하단 PLAY로 별도 게임 화면에 진입합니다.', status: '체험 가능', question: '회의에서 합의한 정보 배치와 최근 수집형 로비 패턴을 결합하면 소유감과 다음 행동이 모두 명확한가?', controls: '상단 주문과 좌우 메뉴, 중앙 수집 현황을 확인한 뒤 PLAY로 현재 주문에 진입하고 HOME으로 돌아옵니다.', homePlayDemo: 'garage-agreement', issueNumber: 102, documentId: 'home-garage-agreement' },
    ],
  },
  {
    id: 'merge-core',
    group: 'MVP CORE PLAY',
    title: '머지 코어',
    description: '머지를 만드는 조작과 진행 규칙을 여러 방안으로 구현해 재미와 이해도를 비교합니다.',
    variants: [
      {
        id: 'tap-select',
        label: 'A안',
        title: '자유 보드 2-to-1 머지',
        description: '부품별 점유 크기와 회전·이동을 이용해 공간을 설계한 뒤 같은 부품을 합치는 2차 구현안입니다.',
        status: '체험 가능',
        question: '모바일에서도 가장 단순한 입력만으로 머지 규칙을 쉽게 이해할 수 있는가?',
        controls: '− / +로 보드 크기를 바꾸고 부품을 골라 배치합니다. 부품을 다시 누르면 회전하며, 선택 후 이동·머지하거나 상단 버튼으로 선택 취소할 수 있습니다.',
        demo: 'free', issueNumber: 10, documentId: 'merge-free-board',
      },
      {
        id: 'order-merge',
        label: 'B안',
        title: '주문 목표 중심 머지',
        description: '커스텀 주문에 부품을 직접 추가하고 주문 안에서 자동 머지하는 방식입니다.',
        status: '체험 가능',
        question: '자유 보드보다 목표성과 플레이 템포가 좋아지는가?',
        controls: '오른쪽 부품을 클릭하면 주문에 Lv.1이 추가되며, 같은 레벨 2개는 자동으로 머지됩니다.',
        demo: 'order', issueNumber: 13, documentId: 'merge-order',
      },
      {
        id: 'guided-merge',
        label: 'C안',
        title: '자유 보드 + 주문 가이드',
        description: '자유로운 선행 제작은 유지하면서 현재 주문에 필요한 부품만 최소한으로 안내합니다.',
        status: '체험 가능',
        question: '자유 보드의 공간 관리 재미와 주문 목표의 명확성을 함께 확보할 수 있는가?',
        controls: '원하는 부품을 자유롭게 만들되, 빛나는 목표 표시와 다음 행동 힌트를 참고합니다. 잘못 고른 부품은 상단 선택 취소 버튼으로 해제합니다.',
        demo: 'guided', issueNumber: 25, documentId: 'merge-guided',
      },
      {
        id: 'board-size',
        label: '검증',
        title: '보드 크기·잠금 칸 검증',
        description: '같은 머지 규칙에서 6×7, 7×9, 잠금 해제형 보드 조건만 바꿔 공간 전략과 난이도를 비교합니다.',
        status: '체험 가능',
        question: '어떤 보드 크기와 잠금 칸 구성이 공간 전략의 재미와 난이도 균형에 가장 적합한가?',
        controls: '세 조건을 전환하면 같은 주문과 초기 부품으로 재시작합니다. 같은 종류·레벨 부품을 차례로 눌러 머지하고 공간감과 잠금 해제 성장을 비교합니다.',
        boardSizeDemo: 'board-size',
        issueNumber: 74, documentId: 'merge-board-size',
      },
    ],
  },
  {
    id: 'parts-supply',
    group: 'MVP CORE PLAY',
    title: '부품 수급',
    description: '머지 재료인 부품이 보드에 공급되는 방식을 비교해 플레이 템포와 기대감을 검증합니다.',
    variants: [
      { id: 'instant-button', label: 'A안', title: '즉시 생성 버튼형', description: '생성 버튼을 누르면 부품이 지연 없이 보드에 추가되는 현행 기준선입니다.', status: '체험 가능', question: '지연 없는 공급이 머지 플레이 템포를 가장 잘 유지하는가?', controls: '부품 생성 버튼으로 Lv.1 부품을 추가하고, 부품 탭 → 같은 레벨 탭으로 머지해 Lv.3 부품 2개를 만듭니다.', supplyDemo: 'instant', issueNumber: 71, documentId: 'supply-instant' },
      { id: 'parcel-box', label: 'B안', title: '택배 상자 개봉형', description: '주문한 부품이 택배 상자로 도착하고 상자를 개봉해 부품을 얻습니다.', status: '체험 가능', question: '개봉 연출의 기대감이 템포 저하보다 큰 가치를 주는가?', controls: '부품 주문 → 배송 대기 → 상자 개봉으로 부품을 받고, 같은 목표(Lv.3 ×2)까지의 템포를 A안과 비교합니다.', supplyDemo: 'parcel', issueNumber: 72, documentId: 'supply-parcel' },
      { id: 'cooldown-generator', label: 'C안', title: '쿨다운·충전식 생성기형', description: '충전량이 있는 생성기를 탭해 부품을 뽑고 쿨다운 후 다시 충전되는 장르 표준 방식입니다.', status: '체험 가능', question: '장르 표준 생성기가 주문 단위의 짧은 세션 구조와 잘 맞는가?', controls: '생성기 가동으로 충전량을 소모해 부품을 뽑고, 쿨다운 재충전을 관리하며 같은 목표까지 진행합니다.', supplyDemo: 'generator', issueNumber: 73, documentId: 'supply-generator' },
      { id: 'auto-placement', label: 'D안', title: '배치 미리보기·자동 배치 토글형', description: '수동 배치에는 부품 모양 미리보기를 제공하고, 체크 시 배송 완료 부품을 첫 번째 빈 공간에 자동으로 넣습니다.', status: '체험 가능', question: '선택형 자동 배치가 택배의 반복 클릭을 줄이면서 보드 공간 판단과 수동 배치 이해도를 유지하는가?', controls: '자동 배치 체크박스를 OFF/ON으로 바꾸고 수동·자동 배치를 비교합니다. 수동 배치는 보드 아래 선택 취소로 해제해도 도착 상자가 유지됩니다.', gameScreenDesignDemo: 'warm-pixel-game-mobile', issueNumber: 196, documentId: 'supply-auto-placement' },
    ],
  },
  {
    id: 'reward-progression',
    group: 'META PROGRESSION',
    title: '보상과 성장',
    description: '납품 보상과 성장 구조가 다음 플레이 동기를 만드는 방식을 비교합니다.',
    variants: [
      { id: 'fixed-salary', label: 'A안', title: '고정 급여·직선 성장', description: '납품마다 정해진 급여를 받고 정해진 순서로 성장하는 기준선입니다.', status: '체험 가능', question: '예측 가능한 보상이 안정적인 반복 플레이 동기를 만드는가?', controls: '주문을 납품해 고정 급여를 받고, 정해진 순서대로 성장 항목을 해금합니다.', rewardDemo: 'fixed', issueNumber: 20, documentId: 'reward-fixed-salary' },
      { id: 'performance-bonus', label: 'B안', title: '성과 보너스·성장 선택', description: '납품 성과에 따라 보너스가 달라지고 성장 방향을 직접 선택합니다.', status: '체험 가능', question: '변동 보상과 성장 선택지가 반복 플레이 동기를 높이는가?', controls: '납품 품질을 선택해 성과 보너스를 받고, 원하는 성장 경로에 급여를 투자합니다.', rewardDemo: 'performance', issueNumber: 21, documentId: 'reward-performance-bonus' },
      { id: 'soft-timer', label: 'C안', title: '소프트 타이머·시간 vs 품질', description: '시간 안에 납품하면 시간 보너스, 늦더라도 품질을 높이면 품질 보너스를 받습니다.', status: '체험 가능', question: '시간과 품질 중 선택하는 긴장감이 실제 재미로 이어지는가?', controls: '빠른 기본 품질 납품과 시간이 걸리는 고품질 납품의 보상 차이를 비교합니다. 시간이 지나도 주문은 실패하지 않습니다.', rewardDemo: 'soft-timer', issueNumber: 75, documentId: 'reward-soft-timer' },
    ],
  },
  {
    id: 'race-event', group: 'META PROGRESSION', title: '대회·레이스 보상', issueNumber: 231,
    description: '급여로 참가비를 내고 보유 자전거로 출전하는 자동 관람형 대회가 성장 보상 루프를 만드는지 단일 시점과 하이브리드 중계를 비교합니다.',
    variants: [
      { id: 'side-follow', label: 'A안', title: '사이드뷰 카메라 추적 레이스', description: '카메라가 내 자전거를 따라가는 사이드뷰 트랙에서 리버사이드 서킷 1,200m(직선→오르막→내리막→스퍼트)를 자동 주행합니다.', status: '체험 가능', question: '내 자전거를 따라가는 주행 연출이 몰입감을 주면서, 오르막·내리막 순위 변동과 현재 등수가 읽히는가?', controls: '성장 프리셋(갓 완성/성장 중/드림 완성)을 바꿔 참가비 500코인을 내고 출전합니다. 관람 중 배속 x2로 전환할 수 있고, 완주 후 등수·기록·상금을 정산합니다.', raceDemo: 'side-follow', issueNumber: 231, documentId: 'race-side-follow' },
      { id: 'lane-board', label: 'B안', title: '8레인 전광판 중계 레이스', description: '같은 시뮬레이션 결과를 8레인 전광판으로 중계해 전체 순위 변동을 한눈에 보여줍니다.', status: '체험 가능', question: '전체 조망형 중계가 순위 경쟁의 긴장감을 더 잘 전달하는가, 아니면 내 자전거 몰입이 약해지는가?', controls: 'A안과 같은 참가·정산 흐름에서 레인별 실시간 순위 칩과 결승 체커 통과를 확인하고, 같은 성장 프리셋으로 A안과 등수 체감을 비교합니다.', raceDemo: 'lane-board', issueNumber: 231, documentId: 'race-lane-board' },
      { id: 'hybrid-finish', label: 'C안', title: '장거리 사이드뷰 → 결승 중계 전환', description: '3,000m 중 첫 2,400m는 A안 사이드뷰로 달리고, 마지막 600m는 B안 8레인 전광판으로 자동 전환해 결승 순위 싸움을 보여줍니다.', status: '체험 가능', question: '주행 중에는 내 자전거의 몰입감을 유지하고 결승 직전에는 전체 순위 경쟁을 보여주는 전환이 두 안의 장점을 자연스럽게 결합하는가?', controls: '성장 프리셋을 골라 출전한 뒤 사이드뷰 장거리 주행을 관람합니다. 2,400m 통과 시 LAST 600m 중계 전환과 레인별 순위 변화, 결승 정산까지 확인합니다.', raceDemo: 'hybrid-finish', issueNumber: 231, documentId: 'race-hybrid-finish' },
      { id: 'manual-switch', label: 'D안', title: '버튼 선택형 레이스 중계 전환', description: '3,000m 레이스를 사이드뷰로 시작하고, 관람 중 버튼을 눌러 내 자전거 추적과 8레인 전체 중계를 원하는 시점에 자유롭게 전환합니다.', status: '체험 가능', question: '자동 전환보다 플레이어가 원하는 순간 시점을 선택하는 방식이 관람 몰입과 순위 확인을 더 잘 만족시키는가?', controls: '출전 후 `전체 중계 보기`와 `내 자전거 보기` 버튼을 여러 차례 눌러 시점을 전환합니다. 거리·기록·순위가 끊기지 않고 이어지는지 확인한 뒤 C안 자동 전환과 비교합니다.', raceDemo: 'manual-switch', issueNumber: 231, documentId: 'race-manual-switch' },
    ],
  },
  {
    id: 'collection',
    group: 'META PROGRESSION',
    title: '자전거 수집',
    description: '완성한 자전거를 어떻게 보여주고 성장 동기로 연결할지 비교합니다.',
    variants: [
      { id: 'catalog', label: 'A안', title: '도감형 수집', description: '종류와 등급별 빈칸을 채우는 방식입니다.', status: '체험 가능', question: '미완성 항목이 다음 수집 동기를 만드는가?', controls: '카드를 선택하고 미획득 자전거의 신규 획득 흐름을 체험합니다.', collectionDemo: 'catalog', issueNumber: 14, documentId: 'collection-catalog' },
      { id: 'garage', label: 'B안', title: 'Garage 전시', description: '보유 자전거를 공간에 배치하고 감상하는 방식입니다.', status: '체험 가능', question: '전시가 자전거 소유감과 애착을 높이는가?', controls: '보유 자전거를 선택해 전시대에 배치하고 성장시킵니다.', collectionDemo: 'garage', issueNumber: 12, documentId: 'collection-garage' },
      { id: 'dream-bike', label: 'C안', title: '드림 바이크 성장', description: '한 대의 자전거를 지속적으로 업그레이드하는 방식입니다.', status: '체험 가능', question: '집중 성장 방식이 장기 목표를 더 선명하게 만드는가?', controls: '같은 조건의 코인을 성능·스타일·희귀도에 투자해 등급 변화를 확인합니다.', collectionDemo: 'dream-bike', issueNumber: 60, documentId: 'collection-dream-bike' },
    ],
  },
  {
    id: 'order-assembly',
    group: 'MVP CORE PLAY',
    title: '조립·완성 연출',
    description: '완성 부품을 고객 자전거에 장착하고 단계별 완성과 납품 가능 상태를 전달하는 방식을 검증합니다.',
    variants: [
      { id: 'parts-delivery', label: 'A안', title: '조건 충족 자동 조립', description: '요구 부품을 완성하면 즉시 자전거를 조립합니다.', status: '체험 가능', question: '주문 목표를 가장 빠르게 이해할 수 있는가?', controls: '네 가지 필요 부품을 준비하면 별도 조작 없이 자전거가 자동으로 완성됩니다.', assemblyDemo: 'auto', issueNumber: 17, documentId: 'assembly-auto' },
      { id: 'assembly-slots', label: 'B안', title: '슬롯 조립형', description: '프레임·휠·구동계 슬롯을 모두 채워 자전거를 완성합니다.', status: '체험 가능', question: '자전거를 조립한다는 느낌이 충분히 전달되는가?', controls: '부품을 준비한 뒤 작업대의 해당 슬롯을 눌러 하나씩 직접 장착합니다.', assemblyDemo: 'slots', issueNumber: 18, documentId: 'assembly-slots' },
    ],
  },
  {
    id: 'input-methods',
    group: 'PLATFORM & TECHNOLOGY',
    title: '입력 방식',
    description: '화면 구성과 분리해 탭·드래그 조작을 어떤 규칙으로 처리할지 비교합니다.',
    variants: [
      { id: 'tap-move', label: 'A안', title: '탭 선택·탭 이동', description: '부품과 목적지를 순서대로 탭해 이동하거나 머지합니다.', status: '체험 가능', question: '작은 모바일 화면에서 가장 정확하고 이해하기 쉬운가?', controls: '부품을 탭한 뒤 목적지 칸을 다시 탭합니다.', inputDemo: 'tap', issueNumber: 32, documentId: 'input-tap' },
      { id: 'drag-drop', label: 'B안', title: '직접 드래그 앤 드롭', description: '부품을 직접 끌어 목적지에 놓아 이동하거나 머지합니다.', status: '체험 가능', question: '직접 조작하는 손맛과 의도가 가장 잘 전달되는가?', controls: '부품을 누른 채 끌어서 목적지에 놓습니다. 보드 밖에 놓으면 원위치로 돌아옵니다.', inputDemo: 'drag', issueNumber: 34, documentId: 'input-drag' },
      { id: 'hybrid-input', label: 'C안', title: '탭·드래그 하이브리드', description: '탭과 드래그를 모두 허용하고 같은 명령으로 연결합니다.', status: '체험 가능', question: '선택권을 늘리면서도 입력 규칙의 혼란을 피할 수 있는가?', controls: '짧게 탭하거나 12px 이상 끌어 같은 이동·머지 명령을 수행합니다.', inputDemo: 'hybrid', issueNumber: 37, documentId: 'input-hybrid' },
    ],
  },
  {
    id: 'responsive-layout',
    group: 'PLATFORM & TECHNOLOGY',
    title: '반응형 화면',
    description: '모바일·태블릿·데스크톱에서 보드와 정보 영역을 구성하는 방식을 비교합니다.',
    variants: [
      { id: 'fit-layout', label: 'A안', title: '전체 화면 FIT', description: '고정된 게임 화면 전체를 기기 안에 축소·확대해 맞춥니다.', status: '준비 중', question: '가장 단순한 구조로 화면 잘림을 안정적으로 방지하는가?', controls: '화면 크기와 방향을 바꿔 전체 스케일과 여백을 확인합니다.', issueNumber: 36, documentId: 'responsive-fit' },
      { id: 'reflow-layout', label: 'B안', title: '영역 재배치 반응형', description: '보드·주문·조작 영역을 화면 폭에 맞춰 재배치합니다.', status: '준비 중', question: '각 기기에서 정보성과 조작 크기를 함께 유지하는가?', controls: '모바일 단일 열과 데스크톱 병렬 배치를 비교합니다.', issueNumber: 38, documentId: 'responsive-reflow' },
      { id: 'safe-area-layout', label: 'C안', title: 'Safe Area 중심 적응형', description: '실제 가용 높이와 Safe Area를 기준으로 보드를 우선 보존합니다.', status: '준비 중', question: 'WebView 환경에서도 핵심 보드 크기와 조작 영역을 유지하는가?', controls: '노치·홈 영역과 화면 높이 변화에서 보드와 부가 UI를 확인합니다.', issueNumber: 35, documentId: 'responsive-safe-area' },
    ],
  },
  {
    id: 'persistence',
    group: 'PLATFORM & TECHNOLOGY',
    title: '진행 상태 저장',
    description: '보드와 재화를 유지하는 저장 방식을 단계적으로 비교합니다.',
    variants: [
      { id: 'local-storage', label: 'A안', title: 'localStorage', description: '가장 단순한 브라우저 저장 방식입니다.', status: '체험 가능', question: 'MVP 진행 상태를 충분히 안정적으로 보존하는가?', controls: '상태 변경 → 저장 → 새로고침 → 불러오기 순서로 단일 슬롯 복원을 확인합니다.', storageDemo: 'local', issueNumber: 3, documentId: 'storage-local' },
      { id: 'indexed-db', label: 'B안', title: 'IndexedDB', description: '더 큰 구조화 데이터를 브라우저에 저장합니다.', status: '체험 가능', question: '복잡한 상태와 버전 변경을 관리하기 쉬운가?', controls: '슬롯별로 서로 다른 상태를 저장하고 새로고침 후 선택한 슬롯을 복원합니다.', storageDemo: 'indexed-db', issueNumber: 3, documentId: 'storage-indexed-db' },
      { id: 'integrated-auto', label: 'C안', title: '통합 상태 자동 저장·복구', description: 'MVP 통합 상태(보드·주문·코인·성장·튜토리얼)를 하나의 저장 계약으로 묶고, 백그라운드 전환·페이지 이탈 시 자동 저장합니다.', status: '체험 가능', question: '새로고침·백그라운드 전환·재실행 후에도 통합 진행 상태가 손실 없이 복구되는가?', controls: '상태를 변경한 뒤 새로고침·탭 전환·창 최소화로 자동 저장과 복원을 확인합니다. 저장 삭제로 첫 실행 흐름도 확인합니다.', storageDemo: 'integrated-auto', issueNumber: 5, documentId: 'storage-integrated-auto' },
    ],
  },
  {
    id: 'toss-webview',
    group: 'PLATFORM & TECHNOLOGY',
    title: '앱인토스 WebView',
    description: '토스 앱 내부 환경에서 필요한 기능을 작은 실험으로 분리해 확인합니다.',
    variants: [
      { id: 'lifecycle', label: 'A안', title: '라이프사이클', description: '진입·백그라운드·복귀 시 게임 상태를 확인합니다.', status: '준비 중', question: '앱 전환 뒤에도 게임이 정상 복귀하는가?', controls: '앱 상태를 전환하고 게임 상태를 비교합니다.', issueNumber: 5, documentId: 'toss-lifecycle' },
      { id: 'sdk-bridge', label: 'B안', title: 'SDK 연결', description: '앱인토스 기능을 어댑터를 통해 호출합니다.', status: '준비 중', question: '웹 게임 코드와 플랫폼 기능을 분리할 수 있는가?', controls: '지원 기능 호출과 실패 처리를 확인합니다.', issueNumber: 6, documentId: 'toss-sdk' },
    ],
  },
  {
    id: 'day-account-session',
    group: 'RELEASE INTEGRATION',
    title: 'Day·계정 기반 플레이 세션',
    description: '하루 제한 시간과 로그인 계정별 진행 저장을 기존 MVP 수직 슬라이스에 연결해 세션 시작·중단·복원을 검증합니다.',
    issueNumber: 207,
    variants: [
      { id: 'active-time-soft-day', label: 'B안 · 1차 권장', title: '활성 플레이 시간 + 계정별 진행', description: '테스트 계정으로 로그인하고 최초 프로필을 만든 뒤, 활성 플레이 중에만 Lab용 10초 Day 타이머를 차감합니다. Day·재화·주문·성장·정산 기록은 계정별로 분리 저장됩니다.', status: '체험 가능', question: '백그라운드와 로그아웃에서는 시간이 멈추면서도 Day 제한이 플레이 리듬을 만들고, 계정 전환 뒤 각 진행이 정확히 복원되는가?', controls: '계정 A 로그인 → 프로필 생성 → Day 시작 → 10초 종료·오늘 수입 정산 → 다음 Day → 로그아웃·계정 전환 순서로 확인합니다.', dayAccountDemo: 'active-time-soft-day', issueNumber: 214, documentId: 'day-account-active-time' },
    ],
  },
  {
    id: 'mvp-release-integration',
    group: 'RELEASE INTEGRATION',
    title: 'MVP 릴리스 통합',
    description: '검증된 기능과 최종 화면 디자인·오디오를 하나의 모바일 수직 슬라이스로 연결해 메인 프로젝트 이전 준비 상태를 확인합니다.',
    issueNumber: 113,
    variants: [
      { id: 'vertical-slice', label: '릴리스 통합안', title: '최종 디자인·오디오 MVP 수직 슬라이스', description: '홈 A안 시각 언어를 전체 화면에 적용하고, 주문 완료→컬렉션 해금→드림 바이크 성장→홈 다음 목표로 이어지는 메타 루프를 저장·복구되는 하나의 진행 상태로 연결합니다.', status: '체험 가능', question: '첫 주문부터 다음 주문까지 급여·해금·성장·다음 목표가 끊기지 않고 반복 가능한 메타 루프로 이해되는가?', controls: 'TAP TO START → 홈 PLAY → 택배·머지·자동 장착 → 급여 봉투(신규 자전거 해금) → 도감·전시·성장 → 홈 NEXT GOAL 확인을 진행합니다. 새로고침 후에도 진행이 복구됩니다.', releaseIntegrationDemo: 'vertical-slice', issueNumber: 192, documentId: 'mvp-release-vertical-slice' },
      { id: 'core-features', label: '통합안', title: '머지 코어 C안 + 택배 수급 + 장착·조립', description: 'C안의 자유 배치 보드와 주문 가이드를 그대로 사용하고, 카테고리 택배 수급과 목표 부품의 단계별 자동 장착을 직접 연결합니다.', status: '체험 가능', question: 'C안 보드·주문 가이드 위에서 택배 수급과 장착·조립이 상태 유실이나 진행 막힘 없이 한 주문의 완료까지 이어지는가?', controls: '필요 카테고리 택배 주문 → 배송 → 개봉 → 배치·회전·선택 취소 → 2→1 머지 → 자동 장착 → 주문 완료 순서로 진행합니다.', demo: 'integrated', issueNumber: 114, documentId: 'mvp-integration-core-features' },
    ],
  },
];

const app = document.querySelector<HTMLDivElement>('#app')!;
type DemoHandle = { destroy(removeCanvas?: boolean): void };
let game: DemoHandle | undefined;
const allVariants = tracks.flatMap((track) => track.variants);

function destroyGame() {
  game?.destroy(true);
  game = undefined;
}

function shell(content: string, back?: { href: string; label: string }) {
  app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="#"><span class="brand-mark">DB</span><span><strong>Dream Bike Garage</strong><small>TECHNOLOGY LAB</small></span></a>
      ${back ? `<a class="back" href="${back.href}">← ${back.label}</a>` : '<a class="repo-link" href="https://github.com/aigemro/dream-bike-garage-lab" target="_blank" rel="noreferrer">GitHub 저장소 ↗</a>'}
    </header>
    ${content}
    <footer class="site-footer">Dream Bike Garage · 오늘부터 자전거 부자 <span>LAB v0.2</span></footer>`;
}

function renderHome() {
  destroyGame();
  const groups: Track['group'][] = ['MVP CORE PLAY', 'META PROGRESSION', 'SCREEN DESIGN', 'ART & AUDIO', 'PLATFORM & TECHNOLOGY', 'RELEASE INTEGRATION'];
  const groupCopy: Record<Track['group'], { title: string; description: string }> = {
    'MVP CORE PLAY': { title: 'MVP 핵심 플레이', description: '주문 목표 → 부품 수급 → 머지 → 조립·완성으로 이어지는 한 판의 직접 플레이를 비교합니다.' },
    'META PROGRESSION': { title: '메타 성장', description: '납품 이후의 보상·수집·레벨·커리어가 다음 플레이 목표를 만드는지 검증합니다.' },
    'SCREEN DESIGN': { title: '화면 디자인', description: '홈·플레이·수집·프로필과 보조 화면의 정보 구조, 시선 흐름과 사용성을 화면 단위로 비교합니다.' },
    'ART & AUDIO': { title: '아트·오디오', description: '배경·캐릭터·UI·애니메이션·피드백·음악·효과음의 표현 방안을 비교합니다.' },
    'PLATFORM & TECHNOLOGY': { title: '플레이 기반', description: '입력·반응형 화면·저장·앱인토스처럼 전체 플레이를 지탱하는 기술을 검증합니다.' },
    'RELEASE INTEGRATION': { title: '릴리스 통합', description: '개별 트랙의 선택안을 다시 구현하지 않고 출시 가능한 하나의 MVP 흐름으로 연결해 검증합니다.' },
  };
  shell(`<main>
    <section class="hero">
      <p class="eyebrow">TRACK · VARIANT · COMPARE</p>
      <h1>하나의 기능을<br /><em>여러 방안으로 검증</em></h1>
      <p class="hero-copy">먼저 실험 트랙을 선택하고, 트랙 안에서 서로 다른 구현안을 직접 체험하고 비교합니다.</p>
      <div class="summary"><span><strong>${tracks.length}</strong> 실험 트랙</span><span><strong>${allVariants.length}</strong> 전체 방안</span><span><strong>${allVariants.filter((item) => item.status === '체험 가능').length}</strong> 체험 가능</span></div>
    </section>
    ${groups.map((group) => `<section class="catalog">
      <div class="section-heading"><div><p class="eyebrow">${group}</p><h2>${groupCopy[group].title}</h2></div><p>${groupCopy[group].description}</p></div>
      <div class="grid">${tracks.filter((track) => track.group === group).map((track, index) => `
        <a class="card ${track.variants.some((item) => item.status === '체험 가능') ? 'ready' : ''}" href="#/track/${track.id}">
          <div class="card-index">${String(index + 1).padStart(2, '0')}</div><p class="category">${track.group}</p><h3>${track.title}</h3><p>${track.description}</p>
          <footer><span class="status">${track.variants.length}개 방안 · ${track.variants.filter((item) => item.status === '체험 가능').length}개 체험 가능</span><span class="arrow">→</span></footer>
        </a>`).join('')}</div>
    </section>`).join('')}
  </main>`);
}

function renderTrack(track: Track) {
  destroyGame();
  const trackIssue = track.issueNumber ? `<a class="track-issue" href="https://github.com/aigemro/dream-bike-garage-lab/issues/${track.issueNumber}" target="_blank" rel="noreferrer">Track Issue #${track.issueNumber} ↗</a>` : '';
  shell(`<main class="track-page">
    <section class="experiment-title"><p class="eyebrow">${track.group} · EXPERIMENT TRACK</p><h1>${track.title}</h1><p>${track.description}</p></section>
    <section class="comparison-note"><strong>${track.variants.length ? '비교 원칙' : '트랙 준비 완료'}</strong><span>${track.variants.length ? '각 방안은 독립 URL과 실행 화면을 가지며, 같은 질문과 조건으로 비교합니다.' : '상위 범위와 이슈만 먼저 등록했습니다. Prototype 방안은 추후 이 트랙 아래에 추가합니다.'}</span>${trackIssue}</section>
    ${track.variants.length ? `<div class="variant-grid">${track.variants.map((item) => `
      <a class="variant-card ${item.status === '체험 가능' ? 'ready' : ''}" href="#/track/${track.id}/${item.id}">
        <div class="variant-top"><span class="variant-label">${item.label}</span><span class="status">${item.status}</span></div>
        <h2>${item.title}</h2><p>${item.description}</p>
        <dl><dt>검증 질문</dt><dd>${item.question}</dd></dl><span class="open">방안 확인 →</span>
      </a>`).join('')}</div>` : '<section class="empty-panel"><span>VARIANTS TO BE DEFINED</span><h2>방안은 추후 추가합니다.</h2><p>트랙 이슈에서 범위와 평가 기준을 먼저 정리한 뒤 Prototype A/B/C를 독립 이슈로 연결합니다.</p></section>'}
  </main>`, { href: '#', label: '전체 트랙' });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#039;' })[character]!);
}

function renderMarkdown(markdown: string) {
  return markdown.split('\n').map((line) => {
    if (line.startsWith('## ')) return `<h3>${escapeHtml(line.slice(3))}</h3>`;
    if (line.startsWith('# ')) return `<h2>${escapeHtml(line.slice(2))}</h2>`;
    if (line.startsWith('- ')) return `<li>${escapeHtml(line.slice(2))}</li>`;
    return line.trim() ? `<p>${escapeHtml(line)}</p>` : '';
  }).join('');
}

function renderVariant(track: Track, variant: Variant) {
  destroyGame();
  const issueUrl = `https://github.com/aigemro/dream-bike-garage-lab/issues/${variant.issueNumber}`;
  shell(`<main class="experiment-page variant-detail-page">
    <section class="variant-detail-head">
      <div class="experiment-title"><p class="eyebrow">${track.title} · ${variant.label} · ${variant.status}</p><h1>${variant.title}</h1><p>${variant.description}</p></div>
      <aside class="variant-actions">
        <a class="issue-action" href="${issueUrl}" target="_blank" rel="noreferrer"><span>RELATED ISSUE</span><strong>Issue #${variant.issueNumber}</strong><em>GitHub에서 확인 ↗</em></a>
        ${variant.status === '체험 가능' ? `<a class="primary-action" href="#/track/${track.id}/${variant.id}/demo">체험 화면으로 이동 →</a>` : '<span class="disabled-action">체험 화면 준비 중</span>'}
      </aside>
    </section>
    <article class="implementation-doc"><p class="panel-label">IMPLEMENTATION NOTE · MARKDOWN</p>${renderMarkdown(variantDocs[variant.documentId])}</article>
  </main>`, { href: `#/track/${track.id}`, label: `${track.title} 방안 목록` });
}

function renderDemo(track: Track, variant: Variant) {
  destroyGame();
  const hasDemo = Boolean(variant.demo || variant.collectionDemo || variant.supplyDemo || variant.rewardDemo || variant.assemblyDemo
    || variant.homePlayDemo || variant.homeDesignDemo || variant.gameScreenDesignDemo || variant.screenDesignDemo
    || variant.collectionDesignDemo || variant.profileDesignDemo || variant.artAudioDemo || variant.inputDemo
    || variant.systemDemo || variant.storageDemo || variant.boardSizeDemo || variant.coreLoopDemo
    || variant.releaseIntegrationDemo || variant.dayAccountDemo || variant.raceDemo || variant.imageDemo);
  const demoLabel = variant.raceDemo ? '동일 시뮬레이션·시드 재현 · 참가비 500 · 390×810'
    : variant.dayAccountDemo ? '테스트 계정 A/B · 활성 플레이 시간 · 계정별 자동 저장'
    : variant.releaseIntegrationDemo ? '선택 디자인·오디오·저장 상태 통합 · 390×810'
    : variant.imageDemo ? '동일 Garage 장면 · 390×810 세로 화면'
    : variant.coreLoopDemo ? 'MVP GAME CORE · 간단 상호작용 검증'
    : variant.gameScreenDesignDemo ? (variant.gameScreenDesignDemo === 'warm-pixel-game-mobile' ? '#114 동일 통합 로직 · 390×810 모바일 세로' : '#114 동일 통합 로직 · 홈 A안 따뜻한 픽셀 Garage 표현')
    : variant.screenDesignDemo ? screenDesignLabels[variant.screenDesignDemo]
    : variant.collectionDesignDemo ? '홈 A안 시각 언어 · 자전거 탭 진입 · 동일 수집 데이터 8/24'
    : variant.profileDesignDemo ? '홈 A안 시각 언어 · 프로필 탭 진입 · 동일 프로필 데이터'
    : variant.artAudioDemo ? '홈 화면 A안 공통 스타일 · 390×810 체험'
    : variant.homeDesignDemo ? '회의안 기반 정보 구조 · 동일 데이터 · 시각 언어만 비교'
    : variant.boardSizeDemo ? '동일 주문·초기 부품 · 보드 조건만 변경'
    : variant.storageDemo ? (variant.storageDemo === 'integrated-auto' ? '통합 상태 · 보드·주문·코인·성장·튜토리얼' : '동일 상태 · 보드·재화·주문')
    : variant.systemDemo ? '동일 초반 레벨·주문·직급 데이터'
    : variant.inputDemo ? '동일 6×5 보드 · 동일 초기 부품 · 입력 규칙만 비교'
    : variant.homePlayDemo ? '390×810 · 동일 주문·메뉴·보드 데이터'
    : variant.assemblyDemo ? '동일 주문 · 동일 부품 4종'
    : variant.rewardDemo ? '동일 시작 급여 1,000 · 기본 보상 500'
    : variant.supplyDemo ? '동일 5×4 보드 · 목표 Lv.3 ×2'
    : variant.collectionDemo ? '동일 데이터 · 3,000코인'
    : variant.demo === 'free' ? '4~10 가변 보드 · 4 PARTS · 2차 구현'
    : variant.demo === 'integrated' ? 'C안 화면·보드 기반 · 택배 수급 · 부품별 자동 장착'
    : '6×7 · 4 PARTS';
  shell(`<main class="experiment-page demo-page">
    ${hasDemo ? `<section class="demo-panel"><div class="demo-head"><div><span>${track.title} · ${variant.label} · LIVE DEMO · ${demoLabel}</span><strong>${variant.title}</strong></div>${variant.imageDemo ? '' : '<button id="reset-demo">초기화</button>'}</div>${variant.imageDemo ? `<figure class="background-art-preview"><img src="${variant.imageDemo}" alt="${variant.title} Garage 배경 시안" /></figure>` : `<div id="game-root" class="demo-${variant.raceDemo ?? variant.dayAccountDemo ?? variant.releaseIntegrationDemo ?? variant.gameScreenDesignDemo ?? variant.screenDesignDemo ?? variant.coreLoopDemo ?? variant.boardSizeDemo ?? variant.storageDemo ?? variant.systemDemo ?? variant.inputDemo ?? variant.artAudioDemo ?? variant.homeDesignDemo ?? variant.collectionDesignDemo ?? variant.profileDesignDemo ?? variant.homePlayDemo ?? variant.assemblyDemo ?? variant.rewardDemo ?? variant.supplyDemo ?? variant.collectionDemo ?? variant.demo}"></div>`}<p class="hint">${variant.controls}</p></section>` : `<section class="empty-panel"><span>VARIANT SLOT</span><h2>이 방안은 아직 준비 중입니다.</h2></section>`}
  </main>`, { href: `#/track/${track.id}/${variant.id}`, label: `${variant.title} 상세` });
  if (hasDemo && !variant.imageDemo) {
    const start = () => { destroyGame(); if (variant.raceDemo) { game = startRaceScenePrototype('game-root', variant.raceDemo); return; } if (variant.dayAccountDemo) { game = startDayAccountIntegration('game-root'); return; } if (variant.releaseIntegrationDemo) { game = startMvpReleaseIntegration('game-root'); return; } if (variant.gameScreenDesignDemo) { game = variant.gameScreenDesignDemo === 'warm-pixel-game-mobile' ? startGameScreenMobilePrototype('game-root') : startMergePrototype('game-root', 'integrated', 'warm-pixel'); return; } if (variant.screenDesignDemo) { game = screenDesignStarters[variant.screenDesignDemo]('game-root'); return; } if (variant.coreLoopDemo) { game = startCoreLoopPrototype('game-root', variant.coreLoopDemo) as unknown as Phaser.Game; return; } if (variant.boardSizeDemo) { game = startBoardSizePrototype('game-root', variant.boardSizeDemo) as unknown as Phaser.Game; return; } if (variant.storageDemo) { variant.storageDemo === 'integrated-auto' ? startIntegratedSavePrototype('game-root') : startStoragePrototype('game-root', variant.storageDemo); return; } game = variant.systemDemo ? startGameSystemPrototype('game-root', variant.systemDemo) : variant.inputDemo ? startInputPrototype('game-root', variant.inputDemo) : variant.artAudioDemo ? startArtAudioPrototype('game-root', variant.artAudioDemo) : variant.collectionDesignDemo ? startBikeCollectionDesignPrototype('game-root', variant.collectionDesignDemo) : variant.profileDesignDemo ? startProfileDesignPrototype('game-root', variant.profileDesignDemo) : variant.homeDesignDemo ? startHomeDesignPrototype('game-root', variant.homeDesignDemo) : variant.homePlayDemo ? startHomePlayPrototype('game-root', variant.homePlayDemo) : variant.assemblyDemo ? startAssemblyPrototype('game-root', variant.assemblyDemo) : variant.rewardDemo ? startRewardPrototype('game-root', variant.rewardDemo) : variant.supplyDemo ? startSupplyPrototype('game-root', variant.supplyDemo) : variant.collectionDemo ? startCollectionPrototype('game-root', variant.collectionDemo) : startMergePrototype('game-root', variant.demo!); };
    start();
    document.querySelector('#reset-demo')?.addEventListener('click', start);
  }
}

function route() {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] !== 'track') return renderHome();
  const track = tracks.find((item) => item.id === parts[1]);
  if (!track) return renderHome();
  const variant = track.variants.find((item) => item.id === parts[2]);
  if (!variant) return renderTrack(track);
  parts[3] === 'demo' ? renderDemo(track, variant) : renderVariant(track, variant);
}

window.addEventListener('hashchange', route);
route();
